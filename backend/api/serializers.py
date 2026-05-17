from rest_framework import serializers
from django.contrib.auth.models import Group, User
from .models import FaultReport, SystemSetting
from .roles import (
    apply_role_groups,
    ensure_waterwise_groups,
    user_can_configure_sms_gateway,
    user_primary_role,
)


class UserAccountSerializer(serializers.ModelSerializer):
    """Staff-readable user list (no password)."""

    role = serializers.SerializerMethodField()
    can_configure_sms_gateway = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "role",
            "can_configure_sms_gateway",
            "date_joined",
            "last_login",
        )
        read_only_fields = fields

    def get_role(self, obj):
        return user_primary_role(obj)

    def get_can_configure_sms_gateway(self, obj):
        return user_can_configure_sms_gateway(obj)


class AdminUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(allow_blank=True, required=False, default="")
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    role = serializers.ChoiceField(
        choices=("technician", "community_leader", "admin"),
        required=False,
    )
    is_superuser = serializers.BooleanField(default=False, required=False)

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        su = bool(attrs.get("is_superuser"))
        if su and not user.is_superuser:
            raise serializers.ValidationError(
                {"is_superuser": "Only superusers can create Django superuser accounts."}
            )
        if not su and not attrs.get("role"):
            raise serializers.ValidationError(
                {"role": "Select a role, or enable superuser (superusers only)."}
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        password = validated_data["password"]
        is_superuser = bool(validated_data.get("is_superuser", False))
        role = validated_data.get("role")
        email = (validated_data.get("email") or "").strip()
        username = validated_data["username"]

        if is_superuser and request.user.is_superuser:
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
            )
            ensure_waterwise_groups()
            user.groups.add(Group.objects.get(name="WaterWise Admin"))
            return user

        user = User.objects.create_user(
            username=username,
            email=email or "",
            password=password,
        )
        apply_role_groups(user, role or "technician")
        user.save()
        return user


class FaultReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaultReport
        fields = '__all__'

class SystemSettingSerializer(serializers.ModelSerializer):
    sms_gateway_configured = serializers.SerializerMethodField()
    sms_provider_configured = serializers.SerializerMethodField()

    class Meta:
        model = SystemSetting
        fields = [
            'id',
            'mode',
            'organization_name',
            'auto_assign_nearest',
            'send_confirmation_sms',
            'last_updated',
            'sms_gateway_configured',
            'sms_provider_configured',
        ]
        read_only_fields = ['id', 'last_updated', 'sms_gateway_configured', 'sms_provider_configured']

    def get_sms_gateway_configured(self, obj):
        from django.conf import settings as django_settings
        return bool(getattr(django_settings, 'SMS_GATEWAY_SHARED_SECRET', None))

    def get_sms_provider_configured(self, obj):
        from django.conf import settings as django_settings
        return bool(getattr(django_settings, 'AT_API_KEY', None))

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
