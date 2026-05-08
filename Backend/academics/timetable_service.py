"""
=============================================================================
TIMETABLE VIEW FIX - REPETITION BUG RESOLUTION
=============================================================================
Fixes the issue where the same lecture (AI) repeats every day.

Root Cause:
  ❌ WRONG: Fetching ALL timetable slots then repeating data for each day
  ✓ CORRECT: Mapping unique SlotID to specific SubjectID based on DAY_OF_WEEK

Problem Analysis (from image):
  - ALL time slots show "Artificial Intelligence"
  - Same lecturer "Riddhi Dave" appears every slot
  - Same room "C-120" repeats
  - No unique per-day mapping

Solution:
  1. Query TimetableSlot with UNIQUE (Day, StartTime, CourseID, Semester)
  2. JOIN with TimeSlot to get slot metadata
  3. Return 'Free' for empty slots (not duplicate previous)
  4. Ensure proper day-of-week to subject mapping

Usage:
  from academics.timetable_service import TimetableService
  
  timetable = TimetableService.get_week_timetable(
      course_id='uuid',
      semester=3,
      section='A'
  )
"""

from django.db.models import Q, F, Prefetch
from django.utils import timezone
from datetime import datetime, time, timedelta
from .models import TimetableSlot, TimeSlot, ProxyLecture, Subject


