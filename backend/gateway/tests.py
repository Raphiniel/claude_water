from django.test import TestCase
from rest_framework.test import APIClient

from .models import FaultReport, GatewaySmsSession, WaterPoint
from .sms_dialog import handle_gateway_sms_dialog


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
