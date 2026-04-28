from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SMSWebhookView, FaultReportListView, WaterPointViewSet, TechnicianViewSet, assign_report

router = DefaultRouter()
router.register(r'waterpoints', WaterPointViewSet)
router.register(r'technicians', TechnicianViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('sms/incoming/', SMSWebhookView.as_view(), name='sms_webhook'),
    path('reports/', FaultReportListView.as_view(), name='report_list'),
    path('reports/<int:pk>/assign/', assign_report, name='assign_report'),
]
