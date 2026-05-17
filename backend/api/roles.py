"""WaterWise portal roles (Django Groups + staff flags)."""

from __future__ import annotations

from django.contrib.auth.models import Group, User

GROUP_TECHNICIAN = "WaterWise Technician"
GROUP_COMMUNITY_LEADER = "WaterWise Community Leader"
GROUP_ADMIN = "WaterWise Admin"

ALL_ROLE_GROUPS = (GROUP_TECHNICIAN, GROUP_COMMUNITY_LEADER, GROUP_ADMIN)


def ensure_waterwise_groups() -> None:
    for name in ALL_ROLE_GROUPS:
        Group.objects.get_or_create(name=name)


def _group_names(user: User) -> set[str]:
    return set(user.groups.values_list("name", flat=True))


def user_primary_role(user: User) -> str:
    """API-facing role string for /api/me/ and user lists."""
    if user.is_superuser:
        return "superuser"
    names = _group_names(user)
    if GROUP_ADMIN in names:
        return "admin"
    if GROUP_COMMUNITY_LEADER in names:
        return "community_leader"
    if GROUP_TECHNICIAN in names:
        return "technician"
    if user.is_staff:
        return "admin"
    return "technician"


def user_can_configure_sms_gateway(user: User) -> bool:
    """Only Admins (group), superusers, or legacy staff-without-role-groups may configure SMS relay."""
    if user.is_superuser:
        return True
    names = _group_names(user)
    if GROUP_ADMIN in names:
        return True
    if GROUP_COMMUNITY_LEADER in names or GROUP_TECHNICIAN in names:
        return False
    return bool(user.is_staff)


def apply_role_groups(user: User, role: str) -> None:
    """Assign WaterWise groups and staff flag from a creation role slug."""
    ensure_waterwise_groups()
    user.groups.clear()
    role = (role or "").strip().lower()
    if role == "technician":
        user.is_staff = False
        user.groups.add(Group.objects.get(name=GROUP_TECHNICIAN))
    elif role == "community_leader":
        user.is_staff = True
        user.groups.add(Group.objects.get(name=GROUP_COMMUNITY_LEADER))
    elif role == "admin":
        user.is_staff = True
        user.groups.add(Group.objects.get(name=GROUP_ADMIN))
    else:
        user.is_staff = False
        user.groups.add(Group.objects.get(name=GROUP_TECHNICIAN))
