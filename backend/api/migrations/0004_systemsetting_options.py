from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_waterwise_role_groups'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemsetting',
            name='organization_name',
            field=models.CharField(default='WaterWise', max_length=120),
        ),
        migrations.AddField(
            model_name='systemsetting',
            name='auto_assign_nearest',
            field=models.BooleanField(
                default=True,
                help_text='When enabled, new SMS fault reports auto-assign the nearest available technician.',
            ),
        ),
        migrations.AddField(
            model_name='systemsetting',
            name='send_confirmation_sms',
            field=models.BooleanField(
                default=True,
                help_text="Send Africa's Talking confirmation SMS to reporters after a valid report.",
            ),
        ),
    ]
