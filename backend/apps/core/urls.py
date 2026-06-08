"""
URL configuration for the core app.
"""

from django.urls import path
from .views import InquiryCreateView

urlpatterns = [
    # Public inquiry/lead submission form
    # POST /api/inquiry/submit/
    path('inquiry/submit/', InquiryCreateView.as_view(), name='inquiry_submit'),
]
