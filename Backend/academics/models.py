import uuid
from django.db import models
from django.utils import timezone


# =============================================
# ROOM & INFRASTRUCTURE MODELS
# =============================================


class Room(models.Model):
    ROOM_TYPE_CHOICES = [
        ("Lecture Hall", "Lecture Hall"),
        ("Lab", "Computer Lab"),
        ("Workshop", "Workshop"),
        ("Seminar Hall", "Seminar Hall"),
        ("Tutorial Room", "Tutorial Room"),
    ]

    CAMPUS_BRANCH_CHOICES = [
        ("Kherva", "Kherva (Mehsana)"),
        ("Ahmedabad", "Ahmedabad"),
    ]

    room_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_number = models.CharField(max_length=20, unique=True)
    building = models.CharField(max_length=50)
    room_type = models.CharField(
        max_length=20, choices=ROOM_TYPE_CHOICES, default="Lecture Hall"
    )
    capacity = models.IntegerField(default=60)
    floor = models.IntegerField(default=1)
    campus_branch = models.CharField(
        max_length=20, choices=CAMPUS_BRANCH_CHOICES, default="Kherva"
    )
    has_projector = models.BooleanField(default=False)
    has_computers = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rooms"
        verbose_name = "Room"
        verbose_name_plural = "Rooms"
        ordering = ["building", "room_number"]

    def __str__(self):
        return f"{self.room_number} ({self.building})"


class Shift(models.Model):
    """Represents different working shifts for faculty (Morning, Noon, Evening)"""

    shift_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)  # e.g., "Morning", "Noon", "Evening"
    code = models.CharField(max_length=20, unique=True)  # e.g., "M", "N", "E"
    start_time = models.TimeField(help_text="Shift start time")
    end_time = models.TimeField(help_text="Shift end time")
    campus_branch = models.CharField(
        max_length=20,
        choices=[
            ("Kherva", "Kherva"),
            ("Ahmedabad", "Ahmedabad"),
            ("Both", "Both Campuses"),
        ],
        default="Kherva",
    )
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shifts"
        verbose_name = "Shift"
        verbose_name_plural = "Shifts"
        ordering = ["display_order"]

    def __str__(self):
        return f"{self.name} ({self.code}): {self.start_time}-{self.end_time}"


