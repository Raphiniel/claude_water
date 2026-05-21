import logging
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from .models import FaultReport, SystemSetting
from .serializers import (
    FaultReportSerializer,
    SystemSettingSerializer,
    PasswordChangeSerializer,
    UserAccountSerializer,
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
    AdminSetPasswordSerializer,
)
from .roles import user_can_configure_sms_gateway, user_primary_role
from gateway.models import Technician
from gateway.sms_service import send_outbound_sms

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user_profile(request):
    """Who am I (for web + mobile after JWT login)."""
    u = request.user
    return Response(
        {
            "id": u.id,
            "username": u.username,
            "email": u.email or "",
            "is_staff": bool(u.is_staff),
            "is_superuser": bool(u.is_superuser),
            "role": user_primary_role(u),
            "can_configure_sms_gateway": user_can_configure_sms_gateway(u),
        }
    )


class UserAccountViewSet(viewsets.ModelViewSet):
    """Django user accounts — staff-only (Django admin–style access)."""

    def get_queryset(self):
        return User.objects.all().order_by("username").prefetch_related("groups")
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def _superuser_guard(self, request, target):
        if target.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Only a superuser can manage superuser accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        if self.action in ("partial_update", "update"):
            return AdminUserUpdateSerializer
        if self.action == "set_password":
            return AdminSetPasswordSerializer
        return UserAccountSerializer

    def _user_response(self, request, user):
        return Response(
            UserAccountSerializer(user, context={"request": request}).data,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserAccountSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        if target.id == request.user.id and request.data.get("is_active") is False:
            return Response(
                {"is_active": ["You cannot disable your own account."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        denied = self._superuser_guard(request, target)
        if denied:
            return denied
        serializer = AdminUserUpdateSerializer(
            target,
            data=request.data,
            partial=True,
            context={"request": request, "instance": target},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return self._user_response(request, user)

    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        target = self.get_object()
        denied = self._superuser_guard(request, target)
        if denied:
            return denied
        serializer = AdminSetPasswordSerializer(
            data=request.data,
            context={"request": request, "instance": target},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        target = self.get_object()
        if target.id == request.user.id:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        denied = self._superuser_guard(request, target)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)


class FaultReportViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = FaultReport.objects.all().order_by('-created_at')
    serializer_class = FaultReportSerializer

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def sms_webhook(request):
    """
    Webhook endpoint for Africa's Talking incoming SMS
    Expected payload includes: from, to, text, date, id, linkId
    """
    phone_number = request.data.get('from')
    message = request.data.get('text')
    
    if not phone_number or not message:
        return Response({'error': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)
        
    report = FaultReport.objects.create(
        phone_number=phone_number,
        message=message,
        status='PENDING'
    )
    
    try:
        reply_message = "Thank you for reporting to WaterWise. We have received your fault report and will attend to it."
        send_outbound_sms(reply_message, [phone_number])
    except Exception as e:
        logger.error(f"Failed to send Africa's Talking SMS reply: {e}")

def _normalize_phone(phone):
    p = str(phone or '').strip()
    if not p:
        return None
    if not p.startswith('+'):
        if p.startswith('0'):
            p = '+263' + p[1:]
        else:
            p = '+' + p
    return p


def _resolve_sms_recipients(recipient_key):
    """Map UI recipient keys to E.164 phone numbers."""
    if recipient_key in ('all_techs', 'all_technicians', 'all_active'):
        qs = Technician.objects.filter(is_active=True).exclude(phone='')
        return [_normalize_phone(p) for p in qs.values_list('phone', flat=True)]
    if recipient_key in ('available_technicians', 'available'):
        qs = Technician.objects.filter(is_active=True, is_available=True).exclude(phone='')
        return [_normalize_phone(p) for p in qs.values_list('phone', flat=True)]
    if isinstance(recipient_key, str) and recipient_key.startswith('tech:'):
        try:
            tech_id = int(recipient_key.split(':', 1)[1])
            tech = Technician.objects.filter(pk=tech_id, is_active=True).first()
            if tech and tech.phone:
                return [_normalize_phone(tech.phone)]
        except (ValueError, TypeError):
            return []
        return []
    phone = _normalize_phone(recipient_key)
    return [phone] if phone else []


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_sms(request):
    """
    Send outbound SMS via Africa's Talking.
    recipient: E.164 number, tech:<id>, all_techs, or available_technicians
    """
    recipient = request.data.get('recipient')
    message = (request.data.get('message') or '').strip()

    if not recipient or not message:
        return Response({'error': 'Recipient and message are required'}, status=status.HTTP_400_BAD_REQUEST)

    phones = [p for p in _resolve_sms_recipients(recipient) if p and p.startswith('+')]
    if not phones:
        return Response(
            {'error': 'No valid recipients. Use +263… or pick technicians with phone numbers.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    sent = []
    errors = []
    for phone in phones:
        try:
            response = send_outbound_sms(message, [phone])
            logger.info('Outbound SMS sent to %s: %s', phone, response)
            sent.append(phone)
        except Exception as e:
            logger.error('Failed to send SMS to %s: %s', phone, e)
            errors.append({'phone': phone, 'error': str(e)})

    if not sent:
        return Response(
            {'error': errors[0]['error'] if errors else 'Send failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            'status': 'ok',
            'sent_count': len(sent),
            'recipients': sent,
            'errors': errors,
        },
        status=status.HTTP_200_OK,
    )
        

class SystemSettingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer

    def list(self, request, *args, **kwargs):
        # We only want one setting object, create it if it doesn't exist
        setting, created = SystemSetting.objects.get_or_create(id=1)
        serializer = self.get_serializer(setting)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response(
                {"detail": "Staff access is required to change system settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Always update the single setting object
        setting, created = SystemSetting.objects.get_or_create(id=1)
        serializer = self.get_serializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def password_change(request):
    serializer = PasswordChangeSerializer(data=request.data)
    if serializer.is_valid():
        user = request.user
        if not user.check_password(serializer.data.get('old_password')):
            return Response({'old_password': ['Wrong password']}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.data.get('new_password'))
        user.save()
        return Response({'status': 'Password updated successfully'}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
