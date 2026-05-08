"""
=============================================================================
QUICK IMPLEMENTATION REFERENCE
=============================================================================
Copy-paste ready code snippets to integrate into your views.py

UPDATED VIEWS - READY TO USE
=============================================================================
"""

# ─────────────────────────────────────────────────────────────────────────
# FILE: Backend/academics/views.py - ADD THESE IMPORTS AT TOP
# ─────────────────────────────────────────────────────────────────────────

from academics.proxy_service import ProxyService, ProxyAuditLog
from academics.notification_service import NotificationService
from academics.timetable_service import TimetableService


# ─────────────────────────────────────────────────────────────────────────
# ENDPOINT 1: Mark Proxy (FIXED VERSION)
# ─────────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_proxy_new(request):
    """
    POST /timetable/mark-proxy/
    
    FIXED: Uses new ProxyService with strict authorization
    
    Request:
    {
        "slot_id": "uuid-of-timetable-slot",
        "proxy_faculty_id": "uuid-of-proxy-faculty (optional, can be null)",
        "reason": "Sick leave / Medical emergency / Conference attendance"
    }
    
    Response:
    {
        "success": true,
        "proxy_id": "uuid",
        "proxy_data": {...full details...},
        "notifications": "Notifications Sent: Admin=✓ | Students=47 | Faculty=✓"
    }
    """
    
    # Validate role
    if request.user.role not in ("faculty", "admin"):
        return Response(
            {"error": "Only Faculty or Admin can mark proxy"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Extract data
    slot_id = request.data.get("slot_id")
    proxy_faculty_id = request.data.get("proxy_faculty_id")
    reason = request.data.get("reason", "").strip()
    
    if not slot_id or not reason:
        return Response(
            {"error": "slot_id and reason are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # ══════════════════════════════════════════════════════════════════════
    # USE NEW SERVICE: ProxyService.mark_proxy()
    # ══════════════════════════════════════════════════════════════════════
    
    result = ProxyService.mark_proxy(
        user=request.user,
        slot_id=slot_id,
        proxy_faculty_id=proxy_faculty_id,
        reason=reason
    )
    
    if not result['success']:
        # Log failed attempt
        ProxyAuditLog.log_proxy_action(
            action_type='FAILED_AUTH',
            proxy_obj=None,
            user=request.user,
            details={'error': result['error'], 'slot_id': slot_id},
            success=False
        )
        
        return Response(
            {"error": result['error']},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # ══════════════════════════════════════════════════════════════════════
    # FETCH PROXY OBJECT FOR NOTIFICATIONS
    # ══════════════════════════════════════════════════════════════════════
    
    try:
        proxy_obj = ProxyLecture.objects.get(proxy_id=result['proxy_id'])
        
        # SEND TARGETED NOTIFICATIONS
        notif_result = NotificationService.notify_proxy_marked(
            proxy_lecture_obj=proxy_obj,
            original_request=request
        )
        
        # Log successful action
        ProxyAuditLog.log_proxy_action(
            action_type='PROXY_CREATED',
            proxy_obj=proxy_obj,
            user=request.user,
            details={
                'proxy_faculty': proxy_obj.proxy_faculty.name if proxy_obj.proxy_faculty else 'Unassigned',
                'subject': proxy_obj.slot.subject.code,
                'notifications_sent': notif_result['summary']
            },
            success=True
        )
    
    except ProxyLecture.DoesNotExist:
        notif_result = {'summary': 'Notification service not available'}
    
    return Response(
        {
            "success": True,
            "message": f"✓ Proxy marked successfully",
            "proxy_id": result['proxy_id'],
            "proxy_data": result['proxy_data'],
            "notifications": notif_result.get('summary', 'N/A')
        },
        status=status.HTTP_201_CREATED
    )


# ─────────────────────────────────────────────────────────────────────────
# ENDPOINT 2: Get Student Timetable (FIXED VERSION)
# ─────────────────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_timetable_new(request):
    """
    GET /timetable/student/
    
    FIXED: Uses new TimetableService with proper slot mapping
    Returns student's personalized timetable WITHOUT repetition bug
    
    Response:
    {
        "success": true,
        "student_info": {...},
        "timetable": {
            "week_schedule": [
                {
                    "day": "Monday",
                    "slots": [
                        {
                            "start_time": "08:00",
                            "end_time": "09:00",
                            "subject": {"code": "U11A1IP1", "name": "..."},
                            "faculty": {"name": "Dr. X", ...},
                            "is_free": false,
                            "proxy_info": null
                        },
                        {
                            "start_time": "09:00",
                            "end_time": "10:00",
                            "subject": null,
                            "faculty": null,
                            "is_free": true    <-- Correctly shows FREE, not duplicate!
                        }
                    ]
                },
                {...more days...}
            ],
            "total_subjects": 25
        }
    }
    """
    
    if request.user.role != "student":
        return Response(
            {"error": "Student access required"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        student = request.user.student_profile
        
        if not student.course:
            return Response(
                {"error": "You have not been assigned to a course"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ══════════════════════════════════════════════════════════════════
        # USE NEW SERVICE: TimetableService.get_week_timetable()
        # ══════════════════════════════════════════════════════════════════
        
        timetable_result = TimetableService.get_week_timetable(
            course_id=student.course.course_id,
            semester=student.current_semester,
            section=student.batch or 'A',
            include_proxy=True
        )
        
        return Response(
            {
                "success": True,
                "student_info": {
                    "name": student.name,
                    "enrollment_no": student.enrollment_no,
                    "course": student.course.code,
                    "semester": student.current_semester,
                    "section": student.batch or 'A'
                },
                "timetable": timetable_result
            }
        )
    
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ─────────────────────────────────────────────────────────────────────────
# ENDPOINT 3: Get Faculty Timetable
# ─────────────────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def faculty_timetable_new(request):
    """
    GET /timetable/faculty/
    
    Get all timetables for faculty's assigned courses/semesters
    """
    
    if request.user.role != "faculty":
        return Response(
            {"error": "Faculty access required"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        result = TimetableService.get_faculty_timetable(request.user)
        
        if not result['success']:
            return Response(
                {"error": result['error']},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(result)
    
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ─────────────────────────────────────────────────────────────────────────
# ENDPOINT 4: Admin - Verify Timetable Duplicates
# ─────────────────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verify_timetable_duplicates(request):
    """
    GET /timetable/admin/verify-duplicates/?course_id=X&semester=Y&section=Z
    
    ADMIN TOOL: Check for duplicate slots in a course
    
    Useful after data import or migrations
    """
    
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    course_id = request.query_params.get("course_id")
    semester = request.query_params.get("semester")
    section = request.query_params.get("section", "A")
    
    if not course_id or not semester:
        return Response(
            {"error": "course_id and semester are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        result = TimetableService.verify_slot_uniqueness(
            course_id=course_id,
            semester=int(semester),
            section=section
        )
        
        return Response(result)
    
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ─────────────────────────────────────────────────────────────────────────
# ENDPOINT 5: Admin - Cleanup Duplicate Slots
# ─────────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cleanup_duplicate_slots(request):
    """
    POST /timetable/admin/cleanup-duplicates/
    
    ADMIN TOOL: Remove duplicate slots (keeps first, deletes rest)
    
    Request:
    {
        "course_id": "uuid",
        "semester": 3,
        "section": "A",
        "dry_run": true/false
    }
    """
    
    if request.user.role != "admin":
        return Response(
            {"error": "Admin access required"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    course_id = request.data.get("course_id")
    semester = request.data.get("semester")
    section = request.data.get("section", "A")
    dry_run = request.data.get("dry_run", True)
    
    if not course_id or not semester:
        return Response(
            {"error": "course_id and semester are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        result = TimetableService.cleanup_duplicate_slots(
            course_id=course_id,
            semester=int(semester),
            section=section,
            dry_run=bool(dry_run)
        )
        
        action = "PREVIEW" if dry_run else "EXECUTED"
        
        return Response({
            "action": action,
            "deleted_count": result['deleted_count'],
            "report": result['report'],
            "message": f"Cleanup {action}: {result['deleted_count']} slots {'would be' if dry_run else 'were'} deleted"
        })
    
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ─────────────────────────────────────────────────────────────────────────
# FILE: Backend/academics/urls.py - ADD THESE ROUTES
# ─────────────────────────────────────────────────────────────────────────

"""
Add to urlpatterns:

from academics.views import (
    mark_proxy_new,
    student_timetable_new,
    faculty_timetable_new,
    verify_timetable_duplicates,
    cleanup_duplicate_slots
)

urlpatterns = [
    ...existing patterns...
    
    # NEW: Proxy Management
    path('mark-proxy/', mark_proxy_new, name='mark-proxy'),
    
    # NEW: Timetable Views (Fixed)
    path('student/timetable/', student_timetable_new, name='student-timetable'),
    path('faculty/timetable/', faculty_timetable_new, name='faculty-timetable'),
    
    # NEW: Admin Tools
    path('admin/verify-duplicates/', verify_timetable_duplicates, name='verify-duplicates'),
    path('admin/cleanup-duplicates/', cleanup_duplicate_slots, name='cleanup-duplicates'),
]
"""

# ─────────────────────────────────────────────────────────────────────────
# EXAMPLE: How to Test These Endpoints
# ─────────────────────────────────────────────────────────────────────────

"""
# TEST 1: Mark Proxy
curl -X POST http://localhost:8000/api/timetable/mark-proxy/ \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slot_id": "12a34b56-c78d-90ef-1234",
    "proxy_faculty_id": "87f65d43-b21a-0987",
    "reason": "Medical emergency requiring leave"
  }'

# TEST 2: Get Student Timetable
curl http://localhost:8000/api/timetable/student/ \\
  -H "Authorization: Bearer <token>"

# TEST 3: Verify Duplicates (Admin)
curl 'http://localhost:8000/api/timetable/admin/verify-duplicates/?course_id=uuid&semester=3&section=A' \\
  -H "Authorization: Bearer <admin_token>"

# TEST 4: Cleanup Duplicates (Admin - Dry Run)
curl -X POST http://localhost:8000/api/timetable/admin/cleanup-duplicates/ \\
  -H "Authorization: Bearer <admin_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "course_id": "uuid",
    "semester": 3,
    "section": "A",
    "dry_run": true
  }'
"""

# ─────────────────────────────────────────────────────────────────────────
# TROUBLESHOOTING: Common Issues & Solutions
# ─────────────────────────────────────────────────────────────────────────

"""
ISSUE 1: Import errors when running server

SOLUTION:
  1. Verify all 3 files created:
     - Backend/academics/proxy_service.py ✓
     - Backend/academics/notification_service.py ✓
     - Backend/academics/timetable_service.py ✓
  
  2. Restart Django server:
     python manage.py runserver
  
  3. Check for syntax errors:
     python -m py_compile Backend/academics/proxy_service.py

ISSUE 2: Notification not sending to students

DEBUG:
  1. Check student exists:
     from users.models import Student
     s = Student.objects.get(enrollment_no='...')
     print(s.course, s.current_semester, s.batch)
  
  2. Run target query manually:
     from academics.notification_service import NotificationService
     students = NotificationService.get_target_students(
         course_id='uuid',
         semester=3,
         section='A'
     )
     print(f"Found {students.count()} students")
  
  3. Check notifications created:
     from users.models import Notification
     notifs = Notification.objects.filter(
         target__contains='COURSE_'
     ).order_by('-created_at')[:10]

ISSUE 3: Timetable still showing duplicates

DEBUG:
  1. Run verification:
     from academics.timetable_service import TimetableService
     result = TimetableService.verify_slot_uniqueness(
         course_id='uuid',
         semester=3,
         section='A'
     )
     print(result)
  
  2. If duplicates found, run dry-run cleanup:
     report = TimetableService.cleanup_duplicate_slots(
         course_id='uuid',
         semester=3,
         section='A',
         dry_run=True
     )
     print(report)
  
  3. Then execute cleanup:
     TimetableService.cleanup_duplicate_slots(
         course_id='uuid',
         semester=3,
         section='A',
         dry_run=False
     )

ISSUE 4: Faculty can mark proxy for unassigned subject

CHECK:
  1. Verify faculty assignment:
     faculty = Faculty.objects.get(...)
     print(faculty.subjects.all())  # Should contain subject
  
  2. Add subject to faculty:
     from academics.models import Subject
     subject = Subject.objects.get(code='...')
     faculty.subjects.add(subject)
  
  3. Re-test proxy marking - should now work

ISSUE 5: Admin notifications not being created

CHECK:
  1. Verify Notification model exists:
     from users.models import Notification
     Notification.objects.count()  # Should work
  
  2. Check error logs:
     tail -f logs/django.log
  
  3. Test notification creation manually:
     Notification.objects.create(
         target='Admin',
         type='Test',
         title='Test Notification',
         message='Testing'
     )
"""

# ═════════════════════════════════════════════════════════════════════════
# END OF QUICK REFERENCE
# ═════════════════════════════════════════════════════════════════════════
