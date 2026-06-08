"""
Views for the core app.
Contains public and authenticated API views for inquiry, timetable, etc.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .serializers import InquirySerializer


class InquiryCreateView(APIView):
    """
    Public endpoint to submit an inquiry/lead form.

    - No authentication required (anyone can submit).
    - POST only.
    - Validates all fields and saves to the Inquiry table.
    - Returns a success message along with the generated inquiry ID.

    URL: POST /api/inquiry/submit/
    """

    # No JWT required — this is a public lead-capture form
    permission_classes = (AllowAny,)

    def post(self, request):
        """
        Handle POST request for inquiry form submission.

        Request body (JSON):
            {
                "first_name": "Rahul",
                "middle_name": "Kumar",          # optional
                "last_name": "Sharma",
                "city": "Surat",                 # optional
                "mobile_number": "9876543210",
                "father_occupation": "Business", # optional
                "father_mobile": "9123456780",   # optional
                "mother_occupation": "Teacher",  # optional
                "mother_mobile": "9111222333",   # optional
                "reference": "social_media",     # newspaper | social_media | friends_relatives | other
                "reference_other": ""            # required only when reference = 'other'
            }

        Returns:
            201 Created  → {"success": true, "message": "...", "inquiry_id": "<uuid>"}
            400 Bad Request → {"success": false, "errors": { ... }}
        """
        serializer = InquirySerializer(data=request.data)

        if serializer.is_valid():
            # Save to database using the serializer's create() method
            inquiry = serializer.save()
            return Response(
                {
                    "success": True,
                    "message": "Thank you! Your inquiry has been submitted successfully. Our team will contact you soon.",
                    "inquiry_id": str(inquiry.id),
                },
                status=status.HTTP_201_CREATED
            )

        # Return field-level validation errors in a clean structure
        return Response(
            {
                "success": False,
                "message": "Please fix the errors below and resubmit.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST
        )
