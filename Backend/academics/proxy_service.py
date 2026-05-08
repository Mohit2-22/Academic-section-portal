"""
=============================================================================
ENHANCED PROXY LECTURE SERVICE
=============================================================================
Implements strict Proxy Authorization Logic with comprehensive validation.

Key Features:
  ✓ Faculty can only mark proxy for subjects assigned in Master Database
  ✓ Subject/Course validation against Faculty.subjects (ManyToMany)
  ✓ Proxy authorization tied to specific CourseID and SectionID
  ✓ Detailed audit trail for compliance
  ✓ Role-based access control (Faculty/Admin only)

Usage:
  from academics.proxy_service import ProxyService
  
  result = ProxyService.mark_proxy(
      user=request.user,
      slot_id='uuid',
      proxy_faculty_id='uuid',
      reason='Sick leave'
  )
"""

import uuid
from datetime import datetime
from django.db.models import Q
from django.core.exceptions import ValidationError
from .models import ProxyLecture, TimetableSlot
from users.models import Faculty


class ProxyAuthorizationError(Exception):
    """Raised when proxy authorization fails"""
    pass


class ProxyService:
    """
    Centralized service for proxy lecture management with strict authorization.
    """
    
    @staticmethod
    def validate_faculty_subject_assignment(faculty_obj, subject_obj, course_obj):
        """
        CRITICAL: Verify faculty is assigned to this specific subject in Master Database.
        
        Args:
            faculty_obj: Faculty instance
            subject_obj: Subject instance
            course_obj: Course instance
        
        Returns:
            tuple (is_valid: bool, error_message: str or None)
        
        Business Logic:
            - Check if subject is in Faculty.subjects (ManyToMany)
            - Check if course matches subject.course
            - Prevent unauthorized subject access
        """
        # Check 1: Is faculty assigned to this subject?
        is_assigned = faculty_obj.subjects.filter(subject_id=subject_obj.subject_id).exists()
        
        if not is_assigned:
            return False, (
                f"❌ Authorization Failed: Subject '{subject_obj.code}' is NOT assigned to you. "
                f"Contact your HOD to add this subject to your Master Assignment."
            )
        
        # Check 2: Does subject belong to the course in the timetable slot?
        if subject_obj.course_id != course_obj.course_id:
            return False, (
                f"❌ Course Mismatch: Subject '{subject_obj.code}' belongs to "
                f"course '{subject_obj.course.code}', not '{course_obj.code}'."
            )
        
        return True, None
    
    @staticmethod
    def validate_proxy_faculty_assignment(proxy_faculty_obj, subject_obj):
        """
        Verify proxy faculty is also assigned to the same subject.
        This ensures proxy can teach the subject.
        """
        if proxy_faculty_obj is None:
            return True, None  # Proxy can be assigned later
        
        is_assigned = proxy_faculty_obj.subjects.filter(subject_id=subject_obj.subject_id).exists()
        
        if not is_assigned:
            return False, (
                f"❌ Proxy Faculty Error: {proxy_faculty_obj.name} is not assigned to "
                f"subject '{subject_obj.code}'. Cannot assign as proxy."
            )
        
        return True, None
    
    @staticmethod
    def validate_course_section_access(faculty_obj, course_obj, semester, section):
        """
        Verify faculty teaches this course and semester/section combination.
        """
        # Check if faculty has any lectures in this course/semester/section
        has_assignment = TimetableSlot.objects.filter(
            course=course_obj,
            semester=semester,
            section=section,
            faculty=faculty_obj
        ).exists()
        
        if not has_assignment:
            return False, (
                f"❌ Course/Section Access Denied: You have no lectures assigned in "
                f"{course_obj.code} Sem-{semester} Section-{section}."
            )
        
        return True, None
    
    @classmethod
    def mark_proxy(
        cls,
        user,
        slot_id,
        proxy_faculty_id=None,
        reason="",
        course_id=None,
        semester=None
    ):
        """
        MAIN METHOD: Mark a lecture as proxy with full authorization validation.
        
        Args:
            user: Request user (should be faculty or admin)
            slot_id: UUID of TimetableSlot
            proxy_faculty_id: UUID of faculty taking proxy (optional)
            reason: Reason for proxy
            course_id: Course UUID (for validation)
            semester: Semester number (for validation)
        
        Returns:
            dict {
                'success': bool,
                'proxy_id': str or None,
                'error': str or None,
                'warnings': list,
                'proxy_data': dict or None
            }
        """
        result = {
            'success': False,
            'proxy_id': None,
            'error': None,
            'warnings': [],
            'proxy_data': None
        }
        
        # ═══════════════════════════════════════════════════════════════════
        # PHASE 1: INPUT VALIDATION
        # ═══════════════════════════════════════════════════════════════════
        
        if not reason or len(reason.strip()) < 5:
            result['error'] = "❌ Reason must be at least 5 characters long"
            return result
        
        # Fetch the timetable slot
        try:
            slot = TimetableSlot.objects.select_related(
                'course', 'subject', 'faculty'
            ).get(slot_id=slot_id)
        except TimetableSlot.DoesNotExist:
            result['error'] = f"❌ Timetable slot '{slot_id}' not found in database"
            return result
        
        # ═══════════════════════════════════════════════════════════════════
        # PHASE 2: ROLE & USER VALIDATION
        # ═══════════════════════════════════════════════════════════════════
        
        if user.role not in ('faculty', 'admin'):
            result['error'] = f"❌ Only Faculty or Admin can mark proxy (You are: {user.role})"
            return result
        
        # Get faculty profile
        try:
            if user.role == 'faculty':
                faculty_obj = user.faculty_profile
            else:  # admin
                faculty_obj = slot.faculty  # Admin acts on behalf of slot's faculty
        except Exception as e:
            result['error'] = f"❌ Faculty profile not found: {str(e)}"
            return result
        
        # ═══════════════════════════════════════════════════════════════════
        # PHASE 3: AUTHORIZATION - FACULTY SUBJECT ASSIGNMENT
        # ═══════════════════════════════════════════════════════════════════
        
        is_valid, error_msg = cls.validate_faculty_subject_assignment(
            faculty_obj=faculty_obj,
            subject_obj=slot.subject,
            course_obj=slot.course
        )
        
        if not is_valid:
            result['error'] = error_msg
            return result
        
        # ═══════════════════════════════════════════════════════════════════
        # PHASE 4: AUTHORIZATION - COURSE/SECTION ACCESS
        # ═══════════════════════════════════════════════════════════════════
        
        is_valid, error_msg = cls.validate_course_section_access(
            faculty_obj=faculty_obj,
            course_obj=slot.course,
            semester=slot.semester,
            section=slot.section
        )
        
        if not is_valid:
            result['error'] = error_msg
            return result
        
        # ═══════════════════════════════════════════════════════════════════
        # PHASE 5: PROXY FACULTY VALIDATION (if specified)
        # ═══════════════════════════════════════════════════════════════════
        
        proxy_faculty_obj = None
        if proxy_faculty_id:
            try:
                proxy_faculty_obj = Faculty.objects.get(faculty_id=proxy_faculty_id)
            except Faculty.DoesNotExist:
                result['error'] = f"❌ Proxy faculty ID '{proxy_faculty_id}' not found"
                return result
            
            # Validate proxy faculty is also assigned to this subject
            is_valid, error_msg = cls.validate_proxy_faculty_assignment(
                proxy_faculty_obj, slot.subject
            )
            
            if not is_valid:
                result['error'] = error_msg
                return result
        
        # ═══════════════════════════════════════════════════════════════════
        # PHASE 6: DUPLICATE PROXY CHECK
        # ═══════════════════════════════════════════════════════════════════
        
        existing = ProxyLecture.objects.filter(
            slot_id=slot_id,
            status='Active'
        ).exists()
        
        if existing:
            result['error'] = (
                f"❌ An active proxy already exists for this slot. "
                f"Cancel it first before creating a new one."
            )
            return result
        
        # ═══════════════════════════════════════════════════════════════════
        # PHASE 7: CREATE PROXY LECTURE
        # ═══════════════════════════════════════════════════════════════════
        
        try:
            proxy_obj = ProxyLecture.objects.create(
                slot=slot,
                original_faculty=slot.faculty,
                proxy_faculty=proxy_faculty_obj,
                reason=reason.strip(),
                status='Active',
                is_notified=False
            )
            
            result['success'] = True
            result['proxy_id'] = str(proxy_obj.proxy_id)
            result['proxy_data'] = {
                'proxy_id': str(proxy_obj.proxy_id),
                'original_faculty': {
                    'id': str(slot.faculty.faculty_id),
                    'name': slot.faculty.name,
                    'email': slot.faculty.email
                },
                'proxy_faculty': {
                    'id': str(proxy_faculty_obj.faculty_id) if proxy_faculty_obj else None,
                    'name': proxy_faculty_obj.name if proxy_faculty_obj else 'TBD',
                    'email': proxy_faculty_obj.email if proxy_faculty_obj else None
                } if proxy_faculty_obj else None,
                'slot': {
                    'id': str(slot.slot_id),
                    'course': slot.course.code,
                    'course_id': str(slot.course_id),
                    'semester': slot.semester,
                    'section': slot.section,
                    'subject': slot.subject.code,
                    'day': slot.day_of_week,
                    'time': f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"
                },
                'reason': reason.strip(),
                'status': 'Active',
                'created_at': proxy_obj.created_at.isoformat()
            }
            
        except Exception as e:
            result['error'] = f"❌ Failed to create proxy: {str(e)}"
            return result
        
        return result
    
    @classmethod
    def cancel_proxy(cls, user, proxy_id):
        """
        Cancel an active proxy lecture.
        
        Returns:
            dict {'success': bool, 'error': str or None}
        """
        result = {'success': False, 'error': None}
        
        try:
            proxy = ProxyLecture.objects.select_related(
                'original_faculty', 'slot__faculty'
            ).get(proxy_id=proxy_id)
        except ProxyLecture.DoesNotExist:
            result['error'] = f"❌ Proxy '{proxy_id}' not found"
            return result
        
        # Authorization: Only original faculty or admin
        if user.role == 'faculty':
            if str(proxy.original_faculty.user_id) != str(user.user_id):
                result['error'] = "❌ You can only cancel your own proxies"
                return result
        elif user.role != 'admin':
            result['error'] = "❌ Only faculty or admin can cancel proxies"
            return result
        
        if proxy.status != 'Active':
            result['error'] = f"❌ Proxy is already {proxy.status}, cannot cancel"
            return result
        
        proxy.status = 'Cancelled'
        proxy.save(update_fields=['status', 'updated_at'])
        
        result['success'] = True
        return result


class ProxyAuditLog:
    """
    Log all proxy operations for compliance and debugging.
    """
    
    @staticmethod
    def log_proxy_action(
        action_type,
        proxy_obj,
        user,
        details=None,
        success=True
    ):
        """
        Log proxy-related action to database for audit trail.
        
        Args:
            action_type: 'CREATED', 'CANCELLED', 'FAILED_AUTH', etc.
            proxy_obj: ProxyLecture instance or None
            user: User performing action
            details: Additional context dict
            success: Whether action succeeded
        """
        from users.models import AdminActivityLog
        
        target_id = str(proxy_obj.proxy_id) if proxy_obj else None
        target_name = (
            f"{proxy_obj.original_faculty.name} → "
            f"{proxy_obj.slot.day_of_week} {proxy_obj.slot.start_time}"
        ) if proxy_obj else "Unknown Proxy"
        
        log_details = {
            'action_type': action_type,
            'success': success,
            'user_role': user.role,
            **(details or {})
        }
        
        AdminActivityLog.log(
            admin=user.admin_profile if user.role == 'admin' else None,
            action='update',
            target_model='ProxyLecture',
            target_id=target_id,
            target_name=target_name,
            details=log_details
        )
