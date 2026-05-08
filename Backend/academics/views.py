from datetime import datetime
from io import StringIO
import sys
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import (
    Course,
    Subject,
    SemesterResult,
    TimetableSlot,
    TimetableConflict,
    Exam,
    Question,
    ExamResult,
    SubjectResult,
    Room,
    SemesterConfig,
    ProxyLecture,
)
from users.models import Faculty
from .serializers import (
    CourseSerializer,
    SubjectSerializer,
    SemesterResultSerializer,
    TimetableSlotSerializer,
    ExamSerializer,
    QuestionSerializer,
    QuestionReadSerializer,
    ExamResultSerializer,
    SubjectResultSerializer,
    RoomSerializer,
)
from django.db.models import Q

from rest_framework import status


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def course_list(request):
    if request.method == "POST":
        if request.user.role != "admin":
            return Response(
                {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = CourseSerializer(data=request.data)
        if serializer.is_valid():
            course = serializer.save()

            # Auto-create 5 subjects per semester for this new course
            subject_templates = [
                ("Core Theory", 4),
                ("Advanced Concepts", 4),
                ("Practical Lab", 3),
                ("Elective Module", 3),
                ("Seminar & Workshop", 2),
            ]

            total_semesters = course.total_semesters or (course.duration * 2)
            for sem in range(1, total_semesters + 1):
                for idx, (name_suffix, credits) in enumerate(subject_templates, 1):
                    sub_code = f"{course.code}-S{sem}-{idx}"
                    sub_name = f"{course.name} {name_suffix} {sem}.{idx}"
                    # Only create if subject code doesn't already exist
                    if not Subject.objects.filter(code=sub_code).exists():
                        Subject.objects.create(
                            code=sub_code,
                            name=sub_name,
                            course=course,
                            semester=sem,
                            credits=credits,
                        )

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(
            {"error": "Invalid course data", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    courses = Course.objects.filter(status="Active").distinct().order_by("name")
    return Response(CourseSerializer(courses, many=True).data)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def course_detail(request, course_id):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        course = Course.objects.get(course_id=course_id)
    except Course.DoesNotExist:
        return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PUT":
        serializer = CourseSerializer(course, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == "DELETE":
        course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def rooms_list(request):
    """Get all rooms with optional filtering by campus_branch and room_type"""
    campus_branch = request.query_params.get("campus_branch")
    room_type = request.query_params.get("room_type")
    shift = request.query_params.get("shift")  # "MORNING" or "NOON"

    rooms = Room.objects.all()

    if campus_branch:
        rooms = rooms.filter(campus_branch=campus_branch)
    if room_type:
        rooms = rooms.filter(room_type=room_type)

    # Filter by shift (Morning = C-xxx rooms, Noon = A-xxx rooms)
    if shift == "MORNING":
        rooms = rooms.filter(room_number__startswith="C-")
    elif shift == "NOON":
        rooms = rooms.filter(room_number__startswith="A-")

    return Response(RoomSerializer(rooms, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def subject_list(request):
    course_id = request.query_params.get("course_id")
    semester = request.query_params.get("semester")
    assigned_only = request.query_params.get("assigned_only") == "true"

    subjects = Subject.objects.all()

    # If faculty is logged in and assigned_only is passed, filter by their assignments
    if assigned_only and request.user.role == "faculty":
        try:
            faculty = request.user.faculty_profile
            subjects = subjects.filter(faculty_members=faculty)
        except Exception:
            pass

    if course_id:
        # Check if course_id is likely a UUID
        if len(str(course_id)) > 30 and "-" in str(course_id):
            subjects = subjects.filter(course_id=course_id)
        else:
            # Fallback to name match or code match
            subjects = subjects.filter(
                Q(course__name__icontains=course_id) | Q(course__code=course_id)
            )

    if semester:
        try:
            subjects = subjects.filter(semester=int(semester))
        except (ValueError, TypeError):
            pass

    return Response(
        SubjectSerializer(
            subjects.select_related("course").order_by("name"), many=True
        ).data
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def timetable_list(request):
    """Admin can list and create timetable slots."""
    if request.method == "GET":
        course_id = request.query_params.get("course_id")
        semester = request.query_params.get("semester")
        section = request.query_params.get("section")

        slots = TimetableSlot.objects.all().select_related(
            "course", "subject", "faculty"
        )

        if course_id:
            slots = slots.filter(course_id=course_id)
        if semester:
            try:
                semester = int(semester)
                slots = slots.filter(semester=semester)
            except (ValueError, TypeError):
                pass
        if section and section != "All":
            slots = slots.filter(section=section)

        slots = slots.order_by("day_of_week", "start_time", "section")

        return Response(TimetableSlotSerializer(slots, many=True).data)

    elif request.method == "POST":
        if request.user.role != "admin":
            return Response(
                {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = TimetableSlotSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def timetable_detail(request, slot_id):
    """Admin can delete a timetable slot."""
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        slot = TimetableSlot.objects.get(slot_id=slot_id)
        slot.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except TimetableSlot.DoesNotExist:
        return Response({"error": "Slot not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def faculty_timetable(request):
    """Logged-in faculty view their weekly schedule, with per-day slot mapping
    and proxy overlay so the frontend never shows duplicate lectures.
    """
    if request.user.role != "faculty":
        return Response(
            {"error": "Faculty access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        faculty = request.user.faculty_profile

        # Fetch ALL timetable slots assigned to this faculty
        slots = (
            TimetableSlot.objects.filter(faculty=faculty)
            .select_related("course", "subject", "room")
            .order_by("day_of_week", "start_time")
        )

        # Attach active proxy info to each slot so the frontend can overlay it
        slot_data = []
        for slot in slots:
            active_proxy = (
                ProxyLecture.objects.filter(slot=slot, status="Active")
                .select_related("proxy_faculty", "original_faculty")
                .first()
            )
            row = TimetableSlotSerializer(slot).data
            row["proxy_info"] = None
            if active_proxy:
                row["proxy_info"] = {
                    "proxy_id": str(active_proxy.proxy_id),
                    "original_faculty_name": active_proxy.original_faculty.name,
                    "proxy_faculty_name": (
                        active_proxy.proxy_faculty.name
                        if active_proxy.proxy_faculty
                        else "Unassigned"
                    ),
                    "reason": active_proxy.reason,
                    "status": active_proxy.status,
                }
            slot_data.append(row)

        return Response(slot_data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_timetable(request):
    """Logged in student can view their course schedule."""
    if request.user.role != "student":
        return Response(
            {"error": "Student access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        student = request.user.student_profile
        slots = TimetableSlot.objects.filter(
            course=student.course, semester=student.current_semester
        ).select_related("subject", "faculty", "room")
        return Response(TimetableSlotSerializer(slots, many=True).data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================
# EXAM VIEWS
# =============================================


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def exam_list(request):
    if request.method == "GET":
        course_id = request.query_params.get("course_id")
        semester = request.query_params.get("semester")
        published = request.query_params.get("published")

        exams = Exam.objects.all().select_related(
            "subject", "subject__course", "created_by"
        )
        if course_id:
            exams = exams.filter(subject__course_id=course_id)
        if semester:
            exams = exams.filter(subject__semester=semester)
        if published == "true":
            exams = exams.filter(is_published=True)
        return Response(ExamSerializer(exams, many=True).data)

    elif request.method == "POST":
        if request.user.role not in ["faculty", "admin"]:
            return Response(
                {"error": "Access required"}, status=status.HTTP_403_FORBIDDEN
            )
        try:
            faculty = (
                request.user.faculty_profile if request.user.role == "faculty" else None
            )
            serializer = ExamSerializer(data=request.data)
            if serializer.is_valid():
                exam = serializer.save(created_by=faculty)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(
                {"error": "Invalid data", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def exam_detail(request, exam_id):
    try:
        exam = Exam.objects.get(exam_id=exam_id)
    except Exam.DoesNotExist:
        return Response({"error": "Exam not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(ExamSerializer(exam).data)
    elif request.method == "PUT":
        if request.user.role not in ["faculty", "admin"]:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = ExamSerializer(exam, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == "DELETE":
        if request.user.role != "admin":
            return Response(
                {"error": "Admin required"}, status=status.HTTP_403_FORBIDDEN
            )
        exam.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def question_list(request, exam_id):
    try:
        exam = Exam.objects.get(exam_id=exam_id)
    except Exam.DoesNotExist:
        return Response({"error": "Exam not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        questions = exam.questions.all().order_by("order")
        return Response(QuestionReadSerializer(questions, many=True).data)
    elif request.method == "POST":
        if request.user.role not in ["faculty", "admin"]:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )
        data = request.data.copy()
        data["exam"] = str(exam_id)
        serializer = QuestionSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def exam_result_list(request, exam_id):
    try:
        exam = Exam.objects.get(exam_id=exam_id)
    except Exam.DoesNotExist:
        return Response({"error": "Exam not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        if request.user.role == "student":
            results = exam.results.filter(student__user=request.user)
        else:
            results = exam.results.all()
        return Response(ExamResultSerializer(results, many=True).data)
    elif request.method == "POST":
        if request.user.role not in ["faculty", "admin"]:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = ExamResultSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def student_results(request):
    if request.user.role != "student":
        return Response(
            {"error": "Student access required"}, status=status.HTTP_403_FORBIDDEN
        )
    try:
        student = request.user.student_profile

        # Get all semester results ordered by semester
        results = (
            SemesterResult.objects.filter(student=student)
            .prefetch_related("subject_results__subject")
            .order_by("semester")
        )

        # Calculate CGPA from all semesters
        total_sgpa = 0
        semesters_completed = 0
        semesters_data = []

        for result in results:
            sgpa = float(result.sgpa) if result.sgpa else 0
            total_sgpa += sgpa
            semesters_completed += 1

            semesters_data.append(
                {
                    "semester": result.semester,
                    "sgpa": sgpa,
                    "percentage": float(result.percentage) if result.percentage else 0,
                    "grade": result.grade,
                    "total_marks": result.total_marks,
                    "obtained_marks": result.obtained_marks,
                    "status": result.status,
                    "subjects": [
                        {
                            "code": sr.subject.code,
                            "name": sr.subject.name,
                            "internal_marks": sr.internal_marks,
                            "external_marks": sr.external_marks,
                            "practical_marks": sr.practical_marks,
                            "total_marks": sr.total_marks,
                            "is_passed": sr.is_passed,
                            "grade": sr.grade,
                        }
                        for sr in result.subject_results.all()
                    ],
                }
            )

        # Calculate CGPA
        cgpa = (
            round(total_sgpa / semesters_completed, 2) if semesters_completed > 0 else 0
        )

        # Update student's cgpa field
        student.cgpa = cgpa
        student.save(update_fields=["cgpa"])

        return Response(
            {
                "cgpa": cgpa,
                "current_semester": student.current_semester,
                "total_semesters": student.total_semesters,
                "semesters": semesters_data,
            }
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_exams(request):
    if request.user.role != "student":
        return Response(
            {"error": "Student access required"}, status=status.HTTP_403_FORBIDDEN
        )
    try:
        student = request.user.student_profile
        student_branch = getattr(student, "branch", None)
        branch_filter = None
        if student_branch:
            branch_filter = (
                "Ahmedabad"
                if "Ahmedabad" in student_branch
                else "Kherva"
                if "Kherva" in student_branch
                else None
            )
        exams = (
            Exam.objects.filter(
                subject__course=student.course,
                subject__semester=student.current_semester,
                is_published=True,
            )
            .filter(
                Q(campus_branch="Both") | Q(campus_branch=branch_filter)
                if branch_filter
                else Q()
            )
            .select_related("subject")
            .order_by("date", "start_time")
        )
        return Response(ExamSerializer(exams, many=True).data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def faculty_exams(request):
    if request.user.role != "faculty":
        return Response(
            {"error": "Faculty access required"}, status=status.HTTP_403_FORBIDDEN
        )
    try:
        faculty = request.user.faculty_profile
        faculty_branch = getattr(faculty, "branch", None)
        branch_filter = None
        if faculty_branch:
            branch_filter = (
                "Ahmedabad"
                if "Ahmedabad" in faculty_branch
                else "Kherva"
                if "Kherva" in faculty_branch
                else None
            )
        exams = (
            Exam.objects.filter(
                Q(created_by=faculty)
                | Q(campus_branch="Both")
                | Q(campus_branch=branch_filter)
                if branch_filter
                else Q()
            )
            .select_related("subject")
            .order_by("-date")
        )
        return Response(ExamSerializer(exams, many=True).data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================
# ADMIN TIMETABLE MANAGEMENT
# =============================================


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_generate_timetable(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    branch = request.data.get("branch", "Ahmedabad")
    clear = request.data.get("clear", True)

    # Check if timetable already generated this semester
    try:
        sem_config = SemesterConfig.objects.first()
        if sem_config and sem_config.timetable_generated:
            return Response(
                {"error": "Timetable already generated for this semester. Wait for semester toggle to re-enable."},
                status=status.HTTP_409_CONFLICT,
            )
    except Exception:
        pass

    try:
        from academics.management.commands.generate_timetable import (
            Command as TimetableCommand,
        )

        if clear:
            deleted = TimetableSlot.objects.filter(is_auto_generated=True).delete()[0]
        else:
            deleted = 0

        cmd = TimetableCommand()
        result = {"generated": 0, "locked": 0, "conflicts": 0}

        # Capture stdout
        from io import StringIO

        old_stdout = sys.stdout
        sys.stdout = StringIO()
        try:
            cmd.handle()
        except Exception as e:
            pass
        output = sys.stdout.getvalue()
        sys.stdout = old_stdout

        # Parse output for stats
        if "[DONE] Generated" in output:
            import re

            match = re.search(r"\[DONE\] Generated (\d+) slots", output)
            if match:
                result["generated"] = int(match.group(1))

        total_slots = TimetableSlot.objects.count()
        auto_slots = TimetableSlot.objects.filter(is_auto_generated=True).count()

        # Mark timetable as generated in SemesterConfig
        try:
            sem_config, _ = SemesterConfig.objects.get_or_create(pk=1)
            sem_config.timetable_generated = True
            sem_config.save(update_fields=["timetable_generated"])
        except Exception:
            pass

        return Response(
            {
                "success": True,
                "message": f"Timetable generated for {branch} campus",
                "stats": {
                    "generated": result["generated"],
                    "locked": result["locked"],
                    "conflicts": result["conflicts"],
                    "deleted": deleted,
                    "total": total_slots,
                },
            }
        )
    except Exception as e:
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pyq_search(request):
    """
    Returns shuffled, subject-specific questions for paper generation.
    Priority order:
      1. Trained ML model clusters (from real past papers)
      2. DB questions (entered by faculty)
      3. Topic-keyword question bank (fallback)
    """
    import random
    from pyqs.apps import PyqsConfig
    from pyqs.question_bank import generate_questions_for_subject

    subject_id = request.query_params.get('subject_id')
    if not subject_id:
        return Response({"error": "subject_id is required"}, status=400)

    try:
        subject = Subject.objects.get(subject_id=subject_id)
        subject_name = subject.name
        subject_code = subject.code.upper()
        semester     = subject.semester or 1
    except Subject.DoesNotExist:
        return Response({"error": "Subject not found"}, status=404)

    all_questions = []
    seen = set()

    def add(q):
        k = q.strip().lower()
        if k not in seen and len(k) > 15:
            seen.add(k)
            all_questions.append(q.strip())

    # ── 1. ML model clusters (real past-paper questions) ──────────────────
    model_key = f"{semester}_{subject_code}"
    clusters  = PyqsConfig.clusters.get(model_key, {})

    # Also try fuzzy semester match (subject may exist in multiple semesters)
    if not clusters:
        for key in PyqsConfig.clusters:
            if key.endswith(f"_{subject_code}"):
                clusters = PyqsConfig.clusters[key]
                break

    # Sort by frequency score (most-repeated questions first)
    ranked = sorted(
        clusters.values(),
        key=lambda c: (c.get("year_count", 1), c.get("count", 1)),
        reverse=True,
    )
    for c in ranked:
        add(c.get("representative", ""))

    # ── 2. DB questions from faculty-entered exams ─────────────────────────
    db_qs = (
        Question.objects.filter(exam__subject_id=subject_id)
        .values_list("question_text", flat=True)
        .distinct()
    )
    for q in db_qs:
        add(q)

    # ── 3. Topic-keyword bank (fallback if model has < 15 questions) ───────
    if len(all_questions) < 15:
        for item in generate_questions_for_subject(subject_name, count=30):
            add(item["question"])

    # Shuffle so repeated calls return different order
    random.shuffle(all_questions)

    result = [{"question_id": i, "question_text": q}
              for i, q in enumerate(all_questions)]
    return Response(result)



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_timetable_stats(request):
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    total = TimetableSlot.objects.count()
    auto = TimetableSlot.objects.filter(is_auto_generated=True).count()
    locked = TimetableSlot.objects.filter(is_locked=True).count()

    return Response(
        {
            "total": total,
            "auto": auto,
            "locked": locked,
            "manual": total - auto,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_complete_timetable(request):
    """Generate complete timetable for all courses using new algorithm"""
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    from django.core.management import call_command
    from io import StringIO
    import sys

    try:
        # Clear existing
        TimetableSlot.objects.filter(is_auto_generated=True).delete()
        TimetableConflict.objects.all().delete()

        # Run generation
        out = StringIO()
        sys.stdout = out
        call_command("generate_timetable", stdout=out)
        sys.stdout = sys.__stdout__

        total = TimetableSlot.objects.count()
        conflicts = TimetableConflict.objects.count()

        return Response(
            {
                "success": True,
                "message": "Timetable generated successfully",
                "stats": {"total_slots": total, "conflicts": conflicts},
            }
        )
    except Exception as e:
        import traceback

        return Response(
            {"success": False, "error": str(e), "traceback": traceback.format_exc()},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_timetable_by_course(request, course_id, semester):
    """Get timetable for specific course and semester"""
    try:
        course = Course.objects.get(course_id=course_id)
        slots = (
            TimetableSlot.objects.filter(course=course, semester=semester)
            .select_related("subject", "faculty", "room", "time_slot")
            .order_by("time_slot__slot_order", "day_of_week")
        )

        # Group by day
        timetable = {}
        for slot in slots:
            day = slot.day_of_week
            if day not in timetable:
                timetable[day] = []
            timetable[day].append(
                {
                    "slot_id": str(slot.slot_id),
                    "time_slot": slot.time_slot.start_time.strftime("%H:%M")
                    if slot.time_slot
                    else "",
                    "end_time": slot.time_slot.end_time.strftime("%H:%M")
                    if slot.time_slot
                    else "",
                    "subject_code": slot.subject.code if slot.subject else "",
                    "subject_name": slot.subject.name if slot.subject else "",
                    "faculty_name": slot.faculty.name if slot.faculty else "TBA",
                    "room": slot.room.room_number if slot.room else "TBA",
                    "room_type": slot.room.room_type if slot.room else "",
                }
            )

        return Response(
            {
                "course": course.code,
                "course_name": course.name,
                "semester": semester,
                "total_slots": slots.count(),
                "timetable": timetable,
            }
        )
    except Course.DoesNotExist:
        return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_timetable_by_faculty(request, faculty_id):
    """Get timetable for specific faculty"""
    try:
        faculty = Faculty.objects.get(faculty_id=faculty_id)
        slots = (
            TimetableSlot.objects.filter(faculty=faculty)
            .select_related("course", "subject", "room", "time_slot")
            .order_by("time_slot__slot_order", "day_of_week")
        )

        timetable = {}
        for slot in slots:
            day = slot.day_of_week
            if day not in timetable:
                timetable[day] = []
            timetable[day].append(
                {
                    "slot_id": str(slot.slot_id),
                    "time_slot": slot.time_slot.start_time.strftime("%H:%M")
                    if slot.time_slot
                    else "",
                    "end_time": slot.time_slot.end_time.strftime("%H:%M")
                    if slot.time_slot
                    else "",
                    "course": slot.course.code if slot.course else "",
                    "course_name": slot.course.name if slot.course else "",
                    "semester": slot.semester,
                    "subject_code": slot.subject.code if slot.subject else "",
                    "subject_name": slot.subject.name if slot.subject else "",
                    "room": slot.room.room_number if slot.room else "TBA",
                }
            )

        return Response(
            {
                "faculty": faculty.name,
                "department": faculty.department,
                "total_slots": slots.count(),
                "timetable": timetable,
            }
        )
    except Faculty.DoesNotExist:
        return Response(
            {"error": "Faculty not found"}, status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_timetable_by_room(request, room_id):
    """Get timetable for specific room"""
    try:
        room = Room.objects.get(room_id=room_id)
        slots = (
            TimetableSlot.objects.filter(room=room)
            .select_related("course", "subject", "faculty", "time_slot")
            .order_by("time_slot__slot_order", "day_of_week")
        )

        timetable = {}
        for slot in slots:
            day = slot.day_of_week
            if day not in timetable:
                timetable[day] = []
            timetable[day].append(
                {
                    "slot_id": str(slot.slot_id),
                    "time_slot": slot.time_slot.start_time.strftime("%H:%M")
                    if slot.time_slot
                    else "",
                    "end_time": slot.time_slot.end_time.strftime("%H:%M")
                    if slot.time_slot
                    else "",
                    "course": slot.course.code if slot.course else "",
                    "semester": slot.semester,
                    "subject_code": slot.subject.code if slot.subject else "",
                    "subject_name": slot.subject.name if slot.subject else "",
                    "faculty": slot.faculty.name if slot.faculty else "TBA",
                }
            )

        return Response(
            {
                "room": room.room_number,
                "building": room.building,
                "capacity": room.capacity,
                "total_slots": slots.count(),
                "timetable": timetable,
            }
        )
    except Room.DoesNotExist:
        return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def clear_timetable(request):
    """Clear all auto-generated timetable slots"""
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        deleted = TimetableSlot.objects.filter(is_auto_generated=True).delete()[0]
        conflicts = TimetableConflict.objects.all().delete()[0]

        return Response(
            {
                "success": True,
                "message": f"Cleared {deleted} slots and {conflicts} conflicts",
            }
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_timetable_conflicts(request):
    """Get all timetable conflicts"""
    conflicts = (
        TimetableConflict.objects.filter(is_resolved=False)
        .select_related("course")
        .order_by("-created_at")
    )

    return Response(
        {
            "total": conflicts.count(),
            "conflicts": [
                {
                    "id": str(c.conflict_id),
                    "type": c.conflict_type,
                    "description": c.description,
                    "course": c.course.code if c.course else None,
                    "semester": c.semester,
                    "created_at": c.created_at.strftime("%Y-%m-%d %H:%M"),
                }
                for c in conflicts
            ],
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resolve_conflict(request, conflict_id):
    """Mark a conflict as resolved"""
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        conflict = TimetableConflict.objects.get(conflict_id=conflict_id)
        conflict.is_resolved = True
        conflict.save()
        return Response({"success": True, "message": "Conflict marked as resolved"})
    except TimetableConflict.DoesNotExist:
        return Response(
            {"error": "Conflict not found"}, status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_generate_timetable_pdf(request):
    """Generate timetable PDF in GANPAT DCS format - ONE CLICK!"""
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
        )

    course_code = request.data.get("course_code")
    semester = request.data.get("semester")

    try:
        from django.http import HttpResponse
        from generate_timetable_pdf import generate_timetable_pdf as gen_pdf

        if course_code:
            try:
                course = Course.objects.get(code=course_code)
            except Course.DoesNotExist:
                return Response(
                    {"error": f"Course {course_code} not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            pdf_buffer = gen_pdf(course_code, semester)
        else:
            from generate_timetable_pdf import generate_all_courses_pdf

            pdf_buffer = generate_all_courses_pdf()

        response = HttpResponse(pdf_buffer.getvalue(), content_type="application/pdf")
        filename = f"timetable_{course_code or 'all'}_{semester or 'all'}_{datetime.now().strftime('%Y%m%d')}.pdf"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        return response

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_proxy(request):
    """
    Mark a lecture slot as proxy.

    Authorization Logic (STRICT):
      1. Requesting user must be 'faculty' (or 'admin').
      2. The timetable slot's assigned faculty must be the requesting faculty.
      3. The subject in that slot MUST exist in faculty.subjects (Master DB M2M).
      4. No duplicate active proxy allowed for the same slot.

    Notification Logic (TARGETED):
      - Admin  → target="Admin"
      - Students → target=COURSE_{course_id}_SEM{sem}_SEC{section}  (only matching)
      - Proxy Faculty → target=<proxy_faculty.email>
    """
    if request.user.role not in ("faculty", "admin"):
        return Response(
            {"error": "Faculty or Admin access required"},
            status=status.HTTP_403_FORBIDDEN,
        )

    slot_id = request.data.get("slot_id")
    reason = (request.data.get("reason") or "").strip()
    proxy_faculty_id = request.data.get("proxy_faculty_id")

    # ── Input validation ──────────────────────────────────────────────────
    if not slot_id:
        return Response(
            {"error": "slot_id is required"}, status=status.HTTP_400_BAD_REQUEST
        )
    if len(reason) < 5:
        return Response(
            {"error": "Reason must be at least 5 characters"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Fetch slot ────────────────────────────────────────────────────────
    try:
        slot = TimetableSlot.objects.select_related(
            "faculty", "subject", "course", "room"
        ).get(slot_id=slot_id)
    except TimetableSlot.DoesNotExist:
        return Response(
            {"error": "Timetable slot not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # ── Authorization checks ──────────────────────────────────────────────
    if request.user.role == "faculty":
        faculty = request.user.faculty_profile

        # CHECK 1: Faculty must own this slot
        if str(slot.faculty.faculty_id) != str(faculty.faculty_id):
            return Response(
                {"error": "You can only mark proxy for your OWN assigned lectures."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # CHECK 2: Subject must be in faculty's Master Assignment (M2M)
        is_master_assigned = slot.subject.faculty_members.filter(
            faculty_id=faculty.faculty_id
        ).exists()
        if not is_master_assigned:
            return Response(
                {
                    "error": (
                        f"Subject '{slot.subject.code}' is not in your Master Assignment. "
                        "Contact your HOD/Admin to add it before marking proxy."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
    else:
        # Admin: act on behalf of the slot's original faculty
        faculty = slot.faculty

    # CHECK 3: No duplicate active proxy for the same slot
    if ProxyLecture.objects.filter(slot_id=slot_id, status="Active").exists():
        return Response(
            {
                "error": (
                    "An active proxy already exists for this slot. "
                    "Cancel it first before creating a new one."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    # ── Proxy faculty validation (optional) ───────────────────────────────
    proxy_fac = None
    if proxy_faculty_id:
        try:
            proxy_fac = Faculty.objects.get(faculty_id=proxy_faculty_id)
        except Faculty.DoesNotExist:
            return Response(
                {"error": "Proxy faculty not found"}, status=status.HTTP_404_NOT_FOUND
            )

    # ── Create proxy record ───────────────────────────────────────────────
    proxy_obj = ProxyLecture.objects.create(
        slot=slot,
        original_faculty=slot.faculty,
        proxy_faculty=proxy_fac,
        reason=reason,
        status="Active",
        is_notified=False,
    )

    # ── Auto-notifications (TARGETED — never broadcast to all) ────────────
    try:
        from users.models import Notification

        original_name = slot.faculty.name
        subject_name = slot.subject.name if slot.subject else "Unknown Subject"
        subject_code = slot.subject.code if slot.subject else ""
        day_time = f"{slot.day_of_week} {slot.start_time.strftime('%I:%M %p')}"
        course_code = slot.course.code if slot.course else ""
        proxy_name = proxy_fac.name if proxy_fac else "To Be Announced"
        section = slot.section
        semester = slot.semester
        course_id = slot.course_id

        # Tag format: COURSE_{uuid}_SEM{sem}_SEC{section}
        # Students filter their notifications using this EXACT tag.
        student_target_tag = f"COURSE_{course_id}_SEM{semester}_SEC{section}"

        # 1. Admin notification (record-keeping)
        Notification.objects.create(
            target="Admin",
            type="Proxy Alert",
            priority="Critical",
            title=f"[PROXY] {subject_code} — {day_time}",
            message=(
                f"PROXY MARKED\n"
                f"Original Faculty: {original_name}\n"
                f"Proxy Faculty: {proxy_name}\n"
                f"Course: {course_code} | Semester: {semester} | Section: {section}\n"
                f"Subject: {subject_name}\n"
                f"Schedule: {day_time}\n"
                f"Reason: {reason}\n"
                f"[Record-Keeping & Compliance]"
            ),
        )

        # 2. Targeted student notification
        # ONLY students whose course_id, semester, and section match receive this.
        # The notification.target field stores the COURSE_SEM_SEC tag;
        # the student dashboard queries by this exact tag.
        Notification.objects.create(
            target=student_target_tag,
            type="Schedule Change",
            priority="High",
            title=f"📅 {subject_code}: Proxy Lecture Alert",
            message=(
                f"CLASS SCHEDULE CHANGE\n"
                f"Subject: {subject_code} — {subject_name}\n"
                f"Course: {course_code} | Sem: {semester} | Section: {section}\n"
                f"Date: {day_time}\n"
                f"Proxy Faculty: {proxy_name}\n"
                f"Reason: {reason}\n"
                f"Please attend as scheduled."
            ),
        )

        # 3. Proxy faculty notification (if assigned)
        if proxy_fac:
            Notification.objects.create(
                target=proxy_fac.email,
                type="Proxy Assignment",
                priority="High",
                title=f"🔄 Proxy Assignment — {subject_code}",
                message=(
                    f"PROXY ASSIGNMENT\n"
                    f"You are assigned as proxy for: {original_name}\n"
                    f"Subject: {subject_code} — {subject_name}\n"
                    f"Course: {course_code} | Sem: {semester} | Section: {section}\n"
                    f"Schedule: {day_time}\n"
                    f"Reason: {reason}"
                ),
            )

        # 4. Confirmation to original faculty
        Notification.objects.create(
            target=slot.faculty.email,
            type="Proxy Confirmation",
            priority="Normal",
            title=f"✅ Proxy Confirmed — {subject_code}",
            message=(
                f"Proxy marked for {day_time}.\n"
                f"Proxy Faculty: {proxy_name}\n"
                f"Subject: {subject_code} | Course: {course_code}"
            ),
        )

        # Mark proxy as notified
        proxy_obj.is_notified = True
        proxy_obj.save(update_fields=["is_notified"])

    except Exception as e:
        print(f"[Notification Error] {e}")  # Non-fatal
    # ── End notifications ─────────────────────────────────────────────────

    return Response(
        {
            "success": True,
            "message": f"Proxy marked for {slot.day_of_week} {slot.start_time}",
            "proxy_id": str(proxy_obj.proxy_id),
            "proxy": {
                "proxy_id": str(proxy_obj.proxy_id),
                "reason": proxy_obj.reason,
                "status": proxy_obj.status,
                "proxy_faculty_name": proxy_fac.name if proxy_fac else None,
                "original_faculty_name": slot.faculty.name,
                "day_of_week": slot.day_of_week,
                "start_time": str(slot.start_time),
                "end_time": str(slot.end_time),
                "subject_name": slot.subject.name,
                "subject_code": slot.subject.code,
                "course_code": slot.course.code if slot.course else None,
                "semester": slot.semester,
                "section": slot.section,
                "notification_target": (
                    f"COURSE_{slot.course_id}_SEM{slot.semester}_SEC{slot.section}"
                ),
            },
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_proxy(request, proxy_id):
    if request.user.role not in ("faculty", "admin"):
        return Response(
            {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        proxy_obj = ProxyLecture.objects.select_related(
            "original_faculty", "slot__faculty"
        ).get(proxy_id=proxy_id)
    except ProxyLecture.DoesNotExist:
        return Response(
            {"error": "Proxy not found"}, status=status.HTTP_404_NOT_FOUND
        )

    if request.user.role == "faculty":
        if str(proxy_obj.original_faculty.user_id) != str(request.user.user_id):
            return Response(
                {"error": "You can only cancel your own proxies"},
                status=status.HTTP_403_FORBIDDEN,
            )

    proxy_obj.status = "Cancelled"
    proxy_obj.save(update_fields=["status"])

    return Response(
        {"success": True, "message": "Proxy lecture cancelled"}
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_slot_proxies(request, slot_id):
    try:
        proxies = ProxyLecture.objects.filter(
            slot_id=slot_id, status="Active"
        ).select_related("proxy_faculty", "original_faculty")

        data = []
        for p in proxies:
            data.append({
                "proxy_id": str(p.proxy_id),
                "reason": p.reason,
                "status": p.status,
                "original_faculty_name": p.original_faculty.name,
                "proxy_faculty_name": (
                    p.proxy_faculty.name if p.proxy_faculty else None
                ),
                "created_at": p.created_at.isoformat(),
            })

        return Response({"proxies": data, "count": len(data)})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def faculty_my_proxies(request):
    if request.user.role != "faculty":
        return Response(
            {"error": "Faculty access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        faculty = request.user.faculty_profile
        proxies = ProxyLecture.objects.filter(
            original_faculty=faculty
        ).select_related("slot", "proxy_faculty", "original_faculty").order_by(
            "-created_at"
        )[:50]

        data = []
        for p in proxies:
            data.append({
                "proxy_id": str(p.proxy_id),
                "reason": p.reason,
                "status": p.status,
                "original_faculty_name": p.original_faculty.name,
                "proxy_faculty_name": (
                    p.proxy_faculty.name if p.proxy_faculty else "Unassigned"
                ),
                "day_of_week": p.slot.day_of_week,
                "start_time": str(p.slot.start_time),
                "end_time": str(p.slot.end_time),
                "subject_name": p.slot.subject.name,
                "course_code": p.slot.course.code,
                "semester": p.slot.semester,
                "section": p.slot.section,
                "created_at": p.created_at.isoformat(),
            })

        return Response({"proxies": data})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
