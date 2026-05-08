import json
from datetime import datetime, timedelta
from django.db.models import Count, Q
from django.db import connection, IntegrityError
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status as http_status
from users.models import User, Student, Faculty, Admin, AdminActivityLog, Notification
from users.permissions import IsSuperAdmin, IsAdminOrSuperAdmin
from users.serializers import StudentSerializer, FacultySerializer
from academics.models import Course, Subject, TimetableSlot, TimeSlot, Room, SemesterConfig
from academics.serializers import CourseSerializer, SubjectSerializer


def log_admin_action(
    admin,
    action,
    target_model,
    target_id=None,
    target_name="",
    details=None,
    request=None,
):
    """Log admin action to AdminActivityLog."""
    AdminActivityLog.log(
        admin=admin,
        action=action,
        target_model=target_model,
        target_id=target_id,
        target_name=target_name,
        details=details,
        request=request,
    )


# =============================================================================
# SYSTEM OVERVIEW
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_dashboard_stats(request):
    """Get complete system dashboard statistics."""
    try:
        today = timezone.now().date()

        stats = {
            "students": {
                "total": Student.objects.count(),
            },
            "faculty": {
                "total": Faculty.objects.count(),
            },
            "courses": {
                "total": Course.objects.count(),
                "active": Course.objects.filter(status="Active").count(),
            },
            "subjects": {
                "total": Subject.objects.count(),
            },
            "timetable": {
                "total_slots": TimetableSlot.objects.count(),
            },
            "notifications": {
                "total": 0,
            },
            "users": {
                "total": User.objects.count(),
            },
            "system": {
                "db_tables": len(connection.introspection.table_names()),
                "total_records": sum(
                    [
                        User.objects.count(),
                        Student.objects.count(),
                        Faculty.objects.count(),
                        Course.objects.count(),
                        Subject.objects.count(),
                    ]
                ),
                "last_backup": None,
                "server_time": timezone.now().isoformat(),
            },
        }

        return Response(stats)
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_recent_activity(request):
    """Get recent admin activity logs."""
    try:
        limit = int(request.query_params.get("limit", 20))
        logs = AdminActivityLog.objects.all()[:limit]

        data = [
            {
                "log_id": str(log.log_id),
                "admin_name": log.admin_name,
                "action": log.action,
                "target_model": log.target_model,
                "target_name": log.target_name,
                "timestamp": log.timestamp.isoformat(),
                "ip_address": log.ip_address,
            }
            for log in logs
        ]

        return Response(data)
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# USER MANAGEMENT
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_list_users(request):
    """Get all users with filters."""
    try:
        role = request.query_params.get("role")
        is_active = request.query_params.get("is_active")
        search = request.query_params.get("search")

        queryset = User.objects.all().order_by("-created_at")

        if role:
            queryset = queryset.filter(role=role)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) | Q(user_id__icontains=search)
            )

        users = []
        for user in queryset[:100]:
            profile_data = {}
            if user.role == "student":
                try:
                    profile = user.student_profile
                    profile_data = {
                        "name": profile.name,
                        "enrollment_no": profile.enrollment_no,
                        "course": str(profile.course_id) if profile.course else None,
                        "course_name": profile.course.name if profile.course else None,
                        "semester": profile.current_semester,
                    }
                except:
                    pass
            elif user.role == "faculty":
                try:
                    profile = user.faculty_profile
                    profile_data = {
                        "name": profile.name,
                        "employee_id": profile.employee_id,
                        "department": profile.department,
                    }
                except:
                    pass
            elif user.role in ["admin", "super_admin"]:
                try:
                    profile = user.admin_profile
                    profile_data = {
                        "name": profile.name,
                        "admin_id": profile.admin_id,
                    }
                except:
                    pass

            users.append(
                {
                    "user_id": str(user.user_id),
                    "email": user.email,
                    "role": user.role,
                    "is_active": user.is_active,
                    "created_at": user.created_at.isoformat(),
                    **profile_data,
                }
            )

        return Response({"total": queryset.count(), "users": users})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrSuperAdmin])
