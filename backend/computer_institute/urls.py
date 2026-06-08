"""
URL configuration for computer_institute project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django built-in admin panel
    path("django-admin/", admin.site.urls),

    # ── Authentication APIs ──────────────────────────────────────────────────
    # POST /api/auth/login/   → get access + refresh tokens
    # POST /api/auth/refresh/ → get new access token
    # POST /api/auth/logout/  → blacklist refresh token
    path("api/auth/", include("apps.users.urls")),

    # ── Core APIs ────────────────────────────────────────────────────────────
    # POST /api/inquiry/submit/ → public inquiry form submission
    path("api/", include("apps.core.urls")),
]

# Serve uploaded media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
