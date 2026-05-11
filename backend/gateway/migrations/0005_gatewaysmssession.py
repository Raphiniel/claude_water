from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gateway", "0004_faultreport_raw_message"),
    ]

    operations = [
        migrations.CreateModel(
            name="GatewaySmsSession",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "sender_number",
                    models.CharField(db_index=True, max_length=32, unique=True),
                ),
                (
                    "state",
                    models.CharField(
                        choices=[
                            ("idle", "Idle"),
                            ("pick_wp", "Pick water point"),
                            ("pick_fault", "Pick fault"),
                        ],
                        default="idle",
                        max_length=20,
                    ),
                ),
                (
                    "pending_wp_code",
                    models.CharField(blank=True, default="", max_length=50),
                ),
                ("wp_page", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
