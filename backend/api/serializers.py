from rest_framework import serializers
from .models import FaultReport, SystemSetting
from django.contrib.auth.models import User

class FaultReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaultReport
        fields = '__all__'

class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = '__all__'

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
