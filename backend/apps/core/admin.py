from django.contrib import admin
from .models import (
    Course, Batch, BatchStudent, BatchSubject, Lecture, Material, 
    VideoTutorial, Assignment, StudentAssignment, Certificate, 
    Notification, NotificationRead, FacultyFeedback, Inquiry
)

# ==========================================
# BATCH INLINE FOR SUBJECT ASSIGNMENTS
# ==========================================
class BatchSubjectInline(admin.TabularInline):
    """
    Inline relationship showing assigned courses/subjects and faculty members inside the Batch Admin.
    """
    model = BatchSubject
    extra = 1
    verbose_name = "Subject Assignment"
    verbose_name_plural = "Subject Assignments"


# ==========================================
# ADMIN CONFIGURATIONS
# ==========================================

@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    """
    Batch management displaying schedule details and overall student count.
    """
    list_display = ('name', 'max_students', 'get_student_count', 'lecture_time', 'status', 'start_date', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name',)
    ordering = ['-created_at']
    inlines = [BatchSubjectInline]

    def get_student_count(self, obj):
        """Returns the count of enrolled students in the batch."""
        return obj.students.count()
    get_student_count.short_description = "Enrolled Students"


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    """
    Course curriculum details configuration.
    """
    list_display = ('name', 'code', 'duration_weeks', 'fee_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name', 'code')
    ordering = ['-created_at']


@admin.register(Lecture)
class LectureAdmin(admin.ModelAdmin):
    """
    Timetable and scheduled online classes details.
    """
    list_display = ('title', 'batch', 'faculty', 'scheduled_date', 'scheduled_time', 'status', 'created_at')
    list_filter = ('status', 'scheduled_date', 'batch')
    search_fields = ('title', 'batch__name', 'faculty__first_name', 'faculty__last_name')
    ordering = ['-created_at']


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    """
    Lectures materials uploaded by Faculty.
    """
    list_display = ('title', 'batch', 'faculty', 'file_name', 'uploaded_at')
    list_filter = ('batch', 'uploaded_at')
    search_fields = ('title', 'file_name')
    ordering = ['-uploaded_at']


@admin.register(VideoTutorial)
class VideoTutorialAdmin(admin.ModelAdmin):
    """
    Video tutorial records.
    """
    list_display = ('title', 'batch', 'faculty', 'file_name', 'uploaded_at')
    list_filter = ('batch', 'uploaded_at')
    search_fields = ('title', 'file_name')
    ordering = ['-uploaded_at']


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    """
    Class assignments published by Faculty.
    """
    list_display = ('title', 'batch', 'faculty', 'due_date', 'max_marks', 'created_at')
    list_filter = ('batch', 'due_date')
    search_fields = ('title', 'description')
    ordering = ['-created_at']


@admin.register(StudentAssignment)
class StudentAssignmentAdmin(admin.ModelAdmin):
    """
    Student assignment submissions.
    """
    list_display = ('assignment', 'student', 'status', 'marks_obtained', 'submitted_at')
    list_filter = ('status', 'submitted_at')
    search_fields = ('student__first_name', 'student__last_name', 'assignment__title')
    ordering = ['-submitted_at']


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    """
    Issue registry for manual or auto-generated student certificates.
    """
    list_display = ('certificate_number', 'student', 'batch', 'issue_date', 'is_auto_generated')
    list_filter = ('issue_date', 'is_auto_generated', 'batch')
    search_fields = ('certificate_number', 'student__first_name', 'student__last_name')
    ordering = ['-created_at']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """
    Broadcasting management panel for system-wide notices.
    """
    list_display = ('title', 'sender_role', 'target_type', 'is_read', 'created_at')
    list_filter = ('sender_role', 'target_type', 'is_read', 'created_at')
    search_fields = ('title', 'message')
    ordering = ['-created_at']


@admin.register(NotificationRead)
class NotificationReadAdmin(admin.ModelAdmin):
    """
    Read receipts auditing.
    """
    list_display = ('notification', 'student', 'read_at')
    list_filter = ('read_at',)
    search_fields = ('student__first_name', 'student__last_name', 'notification__title')
    ordering = ['-read_at']


@admin.register(FacultyFeedback)
class FacultyFeedbackAdmin(admin.ModelAdmin):
    """
    Student weekly feedback for tracking faculty performance.
    """
    list_display = ('faculty', 'student', 'batch', 'week_number', 'overall_rating', 'submitted_at')
    list_filter = ('overall_rating', 'week_number', 'faculty', 'batch')
    search_fields = ('faculty__first_name', 'faculty__last_name', 'student__first_name', 'student__last_name')
    ordering = ['-submitted_at']


@admin.register(Inquiry)
class InquiryAdmin(admin.ModelAdmin):
    """
    Admission inquiries tracking funnel.
    """
    list_display = ('first_name', 'last_name', 'mobile', 'funnel_stage', 'assigned_to', 'created_at')
    list_filter = ('funnel_stage', 'created_at', 'reference_source')
    search_fields = ('first_name', 'last_name', 'mobile', 'city')
    ordering = ['-created_at']
