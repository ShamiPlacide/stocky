from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import DailyReport, Item, Log, User, Variant


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["role"] = "admin" if self.user.is_superuser else self.user.role
        data["username"] = self.user.username
        return data


class VariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Variant
        fields = ["id", "item", "code", "name", "quantity"]


class ItemSerializer(serializers.ModelSerializer):
    variants = VariantSerializer(many=True, read_only=True)

    class Meta:
        model = Item
        fields = ["id", "name", "created_at", "variants"]


class StaffSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["id", "username", "role", "date_joined", "password"]
        read_only_fields = ["id", "date_joined"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LogSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    variant_detail = VariantSerializer(source="variant", read_only=True)

    class Meta:
        model = Log
        fields = ["id", "user", "action", "variant", "variant_detail", "quantity_changed", "timestamp"]


class DailyReportSerializer(serializers.ModelSerializer):
    generated_by = serializers.StringRelatedField()

    class Meta:
        model = DailyReport
        fields = ["id", "date", "generated_by", "created_at"]
