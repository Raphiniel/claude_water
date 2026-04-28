import logging
import uuid
import math
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import viewsets

from .models import FaultReport, WaterPoint, SyncBuffer, Technician
from .validators import validate_sms_report
from .sms_service import send_confirmation_sms, send_error_sms
from .serializers import FaultReportSerializer, WaterPointSerializer, TechnicianSerializer

logger = logging.getLogger(__name__)


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@method_decorator(csrf_exempt, name='dispatch')
class SMSWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        sender_number = request.data.get('from')
        message_text = request.data.get('text', '')

        if not sender_number:
            return Response({'status': 'ignored'}, status=status.HTTP_200_OK)

        try:
            validation_result = validate_sms_report(message_text, sender_number)

            if validation_result['is_valid']:
                wp = WaterPoint.objects.get(code=validation_result['parsed']['wp_code'])
                ticket = f"WP{uuid.uuid4().hex[:6].upper()}"
                FaultReport.objects.create(
                    water_point=wp,
                    fault_code=validation_result['parsed']['fault_code'],
                    sender_number=sender_number,
                    ticket_number=ticket,
                    status='PENDING'
                )
                send_confirmation_sms(sender_number, ticket, wp.code)
                logger.info(f"Report saved, ticket {ticket} for {sender_number}")
            else:
                SyncBuffer.objects.create(
                    raw_message=message_text,
                    sender_number=sender_number,
                    error_message=validation_result['error_message'],
                    is_synced=False
                )
                send_error_sms(sender_number, validation_result['error_message'])

        except Exception as e:
            logger.error(f"Error processing SMS webhook: {e}")
            return Response({'status': 'error', 'detail': str(e)}, status=status.HTTP_200_OK)

        return Response({'status': 'success'}, status=status.HTTP_200_OK)


class FaultReportListView(generics.ListAPIView):
    serializer_class = FaultReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = FaultReport.objects.select_related('water_point', 'assigned_to').order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        return queryset


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_report(request, pk):
    try:
        report = FaultReport.objects.select_related('water_point').get(pk=pk)
    except FaultReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

    technician_id = request.data.get('technician_id')

    if technician_id == 'nearest':
        wp = report.water_point
        if not wp.latitude or not wp.longitude:
            return Response({'error': 'Water point has no coordinates for proximity search'}, status=status.HTTP_400_BAD_REQUEST)

        technicians = Technician.objects.filter(is_available=True, latitude__isnull=False, longitude__isnull=False)
        if not technicians.exists():
            return Response({'error': 'No available technicians with location data'}, status=status.HTTP_400_BAD_REQUEST)

        nearest = min(technicians, key=lambda t: haversine_km(wp.latitude, wp.longitude, t.latitude, t.longitude))
        report.assigned_to = nearest
    else:
        try:
            report.assigned_to = Technician.objects.get(pk=technician_id)
        except Technician.DoesNotExist:
            return Response({'error': 'Technician not found'}, status=status.HTTP_404_NOT_FOUND)

    report.status = 'IN_PROGRESS'
    report.save()
    return Response(FaultReportSerializer(report).data)


class WaterPointViewSet(viewsets.ModelViewSet):
    queryset = WaterPoint.objects.all()
    serializer_class = WaterPointSerializer
    permission_classes = [IsAuthenticated]


class TechnicianViewSet(viewsets.ModelViewSet):
    queryset = Technician.objects.all().order_by('name')
    serializer_class = TechnicianSerializer
    permission_classes = [IsAuthenticated]
