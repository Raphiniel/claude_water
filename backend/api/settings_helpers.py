"""Read singleton system settings used by gateway and other apps."""

from .models import SystemSetting


def get_system_settings():
    setting, _ = SystemSetting.objects.get_or_create(id=1)
    return setting


def auto_assign_nearest_enabled():
    try:
        setting = get_system_settings()
        if setting.mode == "MAINTENANCE":
            return False
        return setting.auto_assign_nearest
    except Exception:
        return True


def send_confirmation_sms_enabled():
    try:
        return get_system_settings().send_confirmation_sms
    except Exception:
        return True
