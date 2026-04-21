from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import DailyReport, Item, Log, User, Variant


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["role"] = self.user.role
        data["username"] = self.user.username
        return data


class VariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Variant
        fields = ["id", "item", "color", "length", "quantity"]

    def validate(self, data):
        item = data.get("item", getattr(self.instance, "item", None))
        length = data.get("length", getattr(self.instance, "length", None))

        if item is None:
            return data

        if item.unit == "meters" and length is None:
            raise serializers.ValidationError(
                {"length": "Length is required when item unit is 'meters'."}
            )
        if item.unit == "boxes" and length is not None:
            raise serializers.ValidationError(
                {"length": "Length must be omitted when item unit is 'boxes'."}
            )
        return data


class ItemSerializer(serializers.ModelSerializer):
    variants = VariantSerializer(many=True, read_only=True)

    class Meta:
        model = Item
        fields = ["id", "name", "unit", "created_at", "variants"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "role"]


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