class BreakSlot(models.Model):
    """Defines break slots like Lunch, Tea breaks that affect lecture scheduling"""

    BREAK_TYPE_CHOICES = [
        ("Tea", "Tea Break"),
        ("Lunch", "Lunch Break"),
        ("Prayer", "Prayer Break"),
        ("Other", "Other"),
    ]
    break_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)  # e.g., "Lunch Break", "Tea Break"
    break_type = models.CharField(
        max_length=20, choices=BREAK_TYPE_CHOICES, default="Lunch"
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_minutes = models.IntegerField(default=30)
    campus_branch = models.CharField(
        max_length=20,
        choices=[
            ("Kherva", "Kherva"),
            ("Ahmedabad", "Ahmedabad"),
            ("Both", "Both Campuses"),
        ],
        default="Kherva",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "break_slots"
        verbose_name = "Break Slot"
        verbose_name_plural = "Break Slots"
        ordering = ["start_time"]

    def __str__(self):
        return f"{self.name}: {self.start_time}-{self.end_time}"


class DayType(models.Model):
    """Different day configurations (Mon-Fri, Saturday)"""

    DAY_TYPE_CHOICES = [
        ("weekday", "Weekday (Mon-Fri)"),
        ("saturday", "Saturday"),
        ("sunday", "Sunday"),
        ("holiday", "Holiday"),
    ]
    day_type_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day_type = models.CharField(max_length=20, choices=DAY_TYPE_CHOICES, unique=True)
    name = models.CharField(max_length=50)
    has_full_day = models.BooleanField(default=True)
    campus_branch = models.CharField(
        max_length=20,
        choices=[
            ("Kherva", "Kherva"),
            ("Ahmedabad", "Ahmedabad"),
            ("Both", "Both Campuses"),
        ],
        default="Kherva",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "day_types"
        verbose_name = "Day Type"
        verbose_name_plural = "Day Types"

    def __str__(self):
        return self.name


class TimeSlot(models.Model):
    slot_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=30)
    slot_order = models.IntegerField(default=0, help_text="Order in day (1, 2, 3...)")
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_minutes = models.IntegerField(default=60)
    is_break = models.BooleanField(default=False)
    break_type = models.CharField(
        max_length=20,
        choices=[
            ("None", "Lecture Slot"),
            ("Tea", "Tea Break"),
            ("Lunch", "Lunch Break"),
            ("Prayer", "Prayer Break"),
        ],
        default="None",
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="slots",
        help_text="Associated shift (optional)",
    )
    day_type = models.ForeignKey(
        DayType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="slots",
        help_text="Day type this slot applies to (null = all days)",
    )
    campus_branch = models.CharField(
        max_length=20,
        choices=[
            ("Kherva", "Kherva"),
            ("Ahmedabad", "Ahmedabad"),
            ("Both", "Both Campuses"),
        ],
        default="Kherva",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "time_slots"
        verbose_name = "Time Slot"
        verbose_name_plural = "Time Slots"
        ordering = ["slot_order"]

    def __str__(self):
        break_str = f" ({self.get_break_type_display()})" if self.is_break else ""
        return f"Slot {self.slot_order}: {self.start_time}-{self.end_time}{break_str}"


class Course(models.Model):
    SHIFT_CHOICES = [
        ("MORNING", "Morning (8:00 AM - 1:00 PM)"),
        ("NOON", "Noon (12:00 PM - 6:10 PM)"),
    ]
    course_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    duration = models.IntegerField(help_text="Duration in years")
    total_semesters = models.IntegerField()
    department = models.CharField(max_length=50)
    level = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Undergraduate, Postgraduate, etc.",
    )
    credits = models.IntegerField(default=0, help_text="Total Graduation Credits")
    status = models.CharField(max_length=20, default="Active")
    shift = models.CharField(
        max_length=10,
        choices=SHIFT_CHOICES,
        default="NOON",
        help_text="Timetable shift for this course",
    )
    desc = models.TextField(
        blank=True, null=True, help_text="Program Summary Description"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "courses"
        verbose_name = "Course"
        verbose_name_plural = "Courses"

    def __str__(self):
        return f"{self.code} - {self.name} ({self.get_shift_display()})"


class Subject(models.Model):
    CAMPUS_BRANCH_CHOICES = [
        ("Kherva", "Kherva (Mehsana)"),
        ("Ahmedabad", "Ahmedabad"),
        ("Both", "Both Campuses"),
    ]

    subject_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="subjects", db_column="course_id"
    )
    semester = models.IntegerField()
    credits = models.IntegerField(default=4)
    campus_branch = models.CharField(
        max_length=20,
        choices=CAMPUS_BRANCH_CHOICES,
        default="Kherva",
        help_text="Campus where this subject is offered",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "subjects"
        verbose_name = "Subject"
        verbose_name_plural = "Subjects"

    def __str__(self):
        return f"{self.code} - {self.name}"


RESULT_STATUS_CHOICES = (
    ("completed", "Completed"),
    ("remaining", "Remaining"),
)


class SemesterResult(models.Model):
    result_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        "users.Student",
        on_delete=models.CASCADE,
        related_name="semester_results",
        db_column="student_id",
    )
    semester = models.IntegerField()
    sgpa = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    total_marks = models.IntegerField(default=0)
    obtained_marks = models.IntegerField(default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grade = models.CharField(max_length=5, blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=RESULT_STATUS_CHOICES, default="remaining"
    )
    year = models.IntegerField(blank=True, null=True)
    exam_type = models.CharField(
        max_length=20, blank=True, null=True, help_text="Regular/Backlog"
    )
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "semester_results"
        verbose_name = "Semester Result"
        verbose_name_plural = "Semester Results"
        unique_together = ("student", "semester")

    def __str__(self):
        return f"{self.student.name} - Sem {self.semester} - {self.sgpa}"

    def calculate_grade(self):
        pct = float(self.percentage or 0)
        if pct >= 90:
            return "O"
        elif pct >= 80:
            return "A+"
        elif pct >= 70:
            return "A"
        elif pct >= 60:
            return "B+"
        elif pct >= 50:
            return "B"
        elif pct >= 40:
            return "C"
        elif pct >= 35:
            return "P"
        else:
            return "F"


class SubjectResult(models.Model):
    subject_result_id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False
    )
    semester_result = models.ForeignKey(
        SemesterResult, on_delete=models.CASCADE, related_name="subject_results"
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="subject_results"
    )
    internal_marks = models.IntegerField(default=0)
    external_marks = models.IntegerField(default=0)
    practical_marks = models.IntegerField(default=0)
    total_marks = models.IntegerField(default=0)
    passing_marks = models.IntegerField(default=35)
    is_passed = models.BooleanField(default=False)
    grade = models.CharField(max_length=5, blank=True, null=True)

    class Meta:
        db_table = "subject_results"
        verbose_name = "Subject Result"
        verbose_name_plural = "Subject Results"

    def __str__(self):
        return f"{self.subject.code} - {self.total_marks}/{self.passing_marks}"


class AcademicTerm(models.Model):
    term_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=(
            ("Upcoming", "Upcoming"),
            ("Active", "Active"),
            ("Completed", "Completed"),
        ),
        default="Upcoming",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "academic_terms"
        verbose_name = "Academic Term"
        verbose_name_plural = "Academic Terms"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name} ({self.status})"


class Holiday(models.Model):
    holiday_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=50)  # National, Festival, Institutional
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "holidays"
        verbose_name = "Holiday"
        verbose_name_plural = "Holidays"
        ordering = ["date"]

    def __str__(self):
        return f"{self.name} on {self.date}"


