from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SystemSettingViewSet,
    sms_webhook,
    password_change,
    send_sms,
    current_user_profile,
    UserAccountViewSet,
)

router = DefaultRouter()
router.register(r'settings', SystemSettingViewSet)
router.register(r'users', UserAccountViewSet, basename='useraccount')

urlpatterns = [
    path('api/me/', current_user_profile, name='api_me'),
    path('api/', include(router.urls)),
    path('webhook/sms/', sms_webhook, name='sms_webhook'),
    path('sms/send/', send_sms, name='send_sms'),
    path('api/password-change/', password_change, name='password_change'),
]
