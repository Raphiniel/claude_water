from django.db import models

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
    ticket_number = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

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
