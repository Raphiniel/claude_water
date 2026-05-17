import logging
import math
import uuid as uuid_mod
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
from .sms_dialog import handle_gateway_sms_dialog
from .validators import validate_sms_report
from .sms_service import send_confirmation_sms, send_error_sms
from .serializers import FaultReportSerializer, WaterPointSerializer, TechnicianSerializer
from .fault_closure import FaultAlreadyClosedError, close_fault_report
from api.settings_helpers import auto_assign_nearest_enabled, send_confirmation_sms_enabled

logger = logging.getLogger(__name__)


def _system_auto_assign_enabled():
    return auto_assign_nearest_enabled()


def _technician_from_token(token: str):
    """Resolve active technician from field portal UUID token."""
    uid = uuid_mod.UUID(str(token).strip())
    return Technician.objects.get(field_token=uid, is_active=True)


def _incoming_sms_fields(request):
    """Africa's Talking and the Android gateway post urlencoded fields; merge POST + DRF data."""
    post = getattr(request, "POST", None)
    drf = getattr(request, "data", None)

    def pick(keys):
        for k in keys:
            v = None
            if post is not None:
                try:
                    v = post.get(k)
                except Exception:
                    v = None
            if v not in (None, ""):
                return v
            if drf is not None:
                try:
                    v = drf.get(k)
                except Exception:
                    v = None
            if v not in (None, ""):
                return v
        return None

    sender = pick(("from", "fromPhone", "sender", "phoneNumber"))
    text = pick(("text", "message", "body")) or ""
    return sender, text


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
        is_active=True,
        is_available=True,
        latitude__isnull=False,
        longitude__isnull=False,
    ).only("id", "name", "phone", "latitude", "longitude", "is_available", "is_active")
    if not technicians.exists():
        return None
    return min(
        technicians,
        key=lambda t: haversine_km(
            water_point.latitude, water_point.longitude, t.latitude, t.longitude
        ),
    )


def get_nearest_technicians(water_point, *, available_only=False, limit=5):
    """Return nearest technicians (optionally only available), each with distance_km."""
    if not water_point.latitude or not water_point.longitude:
        return []

    technicians = Technician.objects.filter(is_active=True, latitude__isnull=False, longitude__isnull=False)
    if available_only:
        technicians = technicians.filter(is_available=True)

    ranked = [
        (
            tech,
            haversine_km(
                water_point.latitude, water_point.longitude, tech.latitude, tech.longitude
            ),
        )
        for tech in technicians
    ]
    ranked.sort(key=lambda pair: pair[1])
    return ranked[:limit]


