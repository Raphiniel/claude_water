import logging

import africastalking
from django.conf import settings

logger = logging.getLogger(__name__)

# Initialize Africa's Talking using values from settings (loaded via env)
try:
    username = getattr(settings, "AT_USERNAME", "sandbox")
    api_key = getattr(settings, "AT_API_KEY", "")
    africastalking.initialize(username, api_key)
    sms = africastalking.SMS
except Exception as e:
    logger.error("Failed to initialize Africa's Talking: %s", e)
    sms = None


def send_outbound_sms(message, recipients):
    """
    Send SMS via Africa's Talking. recipients: list of +E.164 numbers.
    Uses AT_SENDER_ID when set (typical for production).
    """
    if not sms:
        raise RuntimeError("Africa's Talking SMS is not initialized (check AT_USERNAME / AT_API_KEY).")
    sender_id = getattr(settings, "AT_SENDER_ID", None)
    if sender_id:
        return sms.send(message, recipients, sender_id=sender_id)
    return sms.send(message, recipients)


def send_confirmation_sms(phone, ticket_number, wp_code, technician_name=None):
    """Sends a success reply for a valid report."""
    if not sms:
        logger.error("SMS service not initialized")
        return False

    base = (
        f"Success! Fault report for {wp_code} received. "
        f"Your ticket number is {ticket_number}."
    )
    if technician_name:
        message = base + f" Technician {technician_name} has been assigned."
    else:
        message = base + " We are attending to it."

    try:
        response = send_outbound_sms(message, [phone])
        logger.info("Confirmation SMS sent to %s: %s", phone, response)
        return True
    except Exception as e:
        logger.error("Error sending confirmation SMS to %s: %s", phone, e)
        return False


def send_closure_sms(phone, ticket_number, wp_code, closure_notes=''):
    """Notify reporter that their fault ticket has been resolved."""
    if not sms:
        logger.error("SMS service not initialized")
        return False

    base = f"WaterWise: Fault {ticket_number} at {wp_code} is resolved."
    notes = (closure_notes or '').strip()
    if notes:
        snippet = notes if len(notes) <= 120 else notes[:117] + '...'
        message = f"{base} {snippet}"
    else:
        message = base

    try:
        response = send_outbound_sms(message, [phone])
        logger.info("Closure SMS sent to %s: %s", phone, response)
        return True
    except Exception as e:
        logger.error("Error sending closure SMS to %s: %s", phone, e)
        return False


def send_error_sms(phone, error_message):
    """Sends a rejection reply explaining the format or validation error."""
    if not sms:
        logger.error("SMS service not initialized")
        return False

    message = f"Report Rejected: {error_message}"

    try:
        response = send_outbound_sms(message, [phone])
        logger.info("Error SMS sent to %s: %s", phone, response)
        return True
    except Exception as e:
        logger.error("Error sending rejection SMS to %s: %s", phone, e)
        return False
