import logging
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import FaultReport, SystemSetting
from .serializers import FaultReportSerializer, SystemSettingSerializer, PasswordChangeSerializer
import africastalking
from django.conf import settings

logger = logging.getLogger(__name__)

# Initialize Africa's Talking
africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
sms = africastalking.SMS

class FaultReportViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = FaultReport.objects.all().order_by('-created_at')
    serializer_class = FaultReportSerializer

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
        sms.send(reply_message, [phone_number])
    except Exception as e:
        logger.error(f"Failed to send Africa's Talking SMS reply: {e}")
        

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
