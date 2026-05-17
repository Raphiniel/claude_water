from django.db import migrations


def forwards(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for name in (
        "WaterWise Technician",
        "WaterWise Community Leader",
        "WaterWise Admin",
    ):
        Group.objects.get_or_create(name=name)


def backwards(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(
        name__in=(
            "WaterWise Technician",
            "WaterWise Community Leader",
            "WaterWise Admin",
        )
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_systemsetting"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
