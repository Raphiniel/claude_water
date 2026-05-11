# Generated manually for inbound SMS accountability

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gateway', '0003_technician_faultreport_assigned_to'),
    ]

    operations = [
        migrations.AddField(
            model_name='faultreport',
            name='raw_message',
            field=models.TextField(blank=True, default='', help_text='Inbound SMS body as received (accountability).'),
        ),
    ]
