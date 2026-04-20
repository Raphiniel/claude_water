from rest_framework import serializers
from .models import WaterPoint, FaultReport, SyncBuffer

class WaterPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterPoint
        fields = ['id', 'code', 'location', 'latitude', 'longitude', 'description', 'created_at']

class FaultReportSerializer(serializers.ModelSerializer):
    water_point_details = WaterPointSerializer(source='water_point', read_only=True)
    water_point_code = serializers.CharField(source='water_point.code', read_only=True)
    
    class Meta:
        model = FaultReport
        fields = [
            'id', 'water_point', 'water_point_code', 'water_point_details',
            'fault_code', 'sender_number', 'ticket_number', 'status', 'created_at'
        ]

class SyncBufferSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncBuffer
        fields = '__all__'
