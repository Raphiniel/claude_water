"""
SMS menu flow for the Android gateway (X-SMS-Gateway).
Replies are returned in outbound_sms for the APK to send to the reporter.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

from django.utils import timezone

from .models import FaultReport, GatewaySmsSession, WaterPoint

SESSION_TTL = timedelta(minutes=60)
WP_PAGE_SIZE = 6

# User-facing labels → FaultReport.fault_code (several labels may share a code).
FAULT_MENU_ITEMS: list[tuple[str, str]] = [
    ("Pump fail/no pressure", "PUMP"),
    ("Tap or stand broken", "LEAK"),
    ("Pipe leak or burst", "LEAK"),
    ("Tank or reservoir", "OTHER"),
    ("Borehole dry/no water", "DRY"),
    ("Low or intermittent supply", "DRY"),
    ("Dirty water/smell/taste", "CONTAM"),
    ("Theft/stolen parts", "VANDAL"),
    ("Vandalism/damage", "VANDAL"),
    ("Fence/lock/access", "VANDAL"),
    ("Solar/electrical", "OTHER"),
    ("Other", "OTHER"),
]

HELP_TOKENS = frozenset(
    {"HI", "HELLO", "HELP", "MENU", "START", "HEY", "0"}
)


def _now():
    return timezone.now()


def _session_key(sender: str) -> str:
    return (sender or "").strip()[:32]


def _sender_for_report(sender: str) -> str:
    return (sender or "").strip()[:20]


def _get_session(sender: str) -> GatewaySmsSession:
    key = _session_key(sender)
    session, _ = GatewaySmsSession.objects.get_or_create(
        sender_number=key,
        defaults={"state": GatewaySmsSession.STATE_IDLE},
    )
    if _session_expired(session):
        session.state = GatewaySmsSession.STATE_IDLE
        session.pending_wp_code = ""
        session.wp_page = 0
        session.save(
            update_fields=["state", "pending_wp_code", "wp_page", "updated_at"]
        )
    return session


def _session_expired(session: GatewaySmsSession) -> bool:
    return _now() - session.updated_at > SESSION_TTL


def _delete_session(session: GatewaySmsSession) -> None:
    GatewaySmsSession.objects.filter(pk=session.pk).delete()


def _build_wp_list_message(session: GatewaySmsSession) -> str:
    qs = WaterPoint.objects.order_by("code").only("code", "location")
    total = qs.count()
    if total == 0:
        return "WaterWise: No water points in the system yet. Ask an admin to add sites."

    total_pages = max(1, (total + WP_PAGE_SIZE - 1) // WP_PAGE_SIZE)
    page = min(session.wp_page, total_pages - 1)
    session.wp_page = page
    start = page * WP_PAGE_SIZE
    chunk = list(qs[start : start + WP_PAGE_SIZE])

    lines = []
    for i, wp in enumerate(chunk, start=1):
        loc = wp.location.strip()
        if len(loc) > 22:
            loc = loc[:19] + "..."
        lines.append(f"{i}.{wp.code} {loc}")

    nav = ""
    if total_pages > 1:
        nav = f"\n8=prev 9=more pg{page + 1}/{total_pages}"

    return "WaterWise: Pick site (reply number):\n" + "\n".join(lines) + nav


def _build_fault_menu_message(wp_code: str) -> str:
    lines = [f"{i}.{label}" for i, (label, _) in enumerate(FAULT_MENU_ITEMS, start=1)]
    return (
        f"{wp_code} selected.\nPick problem (reply number):\n"
        + "\n".join(lines)
    )


def _create_report(sender: str, wp_code: str, fault_code: str, raw: str) -> FaultReport:
    wp = WaterPoint.objects.get(code=wp_code)
    ticket = f"WP{uuid.uuid4().hex[:6].upper()}"
    return FaultReport.objects.create(
        water_point=wp,
        fault_code=fault_code,
        sender_number=_sender_for_report(sender),
        raw_message=(raw or "")[:2000],
        ticket_number=ticket,
        status="PENDING",
    )


def handle_gateway_sms_dialog(sender_number: str, message_text: str) -> dict:
    """
    Handle gateway SMS when the message is not a valid one-line expert report.
    Returns a dict suitable for Response(...) from SMSWebhookView.
    """
    sender = sender_number  # preserve for FaultReport (max 20 in model)
    raw = (message_text or "").strip()
    token = raw.upper().split()
    first = token[0] if token else ""

    session = _get_session(sender)

    def save_session(**kwargs):
        for k, v in kwargs.items():
            setattr(session, k, v)
        session.save()

    # Restart menu from anywhere
    if raw and (first in HELP_TOKENS or (len(token) == 1 and first in HELP_TOKENS)):
        session.state = GatewaySmsSession.STATE_PICK_WP
        session.pending_wp_code = ""
        session.wp_page = 0
        session.save()
        return {
            "status": "ok",
            "outbound_sms": _build_wp_list_message(session),
        }

    if session.state == GatewaySmsSession.STATE_IDLE:
        return {
            "status": "ok",
            "outbound_sms": (
                "WaterWise: Text Hi to report a fault (menu), or send one line: "
                "WP_CODE FAULT (e.g. WP001 PUMP or WP001 3 for expert fault #3)."
            ),
        }

    if session.state == GatewaySmsSession.STATE_PICK_WP:
        if not raw.isdigit():
            save_session()
            return {
                "status": "ok",
                "outbound_sms": (
                    "Reply with a number from the list, or Hi to restart.\n"
                    + _build_wp_list_message(session)
                ),
            }

        n = int(raw)
        all_wps = list(WaterPoint.objects.order_by("code"))
        total_pages = max(1, (len(all_wps) + WP_PAGE_SIZE - 1) // WP_PAGE_SIZE)

        if n == 9 and total_pages > 1:
            session.wp_page = min(session.wp_page + 1, total_pages - 1)
            session.save()
            return {"status": "ok", "outbound_sms": _build_wp_list_message(session)}
        if n == 8 and total_pages > 1:
            session.wp_page = max(session.wp_page - 1, 0)
            session.save()
            return {"status": "ok", "outbound_sms": _build_wp_list_message(session)}

        start = session.wp_page * WP_PAGE_SIZE
        chunk = all_wps[start : start + WP_PAGE_SIZE]
        if n < 1 or n > len(chunk):
            save_session()
            return {
                "status": "ok",
                "outbound_sms": (
                    "Invalid choice. Pick a number from the list.\n"
                    + _build_wp_list_message(session)
                ),
            }

        wp = chunk[n - 1]
        session.pending_wp_code = wp.code
        session.state = GatewaySmsSession.STATE_PICK_FAULT
        session.save()
        return {
            "status": "ok",
            "outbound_sms": _build_fault_menu_message(wp.code),
        }

    if session.state == GatewaySmsSession.STATE_PICK_FAULT:
        if not session.pending_wp_code:
            session.state = GatewaySmsSession.STATE_PICK_WP
            session.wp_page = 0
            session.save()
            return {"status": "ok", "outbound_sms": _build_wp_list_message(session)}

        if not raw.isdigit():
            save_session()
            return {
                "status": "ok",
                "outbound_sms": (
                    "Reply with a problem number, or Hi to restart.\n"
                    + _build_fault_menu_message(session.pending_wp_code)
                ),
            }

        choice = int(raw)
        if choice < 1 or choice > len(FAULT_MENU_ITEMS):
            save_session()
            return {
                "status": "ok",
                "outbound_sms": (
                    "Invalid number.\n"
                    + _build_fault_menu_message(session.pending_wp_code)
                ),
            }

        label, fault_code = FAULT_MENU_ITEMS[choice - 1]
        wp_code = session.pending_wp_code
        try:
            report = _create_report(
                sender,
                wp_code,
                fault_code,
                raw=f"[menu:{choice} {label}] {raw}",
            )
        except WaterPoint.DoesNotExist:
            _delete_session(session)
            return {
                "status": "error",
                "outbound_sms": f"Water point {wp_code} missing. Text Hi to restart.",
            }

        _delete_session(session)
        return {
            "status": "ok",
            "ticket_number": report.ticket_number,
            "water_point_code": wp_code,
            "technician_name": None,
            "technician_phone": None,
            "outbound_sms": (
                f"Recorded: {label} @ {wp_code}. Ticket {report.ticket_number}. "
                "Flagged for admin. Text Hi to report another."
            ),
        }

    return {
        "status": "ok",
        "outbound_sms": "WaterWise: Text Hi to start.",
    }
