from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom serializer extending Simple JWT's TokenObtainPairSerializer.
    Appends user profile details and role info to the login response 
    for immediate routing compatibility with the React frontend.
    """
    def validate(self, attrs):
        # Authenticate using standard Simple JWT credentials validation
        data = super().validate(attrs)
        
        user = self.user
        
        # Dynamically fetch profile ID based on the user's role
        profile_id = None
        if user.role == 'student':
            student = getattr(user, 'student_profile', None)
            if student:
                profile_id = str(student.id)
        elif user.role == 'faculty':
            faculty = getattr(user, 'faculty_profile', None)
            if faculty:
                profile_id = str(faculty.id)
                
        # Inject custom user context payload
        data['user'] = {
            'user_id': str(user.id),
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'profile_id': profile_id,
            'is_active': user.is_active,
        }
        return data