class TimetableSlot(models.Model):
    DAY_CHOICES = [
        ("Monday", "Monday"),
        ("Tuesday", "Tuesday"),
        ("Wednesday", "Wednesday"),
        ("Thursday", "Thursday"),
        ("Friday", "Friday"),
        ("Saturday", "Saturday"),
    ]
    SLOT_TYPE_CHOICES = [
        ("Theory", "Theory"),
        ("Practical", "Practical"),
        ("Tutorial", "Tutorial"),
        ("Lab", "Lab"),
    ]

    slot_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="timetable_slots"
    )
    semester = models.IntegerField()
    day_of_week = models.CharField(max_length=10, choices=DAY_CHOICES)
    time_slot = models.ForeignKey(
        TimeSlot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timetable_slots",
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="timetable_slots"
    )
    faculty = models.ForeignKey(
        "users.Faculty", on_delete=models.CASCADE, related_name="timetable_slots"
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timetable_slots",
    )
    room_name = models.CharField(max_length=50, blank=True, null=True)
    section = models.CharField(max_length=10, default="A")
    slot_type = models.CharField(
        max_length=20, choices=SLOT_TYPE_CHOICES, default="Theory"
    )
    is_locked = models.BooleanField(
        default=False, help_text="Prevent auto-regeneration"
    )
    is_auto_generated = models.BooleanField(default=False)
    generated_by = models.CharField(max_length=20, default="manual")
    priority = models.IntegerField(default=5, help_text="1=highest, 10=lowest")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "timetable_slots"
        verbose_name = "Timetable Slot"
        verbose_name_plural = "Timetable Slots"
        unique_together = ("course", "semester", "day_of_week", "start_time", "section")

    def __str__(self):
        return f"{self.course.code} S{self.semester} - {self.day_of_week} {self.start_time}"


# =============================================
# SMART TIMETABLE MODELS
# =============================================


class TimetableTemplate(models.Model):
    """Template for recurring timetable patterns"""

    template_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="timetable_templates"
    )
    semester = models.IntegerField()
    campus_branch = models.CharField(
        max_length=20,
        choices=[
            ("Kherva", "Kherva"),
            ("Ahmedabad", "Ahmedabad"),
        ],
        default="Kherva",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "timetable_templates"
        verbose_name = "Timetable Template"
        verbose_name_plural = "Timetable Templates"

    def __str__(self):
        return f"{self.name} - {self.course.code} S{self.semester}"


class TimetableSchedule(models.Model):
    """Monthly/Custom schedule that can be generated from template"""

    schedule_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    template = models.ForeignKey(
        TimetableTemplate,
        on_delete=models.SET_NULL,
        null=True,
        related_name="schedules",
    )
    academic_term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.SET_NULL,
        null=True,
        related_name="timetable_schedules",
    )
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
    generated_by = models.CharField(max_length=20, default="manual")
    generation_log = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "timetable_schedules"
        verbose_name = "Timetable Schedule"
        verbose_name_plural = "Timetable Schedules"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name} ({self.start_date} to {self.end_date})"


