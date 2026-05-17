from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import SystemSetting
from .models import FaultReport, GatewaySmsSession, Technician, WaterPoint
from .sms_dialog import handle_gateway_sms_dialog

User = get_user_model()


class SmsDialogLogicTests(TestCase):
    def setUp(self):
        WaterPoint.objects.create(code="WP001", location="Site A")
        WaterPoint.objects.create(code="WP002", location="Site B")

    def test_hi_starts_menu(self):
        out = handle_gateway_sms_dialog("+263700", "Hi")
        self.assertIn("Pick site", out["outbound_sms"])
        self.assertIn("WP001", out["outbound_sms"])
        s = GatewaySmsSession.objects.get(sender_number="+263700")
        self.assertEqual(s.state, GatewaySmsSession.STATE_PICK_WP)

    def test_pick_wp_then_fault_creates_report(self):
        handle_gateway_sms_dialog("+263701", "Hello")
        out2 = handle_gateway_sms_dialog("+263701", "1")
        self.assertIn("selected", out2["outbound_sms"])
        self.assertIn("Pick problem", out2["outbound_sms"])
        out3 = handle_gateway_sms_dialog("+263701", "5")
        self.assertEqual(out3["status"], "ok")
        self.assertIn("ticket_number", out3)
        r = FaultReport.objects.get(ticket_number=out3["ticket_number"])
        self.assertEqual(r.water_point.code, "WP001")
        self.assertEqual(r.fault_code, "DRY")
        self.assertFalse(
            GatewaySmsSession.objects.filter(sender_number="+263701").exists()
        )

    def test_idle_prompt_without_session(self):
        out = handle_gateway_sms_dialog("+263702", "random")
        self.assertIn("Text Hi", out["outbound_sms"])


class SmsWebhookGatewayTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        WaterPoint.objects.create(code="WP001", location="Site A")

    def _post_gateway(self, sender, text, secret=None):
        headers = {"HTTP_X_SMS_GATEWAY": "1"}
        if secret is not None:
            headers["HTTP_X_SMS_GATEWAY_SECRET"] = secret
        return self.client.post(
            "/api/sms/incoming/",
            {"from": sender, "text": text},
            format="json",
            **headers,
        )

    def test_expert_numeric_fault(self):
        res = self._post_gateway("+100", "WP001 3")
        self.assertEqual(res.status_code, 200)
        self.assertIn("ticket_number", res.data)
        r = FaultReport.objects.latest("id")
        self.assertEqual(r.fault_code, "DRY")

    def test_menu_flow_via_http(self):
        r1 = self._post_gateway("+200", "help")
        self.assertEqual(r1.status_code, 200)
        self.assertIn("WP001", r1.data["outbound_sms"])
        r2 = self._post_gateway("+200", "1")
        self.assertEqual(r2.status_code, 200)
        self.assertIn("Pick problem", r2.data["outbound_sms"])
        r3 = self._post_gateway("+200", "1")
        self.assertEqual(r3.status_code, 200)
        self.assertIn("Recorded", r3.data["outbound_sms"])
        self.assertTrue(FaultReport.objects.filter(sender_number="+200").exists())


class FaultClosureTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.wp = WaterPoint.objects.create(code="WP001", location="Site A")
        self.tech = Technician.objects.create(name="Tech A", phone="+263711")
        self.other_tech = Technician.objects.create(name="Tech B", phone="+263712")
        self.staff = User.objects.create_user(
            username="dispatch", password="pass12345", is_staff=True,
        )
        self.non_staff = User.objects.create_user(
            username="viewer", password="pass12345", is_staff=False,
        )
        self.report = FaultReport.objects.create(
            water_point=self.wp,
            fault_code="PUMP",
            sender_number="+263700111",
            raw_message="WP001 1",
            ticket_number="T-TEST-001",
            status="IN_PROGRESS",
            assigned_to=self.tech,
        )
        SystemSetting.objects.create(send_confirmation_sms=True)

    @patch("gateway.fault_closure.send_closure_sms")
    def test_staff_can_close_with_notes(self, mock_sms):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post(
            f"/api/reports/{self.report.id}/status/",
            {"status": "RESOLVED", "closure_notes": "Pump replaced and tested."},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "RESOLVED")
        self.assertIsNotNone(self.report.resolved_at)
        self.assertEqual(self.report.closure_notes, "Pump replaced and tested.")
        self.assertEqual(self.report.closed_by_staff_id, self.staff.id)
        mock_sms.assert_called_once()

    def test_non_staff_cannot_close(self):
        self.client.force_authenticate(user=self.non_staff)
        res = self.client.post(
            f"/api/reports/{self.report.id}/status/",
            {"status": "RESOLVED", "closure_notes": "Done"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_close_requires_notes(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post(
            f"/api/reports/{self.report.id}/status/",
            {"status": "RESOLVED", "closure_notes": "ab"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    @patch("gateway.fault_closure.send_closure_sms")
    def test_field_token_closes_assigned_job(self, mock_sms):
        token = str(self.tech.field_token)
        res = self.client.post(
            f"/api/field/jobs/{self.report.id}/close/",
            {"token": token, "closure_notes": "Fixed on site."},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "RESOLVED")
        self.assertEqual(self.report.closed_by_technician_id, self.tech.id)
        mock_sms.assert_called_once()

    def test_field_token_cannot_close_unassigned_job(self):
        token = str(self.other_tech.field_token)
        res = self.client.post(
            f"/api/field/jobs/{self.report.id}/close/",
            {"token": token, "closure_notes": "Should fail."},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_field_invalid_token_returns_404(self):
        res = self.client.post(
            f"/api/field/jobs/{self.report.id}/close/",
            {"token": "00000000-0000-0000-0000-000000000099", "closure_notes": "Nope"},
            format="json",
        )
        self.assertEqual(res.status_code, 404)

    @patch("gateway.fault_closure.send_closure_sms")
    def test_double_close_returns_400(self, mock_sms):
        self.client.force_authenticate(user=self.staff)
        payload = {"status": "RESOLVED", "closure_notes": "First close."}
        first = self.client.post(
            f"/api/reports/{self.report.id}/status/", payload, format="json",
        )
        self.assertEqual(first.status_code, 200)
        second = self.client.post(
            f"/api/reports/{self.report.id}/status/", payload, format="json",
        )
        self.assertEqual(second.status_code, 400)
        self.assertEqual(mock_sms.call_count, 1)

    @patch("gateway.fault_closure.send_closure_sms")
    @patch("api.settings_helpers.get_system_settings")
    def test_sms_skipped_when_setting_disabled(self, mock_settings, mock_sms):
        mock_settings.return_value = SystemSetting(send_confirmation_sms=False)
        self.client.force_authenticate(user=self.staff)
        res = self.client.post(
            f"/api/reports/{self.report.id}/status/",
            {"status": "RESOLVED", "closure_notes": "Closed quietly."},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        mock_sms.assert_not_called()
