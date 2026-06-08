import csv
from django.http import HttpResponse
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser
from apps.core.models import Student, Faculty, BatchStudent
from apps.finance.models import Fee

# ==========================================
# CUSTOM STUDENT ADMIN ACTIONS
# ==========================================
@admin.action(description="Bulk activate selected students and user accounts")
def bulk_activate_students(modeladmin, request, queryset):
    """
    Admin Action: Set student status to 'active' and activate their linked User accounts.
    """
    updated_students = 0
    updated_users = 0
    for student in queryset:
        if student.enrollment_status != 'active':
            student.enrollment_status = 'active'
            student.save()
            updated_students += 1
        if student.user and not student.user.is_active:
            student.user.is_active = True
            student.user.save()
            updated_users += 1
    modeladmin.message_user(
        request, 
        f"Successfully activated {updated_students} students and enabled {updated_users} linked user accounts."
    )

@admin.action(description="Bulk suspend (deactivate) selected students and user accounts")
def bulk_deactivate_students(modeladmin, request, queryset):
    """
    Admin Action: Set student status to 'suspended' and deactivate their linked User accounts.
    """
    updated_students = 0
    updated_users = 0
    for student in queryset:
        if student.enrollment_status != 'suspended':
            student.enrollment_status = 'suspended'
            student.save()
            updated_students += 1
        if student.user and student.user.is_active:
            student.user.is_active = False
            student.user.save()
            updated_users += 1
    modeladmin.message_user(
        request, 
        f"Successfully suspended {updated_students} students and disabled {updated_users} linked user accounts."
    )

@admin.action(description="Export selected students as CSV")
def export_students_csv(modeladmin, request, queryset):
    """
    Admin Action: Exports selected student records into a downloadable CSV document.
    """
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="students_export.csv"'
    
    writer = csv.writer(response)
    # Header row
    writer.writerow([
        'First Name', 'Middle Name', 'Last Name', 'Email', 'Phone', 
        'City', 'Father Phone', 'Mother Phone', 'Enrollment Status', 'Created At'
    ])
    
    for student in queryset:
        writer.writerow([
            student.first_name,
            student.middle_name or '',
            student.last_name,
            student.email,
            student.phone,
            student.city or '',
            student.father_phone or '',
            student.mother_phone or '',
            student.enrollment_status,
            student.created_at
        ])
    return response


# ==========================================
# INLINES FOR STUDENT ADMIN
# ==========================================
class BatchStudentInline(admin.TabularInline):
    """
    Shows which batches a student belongs to directly inside their edit page.
    """
    model = BatchStudent
    extra = 1
    verbose_name = "Batch Enrollment"
    verbose_name_plural = "Batch Enrollments"

class StudentFeeInline(admin.TabularInline):
    """
    Read-only view of a student's outstanding fees status on their profile page.
    """
    model = Fee
    extra = 0
    fields = ('course_name', 'total_amount', 'paid_amount', 'outstanding_amount', 'due_date', 'status')
    readonly_fields = ('course_name', 'total_amount', 'paid_amount', 'outstanding_amount', 'due_date', 'status')
    can_delete = False


# ==========================================
# REGISTRATIONS
# ==========================================

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """
    Student profile management panel.
    """
    list_display = ('first_name', 'last_name', 'email', 'phone', 'enrollment_status', 'created_at')
    list_filter = ('enrollment_status', 'created_at', 'reference_source')
    search_fields = ('first_name', 'last_name', 'email', 'phone')
    ordering = ['-created_at']
    actions = [bulk_activate_students, bulk_deactivate_students, export_students_csv]
    inlines = [BatchStudentInline, StudentFeeInline]


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    """
    Faculty profile management panel.
    """
    list_display = ('first_name', 'last_name', 'email', 'phone', 'specialization', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('first_name', 'last_name', 'email', 'phone', 'specialization')
    ordering = ['-created_at']


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """
    Extends standard Django UserAdmin to handle custom role fields and UUID primary keys.
    """
    list_display = ('username', 'email', 'role', 'is_active', 'is_staff', 'created_at')
    list_filter = ('role', 'is_active', 'is_staff', 'created_at')
    search_fields = ('username', 'email')
    ordering = ['-created_at']
    
    # Exposing the role field in admin panel creation and edit views
    fieldsets = UserAdmin.fieldsets + (
        ('Role Configuration', {'fields': ('role',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role Configuration', {'fields': ('role',)}),
    )
