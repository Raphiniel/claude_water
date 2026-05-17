from django.db import models

class SystemSetting(models.Model):
    MODE_CHOICES = [
        ('NORMAL', 'Normal Operation'),
        ('EMERGENCY', 'Emergency Mode'),
        ('MAINTENANCE', 'Maintenance'),
    ]
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='NORMAL')
    organization_name = models.CharField(max_length=120, default='WaterWise')
    auto_assign_nearest = models.BooleanField(
        default=True,
        help_text='When enabled, new SMS fault reports auto-assign the nearest available technician.',
    )
    send_confirmation_sms = models.BooleanField(
        default=True,
        help_text='Send Africa\'s Talking confirmation SMS to reporters after a valid report.',
    )
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"System Mode: {self.mode}"

class FaultReport(models.Model):
    phone_number = models.CharField(max_length=20)
    message = models.TextField()
    location = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, default='PENDING', choices=[
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
    ])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.phone_number} - {self.status}"
