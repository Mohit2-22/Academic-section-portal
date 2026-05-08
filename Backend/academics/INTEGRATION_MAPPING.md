# Integration Mapping - Exact Line Replacements

## Where to Replace in Backend/academics/views.py

### CURRENT CODE (DELETE) vs NEW CODE (ADD)

---

## REPLACEMENT 1: Mark Proxy Endpoint

### LOCATE:
Search for `def mark_proxy(request):` around line 1080-1160 in views.py

### DELETE THIS ENTIRE FUNCTION:
```python
# ❌ OLD - DELETE THIS ENTIRE SECTION (approximately lines 1080-1160)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_proxy(request):
    if request.user.role not in ("faculty", "admin"):
        return Response(
            {"error": "Faculty access required"}, status=status.HTTP_403_FORBIDDEN
        )

    slot_id = request.data.get("slot_id")
    reason = request.data.get("reason", "")
    proxy_faculty_id = request.data.get("proxy_faculty_id")

    if not slot_id or not reason:
        return Response(
            {"error": "slot_id and reason are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        slot = TimetableSlot.objects.select_related("faculty").get(slot_id=slot_id)
    except TimetableSlot.DoesNotExist:
        return Response(
            {"error": "Timetable slot not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # 1. Authorization: Only the assigned faculty (or Admin) can mark proxy
    # AND the subject must be in their master assigned list
    faculty = request.user.faculty_profile
    is_master_assigned = slot.subject.faculty_members.filter(faculty_id=faculty.faculty_id).exists()
    
    if str(slot.faculty.faculty_id) != str(faculty.faculty_id):
        if request.user.role != "admin":
            return Response(
                {"error": "You can only mark proxy for your own lectures."},
                status=status.HTTP_403_FORBIDDEN,
            )
            
    if not is_master_assigned and request.user.role != "admin":
        return Response(
            {"error": "You are not assigned to this subject in the Master Database. Contact Admin."},
            status=status.HTTP_403_FORBIDDEN,
        )

    proxy_obj = ProxyLecture(
        slot=slot,
        original_faculty=slot.faculty,
        reason=reason,
    )

    if proxy_faculty_id:
        try:
            proxy_fac = Faculty.objects.get(faculty_id=proxy_faculty_id)
            proxy_obj.proxy_faculty = proxy_fac
        except Faculty.DoesNotExist:
            return Response(
                {"error": "Proxy faculty not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    proxy_obj.save()

    # ── Auto-notifications ────────────────────────────────────────────────
    try:
        from users.models import Notification

        faculty_name = slot.faculty.name
        subject_name = slot.subject.name if slot.subject else "Unknown Subject"
        day_time = f"{slot.day_of_week} {slot.start_time.strftime('%I:%M %p')}"
        course_code = slot.course.code if slot.course else ""
        proxy_name = proxy_obj.proxy_faculty.name if proxy_obj.proxy_faculty else "Unassigned"
        
        # TARGETED TAG: COURSE_UUID_SEM_SECTION
        target_tag = f"COURSE_{slot.course_id}_{slot.semester}_{slot.section}"

        # 1. Admin notification
        Notification.objects.create(
            target="Admin",
            type="Proxy Alert",
            priority="Important",
            title=f"Proxy Marked — {subject_name}",
            message=(
                f"{faculty_name} has marked their {day_time} lecture "
                f"({subject_name}, {course_code}) as proxy. "
                f"Proxy Faculty: {proxy_name}. Reason: {reason}"
            ),
        )

        # 2. Student notification (TARGETED)
        Notification.objects.create(
            target=target_tag,
            type="Schedule Change",
            priority="Important",
            title=f"Class Change — {subject_name}",
            message=(
                f"Your {day_time} class ({subject_name}, {course_code}, Section {slot.section}) "
                f"will be taken by a proxy faculty ({proxy_name}). "
                f"Reason: {reason}"
            ),
        )

        # 3. Proxy faculty notification (Targeted to email)
        if proxy_obj.proxy_faculty:
            Notification.objects.create(
                target=proxy_obj.proxy_faculty.email,
                type="Proxy Assignment",
                priority="Important",
                title=f"Proxy Assignment — {subject_name}",
                message=(
                    f"You have been assigned as proxy for {faculty_name}'s "
                    f"{day_time} lecture ({subject_name}, {course_code}, Section {slot.section})."
                ),
            )
    except Exception as e:
        print(f"Notification Error: {e}")
        pass  # Never let notification failure break the proxy creation
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
                "proxy_faculty_name": (
                    proxy_obj.proxy_faculty.name if proxy_obj.proxy_faculty else None
                ),
                "original_faculty_name": proxy_obj.original_faculty.name,
                "day_of_week": slot.day_of_week,
                "start_time": str(slot.start_time),
                "end_time": str(slot.end_time),
                "subject_name": slot.subject.name,
            },
        }
    )
```

