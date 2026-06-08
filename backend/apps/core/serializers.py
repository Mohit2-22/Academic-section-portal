"""
Serializers for the core app.
Handles validation and data transformation for API endpoints.
"""

from rest_framework import serializers
from .models import Inquiry


class InquirySerializer(serializers.Serializer):
    """
    Serializer for the public Inquiry submission form.
    Maps API-facing field names to the Inquiry model's actual DB column names.

    Fields:
        - mobile_number    → stored as Inquiry.mobile
        - reference        → stored as Inquiry.reference_source
        - reference_other  → optional, required only when reference == 'other'
    """

    # ── Personal Details ───────────────────────────────────────────────────────
    first_name = serializers.CharField(
        max_length=100,
        error_messages={"required": "First name is required.", "blank": "First name cannot be empty."}
    )
    middle_name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=""
    )
    last_name = serializers.CharField(
        max_length=100,
        error_messages={"required": "Last name is required.", "blank": "Last name cannot be empty."}
    )
    city = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=""
    )
    mobile_number = serializers.CharField(
        max_length=10,
        error_messages={"required": "Mobile number is required.", "blank": "Mobile number cannot be empty."}
    )

    # ── Parent Details ─────────────────────────────────────────────────────────
    father_occupation = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=""
    )
    father_mobile = serializers.CharField(
        max_length=10,
        required=False,
        allow_blank=True,
        default=""
    )
    mother_occupation = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=""
    )
    mother_mobile = serializers.CharField(
        max_length=10,
        required=False,
        allow_blank=True,
        default=""
    )

    # ── Reference Source ───────────────────────────────────────────────────────
    REFERENCE_CHOICES = [
        ('newspaper', 'Newspaper'),
        ('social_media', 'Social Media'),
        ('friends_relatives', 'Friends/Relatives'),
        ('other', 'Other'),
    ]

    reference = serializers.ChoiceField(
        choices=REFERENCE_CHOICES,
        error_messages={
            "required": "Please tell us how you heard about us.",
            "invalid_choice": "Invalid reference. Choose from: newspaper, social_media, friends_relatives, other."
        }
    )
    reference_other = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Required only when reference is 'other'."
    )

    # ── Field-level Validators ─────────────────────────────────────────────────

    def validate_mobile_number(self, value):
        """Ensure mobile number is exactly 10 numeric digits."""
        cleaned = value.strip()
        if not cleaned.isdigit():
            raise serializers.ValidationError("Mobile number must contain digits only.")
        if len(cleaned) != 10:
            raise serializers.ValidationError("Mobile number must be exactly 10 digits.")
        return cleaned

    def validate_father_mobile(self, value):
        """Ensure father's mobile number, if provided, is exactly 10 numeric digits."""
        if not value or value.strip() == "":
            return value
        cleaned = value.strip()
        if not cleaned.isdigit():
            raise serializers.ValidationError("Father's mobile number must contain digits only.")
        if len(cleaned) != 10:
            raise serializers.ValidationError("Father's mobile number must be exactly 10 digits.")
        return cleaned

    def validate_mother_mobile(self, value):
        """Ensure mother's mobile number, if provided, is exactly 10 numeric digits."""
        if not value or value.strip() == "":
            return value
        cleaned = value.strip()
        if not cleaned.isdigit():
            raise serializers.ValidationError("Mother's mobile number must contain digits only.")
        if len(cleaned) != 10:
            raise serializers.ValidationError("Mother's mobile number must be exactly 10 digits.")
        return cleaned

    # ── Cross-field Validator ──────────────────────────────────────────────────

    def validate(self, data):
        """
        Cross-field validation.
        If reference is 'other', reference_other must be provided and non-empty.
        """
        if data.get('reference') == 'other':
            other_text = data.get('reference_other', '').strip()
            if not other_text:
                raise serializers.ValidationError({
                    'reference_other': "Please specify how you heard about us (this field is required when reference is 'other')."
                })
        return data

    # ── Save Helper ────────────────────────────────────────────────────────────

    def create(self, validated_data):
        """
        Save the validated inquiry data to the database.
        Maps serializer field names to the Inquiry model's field names.
        """
        return Inquiry.objects.create(
            first_name=validated_data['first_name'],
            middle_name=validated_data.get('middle_name', ''),
            last_name=validated_data['last_name'],
            city=validated_data.get('city', ''),
            mobile=validated_data['mobile_number'],               # API: mobile_number → DB: mobile
            father_occupation=validated_data.get('father_occupation', ''),
            father_mobile=validated_data.get('father_mobile', ''),
            mother_occupation=validated_data.get('mother_occupation', ''),
            mother_mobile=validated_data.get('mother_mobile', ''),
            reference_source=validated_data['reference'],         # API: reference → DB: reference_source
            reference_other=validated_data.get('reference_other', ''),
        )
