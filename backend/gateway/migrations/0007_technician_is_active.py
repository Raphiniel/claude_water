from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gateway', '0006_technician_field_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='technician',
            name='is_active',
            field=models.BooleanField(default=True, help_text='False when deactivated (soft delete).'),
        ),
    ]
