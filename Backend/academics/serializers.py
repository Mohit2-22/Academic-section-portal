from rest_framework import serializers
from .models import (
    Course,
    Subject,
    SemesterResult,
    AcademicTerm,
    Holiday,
    TimetableSlot,
    Exam,
    Question,
    ExamResult,
    StudentAnswer,
    SubjectResult,
    Room,
)


class CourseSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    unassigned_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "course_id",
            "code",
            "name",
            "duration",
            "total_semesters",
            "department",
            "level",
            "credits",
            "status",
            "shift",
            "desc",
            "student_count",
            "unassigned_count",
            "created_at",
        ]
        read_only_fields = ["course_id", "created_at"]

    def get_student_count(self, obj):
        if hasattr(obj, "_student_count_cached"):
            return obj._student_count_cached
        return obj.students.count() if obj.students.exists() else 0

    def get_unassigned_count(self, obj):
        if hasattr(obj, "_unassigned_count_cached"):
            return obj._unassigned_count_cached
        from users.models import Student

        return Student.objects.filter(course__isnull=True).count()


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = "__all__"
        read_only_fields = ["room_id", "created_at"]


class SubjectSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)

    class Meta:
        model = Subject
        fields = [
            "subject_id",
            "code",
            "name",
            "course",
            "course_code",
            "course_name",
            "semester",
            "credits",
            "campus_branch",
            "created_at",
        ]
        read_only_fields = ["subject_id", "created_at"]


class SubjectResultSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = SubjectResult
        fields = [
            "subject_result_id",
            "subject",
            "subject_code",
            "subject_name",
            "internal_marks",
            "external_marks",
            "practical_marks",
            "total_marks",
            "passing_marks",
            "is_passed",
            "grade",
        ]
        read_only_fields = ["subject_result_id"]


class SemesterResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    student_enrollment = serializers.CharField(
        source="student.enrollment_no", read_only=True
    )
    subject_results = SubjectResultSerializer(many=True, read_only=True)

    class Meta:
        model = SemesterResult
        fields = [
            "result_id",
            "student",
            "student_name",
            "student_enrollment",
            "semester",
            "sgpa",
            "total_marks",
            "obtained_marks",
            "percentage",
            "grade",
            "status",
            "year",
            "exam_type",
            "remarks",
            "subject_results",
            "created_at",
        ]
        read_only_fields = ["result_id", "created_at"]


class AcademicTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicTerm
        fields = "__all__"


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = "__all__"


class TimetableSlotSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    room = serializers.SerializerMethodField(read_only=True)
    proxy_info = serializers.SerializerMethodField(read_only=True)
    room_id = serializers.PrimaryKeyRelatedField(
        source="room",
        queryset=Room.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    room_number = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = TimetableSlot
        fields = [
            "slot_id",
            "course",
            "course_code",
            "semester",
            "day_of_week",
            "start_time",
            "end_time",
            "subject",
            "subject_name",
            "subject_code",
            "faculty",
            "faculty_name",
            "room",
            "proxy_info",
            "room_id",
            "room_number",
            "section",
            "slot_type",
        ]
        read_only_fields = ["slot_id"]

    def get_room(self, obj):
        return obj.room_name or (str(obj.room.room_number) if obj.room else None)

    def get_proxy_info(self, obj):
        try:
            proxy = obj.proxy_lectures.filter(status="Active").first()
            if proxy:
                return {
                    "proxy_id": str(proxy.proxy_id),
                    "reason": proxy.reason,
                    "proxy_faculty_name": (
                        proxy.proxy_faculty.name if proxy.proxy_faculty else None
                    ),
                    "status": proxy.status,
                }
        except Exception:
            pass
        return None

    def _resolve_room(self, validated_data):
        room_obj = validated_data.pop("room", None)
        room_number = validated_data.pop("room_number", "")

        if room_obj:
            validated_data["room"] = room_obj
            validated_data["room_name"] = room_obj.room_number
            return validated_data

        if room_number:
            matched_room = Room.objects.filter(room_number=room_number).first()
            validated_data["room"] = matched_room
            validated_data["room_name"] = room_number

        return validated_data

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        course = attrs.get("course", getattr(instance, "course", None))
        semester = attrs.get("semester", getattr(instance, "semester", None))
        day_of_week = attrs.get("day_of_week", getattr(instance, "day_of_week", None))
        start_time = attrs.get("start_time", getattr(instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(instance, "end_time", None))
        section = attrs.get("section", getattr(instance, "section", "A"))
        subject = attrs.get("subject", getattr(instance, "subject", None))
        faculty = attrs.get("faculty", getattr(instance, "faculty", None))
        slot_type = attrs.get("slot_type", getattr(instance, "slot_type", "Theory"))

        room_obj = attrs.get("room", getattr(instance, "room", None))
        room_number = attrs.get("room_number")
        if not room_number:
            if room_obj:
                room_number = room_obj.room_number
            elif instance:
                room_number = instance.room_name

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError(
                {"end_time": "End time must be later than start time."}
            )

        if subject and course and str(subject.course_id) != str(course.course_id):
            raise serializers.ValidationError(
                {"subject": "Selected subject does not belong to the chosen course."}
            )

        if subject and semester and int(subject.semester) != int(semester):
            raise serializers.ValidationError(
                {"subject": "Selected subject does not belong to the chosen semester."}
            )

        if subject and faculty:
            assigned_qs = subject.faculty_members.filter(pk=faculty.pk)
            has_assigned_faculty = subject.faculty_members.exists()
            if has_assigned_faculty and not assigned_qs.exists():
                raise serializers.ValidationError(
                    {"faculty": "Selected faculty is not assigned to this subject."}
                )

        if not all(
            [
                course,
                semester,
                day_of_week,
                start_time,
                end_time,
                section,
                subject,
                faculty,
            ]
        ):
            return attrs

        base_qs = TimetableSlot.objects.all()
        if instance:
            base_qs = base_qs.exclude(pk=instance.pk)

        overlap_qs = base_qs.filter(
            day_of_week=day_of_week,
            start_time__lt=end_time,
            end_time__gt=start_time,
        )

        if overlap_qs.filter(
            course=course, semester=semester, section=section
        ).exists():
            raise serializers.ValidationError(
                {
                    "start_time": "Another class already exists for this course/semester/section in the selected time range."
                }
            )

        if overlap_qs.filter(faculty=faculty).exists():
            raise serializers.ValidationError(
                {
                    "faculty": "This faculty is already assigned in another class during the selected time range."
                }
            )

        if room_obj and overlap_qs.filter(room=room_obj).exists():
            raise serializers.ValidationError(
                {
                    "room_id": "This room is already occupied during the selected time range."
                }
            )

        if room_number and overlap_qs.filter(room_name=room_number).exists():
            raise serializers.ValidationError(
                {
                    "room_number": "This room is already occupied during the selected time range."
                }
            )

        same_day_subject = base_qs.filter(
            course=course,
            semester=semester,
            section=section,
            subject=subject,
            day_of_week=day_of_week,
        )
        if same_day_subject.exists():
            raise serializers.ValidationError(
                {"subject": "This subject is already scheduled on the selected day."}
            )

        max_per_week = 2 if slot_type in ["Practical", "Lab", "Tutorial"] else 3
        weekly_subject_count = base_qs.filter(
            course=course,
            semester=semester,
            section=section,
            subject=subject,
        ).count()
        if weekly_subject_count >= max_per_week:
            raise serializers.ValidationError(
                {
                    "subject": f"This subject already has {weekly_subject_count} slot(s) in this semester section."
                }
            )

        return attrs

    def create(self, validated_data):
        validated_data = self._resolve_room(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._resolve_room(validated_data)
        return super().update(instance, validated_data)


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            "question_id",
            "exam",
            "question_text",
            "question_type",
            "marks",
            "options",
            "order",
        ]
        read_only_fields = ["question_id"]


class QuestionReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            "question_id",
            "question_text",
            "question_type",
            "marks",
            "options",
            "order",
        ]


class ExamSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    total_questions = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "exam_id",
            "title",
            "subject",
            "subject_name",
            "subject_code",
            "exam_type",
            "campus_branch",
            "date",
            "start_time",
            "duration_minutes",
            "total_marks",
            "passing_marks",
            "instructions",
            "is_published",
            "created_by",
            "created_by_name",
            "total_questions",
            "created_at",
        ]
        read_only_fields = ["exam_id", "created_at"]

    def get_total_questions(self, obj):
        return obj.questions.count()


class ExamResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    student_enrollment = serializers.CharField(
        source="student.enrollment_no", read_only=True
    )
    exam_title = serializers.CharField(source="exam.title", read_only=True)
    subject_name = serializers.CharField(source="exam.subject.name", read_only=True)

    class Meta:
        model = ExamResult
        fields = [
            "result_id",
            "student",
            "student_name",
            "student_enrollment",
            "exam",
            "exam_title",
            "subject_name",
            "marks_obtained",
            "is_absent",
            "is_rechecked",
            "recheck_status",
            "feedback",
            "created_at",
        ]
        read_only_fields = ["result_id", "created_at"]


class StudentAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAnswer
        fields = [
            "answer_id",
            "exam_result",
            "question",
            "answer_text",
            "selected_option",
            "is_correct",
            "marks_obtained",
        ]
        read_only_fields = ["answer_id"]
