import uuid
from django.core.management.base import BaseCommand
from gateway.models import SyncBuffer, FaultReport, WaterPoint
from gateway.validators import validate_sms_report
from gateway.sms_service import send_confirmation_sms

class Command(BaseCommand):
    help = 'Retries syncing failed reports from the SyncBuffer'

    def handle(self, *args, **options):
        failed_reports = SyncBuffer.objects.filter(is_synced=False)
        self.stdout.write(f"Attempting to re-sync {failed_reports.count()} reports...")

        success_count = 0
        failure_count = 0

        for buffer_item in failed_reports:
            self.stdout.write(f"Processing report from {buffer_item.sender_number}...")
            
            # Re-validate the raw message
            result = validate_sms_report(buffer_item.raw_message, buffer_item.sender_number)
            
            if result['is_valid']:
                try:
                    wp = WaterPoint.objects.get(code=result['parsed']['wp_code'])
                    ticket = f"WP{uuid.uuid4().hex[:6].upper()}"
                    
                    # Create the real FaultReport
                    FaultReport.objects.create(
                        water_point=wp,
                        fault_code=result['parsed']['fault_code'],
                        sender_number=buffer_item.sender_number,
                        ticket_number=ticket,
                        status='PENDING'
                    )
                    
                    # Mark buffer as synced
                    buffer_item.is_synced = True
                    buffer_item.save()
                    
                    # Send confirmation since it succeeded this time
                    send_confirmation_sms(buffer_item.sender_number, ticket, wp.code)
                    
                    success_count += 1
                    self.stdout.write(self.style.SUCCESS(f"Successfully synced: {ticket}"))
                except Exception as e:
                    failure_count += 1
                    self.stdout.write(self.style.ERROR(f"Sync failed for {buffer_item.id}: {str(e)}"))
            else:
                failure_count += 1
                self.stdout.write(self.style.WARNING(f"Still invalid: {result['error_message']}"))

        self.stdout.write(
            f"Sync complete. Successes: {success_count}, Failures: {failure_count}"
        )
