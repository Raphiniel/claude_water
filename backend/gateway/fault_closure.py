"""Close fault reports with notes, audit fields, and optional reporter SMS."""

from django.utils import timezone

from api.settings_helpers import send_confirmation_sms_enabled

from .models import FaultReport
from .sms_service import send_closure_sms

MIN_CLOSURE_NOTES_LEN = 3
MAX_CLOSURE_NOTES_LEN = 500


class FaultAlreadyClosedError(Exception):
    pass


def normalize_closure_notes(raw: str) -> str:
    notes = (raw or '').strip()
    if len(notes) < MIN_CLOSURE_NOTES_LEN:
        raise ValueError(
            f'closure_notes must be at least {MIN_CLOSURE_NOTES_LEN} characters.'
        )
    if len(notes) > MAX_CLOSURE_NOTES_LEN:
        raise ValueError(
            f'closure_notes must be at most {MAX_CLOSURE_NOTES_LEN} characters.'
        )
    return notes


def close_fault_report(
    report: FaultReport,
    *,
    notes: str,
    staff_user=None,
    technician=None,
) -> FaultReport:
    if report.status == 'RESOLVED':
        raise FaultAlreadyClosedError('This fault is already closed.')

    closure_notes = normalize_closure_notes(notes)
    now = timezone.now()

    report.status = 'RESOLVED'
    report.resolved_at = now
    report.closure_notes = closure_notes
    report.closed_by_staff = staff_user
    report.closed_by_technician = technician
    report.save(
        update_fields=[
            'status',
            'resolved_at',
            'closure_notes',
            'closed_by_staff',
            'closed_by_technician',
        ]
    )

    if send_confirmation_sms_enabled() and report.sender_number:
        wp_code = report.water_point.code if report.water_point_id else ''
        try:
            send_closure_sms(
                report.sender_number,
                report.ticket_number,
                wp_code,
                closure_notes,
            )
        except Exception:
            pass

    return report
