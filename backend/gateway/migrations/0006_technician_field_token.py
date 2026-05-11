import uuid

from django.db import migrations, models


def fill_unique_tokens(apps, schema_editor):
    Technician = apps.get_model("gateway", "Technician")
    for row in Technician.objects.all():
        row.field_token = uuid.uuid4()
        row.save(update_fields=["field_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("gateway", "0005_gatewaysmssession"),
    ]

    operations = [
        migrations.AddField(
            model_name="technician",
            name="field_token",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(fill_unique_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="technician",
            name="field_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
