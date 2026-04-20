import logging
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import FaultReport, WaterPoint, SyncBuffer
from .validators import validate_sms_report
from .sms_service import send_confirmation_sms, send_error_sms
from .serializers import FaultReportSerializer, WaterPointSerializer
from rest_framework import viewsets

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class SMSWebhookView(APIView):
    """
    Webhook endpoint for Africa's Talking incoming SMS.
    Must return 200 even on rejection.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        # AT payload: 'from', 'to', 'text', 'date', 'id', 'linkId'
        sender_number = request.data.get('from')
        message_text = request.data.get('text', '')

        if not sender_number:
            logger.warning("Received webhook without sender number.")
            return Response({'status': 'ignored'}, status=status.HTTP_200_OK)

        try:
            # 1. Validate the SMS
            validation_result = validate_sms_report(message_text, sender_number)

            if validation_result['is_valid']:
                # 2. Process valid report
                wp = WaterPoint.objects.get(code=validation_result['parsed']['wp_code'])
                ticket = f"WP{uuid.uuid4().hex[:6].upper()}"
                
                report = FaultReport.objects.create(
                    water_point=wp,
                    fault_code=validation_result['parsed']['fault_code'],
                    sender_number=sender_number,
                    ticket_number=ticket,
                    status='PENDING'
                )
                
                # 3. Send confirmation SMS
                send_confirmation_sms(sender_number, ticket, wp.code)
                logger.info(f"Report saved and ticket {ticket} generated for {sender_number}")
            else:
                # 4. Handle invalid report - save to SyncBuffer
                SyncBuffer.objects.create(
                    raw_message=message_text,
                    sender_number=sender_number,
                    error_message=validation_result['error_message'],
                    is_synced=False
                )
                
                # 5. Send error reply
                send_error_sms(sender_number, validation_result['error_message'])
                logger.info(f"Invalid report from {sender_number} buffered.")

        except Exception as e:
            logger.error(f"Error processing SMS webhook: {e}")
            # Ensure we return 200 to AT
            return Response({'status': 'error', 'detail': str(e)}, status=status.HTTP_200_OK)

        return Response({'status': 'success'}, status=status.HTTP_200_OK)

class FaultReportListView(generics.ListAPIView):
    """
    Dashboard API returning live reports.
    Supports filtering by status (e.g., ?status=PENDING)
    """
    serializer_class = FaultReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = FaultReport.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

class WaterPointViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Water Points.
    """
    queryset = WaterPoint.objects.all()
    serializer_class = WaterPointSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Optional: Add any custom creation logic here
        serializer.save()
