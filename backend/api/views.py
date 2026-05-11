import logging
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from .models import FaultReport, SystemSetting
from .serializers import (
    FaultReportSerializer,
    SystemSettingSerializer,
    PasswordChangeSerializer,
    UserAccountSerializer,
    AdminUserCreateSerializer,
)
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
        }
    )


class UserAccountViewSet(viewsets.ModelViewSet):
    """Django user accounts — staff-only (Django admin–style access)."""

    queryset = User.objects.all().order_by("username")
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        return UserAccountSerializer

    def destroy(self, request, *args, **kwargs):
        target = self.get_object()
        if target.id == request.user.id:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Only a superuser can delete another superuser account."},
                status=status.HTTP_403_FORBIDDEN,
            )
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
        reply_message = "Thank you for reporting to Waterwise. We have received your fault report and will attend to it."
        send_outbound_sms(reply_message, [phone_number])
    except Exception as e:
        logger.error(f"Failed to send Africa's Talking SMS reply: {e}")

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_sms(request):
    """
    Endpoint for frontend to send outbound SMS via Africa's Talking.
    """
    recipient = request.data.get('recipient')
    message = request.data.get('message')
    
    if not recipient or not message:
        return Response({'error': 'Recipient and message are required'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Ensure recipient is formatted correctly (e.g. +263...)
    if not recipient.startswith('+'):
        return Response({'error': 'Recipient must include country code starting with +'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        response = send_outbound_sms(message, [recipient])
        logger.info(f"Outbound SMS sent to {recipient}: {response}")
        return Response({'status': 'Message sent successfully', 'data': response}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Failed to send Africa's Talking SMS: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

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
