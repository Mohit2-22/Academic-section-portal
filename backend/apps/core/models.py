import uuid
from django.db import models
from django.conf import settings

# ==========================================
# FACULTY PROFILES
# ==========================================
class Faculty(models.Model):
    """
    Profile table containing personal details of Faculty members.
    One-to-one linked with CustomUser.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='faculty_profile'
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    specialization = models.TextField(blank=True, null=True)
    qualification = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Faculty Member"
        verbose_name_plural = "Faculty Members"
        db_table = "faculty"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


# ==========================================
# STUDENTS (extended)
# ==========================================
class Student(models.Model):
    """
    Profile table containing personal, demographic and inquiry-related details of students.
    """
    class ReferenceSource(models.TextChoices):
        NEWSPAPER = 'newspaper', 'Newspaper'
        SOCIAL_MEDIA = 'social_media', 'Social Media'
        FRIENDS_RELATIVES = 'friends_relatives', 'Friends/Relatives'
        OTHER = 'other', 'Other'

    class EnrollmentStatus(models.TextChoices):
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        DROPPED = 'dropped', 'Dropped'
        SUSPENDED = 'suspended', 'Suspended'
        REVOKED = 'revoked', 'Revoked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='student_profile'
    )
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    city = models.CharField(max_length=100, blank=True, null=True)
    father_occupation = models.CharField(max_length=100, blank=True, null=True)
    father_phone = models.CharField(max_length=20, blank=True, null=True)
    mother_occupation = models.CharField(max_length=100, blank=True, null=True)
    mother_phone = models.CharField(max_length=20, blank=True, null=True)
    reference_source = models.CharField(
        max_length=20,
        choices=ReferenceSource.choices,
        blank=True,
        null=True
    )
    reference_other = models.TextField(blank=True, null=True)
    enrollment_status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Student"
        verbose_name_plural = "Students"
        db_table = "students"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


# ==========================================
# COURSES / SUBJECTS
# ==========================================
class Course(models.Model):
    """
    Representation of courses or subjects taught in the institute.
    """
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        UPCOMING = 'upcoming', 'Upcoming'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    duration_weeks = models.IntegerField(blank=True, null=True)
    fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Course"
        verbose_name_plural = "Courses"
        db_table = "courses"

    def __str__(self):
        return f"{self.name} ({self.code or 'N/A'})"


# ==========================================
# BATCHES
# ==========================================
class Batch(models.Model):
    """
    Batches that group students and courses/subjects together.
    """
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        UPCOMING = 'upcoming', 'Upcoming'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    max_students = models.IntegerField(default=30)
    
    # Storing array of lecture days (e.g. ['Monday', 'Wednesday']) as JSONField
    # to maintain database independence while keeping compatibility with legacy SQL arrays.
    lecture_days = models.JSONField(default=list, blank=True)
    lecture_time = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE
    )
    students = models.ManyToManyField(
        Student,
        through='BatchStudent',
        related_name='batches'
    )
    courses = models.ManyToManyField(
        Course,
        through='BatchSubject',
        related_name='batches'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Batch"
        verbose_name_plural = "Batches"
        db_table = "batches"

    def __str__(self):
        return self.name


# ==========================================
# BATCH <-> STUDENTS (many-to-many relationship)
# ==========================================
class BatchStudent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "batch_students"
        unique_together = ('batch', 'student')

    def __str__(self):
        return f"{self.student} in {self.batch}"


# ==========================================
# BATCH <-> SUBJECTS (many-to-many relationship)
# ==========================================
class BatchSubject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, blank=True, null=True)

    class Meta:
        db_table = "batch_subjects"
        unique_together = ('batch', 'course')

    def __str__(self):
        return f"{self.course.name} in {self.batch.name} (by {self.faculty})"


# ==========================================
# LECTURES (timetable scheduled by faculty)
# ==========================================
class Lecture(models.Model):
    """
    Timetable lectures/meetings scheduled for a batch.
    Integrated with auto-generated Jitsi room names.
    """
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        ONGOING = 'ongoing', 'Ongoing'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='lectures')
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, blank=True, null=True, related_name='lectures')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, blank=True, null=True, related_name='lectures')
    title = models.CharField(max_length=255)
    scheduled_date = models.DateField()
    scheduled_time = models.CharField(max_length=100)
    duration_minutes = models.IntegerField(default=90)
    jitsi_room = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED
    )
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Lecture"
        verbose_name_plural = "Lectures"
        db_table = "lectures"

    def __str__(self):
        return f"{self.title} - {self.batch.name}"


# ==========================================
# MATERIALS (uploaded by faculty)
# ==========================================
class Material(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, blank=True, null=True, related_name='materials')
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, blank=True, null=True, related_name='materials')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, blank=True, null=True, related_name='materials')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=512)
    file_type = models.CharField(max_length=100, blank=True, null=True)
    file_size_bytes = models.BigIntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Study Material"
        verbose_name_plural = "Study Materials"
        db_table = "materials"

    def __str__(self):
        return self.title


# ==========================================
# VIDEO TUTORIALS (uploaded by faculty)
# ==========================================
class VideoTutorial(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, blank=True, null=True, related_name='videos')
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, blank=True, null=True, related_name='videos')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, blank=True, null=True, related_name='videos')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=512)
    thumbnail_path = models.CharField(max_length=512, blank=True, null=True)
    duration_seconds = models.IntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Video Tutorial"
        verbose_name_plural = "Video Tutorials"
        db_table = "video_tutorials"

    def __str__(self):
        return self.title


# ==========================================
# ASSIGNMENTS
# ==========================================
class Assignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, blank=True, null=True, related_name='assignments')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, blank=True, null=True, related_name='assignments')
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, blank=True, null=True, related_name='assignments')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    max_marks = models.IntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Assignment"
        verbose_name_plural = "Assignments"
        db_table = "assignments"

    def __str__(self):
        return self.title


# ==========================================
# STUDENT ASSIGNMENTS (submissions)
# ==========================================
class StudentAssignment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUBMITTED = 'submitted', 'Submitted'
        GRADED = 'graded', 'Graded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='assignments')
    submission_text = models.TextField(blank=True, null=True)
    file_path = models.CharField(max_length=512, blank=True, null=True)
    submitted_at = models.DateTimeField(blank=True, null=True)
    marks_obtained = models.IntegerField(blank=True, null=True)
    feedback = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    class Meta:
        db_table = "student_assignments"
        unique_together = ('assignment', 'student')
        verbose_name = "Student Assignment"
        verbose_name_plural = "Student Assignments"

    def __str__(self):
        return f"{self.student}'s submission for {self.assignment}"


# ==========================================
# CERTIFICATES
# ==========================================
class Certificate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='certificates')
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, blank=True, null=True, related_name='certificates')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, blank=True, null=True, related_name='certificates')
    certificate_number = models.CharField(max_length=100, unique=True)
    issue_date = models.DateField(auto_now_add=True)
    file_path = models.CharField(max_length=512, blank=True, null=True)
    is_auto_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Certificate"
        verbose_name_plural = "Certificates"
        db_table = "certificates"

    def __str__(self):
        return self.certificate_number


# ==========================================
# NOTIFICATIONS
# ==========================================
class Notification(models.Model):
    class TargetType(models.TextChoices):
        ALL = 'all', 'All'
        BATCH = 'batch', 'Batch'
        STUDENT = 'student', 'Student'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender_role = models.CharField(max_length=50)
    sender_id = models.UUIDField(blank=True, null=True)
    target_type = models.CharField(
        max_length=20,
        choices=TargetType.choices
    )
    target_id = models.UUIDField(blank=True, null=True)  # References Batch ID or Student ID
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        db_table = "notifications"

    def __str__(self):
        return self.title


# ==========================================
# NOTIFICATION READ STATUS
# ==========================================
class NotificationRead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name='reads')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='notification_reads')
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notification_reads"
        unique_together = ('notification', 'student')
        verbose_name = "Notification Read Record"
        verbose_name_plural = "Notification Read Records"

    def __str__(self):
        return f"{self.student} read {self.notification}"


# ==========================================
# FACULTY FEEDBACK
# ==========================================
class FacultyFeedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='feedback_given')
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='feedback_received')
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='feedback')
    week_number = models.IntegerField()
    
    # Ratings 1-5
    topic_explanation = models.IntegerField()
    subject_knowledge = models.IntegerField()
    communication = models.IntegerField()
    punctuality = models.IntegerField()
    overall_rating = models.IntegerField()
    
    comments = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "faculty_feedback"
        unique_together = ('student', 'faculty', 'week_number')
        verbose_name = "Faculty Feedback"
        verbose_name_plural = "Faculty Feedbacks"

    def __str__(self):
        return f"Feedback for {self.faculty} by {self.student} (Week {self.week_number})"


# ==========================================
# INQUIRIES (funnel status tracked)
# ==========================================
class Inquiry(models.Model):
    class ReferenceSource(models.TextChoices):
        NEWSPAPER = 'newspaper', 'Newspaper'
        SOCIAL_MEDIA = 'social_media', 'Social Media'
        FRIENDS_RELATIVES = 'friends_relatives', 'Friends/Relatives'
        OTHER = 'other', 'Other'

    class FunnelStage(models.TextChoices):
        LEAD = 'lead', 'Lead/Inquiry'
        SEMINAR = 'seminar', 'Seminar'
        BOOTCAMP = 'bootcamp', 'Bootcamp'
        COUNSELLING = 'counselling', 'Counselling'
        FOLLOW_UP_1 = 'follow_up_1', 'Follow up 1'
        FOLLOW_UP_2 = 'follow_up_2', 'Follow up 2'
        FOLLOW_UP_3 = 'follow_up_3', 'Follow up 3'
        FOLLOW_UP_4 = 'follow_up_4', 'Follow up 4'
        FOLLOW_UP_5 = 'follow_up_5', 'Follow up 5'
        ADMISSION = 'admission', 'Admission'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    city = models.CharField(max_length=100, blank=True, null=True)
    mobile = models.CharField(max_length=20)
    father_occupation = models.CharField(max_length=100, blank=True, null=True)
    father_mobile = models.CharField(max_length=20, blank=True, null=True)
    mother_occupation = models.CharField(max_length=100, blank=True, null=True)
    mother_mobile = models.CharField(max_length=20, blank=True, null=True)
    reference_source = models.CharField(
        max_length=20,
        choices=ReferenceSource.choices,
        blank=True,
        null=True
    )
    reference_other = models.TextField(blank=True, null=True)
    course_interest = models.CharField(max_length=255, blank=True, null=True)
    funnel_stage = models.CharField(
        max_length=20,
        choices=FunnelStage.choices,
        default=FunnelStage.LEAD
    )
    notes = models.TextField(blank=True, null=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='assigned_inquiries'
    )
    converted_student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='inquiry_profile'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Inquiry"
        verbose_name_plural = "Inquiries"
        db_table = "inquiries"

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_funnel_stage_display()})"
