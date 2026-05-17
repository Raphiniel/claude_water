from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('gateway', '0007_technician_is_active'),
    ]

    operations = [
        migrations.AddField(
            model_name='faultreport',
            name='resolved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='faultreport',
            name='closure_notes',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='faultreport',
            name='closed_by_staff',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='closed_fault_reports',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='faultreport',
            name='closed_by_technician',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='closed_fault_reports',
                to='gateway.technician',
            ),
        ),
    ]
