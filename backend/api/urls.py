from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SystemSettingViewSet, sms_webhook, password_change

router = DefaultRouter()
router.register(r'settings', SystemSettingViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    path('webhook/sms/', sms_webhook, name='sms_webhook'),
    path('api/password-change/', password_change, name='password_change'),
]
