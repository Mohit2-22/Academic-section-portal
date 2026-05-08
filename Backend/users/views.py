from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Avg, Count, Q
from django.db import models, IntegrityError
from django.utils import timezone
from datetime import datetime, timedelta

from .models import User, Student, Faculty, Admin
from .serializers import (
    UserSerializer,
    LoginSerializer,
    StudentSerializer,
    FacultySerializer,
    AdminSerializer,
    StudentProfileUpdateSerializer,
    FacultyProfileUpdateSerializer,
    CreateUserSerializer,
    PasswordResetSerializer,
)
from django.core.mail import send_mail
from django.conf import settings
from academics.models import Course, Subject, SemesterResult
from academics.serializers import (
    SemesterResultSerializer,
    CourseSerializer,
    SubjectSerializer,
)


# Attendance models removed - using empty fallbacks
Attendance = None
ClassSession = None


# =============================================
# AUTHENTICATION VIEWS
# =============================================


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    login_id = serializer.validated_data["email"]
    password = serializer.validated_data["password"]

    user = None
    if "@" in login_id:
        # Try direct authenticate with email
        user = authenticate(request, email=login_id, password=password)
        # Fallback: check if it's a student/faculty personal email mapped to a User
        if user is None:
            try:
                student = Student.objects.get(email=login_id)
                if student.user:
                    user = authenticate(request, email=student.user.email, password=password)
            except Student.DoesNotExist:
                pass
        if user is None:
            try:
                fac = Faculty.objects.get(email=login_id)
                if fac.user:
                    user = authenticate(request, email=fac.user.email, password=password)
            except Faculty.DoesNotExist:
                pass
    else:
        # Try enrollment_no -> student
        try:
            student = Student.objects.get(enrollment_no=login_id)
            user_email = student.user.email if student.user else student.email
            user = authenticate(request, email=user_email, password=password)
        except Student.DoesNotExist:
            pass
        # Try employee_id -> faculty
        if user is None:
            try:
                faculty = Faculty.objects.get(employee_id=login_id)
                user_email = faculty.user.email if faculty.user else faculty.email
                user = authenticate(request, email=user_email, password=password)
            except Faculty.DoesNotExist:
                pass
        # Try admin_id -> admin
        if user is None:
            try:
                admin = Admin.objects.get(admin_id=login_id)
                user_email = admin.user.email if admin.user else admin.email
                user = authenticate(request, email=user_email, password=password)
            except Admin.DoesNotExist:
                pass

    if user is None:
        return Response(
            {"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.is_active:
        return Response(
            {"error": "Account is disabled"}, status=status.HTTP_403_FORBIDDEN
        )

    refresh = RefreshToken.for_user(user)
    # Get profile data based on role
    profile_data = {}
    if user.role == "student" and hasattr(user, "student_profile"):
        profile_data = StudentSerializer(user.student_profile).data
    elif user.role == "faculty" and hasattr(user, "faculty_profile"):
        profile_data = FacultySerializer(user.faculty_profile).data
    elif user.role == "admin" and hasattr(user, "admin_profile"):
        profile_data = AdminSerializer(user.admin_profile).data

    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
            "profile": profile_data,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token_view(request):
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return Response(
            {"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST
        )
    try:
        refresh = RefreshToken(refresh_token)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        )
    except Exception:
        return Response(
            {"error": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(["POST"])
def logout_view(request):
    try:
        refresh_token = request.data.get("refresh")
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass
    return Response({"message": "Logged out successfully"})


from django.shortcuts import redirect
import json
from django.utils.http import urlencode

def social_login_success(request):
    """
    Handle successful social login and redirect back to frontend with tokens.
    """
    if not request.user.is_authenticated:
        return redirect('http://localhost:5173/login?error=not_authenticated')

    user = request.user
    refresh = RefreshToken.for_user(user)

    # ── Auto-link Profile if missing ──────────────────────────────────
    if user.role == "student" and not hasattr(user, "student_profile"):
        from .models import Student
        student = Student.objects.filter(email=user.email, user__isnull=True).first()
        if student:
            student.user = user
            student.save()
            
    elif user.role == "faculty" and not hasattr(user, "faculty_profile"):
        from .models import Faculty
        faculty = Faculty.objects.filter(email=user.email, user__isnull=True).first()
        if faculty:
            faculty.user = user
            faculty.save()

    # Get profile data based on role
    profile_data = {}
    if user.role == "student" and hasattr(user, "student_profile"):
        profile_data = StudentSerializer(user.student_profile).data
    elif user.role == "faculty" and hasattr(user, "faculty_profile"):
        profile_data = FacultySerializer(user.faculty_profile).data
    elif user.role == "admin" and hasattr(user, "admin_profile"):
        profile_data = AdminSerializer(user.admin_profile).data

    # Prepare data for frontend
    data = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
        "profile": profile_data
    }

    # Build redirect URL with tokens in query string (encoded as JSON)
    from django.core.serializers.json import DjangoJSONEncoder
    params = {
        "social_login": "success",
        "data": json.dumps(data, cls=DjangoJSONEncoder)
    }
    
    # Also determine dashboard redirect
    target_dashboard = "/student/dashboard"
    if user.role == "faculty":
        target_dashboard = "/faculty/dashboard"
    elif user.role == "admin":
        target_dashboard = "/admin/dashboard"
        
    params["redirect"] = target_dashboard

    return redirect(f"http://localhost:5173/login?{urlencode(params)}")


def resolve_user_by_login_id(login_id):
    from .models import User, Student, Faculty, Admin
    user = None
    if "@" in login_id:
        try:
            user = User.objects.get(email=login_id)
        except User.DoesNotExist:
            try:
                student = Student.objects.get(email=login_id)
                if student.user:
                    user = student.user
            except Student.DoesNotExist:
                pass
            if not user:
                try:
                    fac = Faculty.objects.get(email=login_id)
                    if fac.user:
                        user = fac.user
                except Faculty.DoesNotExist:
                    pass
    else:
        try:
            student = Student.objects.get(enrollment_no=login_id)
            if student.user:
                user = student.user
        except Student.DoesNotExist:
            pass
        if not user:
            try:
                faculty = Faculty.objects.get(employee_id=login_id)
                if faculty.user:
                    user = faculty.user
            except Faculty.DoesNotExist:
                pass
        if not user:
            try:
                admin = Admin.objects.get(admin_id=login_id)
                if admin.user:
                    user = admin.user
            except Admin.DoesNotExist:
                pass
    return user


@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_reset_view(request):
    import random
    import logging
    from .models import PasswordResetOTP
    
    login_id = request.data.get("login_id")
    if not login_id:
        return Response({"error": "Login ID (Enrollment/Employee ID or Email) is required"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        user = resolve_user_by_login_id(login_id)
        if not user:
            raise User.DoesNotExist
        
        # Rate limiting: max 3 requests in the last 10 minutes
        ten_mins_ago = timezone.now() - timedelta(minutes=10)
        recent_requests = PasswordResetOTP.objects.filter(user=user, created_at__gte=ten_mins_ago).count()
        if recent_requests >= 3:
            return Response({"error": "Too many requests. Please try again later."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            
        # Generate 6-digit OTP
        otp = f"{random.randint(100000, 999999)}"
        expires_at = timezone.now() + timedelta(minutes=5)
        
        PasswordResetOTP.objects.create(user=user, otp=otp, expires_at=expires_at)
        
        # Send Email
        logger = logging.getLogger(__name__)
        try:
            send_mail(
                subject="Password Reset OTP - AMPICS",
                message=f"Your OTP for password reset is {otp}. It is valid for 5 minutes. DO NOT share this with anyone.",
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@guni.ac.in'),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send OTP email to {user.email}: {str(e)}")
            return Response({"error": "Failed to send email. Please try again later."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except User.DoesNotExist:
        # Do not reveal that the user does not exist to prevent enumeration
        pass
        
    return Response({"message": "If your account exists, an OTP will be sent to your registered email address."})


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_verify_view(request):
    from .models import PasswordResetOTP
    
    login_id = request.data.get("login_id")
    otp = request.data.get("otp")
    new_password = request.data.get("new_password")
    
    if not all([login_id, otp, new_password]):
        return Response({"error": "Login ID, OTP, and new_password are required"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        user = resolve_user_by_login_id(login_id)
        if not user:
            raise User.DoesNotExist
            
        # Find valid OTP
        valid_otp = PasswordResetOTP.objects.filter(
            user=user,
            otp=otp,
            is_used=False,
            expires_at__gte=timezone.now()
        ).first()
        
        if not valid_otp:
            return Response({"error": "Invalid or expired OTP"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Reset password
        user.set_password(new_password)
        user.save()
        
        # Invalidate OTP
        valid_otp.is_used = True
        valid_otp.save()
        
        return Response({"message": "Password reset successfully"})
        
    except User.DoesNotExist:
        # Avoid user enumeration
        return Response({"error": "Invalid or expired OTP"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def request_email_change_view(request):
    import random
    import logging
    from .models import PasswordResetOTP
    from django.core.mail import send_mail
    from django.conf import settings
    
    new_email = request.data.get("new_email")
    if not new_email:
        return Response({"error": "New email is required"}, status=status.HTTP_400_BAD_REQUEST)
        
    user = request.user
    
    if user.email == new_email:
        return Response({"error": "New email cannot be the same as the current email."}, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    expires_at = timezone.now() + timedelta(minutes=10)
    
    # Store the new email in the OTP object (using it temporarily) or session. 
    # But PasswordResetOTP doesn't have a new_email field. 
    # Wait, instead of hacking PasswordResetOTP, let's use caching or create a temporary model.
    # Since we can't create a model here without migrations easily, we can use Django's cache.
    from django.core.cache import cache
    cache_key = f"email_change_otp_{user.id}"
    cache.set(cache_key, {"otp": otp, "new_email": new_email}, timeout=600)
    
    logger = logging.getLogger(__name__)
    try:
        send_mail(
            subject="Email Change Verification - AMPICS",
            message=f"Your OTP for verifying your new email is {otp}. It is valid for 10 minutes.",
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@guni.ac.in'),
            recipient_list=[new_email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f"Failed to send email verification OTP to {new_email}: {str(e)}")
        return Response({"error": "Failed to send email. Please check the email address."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    return Response({"message": "Verification OTP sent to new email address."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_email_change_view(request):
    from django.core.cache import cache
    
    otp = request.data.get("otp")
    if not otp:
        return Response({"error": "OTP is required"}, status=status.HTTP_400_BAD_REQUEST)
        
    user = request.user
    cache_key = f"email_change_otp_{user.id}"
    cache_data = cache.get(cache_key)
    
    if not cache_data or cache_data.get("otp") != otp:
        return Response({"error": "Invalid or expired OTP"}, status=status.HTTP_400_BAD_REQUEST)
        
    new_email = cache_data.get("new_email")
    
    # Check if email is already taken by another user
    from .models import User
    if User.objects.filter(email=new_email).exclude(id=user.id).exists():
        return Response({"error": "This email is already in use by another account."}, status=status.HTTP_400_BAD_REQUEST)
        
    # Update email
    user.email = new_email
    user.save()
    
    # Update profile email if applicable
    if user.role == "student" and hasattr(user, "student_profile"):
        user.student_profile.email = new_email
        user.student_profile.save()
    elif user.role == "faculty" and hasattr(user, "faculty_profile"):
        user.faculty_profile.email = new_email
        user.faculty_profile.save()
    elif user.role == "admin" and hasattr(user, "admin_profile"):
        user.admin_profile.email = new_email
        user.admin_profile.save()
        
    # Clear cache
    cache.delete(cache_key)
    
    return Response({"message": "Email address updated successfully."})


@api_view(["GET"])
def user_notifications(request):
    from .models import Notification
    from .serializers import NotificationSerializer
    from django.db.models import Q

    # Build filter based on user role and identity
    q = Q(target="Global") | Q(target="All") | Q(target=request.user.email)

    if request.user.role == "student":
        q |= Q(target__icontains="Student")
        try:
            profile = request.user.student_profile
            q |= Q(target=profile.name)

            # ── Targeted Proxy Notification Tag ────────────────────────────
            # The mark_proxy view creates notifications with this EXACT format:
            #   target = "COURSE_{course_id}_SEM{semester}_SEC{section}"
            # Students receive notifications for:
            #   1. Their specific course + semester + section
            #   2. The "All" section broadcast for their semester
            course_id = profile.course_id
            sem = profile.current_semester
            section = profile.batch or "A"  # batch letter maps to section

            # Exact section match (e.g., COURSE_uuid_SEM3_SECA)
            q |= Q(target=f"COURSE_{course_id}_SEM{sem}_SEC{section}")
            # Section = 'All' catchall (admin-sent to entire semester)
            q |= Q(target=f"COURSE_{course_id}_SEM{sem}_SECAll")
            # Legacy format support (COURSE_uuid_sem_section)
            q |= Q(target=f"COURSE_{course_id}_{sem}_{section}")
            q |= Q(target=f"COURSE_{course_id}_{sem}_All")
        except Exception:
            pass

    elif request.user.role == "faculty":
        q |= Q(target__icontains="Faculty")
        try:
            fac = request.user.faculty_profile
            q |= Q(target=fac.name)
            # Faculty receive proxy assignment & confirmation notifications by email
            q |= Q(target=fac.email)
        except Exception:
            pass

    elif request.user.role == "admin":
        # Admin sees ALL notifications for audit/record-keeping
        q = Q()

    notifications = Notification.objects.filter(q).order_by("-created_at")[:50]
    return Response(NotificationSerializer(notifications, many=True).data)


# =============================================
# STUDENT VIEWS
# =============================================


@api_view(["GET"])
def student_dashboard(request):
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Attendance percentage from attendance_ai module
    attendance_pct = 0
    try:
        from attendance_ai.models import AttendanceRecord
        total_records = AttendanceRecord.objects.filter(student=request.user).count()
        present_records = AttendanceRecord.objects.filter(
            student=request.user, status__in=["present", "late"]
        ).count()
        if total_records > 0:
            attendance_pct = round((present_records / total_records * 100), 1)
    except Exception:
        pass

    # Upcoming exams
    upcoming_exams_count = 0
    upcoming_exams_data = []

    # Pending assignments
    pending_assignments_count = 0
    pending_assignments_data = []

    # Latest grade from semester results
    latest_result = (
        SemesterResult.objects.filter(student=student)
        .order_by("-semester")
        .first()
    )

    # Today's schedule
    today_classes = []
    try:
        from academics.models import TimetableSlot
        day_now = timezone.now().strftime("%A")
        
        slots = TimetableSlot.objects.filter(
            course=student.course, 
            semester=student.current_semester,
            day_of_week=day_now
        ).select_related("subject", "room").order_by("start_time")
        
        now_time = timezone.now().time()
        for slot in slots:
            status = "upcoming"
            if slot.start_time <= now_time <= slot.end_time:
                status = "ongoing"
            elif now_time > slot.end_time:
                status = "completed"
                
            today_classes.append({
                "id": str(slot.slot_id),
                "subject": slot.subject.name,
                "time": f"{slot.start_time.strftime('%I:%M %p')} - {slot.end_time.strftime('%I:%M %p')}",
                "room": slot.room.room_number if slot.room else "TBD",
                "status": status
            })
    except Exception:
        pass

    return Response(
        {
            "student": StudentSerializer(student).data,
            "attendance_percentage": attendance_pct,
            "today_classes": today_classes,
            "total_subjects": Subject.objects.filter(course=student.course, semester=student.current_semester).count(),
            "upcoming_exams_count": upcoming_exams_count,
            "upcoming_exams": upcoming_exams_data,
            "pending_assignments_count": pending_assignments_count,
            "pending_assignments": pending_assignments_data,
            "latest_sgpa": float(latest_result.sgpa)
            if latest_result and latest_result.sgpa
            else None,
            "cgpa": float(student.cgpa),
        }
    )


@api_view(["GET"])
def student_results(request):
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    current_sem = max(student.semester, student.current_semester)
    if current_sem < 1:
        current_sem = 1

    results = SemesterResult.objects.filter(student=student).order_by("semester")
    
    semesters_data = []
    
    if results.exists():
        for result in results:
            subject_results = []
            for sr in result.subject_results.select_related("subject").all():
                subject_results.append({
                    "subject_result_id": str(sr.subject_result_id),
                    "subject_code": sr.subject.code,
                    "subject_name": sr.subject.name,
                    "internal_marks": sr.internal_marks,
                    "external_marks": sr.external_marks,
                    "practical_marks": sr.practical_marks,
                    "total_marks": sr.total_marks,
                    "passing_marks": sr.passing_marks,
                    "is_passed": sr.is_passed,
                    "grade": sr.grade or "-",
                })

            semesters_data.append({
                "result_id": str(result.result_id),
                "semester": result.semester,
                "sgpa": float(result.sgpa) if result.sgpa else 0.0,
                "total_marks": result.total_marks,
                "obtained_marks": result.obtained_marks,
                "percentage": float(result.percentage) if result.percentage else 0.0,
                "grade": result.grade or "-",
                "status": result.status,
                "year": result.year,
                "exam_type": result.exam_type,
                "remarks": result.remarks,
                "subject_results": subject_results,
            })
    else:
        # Mock data generation for demonstration purposes
        import random
        base_year = 2026 - ((current_sem + 1) // 2)
        
        for sem in range(1, current_sem):
            sgpa = round(random.uniform(7.5, 9.8), 2)
            
            # Create dummy subject results
            subj_results = []
            for i in range(1, 6):
                total = random.randint(70, 100)
                subj_results.append({
                    "subject_result_id": f"mock-{sem}-{i}",
                    "subject_code": f"SUB{sem}0{i}",
                    "subject_name": f"Core Subject {sem}.{i}",
                    "internal_marks": random.randint(20, 30),
                    "external_marks": random.randint(40, 70),
                    "practical_marks": 0,
                    "total_marks": total,
                    "passing_marks": 35,
                    "is_passed": True,
                    "grade": "O" if total > 90 else ("A+" if total > 80 else "A"),
                })
                
            semesters_data.append({
                "result_id": f"mock-res-{sem}",
                "semester": sem,
                "sgpa": sgpa,
                "total_marks": 500,
                "obtained_marks": int((sgpa / 10.0) * 500),
                "percentage": round((sgpa * 9.5), 2),
                "grade": "O" if sgpa > 9 else "A+",
                "status": "Pass",
                "year": base_year + (sem // 2),
                "exam_type": "Regular",
                "remarks": "Generated mock data",
                "subject_results": subj_results,
            })

    # Dropdown: semesters 1 to (current_sem - 1) for SGPA history
    dropdown_semesters = list(range(1, current_sem))
    
    # Calculate CGPA from mock or real data
    total_sgpa = sum(s["sgpa"] for s in semesters_data)
    calc_cgpa = round(total_sgpa / len(semesters_data), 2) if semesters_data else 0.0
    
    # If student.cgpa is 0 or different, maybe prefer calc_cgpa for mock
    display_cgpa = calc_cgpa if not results.exists() else (float(student.cgpa) if student.cgpa else calc_cgpa)

    return Response(
        {
            "cgpa": display_cgpa,
            "current_semester": current_sem,
            "total_semesters": student.course.total_semesters if student.course else 8,
            "course_name": student.course.name if student.course else "N/A",
            "enrollment_no": student.enrollment_no,
            "student_name": student.name,
            "dropdown_semesters": dropdown_semesters,
            "semesters": semesters_data,
        }
    )


@api_view(["GET"])
def student_attendance(request):
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Query real attendance data from attendance_ai module
    from attendance_ai.models import AttendanceRecord, LectureSession

    user = request.user
    records = AttendanceRecord.objects.filter(student=user).select_related(
        "session", "session__subject"
    )

    total_classes = records.count()
    present = records.filter(status__in=["present", "late"]).count()
    absent = records.filter(status="absent").count()
    percentage = round((present / total_classes * 100), 1) if total_classes > 0 else 0

    # Build subject-wise breakdown
    subject_map = {}
    for rec in records:
        subj = rec.session.subject
        key = str(subj.subject_id)
        if key not in subject_map:
            subject_map[key] = {
                "subject": f"{subj.name} ({subj.code})",
                "total": 0,
                "present": 0,
                "absent": 0,
            }
        subject_map[key]["total"] += 1
        if rec.status in ["present", "late"]:
            subject_map[key]["present"] += 1
        elif rec.status == "absent":
            subject_map[key]["absent"] += 1

    subject_breakdown = []
    for data in subject_map.values():
        data["percentage"] = (
            round((data["present"] / data["total"] * 100), 1)
            if data["total"] > 0
            else 0
        )
        subject_breakdown.append(data)

    # Also include subjects where student has sessions but no record yet
    # (sessions from the student's course that ended)
    if student.course:
        ended_sessions = LectureSession.objects.filter(
            subject__course=student.course, is_active=False
        ).exclude(
            records__student=user
        ).select_related("subject")

        for session in ended_sessions:
            key = str(session.subject.subject_id)
            if key not in subject_map:
                subject_map[key] = {
                    "subject": f"{session.subject.name} ({session.subject.code})",
                    "total": 0,
                    "present": 0,
                    "absent": 0,
                }
            subject_map[key]["total"] += 1
            subject_map[key]["absent"] += 1
            total_classes += 1
            absent += 1

        # Recalculate overall percentage with missed sessions included
        percentage = (
            round((present / total_classes * 100), 1) if total_classes > 0 else 0
        )

        # Rebuild subject_breakdown with updated data
        subject_breakdown = []
        for data in subject_map.values():
            data["percentage"] = (
                round((data["present"] / data["total"] * 100), 1)
                if data["total"] > 0
                else 0
            )
            subject_breakdown.append(data)

    # Build recent records list
    recent_records = []
    for rec in records.order_by("-marked_at")[:20]:
        recent_records.append({
            "subject": rec.session.subject.name,
            "date": str(rec.session.date),
            "status": rec.status,
            "marked_via": rec.marked_via,
            "marked_at": rec.marked_at,
        })

    return Response(
        {
            "total_classes": total_classes,
            "present": present,
            "absent": absent,
            "percentage": percentage,
            "subject_breakdown": subject_breakdown,
            "records": recent_records,
        }
    )


@api_view(["POST"])
def student_mark_attendance(request):
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    return Response(
        {"message": "Attendance module is currently disabled.", "status": "disabled"}
    )


@api_view(["GET"])
def student_assignments(request):
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Assignments module removed - returning empty data
    return Response({"assignments": []})


@api_view(["POST"])
def student_submit_assignment(request):
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Assignments module removed
    return Response(
        {"error": "Assignment submission is disabled"},
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["GET", "PUT"])
def student_profile(request):
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response(
            {"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    if request.method == "GET":
        return Response(StudentSerializer(student).data)

    serializer = StudentProfileUpdateSerializer(
        student, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(StudentSerializer(student).data)


# =============================================
# FACULTY VIEWS
# =============================================


@api_view(["GET"])
def faculty_dashboard(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # First get assigned subjects (directly assigned to this faculty via M2M)
    assigned_subjects = list(faculty.subjects.select_related("course").all())

    # If no explicitly assigned subjects, derive from timetable slots
    if not assigned_subjects:
        from academics.models import TimetableSlot, Subject
        subject_ids = TimetableSlot.objects.filter(faculty=faculty).values_list("subject_id", flat=True)
        assigned_subjects = list(Subject.objects.filter(subject_id__in=subject_ids).select_related("course"))

    subjects_data = []
    course_ids = set()
    semester_course_pairs = set()
    for s in assigned_subjects:
        course_ids.add(s.course_id)
        semester_course_pairs.add((s.course_id, s.semester))
        subjects_data.append(
            {
                "subject_id": str(s.subject_id),
                "code": s.code,
                "name": s.name,
                "semester": s.semester,
                "credits": s.credits,
                "course_id": str(s.course_id) if s.course else "",
                "course_code": s.course.code if s.course else "",
                "course_name": s.course.name if s.course else "",
                "campus_branch": s.campus_branch,
            }
        )

    # Get "today's classes" from Timetable
    from academics.models import TimetableSlot
    from datetime import datetime
    today = datetime.now().strftime("%A")
    today_slots = TimetableSlot.objects.filter(faculty=faculty, day_of_week=today).select_related('subject', 'room').order_by('start_time')
    
    today_classes_data = []
    for slot in today_slots:
        today_classes_data.append({
            "subject_name": slot.subject.name,
            "subject_code": slot.subject.code,
            "time": slot.start_time.strftime("%H:%M:%S") if slot.start_time else None,
            "end_time": slot.end_time.strftime("%H:%M:%S") if slot.end_time else None,
            "section": slot.section,
            "room": slot.room.room_number if slot.room else slot.room_name,
            "attendance_marked": False
        })

    # If faculty is class teacher, also get students from their class
    class_student_count = 0
    if faculty.is_class_teacher and faculty.class_course and faculty.class_semester:
        class_student_count = Student.objects.filter(
            course=faculty.class_course, current_semester=faculty.class_semester
        ).count()

    # Total students across assigned courses
    total_students = (
        Student.objects.filter(course_id__in=course_ids).count() if course_ids else 0
    )

    # Generated exam papers count
    try:
        from AI_Powered_Exam_Paper_Generator.models import GeneratedPaper

        generated_papers_count = GeneratedPaper.objects.count()
    except Exception:
        generated_papers_count = 0

    return Response(
        {
            "faculty": FacultySerializer(faculty).data,
            "today_classes": today_classes_data,
            "today_classes_count": len(today_classes_data),
            "subjects": subjects_data,
            "total_students": total_students,
            "class_teacher_info": {
                "is_class_teacher": faculty.is_class_teacher,
                "course": faculty.class_course.name if faculty.class_course else None,
                "semester": faculty.class_semester,
                "student_count": class_student_count,
            },
            "generated_papers_count": generated_papers_count,
            "lowest_attendance_per_course": [],
        }
    )


@api_view(["GET"])
def faculty_attendance_classes(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Attendance module removed - returning empty data
    return Response([])


@api_view(["GET"])
def faculty_students(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    course_id = request.query_params.get("course_id")
    semester = request.query_params.get("semester")

    # Get faculty's assigned course IDs from subjects
    assigned_course_ids = set()
    for subject in faculty.subjects.all():
        assigned_course_ids.add(subject.course_id)

    # Start with students from assigned courses only
    if assigned_course_ids:
        students = Student.objects.filter(course_id__in=assigned_course_ids)
    else:
        # If no subjects assigned, check if faculty is class teacher
        if faculty.is_class_teacher and faculty.class_course:
            students = Student.objects.filter(course=faculty.class_course)
            if faculty.class_semester:
                students = students.filter(current_semester=faculty.class_semester)
        else:
            # No access to any students
            return Response([])

    if course_id:
        # Only allow filtering within assigned courses
        if course_id in [str(cid) for cid in assigned_course_ids]:
            students = students.filter(course_id=course_id)

    if semester:
        students = students.filter(current_semester=semester)

    students = students.order_by("enrollment_no")
    return Response(StudentSerializer(students, many=True).data)


@api_view(["POST"])
def faculty_mark_attendance(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Attendance module removed
    return Response(
        {
            "message": "Attendance module is currently disabled",
            "records": [],
        }
    )


@api_view(["GET"])
def faculty_check_attendance(request):
    """Check if attendance already exists for a subject+date combo."""
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Attendance module removed
    return Response({"submitted": False})


@api_view(["GET"])
def faculty_exams(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Exams module removed - returning empty data
    return Response([])


@api_view(["POST"])
def faculty_create_exam(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Exams module removed
    return Response(
        {"error": "Exam creation is disabled"}, status=status.HTTP_400_BAD_REQUEST
    )


@api_view(["POST"])
def faculty_generate_questions(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Exam question generation module removed
    return Response(
        {"error": "Question generation is disabled"}, status=status.HTTP_400_BAD_REQUEST
    )


@api_view(["GET"])
def faculty_schedule(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Schedule/ClassSession module removed - returning empty data
    return Response([])


@api_view(["GET", "PUT"])
def faculty_profile(request):
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    if request.method == "GET":
        return Response(FacultySerializer(faculty).data)

    serializer = FacultyProfileUpdateSerializer(
        faculty, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(FacultySerializer(faculty).data)


# =============================================
# ADMIN VIEWS
# =============================================


@api_view(["GET"])
def admin_dashboard(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    total_students = Student.objects.count()
    students_with_course = Student.objects.filter(course__isnull=False).count()
    students_without_course = Student.objects.filter(course__isnull=True).count()
    total_faculty = Faculty.objects.count()
    total_courses = Course.objects.count()
    total_subjects = Subject.objects.count()
    active_sessions = 0
    total_exams = 0
    published_exams = 0

    recent_students = StudentSerializer(
        Student.objects.order_by("-created_at")[:5], many=True
    ).data
    recent_attendance = 0

    return Response(
        {
            "total_students": total_students,
            "students_with_course": students_with_course,
            "students_without_course": students_without_course,
            "total_faculty": total_faculty,
            "total_courses": total_courses,
            "total_subjects": total_subjects,
            "active_sessions_today": active_sessions,
            "total_exams": total_exams,
            "published_exams": published_exams,
            "recent_students": recent_students,
            "recent_attendance_count": recent_attendance,
            "system_health": {
                "database": "connected",
                "maintenance_mode": False,
            },
        }
    )


@api_view(["GET"])
def admin_users(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    role_filter = request.query_params.get("role", None)
    status_filter = request.query_params.get("status", None)

    users = User.objects.all().order_by("-created_at")
    if role_filter:
        users = users.filter(role=role_filter)
    if status_filter:
        users = users.filter(is_active=(status_filter == "active"))

    users_data = []
    for user in users:
        data = UserSerializer(user).data
        if user.role == "student" and hasattr(user, "student_profile"):
            data["profile"] = StudentSerializer(user.student_profile).data
        elif user.role == "faculty" and hasattr(user, "faculty_profile"):
            data["profile"] = FacultySerializer(user.faculty_profile).data
        elif user.role == "admin" and hasattr(user, "admin_profile"):
            data["profile"] = AdminSerializer(user.admin_profile).data
        users_data.append(data)

    return Response({"users": users_data, "total": len(users_data)})


@api_view(["POST"])
def admin_create_user(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    data = request.data
    role = data.get("role")
    name = data.get("name")
    phone = data.get("phone", "")

    if not role or not name:
        return Response(
            {"error": "Role and name are required"}, status=status.HTTP_400_BAD_REQUEST
        )

    provided_email = data.get("email")  # Email from the form
    generated_id = ""

    # Role-specific logic
    try:
        if role == "student":
            password = "Guni@2026"
            course_id = data.get("course_id")
            if not course_id:
                return Response(
                    {"error": "course_id is required for student"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            course = Course.objects.get(course_id=course_id)

            # Map course to code (2 digits)
            course_codes = {
                "BCA": "30",
                "BSC-IT": "32",
                "BSC-IMS": "31",
                "BSC-CYBER": "32",
                "BSC-AIML": "32",
                "BTECH-IT": "39",
                "BTECH-CSE": "39",
                "MCA": "34",
                "MTECH": "37",
                "MSC-IT": "38",
                "MSC-IMS": "35",
                "MSC-CYBER": "36",
                "MSC-AIML": "33",
            }
            course_code = course_codes.get(course.code, "00")

            # Get admission year from data or use current year
            admission_year = data.get("admission_year", datetime.now().year)
            year_code = str(admission_year)[-2:]  # Last 2 digits of year

            # Get semester (default to 1 for new admissions)
            semester = data.get("semester", 1)
            sem_code = str(semester).zfill(2)

            # Build prefix: YY + CC + SS
            prefix = f"{year_code}{course_code}{sem_code}"

            # Find max existing student with this prefix
            existing = Student.objects.filter(
                enrollment_no__startswith=prefix
            ).values_list("enrollment_no", flat=True)
            if existing:
                try:
                    max_seq = max([int(e[-3:]) for e in existing])
                    seq = str(max_seq + 1).zfill(3)
                except ValueError:
                    seq = "001"
            else:
                seq = "001"

            enrollment_no = f"{prefix}{seq}"
            # Use user-provided email for login, or auto-generate from enrollment
            login_email = f"{enrollment_no}@gnu.ac.in"

            # Check if this auto-generated email already exists
            if User.objects.filter(email=login_email).exists():
                # Increment until we find an unused one
                for i in range(1, 100):
                    next_seq = str(int(seq) + i).zfill(3)
                    enrollment_no = f"{prefix}{next_seq}"
                    login_email = f"{enrollment_no}@gnu.ac.in"
                    if not User.objects.filter(email=login_email).exists():
                        break

            generated_id = enrollment_no

            user = User.objects.create_user(
                email=login_email, password=password, role="student"
            )
            Student.objects.create(
                user=user,
                enrollment_no=enrollment_no,
                name=name,
                email=provided_email or login_email,
                phone=phone,
                course=course,
                semester=semester,
                current_semester=semester,
                total_semesters=course.total_semesters,
                admission_year=admission_year,
                batch=data.get("batch", None),
            )

        elif role == "faculty":
            password = "amaterasu456"
            email = provided_email
            if not email:
                email = f"{name.split()[-1].lower()[:5]}@gnu.ac.in"

            if User.objects.filter(email=email).exists():
                return Response(
                    {
                        "error": f"A user with email {email} already exists. Please use a different email."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = User.objects.create_user(
                email=email, password=password, role="faculty"
            )
            employee_id = data.get("employee_id", f"EMP{user.user_id.hex[:6].upper()}")
            generated_id = employee_id
            login_email = email

            Faculty.objects.create(
                user=user,
                employee_id=employee_id,
                name=name,
                email=email,
                phone=phone,
                department=data.get("department", "Computer Applications"),
            )

        elif role == "admin":
            password = "admin123"
            email = provided_email
            if not email:
                return Response(
                    {"error": "Email required for admin"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if User.objects.filter(email=email).exists():
                return Response(
                    {"error": f"A user with email {email} already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = User.objects.create_user(
                email=email, password=password, role="admin"
            )
            login_email = email
            Admin.objects.create(
                user=user,
                admin_id=data.get("admin_id", f"ADM{user.user_id.hex[:6].upper()}"),
                name=name,
                email=email,
                phone=phone,
            )
        else:
            return Response(
                {"error": f"Invalid role: {role}"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Send Email
        subj = f"Welcome to GU Academic Module - Your Credentials"
        message = f"""Hello {name},

Your account has been successfully created.

Role: {role.title()}
{"Enrollment No / Employee ID: " + generated_id if generated_id else ""}
Login Email: {login_email}
Password: {password}

Please log in at the portal: http://localhost:5173/login

Regards,
GU Admin Team"""
        try:
            send_mail(
                subj,
                message,
                settings.EMAIL_HOST_USER,
                [provided_email or login_email],
                fail_silently=True,
            )
        except Exception as e:
            print(f"Error sending email: {e}")

        return Response(
            {
                "message": "User created and email sent successfully",
                "user": UserSerializer(user).data,
                "generated_id": generated_id,
                "email_sent_to": provided_email or login_email,
            },
            status=status.HTTP_201_CREATED,
        )

    except IntegrityError as e:
        return Response(
            {
                "error": f"A user with this email or ID already exists. Details: {str(e)}"
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Course.DoesNotExist:
        return Response(
            {"error": "Selected course not found in the system."},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["PUT"])
def admin_update_user(request, user_id):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )
    try:
        user = User.objects.get(user_id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    # Update user fields
    if "email" in request.data:
        user.email = request.data["email"]
    if "is_active" in request.data:
        user.is_active = request.data["is_active"]
    if "password" in request.data and request.data["password"]:
        user.set_password(request.data["password"])
    user.save()

    # Update profile fields
    name = request.data.get("name")
    phone = request.data.get("phone")

    if user.role == "student" and hasattr(user, "student_profile"):
        student = user.student_profile
        if name:
            student.name = name
        if phone:
            student.phone = phone
        if "status" in request.data:
            student.status = request.data["status"]
        if "semester" in request.data:
            student.semester = request.data["semester"]
            student.current_semester = request.data["semester"]
        if "course_id" in request.data:
            try:
                student.course = Course.objects.get(course_id=request.data["course_id"])
            except Course.DoesNotExist:
                pass
        student.save()
    elif user.role == "faculty" and hasattr(user, "faculty_profile"):
        fac = user.faculty_profile
        if name:
            fac.name = name
        if phone:
            fac.phone = phone
        if "status" in request.data:
            fac.status = request.data["status"]
        if "department" in request.data:
            fac.department = request.data["department"]
        fac.save()
    elif user.role == "admin" and hasattr(user, "admin_profile"):
        adm = user.admin_profile
        if name:
            adm.name = name
        if phone:
            adm.phone = phone
        adm.save()

    return Response(UserSerializer(user).data)


@api_view(["DELETE"])
def admin_delete_user(request, user_id):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )
    try:
        user = User.objects.get(user_id=user_id)
        user.delete()
        return Response({"message": "User deleted successfully"})
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def admin_analytics(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    # Enrollment by course
    enrollment_by_course = (
        Student.objects.values("course__code", "course__name")
        .annotate(count=Count("student_id"))
        .order_by("-count")
    )

    # Performance distribution
    students = Student.objects.all()
    cgpa_ranges = {
        "9.0-10.0": students.filter(cgpa__gte=9).count(),
        "8.0-8.9": students.filter(cgpa__gte=8, cgpa__lt=9).count(),
        "7.0-7.9": students.filter(cgpa__gte=7, cgpa__lt=8).count(),
        "6.0-6.9": students.filter(cgpa__gte=6, cgpa__lt=7).count(),
        "Below 6.0": students.filter(cgpa__lt=6).count(),
    }

    # Faculty workload
    faculty_workload = Faculty.objects.annotate(
        num_subjects=Count("subjects"),
    ).values("name", "department", "num_subjects")

    return Response(
        {
            "enrollment_by_course": list(enrollment_by_course),
            "attendance_summary": {
                "total": 0,
                "present": 0,
                "absent": 0,
                "percentage": 0,
            },
            "cgpa_distribution": cgpa_ranges,
            "faculty_workload": list(faculty_workload),
            "total_students": students.count(),
            "average_cgpa": float(students.aggregate(avg=Avg("cgpa"))["avg"] or 0),
        }
    )


@api_view(["GET"])
def admin_reports(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    report_type = request.query_params.get("type", "summary")

    if report_type == "students":
        students = Student.objects.all().select_related("course")
        return Response(
            {
                "report_type": "students",
                "data": StudentSerializer(students, many=True).data,
                "generated_at": timezone.now().isoformat(),
            }
        )
    elif report_type == "attendance":
        return Response(
            {
                "report_type": "attendance",
                "data": [],
                "generated_at": timezone.now().isoformat(),
            }
        )
    elif report_type == "performance":
        results = SemesterResult.objects.all().select_related("student")
        return Response(
            {
                "report_type": "performance",
                "data": SemesterResultSerializer(results, many=True).data,
                "generated_at": timezone.now().isoformat(),
            }
        )

    else:
        return Response(
            {
                "report_type": "summary",
                "total_students": Student.objects.count(),
                "total_faculty": Faculty.objects.count(),
                "total_courses": Course.objects.count(),
                "total_subjects": Subject.objects.count(),
                "total_exams": 0,
                "generated_at": timezone.now().isoformat(),
            }
        )


@api_view(["GET"])
def admin_students(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    course_id = request.query_params.get("course_id")
    semester = request.query_params.get("semester")

    # Order by enrollment number for proper sorting (numeric string sort)
    students = (
        Student.objects.all().select_related("course", "user").order_by("enrollment_no")
    )

    # Fix: Only filter if course_id is provided and not empty/All
    if course_id and course_id not in ["", "All", "all", None]:
        students = students.filter(course__course_id=course_id)

    # Fix: Only filter if semester is provided and not empty/All/0
    if semester and semester not in ["", "All", "all", "0", None]:
        try:
            students = students.filter(current_semester=int(semester))
        except (ValueError, TypeError):
            pass

    data = []
    for s in students:
        s_data = StudentSerializer(s).data
        s_data["course_name"] = s.course.name if s.course else None
        s_data["course_code"] = s.course.code if s.course else None
        s_data["user_id"] = s.user.user_id
        data.append(s_data)

    return Response(data)


@api_view(["GET"])
def admin_faculty(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    faculty = (
        Faculty.objects.all()
        .select_related("user")
        .prefetch_related("subjects")
        .order_by("-created_at")
    )

    data = []
    for f in faculty:
        f_data = FacultySerializer(f).data
        f_data["user_id"] = f.user.user_id
        data.append(f_data)

    return Response(data)


@api_view(["PUT"])
def admin_assign_subjects(request, faculty_id):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        faculty = Faculty.objects.get(faculty_id=faculty_id)
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty not found"}, status=status.HTTP_404_NOT_FOUND
        )

    subject_ids = request.data.get("subject_ids", [])
    subjects = Subject.objects.filter(subject_id__in=subject_ids)
    faculty.subjects.set(subjects)
    faculty.save()

    return Response(
        {
            "message": f"Assigned {subjects.count()} subjects to {faculty.name}",
            "subjects": [
                {
                    "subject_id": str(s.subject_id),
                    "code": s.code,
                    "name": s.name,
                    "course_name": s.course.name,
                }
                for s in subjects.select_related("course")
            ],
        }
    )


@api_view(["GET", "POST"])
def admin_notifications(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    from .models import Notification
    from .serializers import NotificationSerializer

    if request.method == "GET":
        notifications = Notification.objects.all()
        return Response(NotificationSerializer(notifications, many=True).data)

    if request.method == "POST":
        serializer = NotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification = serializer.save()

        # --- Send email to target audience ---
        target = notification.target
        recipient_emails = []
        if target in ("All Students", "Students"):
            recipient_emails = list(Student.objects.values_list("email", flat=True))
        elif target in ("All Faculty", "Faculty"):
            recipient_emails = list(Faculty.objects.values_list("email", flat=True))
        else:
            # Send to both students and faculty for other targets
            recipient_emails = list(
                Student.objects.values_list("email", flat=True)
            ) + list(Faculty.objects.values_list("email", flat=True))

        if recipient_emails:
            try:
                send_mail(
                    subject=f"[GU Broadcast] {notification.title}",
                    message=f"{notification.message}\n\nPriority: {notification.priority}\nTarget: {notification.target}\n\n— Ganpat University ERP",
                    from_email=settings.EMAIL_HOST_USER,
                    recipient_list=recipient_emails,
                    fail_silently=True,
                )
            except Exception as e:
                print(f"[EMAIL ERROR] Failed to send broadcast email: {e}")

        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
def admin_academic_terms(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    from academics.models import AcademicTerm
    from academics.serializers import AcademicTermSerializer

    if request.method == "GET":
        terms = AcademicTerm.objects.all()
        return Response(AcademicTermSerializer(terms, many=True).data)

    if request.method == "POST":
        serializer = AcademicTermSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
def admin_holidays(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    from academics.models import Holiday
    from academics.serializers import HolidaySerializer
    from .models import Notification

    if request.method == "GET":
        holidays = Holiday.objects.all()
        return Response(HolidaySerializer(holidays, many=True).data)

    if request.method == "POST":
        serializer = HolidaySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid holiday data", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            holiday = serializer.save()
        except Exception as e:
            return Response(
                {"error": f"Failed to save holiday: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # --- Auto-create a dashboard notification for the holiday ---
        holiday_name = holiday.name
        holiday_date = str(holiday.date)
        holiday_type = getattr(holiday, "type", "General")

        try:
            Notification.objects.create(
                target="Global",
                type="Dashboard Alert",
                priority="Important",
                title=f"Holiday Declared: {holiday_name}",
                message=f"{holiday_name} on {holiday_date} ({holiday_type}). All classes and examinations stand suspended for this date.",
                status="Delivered",
            )
        except Exception as e:
            print(f"[NOTIFICATION ERROR] Failed to create holiday notification: {e}")

        # --- Send email to ALL students and faculty ---
        all_emails = list(Student.objects.values_list("email", flat=True)) + list(
            Faculty.objects.values_list("email", flat=True)
        )

        if all_emails:
            try:
                send_mail(
                    subject=f"[GU Notice] Holiday Declared: {holiday_name} — {holiday_date}",
                    message=(
                        f"Dear Member,\n\n"
                        f"This is to inform you that a holiday has been declared by the administration.\n\n"
                        f"Holiday: {holiday_name}\n"
                        f"Date: {holiday_date}\n"
                        f"Type: {holiday_type}\n\n"
                        f"All classes and examinations stand suspended for this date.\n\n"
                        f"— Office of the Registrar, Ganpat University"
                    ),
                    from_email=settings.EMAIL_HOST_USER,
                    recipient_list=all_emails,
                    fail_silently=True,
                )
            except Exception as e:
                print(f"[EMAIL ERROR] Failed to send holiday email: {e}")

        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PUT"])
def admin_update_academic_term(request, term_id):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    from academics.models import AcademicTerm
    from academics.serializers import AcademicTermSerializer

    try:
        term = AcademicTerm.objects.get(term_id=term_id)
    except AcademicTerm.DoesNotExist:
        return Response({"error": "Term not found"}, status=404)

    # If setting to active, update others to completed
    new_status = request.data.get("status")
    if new_status == "Active":
        AcademicTerm.objects.filter(status="Active").update(status="Completed")

    serializer = AcademicTermSerializer(term, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["DELETE"])
def admin_delete_holiday(request, holiday_id):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    from academics.models import Holiday

    try:
        holiday = Holiday.objects.get(holiday_id=holiday_id)
        holiday.delete()
        return Response({"message": "Holiday deleted"})
    except Holiday.DoesNotExist:
        return Response({"error": "Holiday not found"}, status=404)


@api_view(["DELETE"])
def admin_delete_academic_term(request, term_id):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    from academics.models import AcademicTerm

    try:
        term = AcademicTerm.objects.get(term_id=term_id)
        term.delete()
        return Response({"message": "Term deleted successfully"})
    except AcademicTerm.DoesNotExist:
        return Response({"error": "Term not found"}, status=404)


# =============================================================================
# FACULTY GRADING (Class Teachers Only)
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def faculty_grading_students(request):
    """Get all students for the class teacher's assigned course."""
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response({"error": "Faculty profile not found"}, status=404)

    if not faculty.is_class_teacher or not faculty.class_course:
        return Response(
            {"error": "Only class teachers can access grading."},
            status=status.HTTP_403_FORBIDDEN,
        )

    course = faculty.class_course
    assigned_sem = faculty.class_semester
    
    # Fetch all active students in the course across all semesters
    students = (
        Student.objects.filter(course=course, status="Active")
        .select_related("user")
        .order_by("current_semester", "enrollment_no")
    )

    semesters = {}
    for s in students:
        sem = s.current_semester
        if sem not in semesters:
            semesters[sem] = []
        semesters[sem].append({
            "student_id": str(s.student_id),
            "name": s.name,
            "enrollment_no": s.enrollment_no,
            "email": s.email,
            "current_semester": sem,
        })

    # Get subjects for all semesters of this course
    subjects_by_sem = {}
    for sub in Subject.objects.filter(course=course).order_by("semester", "name"):
        sem = sub.semester
        if sem not in subjects_by_sem:
            subjects_by_sem[sem] = []
        subjects_by_sem[sem].append({
            "subject_id": str(sub.subject_id),
            "code": sub.code,
            "name": sub.name,
            "credits": sub.credits,
        })

    return Response({
        "course_id": str(course.course_id),
        "course_name": course.name,
        "course_code": course.code,
        "assigned_semester": assigned_sem,
        "total_semesters": course.total_semesters,
        "faculty_name": faculty.name,
        "semesters": semesters,
        "subjects_by_semester": subjects_by_sem,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def faculty_grading_submit(request):
    """Submit grades for students. Only class teachers can submit."""
    try:
        faculty = request.user.faculty_profile
    except Faculty.DoesNotExist:
        return Response({"error": "Faculty profile not found"}, status=404)

    if not faculty.is_class_teacher or not faculty.class_course:
        return Response(
            {"error": "Only class teachers can submit grades."},
            status=status.HTTP_403_FORBIDDEN,
        )

    data = request.data
    semester = data.get("semester")
    sgpa = data.get("sgpa")
    student_id = data.get("student_id")
    subjects = data.get("subjects", [])

    if not semester or not student_id:
        return Response(
            {"error": "semester and student_id are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        student = Student.objects.get(student_id=student_id)
    except Student.DoesNotExist:
        return Response({"error": "Student not found"}, status=404)

    # Verify student belongs to class teacher's course
    if str(student.course_id) != str(faculty.class_course_id):
        return Response(
            {"error": "Student does not belong to your assigned course."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Create or update SemesterResult
    sem_result, created = SemesterResult.objects.update_or_create(
        student=student,
        semester=semester,
        defaults={
            "sgpa": sgpa or 0,
            "status": "completed",
            "year": timezone.now().year,
            "exam_type": "Regular",
        },
    )

    # Process subject marks
    total_marks = 0
    obtained_marks = 0
    from academics.models import SubjectResult

    for sub_data in subjects:
        subject_id = sub_data.get("subject_id")
        internal = int(sub_data.get("internal_marks", 0))
        external = int(sub_data.get("external_marks", 0))
        practical = int(sub_data.get("practical_marks", 0))
        sub_total = internal + external + practical
        passing = int(sub_data.get("passing_marks", 35))
        is_passed = sub_total >= passing

        # Grade calculation
        pct = (sub_total / max(passing * 3, 1)) * 100
        if pct >= 90:
            grade = "O"
        elif pct >= 80:
            grade = "A+"
        elif pct >= 70:
            grade = "A"
        elif pct >= 60:
            grade = "B+"
        elif pct >= 50:
            grade = "B"
        elif pct >= 40:
            grade = "C"
        elif pct >= 35:
            grade = "P"
        else:
            grade = "F"

        SubjectResult.objects.update_or_create(
            semester_result=sem_result,
            subject_id=subject_id,
            defaults={
                "internal_marks": internal,
                "external_marks": external,
                "practical_marks": practical,
                "total_marks": sub_total,
                "passing_marks": passing,
                "is_passed": is_passed,
                "grade": grade,
            },
        )
        total_marks += passing * 3  # max possible per subject
        obtained_marks += sub_total

    # Update semester result totals
    sem_result.total_marks = total_marks
    sem_result.obtained_marks = obtained_marks
    if total_marks > 0:
        sem_result.percentage = round((obtained_marks / total_marks) * 100, 2)
    sem_result.grade = sem_result.calculate_grade()
    sem_result.save()

    # Update student CGPA (average of all SGPAs)
    all_results = SemesterResult.objects.filter(
        student=student, status="completed"
    )
    if all_results.exists():
        avg_sgpa = all_results.aggregate(avg=Avg("sgpa"))["avg"] or 0
        student.cgpa = round(avg_sgpa, 2)
        student.save(update_fields=["cgpa"])

    return Response({
        "success": True,
        "result_id": str(sem_result.result_id),
        "semester": semester,
        "sgpa": float(sem_result.sgpa) if sem_result.sgpa else 0,
        "grade": sem_result.grade,
        "percentage": float(sem_result.percentage),
    })
