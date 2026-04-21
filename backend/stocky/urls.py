from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]

if settings.DEBUG:
    from django.views.static import serve
    from pathlib import Path
    FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

    urlpatterns += [
        path("", serve, {"document_root": FRONTEND_DIR, "path": "index.html"}),
        re_path(r"^(?P<path>.+)$", serve, {"document_root": FRONTEND_DIR}),
    ]
