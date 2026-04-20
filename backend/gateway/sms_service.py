import africastalking
import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Initialize Africa's Talking using values from settings (loaded via env)
try:
    username = getattr(settings, 'AT_USERNAME', 'sandbox')
    api_key = getattr(settings, 'AT_API_KEY', '')
    africastalking.initialize(username, api_key)
    sms = africastalking.SMS
except Exception as e:
    logger.error(f"Failed to initialize Africa's Talking: {e}")
    sms = None

def send_confirmation_sms(phone, ticket_number, wp_code):
    """Sends a success reply for a valid report."""
    if not sms:
        logger.error("SMS service not initialized")
        return False
    
    message = (
        f"Success! Fault report for {wp_code} received. "
        f"Your ticket number is {ticket_number}. We are attending to it."
    )
    
    try:
        response = sms.send(message, [phone])
        logger.info(f"Confirmation SMS sent to {phone}: {response}")
        return True
    except Exception as e:
        logger.error(f"Error sending confirmation SMS to {phone}: {e}")
        return False

def send_error_sms(phone, error_message):
    """Sends a rejection reply explaining the format or validation error."""
    if not sms:
        logger.error("SMS service not initialized")
        return False

    message = f"Report Rejected: {error_message}"
    
    try:
        response = sms.send(message, [phone])
        logger.info(f"Error SMS sent to {phone}: {response}")
        return True
    except Exception as e:
        logger.error(f"Error sending rejection SMS to {phone}: {e}")
        return False
