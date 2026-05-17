from rest_framework import serializers
from .models import WaterPoint, FaultReport, SyncBuffer, Technician

class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technician
        fields = [
            'id', 'name', 'phone', 'latitude', 'longitude', 'is_available', 'is_active',
            'field_token', 'created_at',
        ]
        read_only_fields = ['field_token', 'created_at']

class WaterPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterPoint
        fields = ['id', 'code', 'location', 'latitude', 'longitude', 'description', 'created_at']

class FaultReportSerializer(serializers.ModelSerializer):
    water_point_details = WaterPointSerializer(source='water_point', read_only=True)
    water_point_code = serializers.CharField(source='water_point.code', read_only=True)
    assigned_to_details = TechnicianSerializer(source='assigned_to', read_only=True)
    closed_by_staff_username = serializers.CharField(
        source='closed_by_staff.username', read_only=True, default=None,
    )
    closed_by_technician_name = serializers.CharField(
        source='closed_by_technician.name', read_only=True, default=None,
    )

    class Meta:
        model = FaultReport
        fields = [
            'id', 'water_point', 'water_point_code', 'water_point_details',
            'fault_code', 'sender_number', 'raw_message', 'ticket_number', 'status',
            'assigned_to', 'assigned_to_details', 'created_at',
            'resolved_at', 'closure_notes', 'closed_by_staff', 'closed_by_technician',
            'closed_by_staff_username', 'closed_by_technician_name',
        ]
        read_only_fields = [
            'resolved_at', 'closure_notes', 'closed_by_staff', 'closed_by_technician',
            'closed_by_staff_username', 'closed_by_technician_name',
        ]

class SyncBufferSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncBuffer
        fields = '__all__'