class FacultyAvailability(models.Model):
    """Track faculty availability/working days"""

    availability_id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False
    )
    faculty = models.ForeignKey(
        "users.Faculty", on_delete=models.CASCADE, related_name="availability"
    )
    day_of_week = models.CharField(
        max_length=10,
        choices=[
            ("Monday", "Monday"),
            ("Tuesday", "Tuesday"),
            ("Wednesday", "Wednesday"),
            ("Thursday", "Thursday"),
            ("Friday", "Friday"),
            ("Saturday", "Saturday"),
        ],
    )
    is_available = models.BooleanField(default=True)
    preferred_slots = models.JSONField(
        default=list, blank=True, help_text="List of preferred time slot IDs"
    )
    not_available_slots = models.JSONField(
        default=list, blank=True, help_text="List of unavailable time slot IDs"
    )
    campus_branch = models.CharField(
        max_length=20,
        choices=[
            ("Kherva", "Kherva"),
            ("Ahmedabad", "Ahmedabad"),
        ],
        default="Kherva",
    )

    class Meta:
        db_table = "faculty_availability"
        verbose_name = "Faculty Availability"
        verbose_name_plural = "Faculty Availabilities"
        unique_together = ("faculty", "day_of_week")

    def __str__(self):
        status = "Available" if self.is_available else "Not Available"
        return f"{self.faculty.name} - {self.day_of_week}: {status}"


class TimetableConflict(models.Model):
    """Track and resolve timetable conflicts"""

    CONFLICT_TYPE_CHOICES = [
        ("Room", "Room Conflict"),
        ("Faculty", "Faculty Conflict"),
        ("Student", "Student Group Conflict"),
        ("Time", "Time Slot Conflict"),
    ]

    conflict_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conflict_type = models.CharField(max_length=20, choices=CONFLICT_TYPE_CHOICES)
    slot_1 = models.ForeignKey(
        TimetableSlot,
        on_delete=models.CASCADE,
        related_name="conflicts_as_first",
        null=True,
    )
    slot_2 = models.ForeignKey(
        TimetableSlot,
        on_delete=models.CASCADE,
        related_name="conflicts_as_second",
        null=True,
    )
    description = models.TextField()
    is_resolved = models.BooleanField(default=False)
    resolution = models.TextField(blank=True, null=True)
    resolved_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_conflicts",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "timetable_conflicts"
        verbose_name = "Timetable Conflict"
        verbose_name_plural = "Timetable Conflicts"

    def __str__(self):
        return f"{self.conflict_type}: {self.description[:50]}"


# =============================================
# EXAM MODELS
# =============================================


class Exam(models.Model):
    EXAM_TYPE_CHOICES = [
        ("Mid Term", "Mid Term"),
        ("End Term", "End Term"),
        ("Quiz", "Quiz"),
        ("Assignment", "Assignment"),
        ("Practical", "Practical"),
    ]

    CAMPUS_BRANCH_CHOICES = [
        ("Kherva", "Kherva (Mehsana)"),
        ("Ahmedabad", "Ahmedabad"),
        ("Both", "Both Campuses"),
    ]

    exam_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="exams")
    exam_type = models.CharField(
        max_length=20, choices=EXAM_TYPE_CHOICES, default="End Term"
    )
    campus_branch = models.CharField(
        max_length=20, choices=CAMPUS_BRANCH_CHOICES, default="Kherva"
    )
    date = models.DateField()
    start_time = models.TimeField()
    duration_minutes = models.IntegerField(default=60)
    total_marks = models.IntegerField(default=100)
    passing_marks = models.IntegerField(default=35)
    instructions = models.TextField(blank=True, null=True)
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "users.Faculty",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_exams",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exams"
        verbose_name = "Exam"
        verbose_name_plural = "Exams"
        ordering = ["-date", "-start_time"]

    def __str__(self):
        return f"{self.title} - {self.subject.code} ({self.exam_type})"


