from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    DailyReportView,
    ItemViewSet,
    LogListView,
    LogoutView,
    StockAddView,
    StockRemoveView,
    VariantViewSet,
)

router = DefaultRouter()
router.register(r"items", ItemViewSet, basename="items")
router.register(r"variants", VariantViewSet, basename="variants")

urlpatterns = [
    path("auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("stock/add/", StockAddView.as_view(), name="stock_add"),
    path("stock/remove/", StockRemoveView.as_view(), name="stock_remove"),
    path("logs/", LogListView.as_view(), name="logs"),
    path("report/daily/", DailyReportView.as_view(), name="report_daily"),
    path("", include(router.urls)),
]