def try_auto_assign_nearest(report):
    """
    If the water point has coordinates, assign the nearest available technician
    and set status to IN_PROGRESS. Returns True if an assignment was made.
    """
    if report.assigned_to_id or report.status != "PENDING":
        return False
    nearest = get_nearest_available_technician(report.water_point)
    if not nearest:
        return False
    report.assigned_to = nearest
    report.status = "IN_PROGRESS"
    report.save(update_fields=["assigned_to", "status"])
    return True


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
            return Response(
                {
                    "detail": "Invalid gateway secret.",
                    "status": "error",
                    "outbound_sms": (
                        "WaterWise: this phone was rejected (gateway secret). "
                        "Match app Shared secret to server SMS_GATEWAY_SHARED_SECRET, "
                        "or leave both empty."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        sender_number, message_text = _incoming_sms_fields(request)

        if not sender_number:
            if gateway:
                logger.warning(
                    "Gateway SMS missing sender; POST keys=%s data keys=%s",
                    list(request.POST.keys()) if request.POST else [],
                    list(request.data.keys()) if hasattr(request.data, "keys") else [],
                )
                return Response(
                    {
                        "status": "error",
                        "outbound_sms": (
                            "WaterWise: server did not receive your number. "
                            "Try saving settings in the app and send again."
                        ),
                    }
                )
            return HttpResponse("GOOD", content_type="text/plain", status=200)

        try:
            validation_result = validate_sms_report(message_text, sender_number)

            if validation_result['is_valid']:
                wp = WaterPoint.objects.get(code=validation_result['parsed']['wp_code'])
                ticket = f"WP{uuid_mod.uuid4().hex[:6].upper()}"
                report = FaultReport.objects.create(
                    water_point=wp,
                    fault_code=validation_result['parsed']['fault_code'],
                    sender_number=sender_number,
                    raw_message=message_text or '',
                    ticket_number=ticket,
                    status='PENDING',
                )
                if _system_auto_assign_enabled():
                    try_auto_assign_nearest(report)

                if gateway:
                    if report.assigned_to:
                        tech = report.assigned_to
                        outbound = (
                            f"Fault recorded. Ticket {ticket} for {wp.code}. "
                            f"Technician {tech.name} ({tech.phone}) has been assigned."
                        )
                        tech_name = tech.name
                        tech_phone = tech.phone
                    else:
                        outbound = (
                            f"Fault recorded. Ticket {ticket} for {wp.code}. "
                            "Your report is flagged for admin assignment."
                        )
                        tech_name = None
                        tech_phone = None
                    logger.info("Gateway SMS ticket %s for %s", ticket, sender_number)
                    return Response(
                        {
                            "status": "ok",
                            "ticket_number": ticket,
                            "water_point_code": wp.code,
                            "technician_name": tech_name,
                            "technician_phone": tech_phone,
                            "outbound_sms": outbound,
                        }
                    )

                if send_confirmation_sms_enabled():
                    send_confirmation_sms(
                        sender_number,
                        ticket,
                        wp.code,
                        technician_name=report.assigned_to.name if report.assigned_to else None,
                    )
                logger.info("Report saved, ticket %s for %s", ticket, sender_number)
            elif gateway:
                return Response(handle_gateway_sms_dialog(sender_number, message_text))
            else:
                SyncBuffer.objects.create(
                    raw_message=message_text,
                    sender_number=sender_number,
                    error_message=validation_result['error_message'],
                    is_synced=False
                )
                err = validation_result['error_message']
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


class FaultReportDetailView(generics.RetrieveAPIView):
    serializer_class = FaultReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FaultReport.objects.select_related(
            'water_point', 'assigned_to', 'closed_by_staff', 'closed_by_technician',
        ).all()


@api_view(['POST'])
@permission_classes([AllowAny])
def field_update_position(request):
    """Technician handset: update GPS using secret field_token (no admin JWT)."""
    token = str(request.data.get('token', '')).strip()
    lat = request.data.get('latitude')
    lng = request.data.get('longitude')
    if not token:
        return Response({'error': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)
    if lat is None or lng is None:
        return Response({'error': 'latitude and longitude are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        tech = _technician_from_token(token)
    except (Technician.DoesNotExist, ValueError, TypeError, AttributeError):
        return Response({'error': 'Invalid token'}, status=status.HTTP_404_NOT_FOUND)
    try:
        tech.latitude = round(float(lat), 6)
        tech.longitude = round(float(lng), 6)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid coordinates'}, status=status.HTTP_400_BAD_REQUEST)
    tech.save(update_fields=['latitude', 'longitude'])
    return Response({'ok': True, 'name': tech.name})


@api_view(['GET'])
@permission_classes([AllowAny])
def field_my_jobs(request):
    """Open jobs assigned to this technician (token auth)."""
    token = str(request.query_params.get('token', '')).strip()
    if not token:
        return Response({'error': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        tech = _technician_from_token(token)
    except (Technician.DoesNotExist, ValueError, TypeError, AttributeError):
        return Response({'error': 'Invalid token'}, status=status.HTTP_404_NOT_FOUND)

    qs = (
        FaultReport.objects.filter(assigned_to=tech)
        .exclude(status='RESOLVED')
        .select_related('water_point')
        .order_by('-created_at')[:25]
    )
    out = []
    for r in qs:
        wp = r.water_point
        out.append(
            {
                'id': r.id,
                'ticket_number': r.ticket_number,
                'status': r.status,
                'fault_code': r.fault_code,
                'raw_message': r.raw_message,
                'sender_number': r.sender_number,
                'created_at': r.created_at,
                'water_point_code': wp.code,
                'water_point_location': wp.location,
                'latitude': str(wp.latitude) if wp.latitude is not None else None,
                'longitude': str(wp.longitude) if wp.longitude is not None else None,
            }
        )
    return Response({'technician': {'id': tech.id, 'name': tech.name}, 'jobs': out})


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


@api_view(['POST'])
@permission_classes([AllowAny])
def field_close_job(request, pk):
    """Assigned technician closes a job via field portal token."""
    token = str(request.data.get('token', '')).strip()
    if not token:
        return Response({'error': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        tech = _technician_from_token(token)
    except (Technician.DoesNotExist, ValueError, TypeError, AttributeError):
        return Response({'error': 'Invalid token'}, status=status.HTTP_404_NOT_FOUND)

    try:
        report = FaultReport.objects.select_related('water_point', 'assigned_to').get(pk=pk)
    except FaultReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

    if report.assigned_to_id != tech.id:
        return Response(
            {'error': 'You can only close faults assigned to you.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    notes = request.data.get('closure_notes', '')
    try:
        close_fault_report(report, notes=notes, technician=tech)
    except FaultAlreadyClosedError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    report.refresh_from_db()
    return Response(
        {
            'ok': True,
            'ticket_number': report.ticket_number,
            'status': report.status,
            'resolved_at': report.resolved_at,
        }
    )


@api_view(['POST', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_report_status(request, pk):
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff can update report status.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        report = FaultReport.objects.select_related(
            'water_point', 'assigned_to', 'closed_by_staff', 'closed_by_technician',
        ).get(pk=pk)
    except FaultReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = str(request.data.get('status', '')).strip().upper()
    allowed = {'PENDING', 'IN_PROGRESS', 'RESOLVED'}
    if new_status not in allowed:
        return Response(
            {'error': 'Invalid status. Use PENDING, IN_PROGRESS, or RESOLVED.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if new_status == 'RESOLVED':
        notes = request.data.get('closure_notes', '')
        try:
            close_fault_report(report, notes=notes, staff_user=request.user)
        except FaultAlreadyClosedError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        report.refresh_from_db()
        return Response(FaultReportSerializer(report).data)

    report.status = new_status
    report.save(update_fields=['status'])
    return Response(FaultReportSerializer(report).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nearby_technicians(request, pk):
    try:
        report = FaultReport.objects.select_related('water_point').get(pk=pk)
    except FaultReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

    if not report.water_point.latitude or not report.water_point.longitude:
        return Response(
            {'error': 'Water point has no coordinates for proximity search'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ranked = get_nearest_technicians(report.water_point, available_only=False, limit=8)
    data = []
    for technician, distance_km in ranked:
        item = TechnicianSerializer(technician).data
        item['distance_km'] = round(distance_km, 2)
        data.append(item)
    return Response(data)


class WaterPointViewSet(viewsets.ModelViewSet):
    queryset = WaterPoint.objects.all()
    serializer_class = WaterPointSerializer
    permission_classes = [IsAuthenticated]


class TechnicianViewSet(viewsets.ModelViewSet):
    queryset = Technician.objects.all().order_by('name')
    serializer_class = TechnicianSerializer
    permission_classes = [IsAuthenticated]
