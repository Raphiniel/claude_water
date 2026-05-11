from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SMSWebhookView,
    FaultReportListView,
    FaultReportDetailView,
    WaterPointViewSet,
    TechnicianViewSet,
    assign_report,
    nearby_technicians,
    field_update_position,
    field_my_jobs,
)

router = DefaultRouter()
router.register(r'waterpoints', WaterPointViewSet)
router.register(r'technicians', TechnicianViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('sms/incoming/', SMSWebhookView.as_view(), name='sms_webhook'),
    path('reports/', FaultReportListView.as_view(), name='report_list'),
    path('reports/<int:pk>/assign/', assign_report, name='assign_report'),
    path('reports/<int:pk>/nearby-technicians/', nearby_technicians, name='nearby_technicians'),
    path('reports/<int:pk>/', FaultReportDetailView.as_view(), name='report_detail'),
    path('field/position/', field_update_position, name='field_position'),
    path('field/jobs/', field_my_jobs, name='field_jobs'),
]
