import logging
import uuid
import math
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import viewsets
from django.http import HttpResponse

from .models import FaultReport, WaterPoint, SyncBuffer, Technician
from .validators import validate_sms_report
from .sms_service import send_confirmation_sms, send_error_sms
from .serializers import FaultReportSerializer, WaterPointSerializer, TechnicianSerializer

logger = logging.getLogger(__name__)


def _incoming_sms_fields(request):
    """Africa's Talking posts urlencoded fields; tolerate a few aliases."""
    data = request.data
    sender = (
        data.get("from")
        or data.get("fromPhone")
        or data.get("sender")
        or data.get("phoneNumber")
    )
    text = data.get("text") or data.get("message") or data.get("body") or ""
    return sender, (text or "")


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_nearest_available_technician(water_point):
    """Return nearest available technician with coordinates, or None."""
    if not water_point.latitude or not water_point.longitude:
        return None
    technicians = Technician.objects.filter(
        is_available=True, latitude__isnull=False, longitude__isnull=False
    )
    if not technicians.exists():
        return None
    return min(
        technicians,
        key=lambda t: haversine_km(
            water_point.latitude, water_point.longitude, t.latitude, t.longitude
        ),
    )


def _is_device_gateway_request(request):
    v = (request.headers.get("X-SMS-Gateway") or "").strip().lower()
    return v in ("1", "true", "yes")


def _gateway_secret_ok(request):
    expected = getattr(settings, "SMS_GATEWAY_SHARED_SECRET", None)
    if not expected:
        return True
    got = (request.headers.get("X-SMS-Gateway-Secret") or "").strip()
    return got == expected


@method_decorator(csrf_exempt, name='dispatch')
class SMSWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        gateway = _is_device_gateway_request(request)
        if gateway and not _gateway_secret_ok(request):
            return Response({"detail": "Invalid gateway secret."}, status=status.HTTP_403_FORBIDDEN)

        sender_number, message_text = _incoming_sms_fields(request)

        if not sender_number:
            if gateway:
                return Response({"status": "ignored", "outbound_sms": ""})
            return HttpResponse("GOOD", content_type="text/plain", status=200)

        try:
            validation_result = validate_sms_report(message_text, sender_number)

            if validation_result['is_valid']:
                wp = WaterPoint.objects.get(code=validation_result['parsed']['wp_code'])
                ticket = f"WP{uuid.uuid4().hex[:6].upper()}"
                report = FaultReport.objects.create(
                    water_point=wp,
                    fault_code=validation_result['parsed']['fault_code'],
                    sender_number=sender_number,
                    ticket_number=ticket,
                    status='PENDING',
                )
                tech = get_nearest_available_technician(wp)
                if tech:
                    report.assigned_to = tech
                    report.status = 'IN_PROGRESS'
                    report.save(update_fields=['assigned_to', 'status'])

                if gateway:
                    if tech:
                        outbound = (
                            f"Fault recorded. Ticket {ticket} for {wp.code}. "
                            f"Assigned technician: {tech.name}. Contact: {tech.phone}."
                        )
                    else:
                        outbound = (
                            f"Fault recorded. Ticket {ticket} for {wp.code}. "
                            "A technician will be assigned shortly."
                        )
                    logger.info("Gateway SMS ticket %s for %s", ticket, sender_number)
                    return Response(
                        {
                            "status": "ok",
                            "ticket_number": ticket,
                            "water_point_code": wp.code,
                            "technician_name": tech.name if tech else None,
                            "technician_phone": str(tech.phone) if tech else None,
                            "outbound_sms": outbound,
                        }
                    )

                send_confirmation_sms(sender_number, ticket, wp.code)
                logger.info("Report saved, ticket %s for %s", ticket, sender_number)
            else:
                SyncBuffer.objects.create(
                    raw_message=message_text,
                    sender_number=sender_number,
                    error_message=validation_result['error_message'],
                    is_synced=False
                )
                err = validation_result['error_message']
                if gateway:
                    outbound = f"Report rejected: {err}"
                    return Response(
                        {
                            "status": "error",
                            "outbound_sms": outbound,
                        }
                    )
                send_error_sms(sender_number, err)

        except Exception as e:
            logger.error("Error processing SMS webhook: %s", e)
            if gateway:
                return Response(
                    {
                        "status": "error",
                        "outbound_sms": "Server error. Please try again later.",
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return HttpResponse("BAD", content_type="text/plain", status=500)

        return HttpResponse("GOOD", content_type="text/plain", status=200)


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
        nearest = get_nearest_available_technician(wp)
        if not nearest:
            if not wp.latitude or not wp.longitude:
                return Response({'error': 'Water point has no coordinates for proximity search'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'No available technicians with location data'}, status=status.HTTP_400_BAD_REQUEST)
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
