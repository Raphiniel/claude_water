from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SMSWebhookView, FaultReportListView, WaterPointViewSet

router = DefaultRouter()
router.register(r'waterpoints', WaterPointViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('sms/incoming/', SMSWebhookView.as_view(), name='sms_webhook'),
    path('reports/', FaultReportListView.as_view(), name='report_list'),
]