### REPLACE WITH THIS:
```python
# ✅ NEW - REPLACE WITH THIS (from QUICK_REFERENCE.py)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_proxy(request):
    """
    POST /timetable/mark-proxy/
    
    FIXED: Uses new ProxyService with strict authorization
    """
    
    if request.user.role not in ("faculty", "admin"):
        return Response(
            {"error": "Only Faculty or Admin can mark proxy"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    slot_id = request.data.get("slot_id")
    proxy_faculty_id = request.data.get("proxy_faculty_id")
    reason = request.data.get("reason", "").strip()
    
    if not slot_id or not reason:
        return Response(
            {"error": "slot_id and reason are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # USE NEW SERVICE
    from academics.proxy_service import ProxyService, ProxyAuditLog
    
    result = ProxyService.mark_proxy(
        user=request.user,
        slot_id=slot_id,
        proxy_faculty_id=proxy_faculty_id,
        reason=reason
    )
    
    if not result['success']:
        ProxyAuditLog.log_proxy_action(
            action_type='FAILED_AUTH',
            proxy_obj=None,
            user=request.user,
            details={'error': result['error']},
            success=False
        )
        return Response(
            {"error": result['error']},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        proxy_obj = ProxyLecture.objects.get(proxy_id=result['proxy_id'])
        
        # SEND TARGETED NOTIFICATIONS
        from academics.notification_service import NotificationService
        
        notif_result = NotificationService.notify_proxy_marked(
            proxy_lecture_obj=proxy_obj,
            original_request=request
        )
        
        ProxyAuditLog.log_proxy_action(
            action_type='PROXY_CREATED',
            proxy_obj=proxy_obj,
            user=request.user,
            details={'notifications': notif_result['summary']},
            success=True
        )
    
    except ProxyLecture.DoesNotExist:
        notif_result = {'summary': 'Notification service not available'}
    
    return Response(
        {
            "success": True,
            "message": "✓ Proxy marked successfully",
            "proxy_id": result['proxy_id'],
            "proxy_data": result['proxy_data'],
            "notifications": notif_result.get('summary', 'N/A')
        },
        status=status.HTTP_201_CREATED
    )
```

---

## REPLACEMENT 2: Student Timetable Endpoint

### LOCATE:
Search for `def student_timetable(request):` around line 330-350 in views.py

### DELETE THIS:
```python
# ❌ OLD - DELETE (approximately lines 330-350)

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
```

### REPLACE WITH THIS:
```python
# ✅ NEW - REPLACE WITH THIS

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_timetable(request):
    """
    GET /timetable/student/
    
    FIXED: Uses TimetableService with proper slot mapping
    """
    
    if request.user.role != "student":
        return Response(
            {"error": "Student access required"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        from academics.timetable_service import TimetableService
        
        student = request.user.student_profile
        
        if not student.course:
            return Response(
                {"error": "You have not been assigned to a course"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
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
```

---

## REPLACEMENT 3: Faculty Timetable Endpoint

### LOCATE:
Search for `def faculty_timetable(request):` around line 318-330 in views.py

