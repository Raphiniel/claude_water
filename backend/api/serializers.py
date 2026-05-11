from rest_framework import serializers
from django.contrib.auth.models import User
from .models import FaultReport, SystemSetting


class UserAccountSerializer(serializers.ModelSerializer):
    """Staff-readable user list (no password)."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "is_staff", "is_superuser", "date_joined", "last_login")
        read_only_fields = fields


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ("username", "email", "password", "is_staff", "is_superuser")
        extra_kwargs = {"email": {"allow_blank": True}}

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if attrs.get("is_staff") and not user.is_superuser:
            raise serializers.ValidationError({"is_staff": "Only superusers can grant staff access."})
        if attrs.get("is_superuser") and not user.is_superuser:
            raise serializers.ValidationError({"is_superuser": "Only superusers can create superuser accounts."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        is_superuser = validated_data.pop("is_superuser", False)
        email = (validated_data.pop("email", "") or "").strip()
        username = validated_data.pop("username")
        is_staff = validated_data.pop("is_staff", False)
        if is_superuser:
            return User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
            )
        return User.objects.create_user(
            username=username,
            email=email or "",
            password=password,
            is_staff=is_staff,
        )


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
