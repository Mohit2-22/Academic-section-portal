"""
=============================================================================
TARGETED NOTIFICATION SERVICE (CRITICAL FEATURE)
=============================================================================
Implements smart notification filtering to PREVENT BROADCAST TO UNRELATED USERS.

Key Features:
  ✓ Notifications sent ONLY to students in target Course/Semester/Section
  ✓ Admins receive all proxy alerts for record-keeping
  ✓ Faculty receive assignment confirmations
  ✓ Query optimization with select_related/prefetch_related
  ✓ Prevents notification spam and privacy violations

Business Logic:
  IF: Student.Course == Faculty.AssignedCourse 
      AND Student.CurrentSemester == Lecture.Semester 
      AND (Lecture.Section == 'All' OR Student.Section == Lecture.Section)
  THEN: Send Notification to Student
  ELSE: Skip Student (DO NOT SEND)

Usage:
  from academics.notification_service import NotificationService
  
  NotificationService.notify_proxy_marked(
      proxy_lecture_obj=proxy,
      original_request=request  # Optional, for audit logging
  )
"""

from django.db.models import Q, Prefetch
from users.models import Notification, Student, User
from .models import ProxyLecture, TimetableSlot


class NotificationTarget:
    """Constants for notification targeting"""
    ADMIN = "Admin"
    FACULTY = "Faculty"
    STUDENTS = "Students"
    ALL = "All"