### DELETE THIS:
```python
# ❌ OLD - DELETE

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def faculty_timetable(request):
    """Logged in faculty can view their schedule."""
    if request.user.role != "faculty":
        return Response(
            {"error": "Faculty access required"}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        faculty = request.user.faculty_profile
        slots = TimetableSlot.objects.filter(faculty=faculty).select_related(
            "course", "subject", "room"
        )
        return Response(TimetableSlotSerializer(slots, many=True).data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### REPLACE WITH THIS:
```python
# ✅ NEW - REPLACE WITH THIS

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def faculty_timetable(request):
    """
    GET /timetable/faculty/
    
    Get all timetables for faculty's assigned courses
    """
    
    if request.user.role != "faculty":
        return Response(
            {"error": "Faculty access required"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        from academics.timetable_service import TimetableService
        
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
```

---

## ADD THESE NEW ENDPOINTS

### ADD TO END OF VIEWS.PY:
```python
# ═════════════════════════════════════════════════════════════════════════
# NEW ADMIN ENDPOINTS FOR TIMETABLE DIAGNOSTICS
# ═════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verify_timetable_duplicates(request):
    """
    GET /timetable/admin/verify-duplicates/?course_id=X&semester=Y&section=Z
    
    ADMIN TOOL: Check for duplicate slots
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
        from academics.timetable_service import TimetableService
        
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cleanup_duplicate_slots(request):
    """
    POST /timetable/admin/cleanup-duplicates/
    
    ADMIN TOOL: Remove duplicate slots
    
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
        from academics.timetable_service import TimetableService
        
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
            "report": result['report']
        })
    
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

---

## UPDATE urls.py

### LOCATE: Backend/academics/urls.py

### REPLACE THIS:
```python
# ❌ OLD

path('timetable/', timetable_list, name='timetable-list'),
path('timetable/<str:slot_id>/', timetable_detail, name='timetable-detail'),
path('faculty/timetable/', faculty_timetable, name='faculty-timetable'),
path('student/timetable/', student_timetable, name='student-timetable'),
path('mark-proxy/<str:proxy_id>/', mark_proxy, name='mark-proxy'),
```

### WITH THIS:
```python
# ✅ NEW

# Timetable endpoints (FIXED)
path('timetable/', timetable_list, name='timetable-list'),
path('timetable/<str:slot_id>/', timetable_detail, name='timetable-detail'),
path('faculty/timetable/', faculty_timetable, name='faculty-timetable'),
path('student/timetable/', student_timetable, name='student-timetable'),

# Proxy management (ENHANCED)
path('mark-proxy/', mark_proxy, name='mark-proxy'),  # Updated version
path('cancel-proxy/<str:proxy_id>/', cancel_proxy, name='cancel-proxy'),

# Admin tools (NEW)
path('admin/verify-duplicates/', verify_timetable_duplicates, name='verify-duplicates'),
path('admin/cleanup-duplicates/', cleanup_duplicate_slots, name='cleanup-duplicates'),
```

---

## SUMMARY OF CHANGES

| Item | Location | Type | Action |
|------|----------|------|--------|
| mark_proxy() | ~line 1080 | Function | **Replace** with new version |
| student_timetable() | ~line 330 | Function | **Replace** with new version |
| faculty_timetable() | ~line 318 | Function | **Replace** with new version |
| verify_timetable_duplicates() | End of file | Function | **Add** new |
| cleanup_duplicate_slots() | End of file | Function | **Add** new |
| urls.py patterns | urls.py | Routes | **Update** imports & paths |

**Total Changes:**
- 3 functions replaced
- 2 functions added
- 1 file updated (urls.py)

**Time to integrate:** ~10 minutes

---

## VERIFY CHANGES

After making all changes, run:

```bash
# Check for syntax errors
python manage.py check

# Run tests
python manage.py test academics

# Test endpoints with curl
curl http://localhost:8000/api/timetable/student/ \
  -H "Authorization: Bearer <token>"
```

If all tests pass ✓, you're ready for submission!
