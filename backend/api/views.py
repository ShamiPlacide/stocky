from datetime import date

from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import DailyReport, Item, Log, Variant
from .permissions import IsAdmin
from .serializers import (
    CustomTokenObtainPairSerializer,
    DailyReportSerializer,
    ItemSerializer,
    LogSerializer,
    VariantSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"error": "Refresh token required."}, status=400)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response({"error": "Invalid or already blacklisted token."}, status=400)
        return Response({"detail": "Logged out successfully."})


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.prefetch_related("variants").all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        Log.objects.create(
            user=self.request.user,
            action="DELETE",
            variant=None,
            quantity_changed=0,
        )
        instance.delete()


class VariantViewSet(viewsets.ModelViewSet):
    queryset = Variant.objects.select_related("item").all()
    serializer_class = VariantSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        old = self.get_object()
        instance = serializer.save()
        Log.objects.create(
            user=self.request.user,
            action="EDIT",
            variant=instance,
            quantity_changed=instance.quantity - old.quantity,
        )

    def perform_destroy(self, instance):
        Log.objects.create(
            user=self.request.user,
            action="DELETE",
            variant=instance,
            quantity_changed=0,
        )
        instance.delete()


class StockAddView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return _stock_change(request, action="ADD", sign=1)


class StockRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return _stock_change(request, action="REMOVE", sign=-1)


def _stock_change(request, action, sign):
    variant_id = request.data.get("variant_id")
    quantity = request.data.get("quantity")

    if variant_id is None or quantity is None:
        return Response({"error": "variant_id and quantity are required."}, status=400)

    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return Response({"error": "quantity must be an integer."}, status=400)

    if quantity <= 0:
        return Response({"error": "quantity must be a positive integer."}, status=400)

    variant = get_object_or_404(Variant, pk=variant_id)

    if action == "REMOVE" and variant.quantity < quantity:
        return Response({"error": "Insufficient stock."}, status=400)

    variant.quantity = F("quantity") + (sign * quantity)
    variant.save(update_fields=["quantity"])

    Log.objects.create(
        user=request.user,
        action=action,
        variant=variant,
        quantity_changed=sign * quantity,
    )

    variant.refresh_from_db()
    return Response(VariantSerializer(variant).data)


class LogListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        logs = Log.objects.select_related("user", "variant__item").all()
        date_filter = request.query_params.get("date")
        if date_filter:
            logs = logs.filter(timestamp__date=date_filter)
        serializer = LogSerializer(logs, many=True)
        return Response(serializer.data)


class DailyReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        today = date.today()
        logs_today = Log.objects.filter(timestamp__date=today).select_related(
            "user", "variant__item"
        )
        all_variants = Variant.objects.select_related("item").all()

        report_record = DailyReport.objects.create(
            date=today,
            generated_by=request.user,
        )

        return Response(
            {
                "date": str(today),
                "report_id": report_record.id,
                "logs": LogSerializer(logs_today, many=True).data,
                "inventory_snapshot": VariantSerializer(all_variants, many=True).data,
            }
        )