def admin_create_user(request):
    """Create any type of user with auto-generation of IDs, emails, and credentials."""
    try:
        data = request.data
        role = data.get("role", "student")
        personal_email = data.get("email")
        password = data.get("password", "Guni@2026")
        name = data.get("name", "")

        if not personal_email:
            return Response(
                {"error": "Email is required"}, status=http_status.HTTP_400_BAD_REQUEST
            )

        # ── ADMISSION WINDOW: Students only April-June ──
        if role == "student":
            current_month = timezone.now().month
            if current_month < 4 or current_month > 6:
                return Response(
                    {"error": "Student admissions are only open from April 1 to June 1."},
                    status=http_status.HTTP_403_FORBIDDEN,
                )

        # ── AUTO-GENERATE: Student Enrollment + University Email ──
        if role == "student":
            course_id = data.get("course_id")
            course = None
            if course_id:
                try:
                    course = Course.objects.get(course_id=course_id)
                except Course.DoesNotExist:
                    return Response(
                        {"error": "Invalid course_id"},
                        status=http_status.HTTP_400_BAD_REQUEST,
                    )

            # Build enrollment: YY + CourseCode(4) + Seq(3)
            year_code = str(timezone.now().year)[-2:]
            course_code = (course.code[:4] if course else "GNRL").upper()
            # Find next sequence for this prefix
            prefix = f"{year_code}{course_code}"
            existing_count = Student.objects.filter(
                enrollment_no__startswith=prefix
            ).count()
            seq = str(existing_count + 1).zfill(3)
            enrollment_no = data.get("enrollment_no") or f"{prefix}{seq}"

            # University email from enrollment
            uni_email = f"{enrollment_no.lower()}@gnu.ac.in"

            # Check if User email already taken — use uni_email for auth
            if User.objects.filter(email=uni_email).exists():
                # Try next seq
                seq = str(existing_count + 2).zfill(3)
                enrollment_no = f"{prefix}{seq}"
                uni_email = f"{enrollment_no.lower()}@gnu.ac.in"

            user = User.objects.create(
                email=uni_email, role="student", password=make_password(password)
            )

            student = Student.objects.create(
                user=user,
                name=name or personal_email.split("@")[0],
                email=personal_email,
                enrollment_no=enrollment_no,
                course=course,
                current_semester=int(data.get("semester", 1)),
                batch=data.get("batch", str(timezone.now().year)),
                admission_year=timezone.now().year,
            )

            # Send credentials to personal email
            try:
                send_mail(
                    subject="GUNI - Your Student Portal Credentials",
                    message=(
                        f"Dear {name},\n\n"
                        f"Welcome to Ganpat University!\n\n"
                        f"Your portal credentials:\n"
                        f"  Enrollment No: {enrollment_no}\n"
                        f"  University Email: {uni_email}\n"
                        f"  Password: {password}\n\n"
                        f"You can login using either your Enrollment No or University Email.\n\n"
                        f"Regards,\nGUNI Academic Portal"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[personal_email],
                    fail_silently=True,
                )
            except Exception:
                pass  # Don't fail user creation if email fails

            log_admin_action(
                request.user, "CREATE", "Student", user.user_id, uni_email,
                {"role": role, "enrollment_no": enrollment_no}, request,
            )

            return Response(
                {
                    "success": True,
                    "user_id": str(user.user_id),
                    "email": uni_email,
                    "personal_email": personal_email,
                    "enrollment_no": enrollment_no,
                    "role": role,
                    "message": f"Student created. Credentials sent to {personal_email}",
                },
                status=http_status.HTTP_201_CREATED,
            )

        # ── AUTO-GENERATE: Faculty Employee ID + University Email ──
        elif role == "faculty":
            # Build employee ID
            fac_count = Faculty.objects.count()
            employee_id = data.get("employee_id") or f"EMP{timezone.now().year}{str(fac_count + 1).zfill(3)}"
            uni_email = f"{employee_id.lower()}@gnu.ac.in"

            if User.objects.filter(email=uni_email).exists():
                employee_id = f"EMP{timezone.now().year}{str(fac_count + 2).zfill(3)}"
                uni_email = f"{employee_id.lower()}@gnu.ac.in"

            user = User.objects.create(
                email=uni_email, role="faculty", password=make_password(password)
            )

            faculty = Faculty.objects.create(
                user=user,
                name=name or personal_email.split("@")[0],
                email=personal_email,
                employee_id=employee_id,
                department=data.get("department", "Computer Applications"),
            )

            # Optional: assign subject
            subject_id = data.get("subject_id")
            if subject_id:
                try:
                    subject = Subject.objects.get(subject_id=subject_id)
                    faculty.subjects.add(subject)
                except Subject.DoesNotExist:
                    pass

            # Optional: assign as class teacher
            class_course_id = data.get("class_course_id")
            if class_course_id:
                try:
                    class_course = Course.objects.get(course_id=class_course_id)
                    faculty.is_class_teacher = True
                    faculty.class_course = class_course
                    faculty.save(update_fields=["is_class_teacher", "class_course"])
                except Course.DoesNotExist:
                    pass

            # Send credentials
            try:
                send_mail(
                    subject="GUNI - Your Faculty Portal Credentials",
                    message=(
                        f"Dear {name},\n\n"
                        f"Welcome to Ganpat University!\n\n"
                        f"Your portal credentials:\n"
                        f"  Employee ID: {employee_id}\n"
                        f"  University Email: {uni_email}\n"
                        f"  Password: {password}\n\n"
                        f"You can login using either your Employee ID or University Email.\n\n"
                        f"Regards,\nGUNI Academic Portal"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[personal_email],
                    fail_silently=True,
                )
            except Exception:
                pass

            log_admin_action(
                request.user, "CREATE", "Faculty", user.user_id, uni_email,
                {"role": role, "employee_id": employee_id}, request,
            )

            return Response(
                {
                    "success": True,
                    "user_id": str(user.user_id),
                    "email": uni_email,
                    "personal_email": personal_email,
                    "employee_id": employee_id,
                    "role": role,
                    "message": f"Faculty created. Credentials sent to {personal_email}",
                },
                status=http_status.HTTP_201_CREATED,
            )

        # ── ADMIN CREATION ──
        elif role in ["admin", "super_admin"]:
            if User.objects.filter(email=personal_email).exists():
                return Response(
                    {"error": "User with this email already exists"},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            user = User.objects.create(
                email=personal_email, role=role, password=make_password(password)
            )
            Admin.objects.create(
                user=user,
                name=name or personal_email.split("@")[0],
                email=personal_email,
                admin_id=data.get("admin_id", f"ADM{user.user_id.hex[:8].upper()}"),
            )

            log_admin_action(
                request.user, "CREATE", "Admin", user.user_id, personal_email,
                {"role": role}, request,
            )

            return Response(
                {
                    "success": True,
                    "user_id": str(user.user_id),
                    "email": personal_email,
                    "role": role,
                },
                status=http_status.HTTP_201_CREATED,
            )

        return Response(
            {"error": f"Unknown role: {role}"},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    except IntegrityError as e:
        return Response(
            {"error": f"Database error - duplicate entry: {str(e)}"},
            status=http_status.HTTP_409_CONFLICT,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_update_user(request, user_id):
    """Update any user."""
    try:
        user = User.objects.get(user_id=user_id)
        data = request.data

        if "email" in data:
            user.email = data["email"]
        if "is_active" in data:
            user.is_active = data["is_active"]
        if "role" in data:
            user.role = data["role"]

        user.save()

        profile_data = {}
        if user.role == "student" and hasattr(user, "student_profile"):
            profile = user.student_profile
            if "name" in data:
                profile.name = data["name"]
            if "semester" in data:
                profile.current_semester = data["semester"]
            if "course_id" in data:
                profile.course_id = data["course_id"]
            profile.save()
            profile_data = {"name": profile.name}

        elif user.role == "faculty" and hasattr(user, "faculty_profile"):
            profile = user.faculty_profile
            if "name" in data:
                profile.name = data["name"]
            if "department" in data:
                profile.department = data["department"]
            profile.save()
            profile_data = {"name": profile.name}

        log_admin_action(
            request.user,
            "UPDATE",
            "User",
            user.user_id,
            user.email,
            {"changes": data},
            request,
        )

        return Response({"success": True, **profile_data})
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrSuperAdmin])
def admin_delete_user(request, user_id):
    """Delete any user."""
    try:
        user = User.objects.get(user_id=user_id)

        if user.role == "super_admin":
            return Response(
                {"error": "Cannot delete Super Admin"},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        email = user.email
        user_id_str = str(user.user_id)

        user.delete()

        log_admin_action(
            request.user,
            "DELETE",
            "User",
            user_id_str,
            email,
            {"deleted_email": email},
            request,
        )

        return Response({"success": True, "message": "User deleted"})
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_reset_password(request, user_id):
    """Reset any user's password."""
    try:
        user = User.objects.get(user_id=user_id)
        new_password = request.data.get("new_password", "Guni@2026")

        user.password = make_password(new_password)
        user.save()

        log_admin_action(
            request.user,
            "RESET_PASSWORD",
            "User",
            user.user_id,
            user.email,
            {},
            request,
        )

        return Response({"success": True, "message": "Password reset successfully"})
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_ban_user(request, user_id):
    """Ban any user."""
    try:
        user = User.objects.get(user_id=user_id)

        if user.role == "super_admin":
            return Response(
                {"error": "Cannot ban Super Admin"},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        user.is_active = False
        user.save()

        log_admin_action(
            request.user, "BAN", "User", user.user_id, user.email, {}, request
        )

        return Response({"success": True, "message": "User banned"})
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_unban_user(request, user_id):
    """Unban any user."""
    try:
        user = User.objects.get(user_id=user_id)
        user.is_active = True
        user.save()

        log_admin_action(
            request.user, "UNBAN", "User", user.user_id, user.email, {}, request
        )

        return Response({"success": True, "message": "User unbanned"})
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# STUDENT MANAGEMENT
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_list_students(request):
    """Get all students with filters."""
    try:
        course = request.query_params.get("course", "")
        semester = request.query_params.get("semester", "")
        batch = request.query_params.get("batch", "")
        status = request.query_params.get("status", "")
        search = request.query_params.get("search", "")

        queryset = (
            Student.objects.all()
            .select_related("user", "course")
            .order_by("enrollment_no")
        )

        if course:
            queryset = queryset.filter(course__code=course)
        if semester:
            queryset = queryset.filter(current_semester=semester)
        if batch:
            queryset = queryset.filter(batch=batch)
        if status:
            queryset = queryset.filter(status=status)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(enrollment_no__icontains=search)
            )

        students = []
        for s in queryset[:500]:
            students.append(
                {
                    "student_id": str(s.student_id),
                    "user_id": str(s.user.user_id) if s.user else None,
                    "name": s.name,
                    "email": s.email,
                    "enrollment_no": s.enrollment_no,
                    "course_id": str(s.course.course_id) if s.course else None,
                    "course": s.course.code if s.course else None,
                    "course_name": s.course.name if s.course else None,
                    "semester": s.current_semester,
                    "batch": s.batch,
                    "status": s.status,
                    "cgpa": float(s.cgpa) if s.cgpa else 0,
                    "is_active": s.user.is_active if s.user else True,
                }
            )

        return Response({"total": queryset.count(), "students": students})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_update_student(request, student_id):
    """Update any student."""
    try:
        student = Student.objects.get(student_id=student_id)
        data = request.data

        for field in [
            "name",
            "email",
            "phone",
            "father_name",
            "address",
            "batch",
            "current_semester",
            "status",
            "cgpa",
        ]:
            if field in data:
                setattr(student, field, data[field])

        if "course_id" in data:
            student.course_id = data["course_id"]

        student.save()

        log_admin_action(
            request.user,
            "UPDATE",
            "Student",
            student.student_id,
            student.name,
            {"changes": data},
            request,
        )

        return Response({"success": True})
    except Student.DoesNotExist:
        return Response(
            {"error": "Student not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# ROLL NUMBER MANAGEMENT
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_check_roll_numbers(request):
    """Check for roll number issues."""
    try:
        students = Student.objects.all().select_related("course")

        issues = []
        total_students = students.count()
        with_roll = 0
        without_roll = 0
        course_codes = {
            "MCA": "34",
            "BCA": "31",
            "BTech": "32",
            "MTech": "33",
            "BSC-IT": "41",
            "BSC-IT(IMS)": "42",
            "BSC-IT(CS)": "43",
            "MSc-IT": "51",
            "MSc-IT(IMS)": "52",
            "MSc-IT(CS)": "53",
            "MSc-IT(AI/ML)": "54",
            "BSC(IT)": "41",
        }

        for s in students:
            enrollment = s.enrollment_no or ""
            if enrollment:
                with_roll += 1
            else:
                without_roll += 1

            if not s.course:
                issues.append(
                    {
                        "student_id": str(s.student_id),
                        "name": s.name,
                        "enrollment_no": s.enrollment_no,
                        "course": "N/A",
                        "type": "missing",
                        "issue": "No course assigned",
                    }
                )
                continue

            course_code = course_codes.get(s.course.code, "00")
            year = str(s.admission_year)[-2:] if s.admission_year else "26"
            sem = str(s.current_semester).zfill(2)

            expected_prefix = f"{year}{course_code}{sem}"

            if enrollment and not enrollment.startswith(expected_prefix):
                issues.append(
                    {
                        "student_id": str(s.student_id),
                        "name": s.name,
                        "enrollment_no": enrollment,
                        "course": s.course.code,
                        "semester": s.current_semester,
                        "type": "format",
                        "issue": "Enrollment format mismatch",
                    }
                )

        return Response(
            {
                "total_students": total_students,
                "with_roll_number": with_roll,
                "without_roll_number": without_roll,
                "total_issues": len(issues),
                "issues": issues[:100],
            }
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_fix_roll_numbers(request):
    """Fix all roll numbers with correct format."""
    try:
        course_codes = {
            "MCA": "34",
            "BCA": "31",
            "BTech": "32",
            "MTech": "33",
            "BSC-IT": "41",
            "BSC-IT(IMS)": "42",
            "BSC-IT(CS)": "43",
            "MSc-IT": "51",
            "MSc-IT(IMS)": "52",
            "MSc-IT(CS)": "53",
            "MSc-IT(AI/ML)": "54",
            "BSC(IT)": "41",
        }

        fixed_count = 0
        errors = []

        students = (
            Student.objects.all()
            .select_related("course")
            .order_by("course__code", "current_semester", "name")
        )

        for course_code, code_digits in course_codes.items():
            course_students = [
                s for s in students if s.course and s.course.code == course_code
            ]

            if not course_students:
                continue

            semesters = set(s.current_semester for s in course_students)

            for sem in semesters:
                sem_students = [s for s in course_students if s.current_semester == sem]

                for i, student in enumerate(sorted(sem_students, key=lambda x: x.name)):
                    try:
                        year = (
                            str(student.admission_year)[-2:]
                            if student.admission_year
                            else "26"
                        )
                        sem_digits = str(sem).zfill(2)
                        serial = str(i + 1).zfill(3)
                        new_enrollment = f"{year}{code_digits}{sem_digits}{serial}"

                        old_enrollment = student.enrollment_no or ""

                        if old_enrollment != new_enrollment:
                            student.enrollment_no = new_enrollment
                            student.save(update_fields=["enrollment_no"])
                            fixed_count += 1

                    except Exception as e:
                        errors.append(
                            {
                                "student_id": str(student.student_id),
                                "name": student.name,
                                "error": str(e),
                            }
                        )

        log_admin_action(
            request.user,
            "UPDATE",
            "Student",
            None,
            "Roll Numbers",
            {"fixed_count": fixed_count, "errors": len(errors)},
            request,
        )

        return Response(
            {"success": True, "fixed_count": fixed_count, "errors": errors[:50]}
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# COURSE MANAGEMENT
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_list_courses(request):
    """Get all courses."""
    try:
        courses = Course.objects.all().order_by("name")
        data = [
            {
                "course_id": str(c.course_id),
                "code": c.code,
                "name": c.name,
                "total_semesters": c.total_semesters,
                "department": c.department,
                "shift": c.shift,
                "status": c.status,
                "subjects_count": c.subjects.count(),
            }
            for c in courses
        ]

        return Response({"total": courses.count(), "courses": data})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_create_course(request):
    """Create a new course."""
    try:
        data = request.data

        course = Course.objects.create(
            code=data.get("code"),
            name=data.get("name"),
            total_semesters=data.get("total_semesters", 6),
            department=data.get("department", "Computer Applications"),
            shift=data.get("shift", "NOON"),
            level=data.get("level"),
        )

        log_admin_action(
            request.user,
            "CREATE",
            "Course",
            course.course_id,
            course.name,
            {"code": course.code},
            request,
        )

        return Response(
            {"success": True, "course_id": str(course.course_id), "code": course.code},
            status=http_status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_update_course(request, course_id):
    """Update a course."""
    try:
        course = Course.objects.get(course_id=course_id)
        data = request.data

        for field in [
            "code",
            "name",
            "total_semesters",
            "department",
            "shift",
            "status",
            "level",
        ]:
            if field in data:
                setattr(course, field, data[field])

        course.save()

        log_admin_action(
            request.user,
            "UPDATE",
            "Course",
            course.course_id,
            course.name,
            {"changes": data},
            request,
        )

        return Response({"success": True})
    except Course.DoesNotExist:
        return Response(
            {"error": "Course not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_delete_course(request, course_id):
    """Delete a course."""
    try:
        course = Course.objects.get(course_id=course_id)
        name = course.name
        course.delete()

        log_admin_action(request.user, "DELETE", "Course", course_id, name, {}, request)

        return Response({"success": True})
    except Course.DoesNotExist:
        return Response(
            {"error": "Course not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# SUBJECT MANAGEMENT
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_list_subjects(request):
    """Get all subjects."""
    try:
        course = request.query_params.get("course")
        semester = request.query_params.get("semester")

        queryset = Subject.objects.all().select_related("course")

        if course:
            queryset = queryset.filter(course__code=course)
        if semester:
            queryset = queryset.filter(semester=semester)

        subjects = [
            {
                "subject_id": str(s.subject_id),
                "code": s.code,
                "name": s.name,
                "course": s.course.code,
                "course_name": s.course.name,
                "semester": s.semester,
                "credits": s.credits,
            }
            for s in queryset[:500]
        ]

        return Response({"total": queryset.count(), "subjects": subjects})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_create_subject(request):
    """Create a new subject."""
    try:
        data = request.data

        subject = Subject.objects.create(
            code=data.get("code"),
            name=data.get("name"),
            course_id=data.get("course_id"),
            semester=data.get("semester", 1),
            credits=data.get("credits", 4),
        )

        log_admin_action(
            request.user,
            "CREATE",
            "Subject",
            subject.subject_id,
            subject.name,
            {"code": subject.code, "course": str(subject.course_id)},
            request,
        )

        return Response(
            {
                "success": True,
                "subject_id": str(subject.subject_id),
                "code": subject.code,
            },
            status=http_status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_update_subject(request, subject_id):
    """Update a subject."""
    try:
        subject = Subject.objects.get(subject_id=subject_id)
        data = request.data

        for field in ["code", "name", "semester", "credits"]:
            if field in data:
                setattr(subject, field, data[field])

        if "course_id" in data:
            subject.course_id = data["course_id"]

        subject.save()

        log_admin_action(
            request.user,
            "UPDATE",
            "Subject",
            subject.subject_id,
            subject.name,
            {"changes": data},
            request,
        )

        return Response({"success": True})
    except Subject.DoesNotExist:
        return Response(
            {"error": "Subject not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_delete_subject(request, subject_id):
    """Delete a subject."""
    try:
        subject = Subject.objects.get(subject_id=subject_id)
        name = subject.name
        subject.delete()

        log_admin_action(
            request.user, "DELETE", "Subject", subject_id, name, {}, request
        )

        return Response({"success": True})
    except Subject.DoesNotExist:
        return Response(
            {"error": "Subject not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# TIMETABLE MANAGEMENT
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_timetable_stats(request):
    """Get timetable statistics and conflicts."""
    try:
        total_slots = TimetableSlot.objects.count()

        conflicts = []
        rooms = Room.objects.all()

        for room in rooms:
            slots = TimetableSlot.objects.filter(room=room).values(
                "day_of_week", "start_time", "end_time"
            )

            seen = {}
            for slot in slots:
                key = f"{slot['day_of_week']}_{slot['start_time']}"
                if key in seen:
                    conflicts.append(
                        {
                            "room": room.name,
                            "day": slot["day_of_week"],
                            "time": str(slot["start_time"]),
                            "slot_count": seen[key] + 1,
                        }
                    )
                seen[key] = seen.get(key, 0) + 1

        courses = (
            TimetableSlot.objects.values("course__code", "course__name")
            .annotate(count=Count("slot_id"))
            .order_by("-count")
        )

        return Response(
            {
                "total_slots": total_slots,
                "conflicts": conflicts,
                "courses": list(courses),
            }
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_clear_timetable(request):
    """Clear all timetable slots."""
    try:
        data = request.data or {}
        course_code = data.get("course_code")

        if course_code:
            count = TimetableSlot.objects.filter(course__code=course_code).count()
            TimetableSlot.objects.filter(course__code=course_code).delete()
        else:
            count = TimetableSlot.objects.count()
            TimetableSlot.objects.all().delete()

        log_admin_action(
            request.user,
            "CLEAR",
            "TimetableSlot",
            None,
            f"All slots (course: {course_code or 'all'})",
            {"deleted_count": count},
            request,
        )

        return Response({"success": True, "deleted_count": count})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_generate_timetable(request):
    """Generate timetable for a branch/campus."""
    try:
        from users.management.commands.generate_smart_timetable import (
            SmartTimetableGenerator,
        )

        branch = request.data.get("branch", "Ahmedabad")
        dry_run = request.data.get("dry_run", False)
        clear_existing = request.data.get("clear", True)

        if clear_existing:
            deleted = TimetableSlot.objects.filter(is_auto_generated=True).delete()[0]
        else:
            deleted = 0

        generator = SmartTimetableGenerator(branch=branch, dry_run=dry_run)
        result = generator.generate()

        total_slots = TimetableSlot.objects.count()
        auto_slots = TimetableSlot.objects.filter(is_auto_generated=True).count()

        log_admin_action(
            request.user,
            "GENERATE",
            "TimetableSlot",
            None,
            f"Smart timetable for {branch} campus",
            {
                "branch": branch,
                "generated": result.get("generated", 0),
                "conflicts_resolved": result.get("conflicts_resolved", 0),
                "total_slots": total_slots,
            },
            request,
        )

        return Response(
            {
                "success": True,
                "message": f"Timetable generated for {branch} campus",
                "stats": {
                    "generated": result.get("generated", 0),
                    "conflicts_resolved": result.get("conflicts_resolved", 0),
                    "deleted": deleted,
                    "total": total_slots,
                    "auto_generated": auto_slots,
                },
            }
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# FACULTY MANAGEMENT
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_list_faculty(request):
    """Get all faculty."""
    try:
        department = request.query_params.get("department")
        search = request.query_params.get("search")

        queryset = Faculty.objects.all().select_related("user")

        if department:
            queryset = queryset.filter(department=department)
        if search:
            queryset = queryset.filter(name__icontains=search)

        faculty = [
            {
                "faculty_id": str(f.faculty_id),
                "name": f.name,
                "email": f.email,
                "employee_id": f.employee_id,
                "department": f.department,
                "working_shift": f.working_shift,
                "status": f.status,
                "subjects_count": f.subjects.count(),
                "is_active": f.user.is_active if hasattr(f, "user") else True,
            }
            for f in queryset[:200]
        ]

        return Response({"total": queryset.count(), "faculty": faculty})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_create_faculty(request):
    """Create a new faculty member."""
    try:
        data = request.data

        name = data.get("name")
        email = data.get("email")
        phone = data.get("phone", "")
        department = data.get("department", "Computer Applications")
        working_shift = data.get("working_shift", "Morning")
        password = data.get("password", "Faculty@2026")

        if not name or not email:
            return Response(
                {"error": "Name and email are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": f"A user with email {email} already exists."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(email=email, password=password, role="faculty")

        employee_id = data.get("employee_id", f"EMP{user.user_id.hex[:6].upper()}")

        faculty = Faculty.objects.create(
            user=user,
            employee_id=employee_id,
            name=name,
            email=email,
            phone=phone,
            department=department,
            working_shift=working_shift,
        )

        log_admin_action(
            request.user,
            "CREATE",
            "Faculty",
            faculty.faculty_id,
            faculty.name,
            {"email": email, "department": department, "shift": working_shift},
            request,
        )

        return Response(
            {
                "success": True,
                "faculty_id": str(faculty.faculty_id),
                "employee_id": employee_id,
                "password": password,
            }
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_update_faculty(request, faculty_id):
    """Update any faculty."""
    try:
        faculty = Faculty.objects.get(faculty_id=faculty_id)
        data = request.data

        for field in [
            "name",
            "email",
            "phone",
            "department",
            "working_shift",
            "status",
        ]:
            if field in data:
                setattr(faculty, field, data[field])

        if "user_active" in data and hasattr(faculty, "user"):
            faculty.user.is_active = data["user_active"]
            faculty.user.save()

        faculty.save()

        log_admin_action(
            request.user,
            "UPDATE",
            "Faculty",
            faculty.faculty_id,
            faculty.name,
            {"changes": data},
            request,
        )

        return Response({"success": True})
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_faculty_subjects(request, faculty_id):
    """Get or update subjects assigned to a faculty member."""
    try:
        faculty = Faculty.objects.get(faculty_id=faculty_id)

        if request.method == "GET":
            assigned_subjects = faculty.subjects.all().select_related("course")
            subjects_data = [
                {
                    "subject_id": str(s.subject_id),
                    "code": s.code,
                    "name": s.name,
                    "semester": s.semester,
                    "course_code": s.course.code,
                    "course_name": s.course.name,
                    "credits": s.credits,
                }
                for s in assigned_subjects
            ]
            return Response(
                {
                    "faculty_id": str(faculty.faculty_id),
                    "faculty_name": faculty.name,
                    "subjects": subjects_data,
                    "total_subjects": len(subjects_data),
                }
            )

        elif request.method == "POST":
            data = request.data
            action = data.get("action", "set")

            if action == "set":
                subject_ids = data.get("subject_ids", [])
                faculty.subjects.set(subject_ids)
                log_admin_action(
                    request.user,
                    "ASSIGN",
                    "FacultySubjects",
                    faculty.faculty_id,
                    f"Assigned {len(subject_ids)} subjects to {faculty.name}",
                    {"subject_ids": subject_ids},
                    request,
                )
                return Response(
                    {
                        "success": True,
                        "message": f"Assigned {len(subject_ids)} subjects to {faculty.name}",
                    }
                )

            elif action == "add":
                subject_id = data.get("subject_id")
                if subject_id:
                    from academics.models import Subject

                    subject = Subject.objects.get(subject_id=subject_id)
                    faculty.subjects.add(subject)
                    log_admin_action(
                        request.user,
                        "ADD",
                        "FacultySubject",
                        faculty.faculty_id,
                        f"Added {subject.code} to {faculty.name}",
                        {"subject_id": str(subject_id)},
                        request,
                    )
                    return Response(
                        {"success": True, "message": f"Added {subject.code}"}
                    )

            elif action == "remove":
                subject_id = data.get("subject_id")
                if subject_id:
                    from academics.models import Subject

                    subject = Subject.objects.get(subject_id=subject_id)
                    faculty.subjects.remove(subject)
                    log_admin_action(
                        request.user,
                        "REMOVE",
                        "FacultySubject",
                        faculty.faculty_id,
                        f"Removed {subject.code} from {faculty.name}",
                        {"subject_id": str(subject_id)},
                        request,
                    )
                    return Response(
                        {"success": True, "message": f"Removed {subject.code}"}
                    )

            return Response(
                {"error": "Invalid action"}, status=http_status.HTTP_400_BAD_REQUEST
            )

    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty not found"}, status=http_status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# NOTIFICATIONS
# =============================================================================


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_send_notification(request):
    """Send notification to users."""
    try:
        data = request.data
        target = data.get("target", "all")
        title = data.get("title", "")
        message = data.get("message", "")
        priority = data.get("priority", "Normal")

        if not title or not message:
            return Response(
                {"error": "Title and message are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        target_display = target

        if target == "all":
            users = User.objects.filter(is_active=True, role="student")
        elif target == "faculty":
            users = User.objects.filter(is_active=True, role="faculty")
        elif target.startswith("course:"):
            course_code = target.split(":")[1]
            users = User.objects.filter(
                is_active=True,
                role="student",
                student_profile__course__code=course_code,
            )
        else:
            users = User.objects.none()

        notifications_created = 0
        for user in users:
            Notification.objects.create(
                target=f"{user.email}",
                type="bulk",
                priority=priority,
                title=title,
                message=message,
            )
            notifications_created += 1

        log_admin_action(
            request.user,
            "SEND_NOTIFICATION",
            "Notification",
            None,
            title,
            {
                "target": target,
                "count": notifications_created,
                "message": message[:100],
            },
            request,
        )

        return Response(
            {
                "success": True,
                "notifications_created": notifications_created,
                "target": target_display,
            }
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_notification_history(request):
    """Get notification history."""
    try:
        notifications = Notification.objects.all()[:100]
        data = [
            {
                "notification_id": str(n.notification_id),
                "target": n.target,
                "title": n.title,
                "message": n.message[:100],
                "priority": n.priority,
                "status": n.status,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ]

        return Response({"total": Notification.objects.count(), "notifications": data})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# SYSTEM CONTROL
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_system_health(request):
    """Get system health information."""
    try:
        from users.models import Student, Faculty
        from academics.models import Course, Subject

        table_counts = {}
        for table_name in connection.introspection.table_names():
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    table_counts[table_name] = cursor.fetchone()[0]
            except:
                table_counts[table_name] = 0

        return Response(
            {
                "students": Student.objects.count(),
                "faculty": Faculty.objects.count(),
                "courses": Course.objects.count(),
                "subjects": Subject.objects.count(),
                "tables": len(table_counts),
                "table_counts": table_counts,
                "server_time": timezone.now().isoformat(),
                "db_size": "N/A",
                "server_status": "operational",
                "db_status": "connected",
            }
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_activity_logs(request):
    """Get activity logs with filters."""
    try:
        action = request.query_params.get("action")
        target_model = request.query_params.get("target_model")
        limit = int(request.query_params.get("limit", 100))

        queryset = AdminActivityLog.objects.all()

        if action:
            queryset = queryset.filter(action=action)
        if target_model:
            queryset = queryset.filter(target_model=target_model)

        logs = [
            {
                "log_id": str(log.log_id),
                "admin_name": log.admin_name,
                "action": log.action,
                "target_model": log.target_model,
                "target_id": log.target_id,
                "target_name": log.target_name,
                "details": log.details,
                "ip_address": log.ip_address,
                "timestamp": log.timestamp.isoformat(),
            }
            for log in queryset[:limit]
        ]

        return Response({"total": queryset.count(), "logs": logs})
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_bulk_import(request):
    """Bulk import students, faculty, or subjects from CSV."""
    try:
        import csv
        from io import StringIO

        if "file" not in request.FILES:
            return Response(
                {"error": "No file uploaded"}, status=http_status.HTTP_400_BAD_REQUEST
            )

        csv_file = request.FILES["file"]
        decoded_file = csv_file.read().decode("utf-8")
        reader = csv.DictReader(StringIO(decoded_file))

        import_type = request.data.get("type", "students")

        total = 0
        imported = 0
        failed = 0
        errors = []

        for row in reader:
            total += 1
            try:
                if import_type == "students":
                    name = row.get("name", "").strip()
                    email = row.get("email", "").strip()
                    phone = row.get("phone", "").strip()
                    course_code = row.get("course_code", "").strip()
                    semester = int(row.get("semester", 1))

                    if not name or not email:
                        failed += 1
                        errors.append(
                            {"row": total, "message": "Name and email required"}
                        )
                        continue

                    if User.objects.filter(email=email).exists():
                        failed += 1
                        errors.append(
                            {"row": total, "message": f"Email {email} already exists"}
                        )
                        continue

                    course = None
                    if course_code:
                        try:
                            course = Course.objects.get(code=course_code)
                        except Course.DoesNotExist:
                            pass

                    user = User.objects.create_user(
                        email=email, password="Student@2026", role="student"
                    )
                    Student.objects.create(
                        user=user,
                        name=name,
                        email=email,
                        phone=phone,
                        course=course,
                        current_semester=semester,
                    )
                    imported += 1

                elif import_type == "faculty":
                    name = row.get("name", "").strip()
                    email = row.get("email", "").strip()
                    phone = row.get("phone", "").strip()
                    department = row.get("department", "Computer Applications").strip()

                    if not name or not email:
                        failed += 1
                        errors.append(
                            {"row": total, "message": "Name and email required"}
                        )
                        continue

                    if User.objects.filter(email=email).exists():
                        failed += 1
                        errors.append(
                            {"row": total, "message": f"Email {email} already exists"}
                        )
                        continue

                    user = User.objects.create_user(
                        email=email, password="Faculty@2026", role="faculty"
                    )
                    Faculty.objects.create(
                        user=user,
                        name=name,
                        email=email,
                        phone=phone,
                        department=department,
                    )
                    imported += 1

                elif import_type == "subjects":
                    code = row.get("code", "").strip()
                    name = row.get("name", "").strip()
                    course_code = row.get("course_code", "").strip()
                    semester = int(row.get("semester", 1))
                    credits = int(row.get("credits", 4))

                    if not code or not name or not course_code:
                        failed += 1
                        errors.append(
                            {
                                "row": total,
                                "message": "Code, name, and course_code required",
                            }
                        )
                        continue

                    course = None
                    try:
                        course = Course.objects.get(code=course_code)
                    except Course.DoesNotExist:
                        failed += 1
                        errors.append(
                            {"row": total, "message": f"Course {course_code} not found"}
                        )
                        continue

                    Subject.objects.create(
                        code=code,
                        name=name,
                        course=course,
                        semester=semester,
                        credits=credits,
                    )
                    imported += 1

            except Exception as e:
                failed += 1
                errors.append({"row": total, "message": str(e)})

        log_admin_action(
            request.user,
            "IMPORT",
            "BulkImport",
            None,
            f"Bulk import: {import_type}",
            {"total": total, "imported": imported, "failed": failed},
            request,
        )

        return Response(
            {
                "success": failed == 0,
                "total": total,
                "imported": imported,
                "failed": failed,
                "errors": errors[:50],
            }
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ─── Database Explorer ─────────────────────────────────────────────────────────


def get_model_by_table(table_name):
    """Get Django model by db_table name."""
    from django.apps import apps

    for model in apps.get_models():
        if model._meta.db_table == table_name:
            return model
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def db_tables_list(request):
    """Get list of all database tables with row counts."""
    from django.apps import apps

    tables = []
    for model in apps.get_models():
        try:
            count = model.objects.count()
        except Exception:
            count = 0
        tables.append(
            {
                "table_name": model._meta.db_table,
                "model_name": model.__name__,
                "app_label": model._meta.app_label,
                "row_count": count,
            }
        )
    tables.sort(key=lambda x: x["table_name"])
    return Response({"tables": tables, "total": len(tables)})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def db_table_records(request, table_name):
    """Get records from a table with pagination and search, or create new record."""
    from django.core.paginator import Paginator
    from django.db.models import Q
    from django.db.models.base import Model

    model = get_model_by_table(table_name)
    if not model:
        return Response({"error": "Table not found"}, status=404)

    if request.method == "GET":
        search = request.query_params.get("search", "").strip()
        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 50))

        columns = [f.name for f in model._meta.fields]
        qs = model.objects.all()

        if search:
            q = Q()
            for field in model._meta.fields:
                if field.get_internal_type() in [
                    "CharField",
                    "TextField",
                    "EmailField",
                    "SlugField",
                ]:
                    q |= Q(**{f"{field.name}__icontains": search})
                elif field.get_internal_type() == "ForeignKey":
                    q |= Q(**{f"{field.name}__name__icontains": search})
                    q |= Q(**{f"{field.name}__email__icontains": search})
                    q |= Q(**{f"{field.name}__code__icontains": search})
                    q |= Q(**{f"{field.name}__title__icontains": search})
            qs = qs.filter(q)

        paginator = Paginator(qs, limit)
        page_obj = paginator.get_page(page)

        rows = []
        for obj in page_obj:
            row = {"id": str(obj.pk)}
            for col in columns:
                if col != "id":
                    val = getattr(obj, col, None)
                    if val is None:
                        row[col] = ""
                    elif isinstance(
                        val, Model
                    ):  # It's a Django model instance (ForeignKey)
                        # Try to get display value
                        for attr in [
                            "name",
                            "email",
                            "code",
                            "title",
                            "username",
                            "__str__",
                        ]:
                            if hasattr(val, attr):
                                try:
                                    attr_val = getattr(val, attr)
                                    if callable(attr_val):
                                        row[col] = str(attr_val())
                                    else:
                                        row[col] = str(attr_val)
                                    break
                                except Exception:
                                    continue
                        else:
                            row[col] = str(val.pk)
                    elif isinstance(val, (list, tuple)):
                        row[col] = ", ".join(str(v) for v in val[:5])
                    else:
                        # It's a primitive type - just convert to string
                        row[col] = str(val) if val is not None else ""
            rows.append(row)

        return Response(
            {
                "columns": columns,
                "rows": rows,
                "total": paginator.count,
                "pages": paginator.num_pages,
                "current_page": page,
            }
        )

    elif request.method == "POST":
        try:
            obj = model.objects.create(**request.data)
            return Response({"success": True, "id": str(obj.pk)}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def db_table_record_detail(request, table_name, record_id):
    """Get, update, or delete a specific record."""
    from uuid import UUID

    model = get_model_by_table(table_name)
    if not model:
        return Response({"error": "Table not found"}, status=404)

    # Try to convert record_id to appropriate type
    pk_value = record_id
    try:
        # Check if PK is UUID field
        if model._meta.pk.get_internal_type() == "UUIDField":
            pk_value = UUID(record_id)
        else:
            pk_value = int(record_id)
    except (ValueError, TypeError):
        return Response({"error": "Invalid record ID format"}, status=400)

    try:
        obj = model.objects.get(pk=pk_value)
    except model.DoesNotExist:
        return Response({"error": "Record not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    if request.method == "GET":
        columns = [f.name for f in model._meta.fields]
        row = {"id": str(obj.pk)}
        for col in columns:
            if col != "id":
                val = getattr(obj, col, None)
                if val is None:
                    row[col] = ""
                elif hasattr(val, "name"):
                    row[col] = str(val.name)
                elif hasattr(val, "email"):
                    row[col] = str(val.email)
                elif hasattr(val, "code"):
                    row[col] = str(val.code)
                elif hasattr(val, "title"):
                    row[col] = str(val.title)
                elif hasattr(val, "pk"):
                    row[col] = str(val)
                else:
                    row[col] = str(val)
        return Response(row)

    elif request.method == "PUT":
        try:
            for key, value in request.data.items():
                if hasattr(obj, key) and key != "id":
                    setattr(obj, key, value)
            obj.save()

            # Log the action
            try:
                log_admin_action(
                    request.user,
                    "UPDATE",
                    model.__name__,
                    record_id,
                    f"Updated {model.__name__} record #{record_id}",
                    request,
                )
            except Exception:
                pass

            return Response({"success": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        try:
            obj.delete()

            # Log the action
            try:
                log_admin_action(
                    request.user,
                    "DELETE",
                    model.__name__,
                    record_id,
                    f"Deleted {model.__name__} record #{record_id}",
                    request,
                )
            except Exception:
                pass

            return Response({"success": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# =============================================================================
# SEMESTER CONFIG — ODD / EVEN TOGGLE
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_semester_config(request):
    """Get current semester config state."""
    try:
        config = SemesterConfig.get_active()
        now = timezone.now()
        current_month = now.month

        return Response({
            "config_id": str(config.config_id),
            "current_parity": config.current_parity,
            "timetable_generated": config.timetable_generated,
            "last_toggled_at": config.last_toggled_at.isoformat() if config.last_toggled_at else None,
            "toggled_by": config.toggled_by.email if config.toggled_by else None,
            "can_toggle_to_even": config.current_parity == "ODD" and current_month == 1,
            "can_toggle_to_odd": config.current_parity == "EVEN" and current_month == 7,
            "current_month": current_month,
        })
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def admin_toggle_semester(request):
    """Toggle semester parity ODD<->EVEN. Auto-increments all student semesters."""
    try:
        config = SemesterConfig.get_active()
        now = timezone.now()
        current_month = now.month
        target_parity = request.data.get("target_parity")

        # Validate toggle direction
        if target_parity == "EVEN" and config.current_parity != "ODD":
            return Response(
                {"error": "Can only toggle to EVEN from ODD"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if target_parity == "ODD" and config.current_parity != "EVEN":
            return Response(
                {"error": "Can only toggle to ODD from EVEN"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Month restriction (January for EVEN, July for ODD)
        if target_parity == "EVEN" and current_month != 1:
            return Response(
                {"error": "Can only toggle to EVEN semester in January"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if target_parity == "ODD" and current_month != 7:
            return Response(
                {"error": "Can only toggle to ODD semester in July"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # ── Auto-increment all student semesters ──
        students = Student.objects.filter(status="Active").select_related("course")
        incremented = 0
        graduated = 0

        for student in students:
            max_sem = student.course.total_semesters if student.course else 8
            new_sem = (student.current_semester or 1) + 1

            if new_sem > max_sem:
                # Graduate this student
                student.status = "Graduated"
                student.save(update_fields=["status"])
                if student.user:
                    student.user.is_active = False
                    student.user.save(update_fields=["is_active"])
                graduated += 1
            else:
                student.current_semester = new_sem
                student.save(update_fields=["current_semester"])
                incremented += 1

        # ── Update config ──
        config.current_parity = target_parity
        config.last_toggled_at = now
        config.toggled_by = request.user
        config.timetable_generated = False  # Reset — enables re-generation
        config.save()

        log_admin_action(
            request.user,
            "TOGGLE_SEMESTER",
            "SemesterConfig",
            config.config_id,
            f"Toggled to {target_parity}",
            {
                "target_parity": target_parity,
                "students_incremented": incremented,
                "students_graduated": graduated,
            },
            request,
        )

        return Response({
            "success": True,
            "current_parity": target_parity,
            "students_incremented": incremented,
            "students_graduated": graduated,
            "timetable_generated": False,
        })
    except Exception as e:
        return Response(
            {"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )
