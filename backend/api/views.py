from datetime import date

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import DailyReport, Item, Log, Sale, SaleItem, User, Variant
from .permissions import IsAdmin
from .serializers import (
    CustomTokenObtainPairSerializer,
    ItemSerializer,
    LogSerializer,
    SaleSerializer,
    StaffSerializer,
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
        return Response(LogSerializer(logs, many=True).data)


class DailyReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        today = date.today()
        logs_today = Log.objects.filter(
            timestamp__date=today,
            action__in=["ADD", "REMOVE"],
        ).select_related("user", "variant__item")
        items = Item.objects.prefetch_related("variants").order_by("name")

        DailyReport.objects.create(date=today, generated_by=request.user)

        return Response({
            "date": str(today),
            "logs": LogSerializer(logs_today, many=True).data,
            "items": ItemSerializer(items, many=True).data,
        })


class SaleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sales = Sale.objects.prefetch_related("items").select_related("created_by").all()
        return Response(SaleSerializer(sales, many=True).data)

    def post(self, request):
        customer_name = request.data.get("customer_name", "").strip()
        items_data = request.data.get("items", [])

        if not customer_name:
            return Response({"error": "customer_name is required."}, status=400)
        if not items_data:
            return Response({"error": "At least one item is required."}, status=400)

        with transaction.atomic():
            for entry in items_data:
                try:
                    qty = int(entry.get("quantity", 0))
                except (TypeError, ValueError):
                    return Response({"error": "quantity must be an integer."}, status=400)
                if qty <= 0:
                    return Response({"error": "quantity must be positive."}, status=400)
                variant = get_object_or_404(Variant, pk=entry.get("variant_id"))
                if variant.quantity < qty:
                    return Response(
                        {"error": f"Insufficient stock for {variant.code} — {variant.name}."},
                        status=400,
                    )

            sale = Sale.objects.create(customer_name=customer_name, created_by=request.user)

            for entry in items_data:
                qty = int(entry["quantity"])
                variant = Variant.objects.select_related("item").get(pk=entry["variant_id"])
                SaleItem.objects.create(
                    sale=sale,
                    variant=variant,
                    variant_code=variant.code,
                    variant_name=variant.name,
                    item_name=variant.item.name,
                    quantity=qty,
                )
                variant.quantity = F("quantity") - qty
                variant.save(update_fields=["quantity"])
                Log.objects.create(
                    user=request.user,
                    action="SALE",
                    variant=variant,
                    quantity_changed=-qty,
                )

        sale.refresh_from_db()
        return Response(SaleSerializer(Sale.objects.prefetch_related("items").get(pk=sale.pk)).data, status=201)


class StaffListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        staff = User.objects.all().order_by("username")
        return Response(StaffSerializer(staff, many=True).data)

    def post(self, request):
        serializer = StaffSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(StaffSerializer(user).data, status=201)
        return Response(serializer.errors, status=400)


class StaffDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user == request.user:
            return Response({"error": "You cannot delete your own account."}, status=400)
        user.delete()
        return Response({"detail": "User deleted."})