class Question(models.Model):
    QUESTION_TYPE_CHOICES = [
        ("MCQ", "Multiple Choice"),
        ("Short", "Short Answer"),
        ("Long", "Long Answer"),
    ]

    question_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()
    question_type = models.CharField(
        max_length=10, choices=QUESTION_TYPE_CHOICES, default="MCQ"
    )
    marks = models.IntegerField(default=5)
    options = models.JSONField(
        blank=True, null=True, help_text="JSON array for MCQ options"
    )
    correct_answer = models.TextField(
        blank=True, null=True, help_text="Correct answer(s)"
    )
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "questions"
        verbose_name = "Question"
        verbose_name_plural = "Questions"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"Q{self.order}: {self.question_text[:50]}..."


class ExamResult(models.Model):
    result_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        "users.Student", on_delete=models.CASCADE, related_name="exam_results"
    )
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="results")
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    is_absent = models.BooleanField(default=False)
    is_rechecked = models.BooleanField(default=False)
    recheck_status = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        choices=[
            ("Pending", "Pending"),
            ("Approved", "Approved"),
            ("Rejected", "Rejected"),
        ],
    )
    feedback = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exam_results"
        verbose_name = "Exam Result"
        verbose_name_plural = "Exam Results"
        unique_together = ("student", "exam")

    def __str__(self):
        status = "ABS" if self.is_absent else self.marks_obtained
        return f"{self.student.name} - {self.exam.title}: {status}"


class StudentAnswer(models.Model):
    answer_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam_result = models.ForeignKey(
        ExamResult, on_delete=models.CASCADE, related_name="answers"
    )
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer_text = models.TextField(blank=True, null=True)
    selected_option = models.CharField(max_length=500, blank=True, null=True)
    is_correct = models.BooleanField(default=False)
    marks_obtained = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_answers"
        verbose_name = "Student Answer"
        verbose_name_plural = "Student Answers"

    def __str__(self):
        return f"{self.exam_result.student.name} - Q{self.question.order}"


class SemesterConfig(models.Model):
    """Global singleton config tracking current semester parity (Odd/Even)."""

    PARITY_CHOICES = [
        ("ODD", "Odd Semester"),
        ("EVEN", "Even Semester"),
    ]
    config_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    current_parity = models.CharField(
        max_length=4, choices=PARITY_CHOICES, default="ODD"
    )
    is_odd_enabled = models.BooleanField(default=True)
    is_even_enabled = models.BooleanField(default=False)
    last_toggled_at = models.DateTimeField(null=True, blank=True)
    toggled_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="semester_toggles",
    )
    timetable_generated = models.BooleanField(
        default=False,
        help_text="Set to True after AI timetable generation. Resets on semester toggle.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "semester_config"
        verbose_name = "Semester Config"
        verbose_name_plural = "Semester Configs"

    def __str__(self):
        return f"Semester Config: {self.current_parity} (Generated: {self.timetable_generated})"

    @classmethod
    def get_active(cls):
        config, _ = cls.objects.get_or_create(
            defaults={"current_parity": "ODD"}
        )
        return config


class ProxyLecture(models.Model):
    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Cancelled", "Cancelled"),
    ]

    proxy_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slot = models.ForeignKey(
        TimetableSlot,
        on_delete=models.CASCADE,
        related_name="proxy_lectures",
        db_column="slot_id",
    )
    original_faculty = models.ForeignKey(
        "users.Faculty",
        on_delete=models.CASCADE,
        related_name="original_lectures",
        db_column="original_faculty_id",
    )
    proxy_faculty = models.ForeignKey(
        "users.Faculty",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="proxy_lectures_taken",
        db_column="proxy_faculty_id",
    )
    reason = models.TextField(
        max_length=500,
        help_text="Reason for proxy (e.g., Weekend leave, Sick leave, Conference)",
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="Active",
    )
    is_notified = models.BooleanField(
        default=False,
        help_text="Has notification been sent?",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "proxy_lectures"
        verbose_name = "Proxy Lecture"
        verbose_name_plural = "Proxy Lectures"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Proxy: {self.original_faculty.name} — {self.slot.day_of_week} {self.slot.start_time} ({self.status})"