class NotificationService:
    """
    Smart notification service with rigorous target filtering.
    """
    
    @staticmethod
    def get_target_students(course_id, semester, section):
        """
        CRITICAL QUERY: Get students who should receive the notification.
        
        Filters:
          1. Student.course_id == course_id (same course as lecture)
          2. Student.current_semester == semester (same semester)
          3. Section match: (section == 'All') OR (student's section == section)
        
        Args:
            course_id: UUID of course
            semester: Int (1-6)
            section: String ('A', 'B', 'C', 'All')
        
        Returns:
            QuerySet of Student objects with optimizations
        """
        query = Student.objects.filter(
            course_id=course_id,
            current_semester=semester,
            status='Active'  # Only active students
        )
        
        # Section filtering
        if section and section != 'All':
            query = query.filter(batch=section)  # batch field maps to section
        
        # Optimize query
        query = query.select_related(
            'user',
            'course'
        ).only(
            'student_id',
            'user_id',
            'enrollment_no',
            'name',
            'email',
            'course__code',
            'current_semester',
            'user__user_id'
        )
        
        return query
    
    @staticmethod
    def send_proxy_notification(
        proxy_lecture,
        admin_only=False,
        test_mode=False
    ):
        """
        Send proxy marking notifications to all relevant recipients.
        
        Args:
            proxy_lecture: ProxyLecture instance
            admin_only: If True, only send to Admin (for testing)
            test_mode: If True, log instead of creating notifications
        
        Returns:
            dict {
                'admin_notified': bool,
                'faculty_notified': bool,
                'students_notified': int,
                'errors': list,
                'summary': str
            }
        """
        result = {
            'admin_notified': False,
            'faculty_notified': False,
            'students_notified': 0,
            'errors': [],
            'summary': ''
        }
        
        slot = proxy_lecture.slot
        course = slot.course
        semester = slot.semester
        section = slot.section
        subject = slot.subject
        original_faculty = proxy_lecture.original_faculty
        proxy_faculty = proxy_lecture.proxy_faculty
        reason = proxy_lecture.reason
        
        # Format time
        day_time = f"{slot.day_of_week} {slot.start_time.strftime('%I:%M %p')}"
        
        # ═══════════════════════════════════════════════════════════════════
        # 1. ADMIN NOTIFICATION (Record-keeping)
        # ═══════════════════════════════════════════════════════════════════
        
        try:
            admin_message = (
                f"🔔 PROXY MARKED — {subject.code}\n\n"
                f"Original Faculty: {original_faculty.name} ({original_faculty.email})\n"
                f"Proxy Faculty: {proxy_faculty.name if proxy_faculty else 'UNASSIGNED'}\n"
                f"Course: {course.code} | Semester: {semester} | Section: {section}\n"
                f"Schedule: {day_time}\n"
                f"Subject: {subject.name}\n"
                f"Reason: {reason}\n\n"
                f"Status: Active\n"
                f"[For Record-Keeping & Compliance]"
            )
            
            if not test_mode:
                Notification.objects.create(
                    target=NotificationTarget.ADMIN,
                    type="Proxy Alert",
                    priority="Critical",
                    title=f"[PROXY] {subject.code} — {day_time}",
                    message=admin_message,
                    status="Delivered"
                )
            
            result['admin_notified'] = True
            
        except Exception as e:
            result['errors'].append(f"Admin notification failed: {str(e)}")
        
        # If admin_only mode, stop here
        if admin_only:
            result['summary'] = "Admin notification sent only (test mode)"
            return result
        
        # ═══════════════════════════════════════════════════════════════════
        # 2. TARGETED STUDENT NOTIFICATIONS (CRITICAL FILTERING)
        # ═══════════════════════════════════════════════════════════════════
        
        try:
            # Get ONLY students in this course/semester/section
            target_students = NotificationService.get_target_students(
                course_id=course.course_id,
                semester=semester,
                section=section
            )
            
            student_count = target_students.count()
            
            if student_count == 0:
                result['errors'].append(
                    f"No students found in {course.code} Sem-{semester} Section-{section}"
                )
            else:
                student_message = (
                    f"📅 CLASS SCHEDULE CHANGE\n\n"
                    f"Subject: {subject.code} — {subject.name}\n"
                    f"Date: {day_time}\n"
                    f"Course: {course.code}\n"
                    f"Your Section: {section}\n\n"
                    f"📢 Update: This class will be taken by a proxy faculty.\n"
                    f"Proxy Faculty: {proxy_faculty.name if proxy_faculty else 'To be announced'}\n"
                    f"Reason: {reason}\n\n"
                    f"✓ Please attend as scheduled.\n"
                    f"For queries, contact your class teacher."
                )
                
                if not test_mode:
                    # Batch create notifications
                    notifications_to_create = []
                    for student in target_students:
                        notifications_to_create.append(
                            Notification(
                                target=f"COURSE_{course.course_id}_SEM{semester}_SEC{section}",
                                type="Schedule Change",
                                priority="High",
                                title=f"📅 {subject.code}: Proxy Faculty",
                                message=student_message,
                                status="Delivered"
                            )
                        )
                    
                    Notification.objects.bulk_create(
                        notifications_to_create,
                        batch_size=100
                    )
                
                result['students_notified'] = student_count
        
        except Exception as e:
            result['errors'].append(f"Student notification failed: {str(e)}")
        
        # ═══════════════════════════════════════════════════════════════════
        # 3. PROXY FACULTY NOTIFICATION (Assignment)
        # ═══════════════════════════════════════════════════════════════════
        
        if proxy_faculty:
            try:
                proxy_message = (
                    f"👤 PROXY ASSIGNMENT\n\n"
                    f"You have been assigned as proxy faculty for:\n\n"
                    f"Original Faculty: {original_faculty.name}\n"
                    f"Subject: {subject.code} — {subject.name}\n"
                    f"Course: {course.code}\n"
                    f"Semester: {semester} | Section: {section}\n"
                    f"Schedule: {day_time}\n"
                    f"Reason: {reason}\n\n"
                    f"📍 Please confirm your availability in the system.\n"
                    f"Contact: {original_faculty.email}"
                )
                
                if not test_mode:
                    Notification.objects.create(
                        target=proxy_faculty.email,  # Target by email for uniqueness
                        type="Proxy Assignment",
                        priority="High",
                        title=f"🔄 Proxy Assignment — {subject.code}",
                        message=proxy_message,
                        status="Delivered"
                    )
                
                result['faculty_notified'] = True
            
            except Exception as e:
                result['errors'].append(f"Proxy faculty notification failed: {str(e)}")
        
        # ═══════════════════════════════════════════════════════════════════
        # 4. ORIGINAL FACULTY NOTIFICATION (Confirmation)
        # ═══════════════════════════════════════════════════════════════════
        
        try:
            if proxy_faculty:
                orig_message = (
                    f"✅ PROXY CONFIRMED\n\n"
                    f"Your proxy for {day_time} has been successfully assigned to:\n"
                    f"Proxy Faculty: {proxy_faculty.name}\n"
                    f"Subject: {subject.code}\n"
                    f"Course: {course.code} | Semester: {semester}\n\n"
                    f"Status: Notifications sent to {student_count} students."
                )
            else:
                orig_message = (
                    f"⏳ PROXY PENDING\n\n"
                    f"Proxy marked for {day_time} but no proxy faculty assigned yet.\n"
                    f"Subject: {subject.code}\n"
                    f"Course: {course.code}\n\n"
                    f"Status: Will be assigned later."
                )
            
            if not test_mode:
                Notification.objects.create(
                    target=original_faculty.email,
                    type="Proxy Confirmation",
                    priority="Normal",
                    title=f"Proxy Status — {subject.code}",
                    message=orig_message,
                    status="Delivered"
                )
        
        except Exception as e:
            result['errors'].append(f"Original faculty notification failed: {str(e)}")
        
        # Build summary
        summary = (
            f"Notifications Sent: "
            f"Admin={'✓' if result['admin_notified'] else '✗'} | "
            f"Students={result['students_notified']} | "
            f"Proxy Faculty={'✓' if result['faculty_notified'] else '✗'}"
        )
        result['summary'] = summary
        
        return result
    
    @staticmethod
    def notify_proxy_marked(proxy_lecture_obj, original_request=None):
        """
        MAIN ENTRY POINT: Called after ProxyLecture.save()
        Orchestrates all notifications with proper error handling.
        """
        try:
            result = NotificationService.send_proxy_notification(
                proxy_lecture_obj,
                admin_only=False,
                test_mode=False
            )
            
            # Log result
            if original_request and hasattr(original_request.user, 'admin_profile'):
                from users.models import AdminActivityLog
                AdminActivityLog.log(
                    admin=original_request.user.admin_profile,
                    action='update',
                    target_model='Notification',
                    target_name=result['summary'],
                    details={'notification_result': result}
                )
            
            return result
        
        except Exception as e:
            # Graceful failure - don't let notification errors break proxy creation
            print(f"❌ NotificationService Error: {str(e)}")
            return {
                'admin_notified': False,
                'faculty_notified': False,
                'students_notified': 0,
                'errors': [str(e)],
                'summary': f"Notification system error: {str(e)}"
            }


class QueryOptimizationHelper:
    """
    Helper methods for complex queries with proper select_related/prefetch_related
    """
    
    @staticmethod
    def get_student_notifications_for_course(user, course_id):
        """
        Get all notifications for student's enrolled course and current semester.
        """
        try:
            student = user.student_profile
            
            notifications = Notification.objects.filter(
                Q(
                    target=f"COURSE_{course_id}_SEM{student.current_semester}_SEC{student.batch}"
                ) |
                Q(target=f"COURSE_{course_id}_SEM{student.current_semester}_SECAll")
            ).order_by('-created_at')[:50]
            
            return notifications
        
        except Exception:
            return Notification.objects.none()
    
    @staticmethod
    def get_faculty_assigned_courses(faculty_obj):
        """
        Get all courses where faculty has subject assignments.
        """
        from .models import Subject
        
        return Subject.objects.filter(
            faculty_members=faculty_obj
        ).values_list('course_id', flat=True).distinct()
