from .models import WaterPoint

def validate_sms_report(message_text, sender_number):
    """
    Parses and validates SMS in format: REPORT [WP_CODE] [FAULT_CODE]
    Valid fault codes: PUMP, LEAK, DRY, CONTAM, VANDAL, OTHER
    """
    parts = message_text.strip().split()
    
    result = {
        'is_valid': False,
        'error_message': '',
        'parsed': {
            'wp_code': None,
            'fault_code': None,
            'sender_number': sender_number
        }
    }

    # Format check: Must have 3 parts and start with REPORT
    if len(parts) != 3 or parts[0].upper() != 'REPORT':
        result['error_message'] = "Invalid format. Use: REPORT [WP_CODE] [FAULT_CODE]"
        return result

    wp_code = parts[1].upper()
    fault_code = parts[2].upper()

    # Validate Water Point Code
    try:
        wp = WaterPoint.objects.get(code=wp_code)
        result['parsed']['wp_code'] = wp_code
    except WaterPoint.DoesNotExist:
        result['error_message'] = f"Water Point {wp_code} not found in our system."
        return result

    # Validate Fault Code
    valid_faults = ['PUMP', 'LEAK', 'DRY', 'CONTAM', 'VANDAL', 'OTHER']
    if fault_code not in valid_faults:
        result['error_message'] = f"Invalid fault code {fault_code}. Use: PUMP, LEAK, DRY, CONTAM, VANDAL, or OTHER."
        return result

    result['parsed']['fault_code'] = fault_code
    result['is_valid'] = True
    return result
