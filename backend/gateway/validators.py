from .models import WaterPoint

def validate_sms_report(message_text, sender_number):
    """
    Parses and validates SMS in format: [WP_CODE] [FAULT_CODE]
    Also accepts legacy: REPORT [WP_CODE] [FAULT_CODE]
    Valid fault codes: PUMP, LEAK, DRY, CONTAM, VANDAL, OTHER
    """
    parts = message_text.strip().upper().split()

    result = {
        'is_valid': False,
        'error_message': '',
        'parsed': {
            'wp_code': None,
            'fault_code': None,
            'sender_number': sender_number
        }
    }

    # Strip optional REPORT prefix
    if parts and parts[0] == 'REPORT':
        parts = parts[1:]

    if len(parts) != 2:
        result['error_message'] = "Invalid format. Send: WP_CODE FAULT_CODE (e.g. WP01 PUMP)"
        return result

    wp_code = parts[0]
    fault_token = parts[1]
    valid_faults = ['PUMP', 'LEAK', 'DRY', 'CONTAM', 'VANDAL', 'OTHER']

    # Validate Water Point Code
    try:
        WaterPoint.objects.get(code=wp_code)
        result['parsed']['wp_code'] = wp_code
    except WaterPoint.DoesNotExist:
        result['error_message'] = f"Water Point {wp_code} not found in our system."
        return result

    # Expert shortcut: WP001 1 .. 6 → PUMP .. OTHER
    if fault_token.isdigit():
        idx = int(fault_token)
        if idx < 1 or idx > len(valid_faults):
            result['error_message'] = (
                f"Fault # must be 1-{len(valid_faults)} "
                "(1=PUMP 2=LEAK 3=DRY 4=CONTAM 5=VANDAL 6=OTHER)."
            )
            return result
        fault_code = valid_faults[idx - 1]
    elif fault_token in valid_faults:
        fault_code = fault_token
    else:
        result['error_message'] = (
            f"Invalid fault {fault_token}. "
            "Use word or # 1-6: PUMP LEAK DRY CONTAM VANDAL OTHER."
        )
        return result

    result['parsed']['fault_code'] = fault_code
    result['is_valid'] = True
    return result
