import uuid

from django.conf import settings
from django.db import models


class Technician(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_available = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, help_text='False when deactivated (soft delete).')
    field_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class WaterPoint(models.Model):
    code = models.CharField(max_length=50, unique=True)
    location = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.location}"

class FaultReport(models.Model):
    FAULT_CHOICES = [
        ('PUMP', 'Pump Failure'),
        ('LEAK', 'Pipe Leak'),
        ('DRY', 'Borehole Dry'),
        ('CONTAM', 'Contamination'),
        ('VANDAL', 'Vandalism'),
        ('OTHER', 'Other'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
    ]
    water_point = models.ForeignKey(WaterPoint, on_delete=models.CASCADE, related_name='reports')
    fault_code = models.CharField(max_length=10, choices=FAULT_CHOICES)
    sender_number = models.CharField(max_length=20)
    raw_message = models.TextField(blank=True, default='', help_text='Inbound SMS body as received (accountability).')
    ticket_number = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    assigned_to = models.ForeignKey(Technician, null=True, blank=True, on_delete=models.SET_NULL, related_name='assignments')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closure_notes = models.TextField(blank=True, default='')
    closed_by_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='closed_fault_reports',
    )
    closed_by_technician = models.ForeignKey(
        Technician,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='closed_fault_reports',
    )

    def __str__(self):
        return f"Ticket {self.ticket_number} - {self.fault_code}"

class SyncBuffer(models.Model):
    raw_message = models.TextField()
    sender_number = models.CharField(max_length=20)
    error_message = models.TextField()
    is_synced = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Failed report from {self.sender_number}"


class GatewaySmsSession(models.Model):
    """Per-handset SMS menu state for the Android gateway relay."""

    STATE_IDLE = "idle"
    STATE_PICK_WP = "pick_wp"
    STATE_PICK_FAULT = "pick_fault"
    STATE_CHOICES = [
        (STATE_IDLE, "Idle"),
        (STATE_PICK_WP, "Pick water point"),
        (STATE_PICK_FAULT, "Pick fault"),
    ]

    sender_number = models.CharField(max_length=32, unique=True, db_index=True)
    state = models.CharField(
        max_length=20, choices=STATE_CHOICES, default=STATE_IDLE
    )
    pending_wp_code = models.CharField(max_length=50, blank=True, default="")
    wp_page = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"SMS session {self.sender_number} ({self.state})"