class TimetableService:
    """
    Fixed timetable generation service with proper slot mapping.
    """
    
    DAYS_OF_WEEK = [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ]
    
    @staticmethod
    def get_week_timetable(course_id, semester, section='A', include_proxy=True):
        """
        FIXED: Get complete week timetable with proper day-to-subject mapping.
        
        Args:
            course_id: UUID of course
            semester: Int (1-6)
            section: String ('A', 'B', etc.)
            include_proxy: If True, include proxy faculty info
        
        Returns:
            dict {
                'course_id': str,
                'semester': int,
                'section': str,
                'week_schedule': [
                    {
                        'day': str,
                        'slots': [
                            {
                                'slot_id': str,
                                'time_slot': int,
                                'start_time': str,
                                'end_time': str,
                                'subject': {...} or None,
                                'faculty': {...} or None,
                                'room': str or None,
                                'is_free': bool,
                                'proxy_info': {...} or None
                            }
                        ]
                    }
                ],
                'total_subjects': int,
                'warnings': list
            }
        """
        result = {
            'course_id': str(course_id),
            'semester': semester,
            'section': section,
            'week_schedule': [],
            'total_subjects': 0,
            'warnings': []
        }
        
        # ═══════════════════════════════════════════════════════════════════
        # STEP 1: Query all TimeSlots (the vertical axis - times of day)
        # ═══════════════════════════════════════════════════════════════════
        
        try:
            time_slots = TimeSlot.objects.filter(
                is_break=False,
                is_active=True
            ).order_by('slot_order')
            
            if not time_slots.exists():
                result['warnings'].append(
                    "No time slots configured in database. Please contact admin."
                )
                return result
        
        except Exception as e:
            result['warnings'].append(f"Error loading time slots: {str(e)}")
            return result
        
        # ═══════════════════════════════════════════════════════════════════
        # STEP 2: For each day, query UNIQUE timetable slots
        # ═══════════════════════════════════════════════════════════════════
        
        for day_name in TimetableService.DAYS_OF_WEEK:
            day_schedule = {
                'day': day_name,
                'slots': []
            }
            
            # Get all subjects for this course/semester on this day
            day_slots_query = TimetableSlot.objects.filter(
                course_id=course_id,
                semester=semester,
                section=section,
                day_of_week=day_name,
                is_locked=False
            ).select_related(
                'subject',
                'faculty',
                'faculty__user',
                'room',
                'time_slot'
            ).distinct()  # CRITICAL: Prevent duplicates
            
            # Create dict for quick lookup: (start_time) -> TimetableSlot
            slots_dict = {}
            for slot in day_slots_query:
                key = slot.start_time
                slots_dict[key] = slot
            
            # ─────────────────────────────────────────────────────────────
            # STEP 3: Iterate through time slots for this day
            # ─────────────────────────────────────────────────────────────
            
            for time_slot in time_slots:
                slot_info = {
                    'slot_id': str(time_slot.slot_id),
                    'time_slot': time_slot.slot_order,
                    'start_time': time_slot.start_time.strftime('%H:%M'),
                    'end_time': time_slot.end_time.strftime('%H:%M'),
                    'subject': None,
                    'faculty': None,
                    'room': None,
                    'is_free': True,
                    'proxy_info': None
                }
                
                # Check if there's a lecture in this time slot
                timetable_slot = slots_dict.get(time_slot.start_time)
                
                if timetable_slot:
                    # ─────────────────────────────────────────────────────
                    # Subject info
                    # ─────────────────────────────────────────────────────
                    
                    if timetable_slot.subject:
                        slot_info['subject'] = {
                            'subject_id': str(timetable_slot.subject.subject_id),
                            'code': timetable_slot.subject.code,
                            'name': timetable_slot.subject.name,
                            'credits': timetable_slot.subject.credits,
                            'type': timetable_slot.slot_type
                        }
                    
                    # ─────────────────────────────────────────────────────
                    # Faculty info
                    # ─────────────────────────────────────────────────────
                    
                    if timetable_slot.faculty:
                        slot_info['faculty'] = {
                            'faculty_id': str(timetable_slot.faculty.faculty_id),
                            'name': timetable_slot.faculty.name,
                            'email': timetable_slot.faculty.email,
                            'phone': timetable_slot.faculty.phone or 'N/A',
                            'department': timetable_slot.faculty.department
                        }
                    
                    # ─────────────────────────────────────────────────────
                    # Room info
                    # ─────────────────────────────────────────────────────
                    
                    if timetable_slot.room:
                        slot_info['room'] = {
                            'room_id': str(timetable_slot.room.room_id),
                            'number': timetable_slot.room.room_number,
                            'building': timetable_slot.room.building,
                            'type': timetable_slot.room.room_type,
                            'capacity': timetable_slot.room.capacity
                        }
                    elif timetable_slot.room_name:
                        slot_info['room'] = {
                            'number': timetable_slot.room_name,
                            'building': 'N/A',
                            'type': 'Unknown',
                            'capacity': 0
                        }
                    
                    slot_info['is_free'] = False
                    
                    # ─────────────────────────────────────────────────────
                    # Proxy info (if lecture is proxy)
                    # ─────────────────────────────────────────────────────
                    
                    if include_proxy:
                        try:
                            proxy = ProxyLecture.objects.filter(
                                slot_id=timetable_slot.slot_id,
                                status='Active'
                            ).select_related('proxy_faculty').first()
                            
                            if proxy:
                                slot_info['proxy_info'] = {
                                    'proxy_id': str(proxy.proxy_id),
                                    'original_faculty': proxy.original_faculty.name,
                                    'proxy_faculty': proxy.proxy_faculty.name if proxy.proxy_faculty else 'TBD',
                                    'reason': proxy.reason,
                                    'status': proxy.status,
                                    'created_at': proxy.created_at.isoformat()
                                }
                        
                        except Exception as e:
                            # Don't fail entire timetable for proxy lookup error
                            pass
                    
                    result['total_subjects'] += 1
                
                else:
                    # NO lecture in this slot - mark as FREE
                    slot_info['is_free'] = True
                
                day_schedule['slots'].append(slot_info)
            
            result['week_schedule'].append(day_schedule)
        
        return result
    
    @staticmethod
    def get_student_timetable(student_user):
        """
        Get timetable for logged-in student.
        Uses student's course, semester, and section.
        """
        try:
            student = student_user.student_profile
            
            if not student.course:
                return {
                    'success': False,
                    'error': 'Student has not been assigned to a course',
                    'timetable': None
                }
            
            timetable = TimetableService.get_week_timetable(
                course_id=student.course.course_id,
                semester=student.current_semester,
                section=student.batch or 'A',
                include_proxy=True
            )
            
            return {
                'success': True,
                'error': None,
                'timetable': timetable,
                'student_info': {
                    'name': student.name,
                    'enrollment': student.enrollment_no,
                    'course': student.course.code,
                    'semester': student.current_semester,
                    'section': student.batch
                }
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timetable': None
            }
    
    @staticmethod
    def get_faculty_timetable(faculty_user):
        """
        Get timetable for logged-in faculty.
        Shows all lectures assigned to this faculty.
        """
        try:
            faculty = faculty_user.faculty_profile
            
            # Get all courses where this faculty teaches
            faculty_courses = TimetableSlot.objects.filter(
                faculty=faculty
            ).values_list('course_id', flat=True).distinct()
            
            timetables_by_course = {}
            
            for course_id in faculty_courses:
                # Get unique semesters for this course
                semesters = TimetableSlot.objects.filter(
                    course_id=course_id,
                    faculty=faculty
                ).values_list('semester', flat=True).distinct()
                
                for semester in semesters:
                    # Get unique sections
                    sections = TimetableSlot.objects.filter(
                        course_id=course_id,
                        semester=semester,
                        faculty=faculty
                    ).values_list('section', flat=True).distinct()
                    
                    for section in sections:
                        key = f"{course_id}_{semester}_{section}"
                        timetables_by_course[key] = TimetableService.get_week_timetable(
                            course_id=course_id,
                            semester=semester,
                            section=section,
                            include_proxy=True
                        )
            
            return {
                'success': True,
                'error': None,
                'timetables': timetables_by_course,
                'faculty_info': {
                    'name': faculty.name,
                    'employee_id': faculty.employee_id,
                    'department': faculty.department,
                    'designation': faculty.designation or 'N/A'
                }
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timetables': {}
            }
    
    @staticmethod
    def verify_slot_uniqueness(course_id, semester, section):
        """
        DIAGNOSTIC: Verify there are no duplicate slots for same day/time.
        
        Returns:
            dict {
                'is_valid': bool,
                'duplicates': list,
                'summary': str
            }
        """
        from django.db.models import Count
        
        result = {
            'is_valid': True,
            'duplicates': [],
            'summary': ''
        }
        
        # Find duplicate (day, start_time) combinations
        duplicates = TimetableSlot.objects.filter(
            course_id=course_id,
            semester=semester,
            section=section
        ).values(
            'day_of_week', 'start_time'
        ).annotate(
            count=Count('slot_id')
        ).filter(count__gt=1)
        
        if duplicates.exists():
            result['is_valid'] = False
            for dup in duplicates:
                conflicting_slots = TimetableSlot.objects.filter(
                    course_id=course_id,
                    semester=semester,
                    section=section,
                    day_of_week=dup['day_of_week'],
                    start_time=dup['start_time']
                ).values_list('subject__code', 'faculty__name')
                
                result['duplicates'].append({
                    'day': dup['day_of_week'],
                    'time': str(dup['start_time']),
                    'count': dup['count'],
                    'subjects': list(conflicting_slots)
                })
        
        result['summary'] = (
            f"{'❌ DUPLICATES FOUND' if not result['is_valid'] else '✓ No Duplicates'}: "
            f"{len(result['duplicates'])} conflicting slots"
        )
        
        return result
    
    @staticmethod
    def cleanup_duplicate_slots(course_id, semester, section, dry_run=True):
        """
        ADMIN TOOL: Remove duplicate slots (keep first, delete others).
        
        Args:
            dry_run: If True, only report what would be deleted
        
        Returns:
            dict {'deleted_count': int, 'report': list}
        """
        result = {
            'deleted_count': 0,
            'report': []
        }
        
        duplicates = TimetableSlot.objects.filter(
            course_id=course_id,
            semester=semester,
            section=section
        ).values(
            'day_of_week', 'start_time'
        ).annotate(
            count=Count('slot_id')
        ).filter(count__gt=1)
        
        for dup in duplicates:
            conflicting = TimetableSlot.objects.filter(
                course_id=course_id,
                semester=semester,
                section=section,
                day_of_week=dup['day_of_week'],
                start_time=dup['start_time']
            ).order_by('created_at')
            
            # Keep first, delete rest
            to_delete = conflicting[1:]
            
            for slot in to_delete:
                result['report'].append({
                    'action': 'DELETE' if not dry_run else 'WOULD DELETE',
                    'slot_id': str(slot.slot_id),
                    'subject': slot.subject.code,
                    'day': slot.day_of_week,
                    'time': str(slot.start_time)
                })
                
                if not dry_run:
                    slot.delete()
                    result['deleted_count'] += 1
        
        return result
