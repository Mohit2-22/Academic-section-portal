"""
URL configuration for the users app.
Covers: login, refresh token, logout.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, LogoutView

urlpatterns = [
    # POST /api/auth/login/   → returns access + refresh tokens + user info
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),

    # POST /api/auth/refresh/ → send {"refresh": "<token>"} to get new access token
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # POST /api/auth/logout/  → send {"refresh": "<token>"} to blacklist it
    path('logout/', LogoutView.as_view(), name='logout'),
]
