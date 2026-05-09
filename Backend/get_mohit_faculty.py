#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ampics.settings')
django.setup()

from users.models import Student, Faculty, User
from academics.models import Subject, TimetableSlot

# Mohit ka data dhundo
student = Student.objects.filter(name__icontains='Mohit').first()

if student:
    print(f"\n✅ Student Found:")
    print(f"   Name: {student.name}")
    print(f"   Enrollment No: {student.enrollment_no}")
    print(f"   Course: {student.course}")
    print(f"   Semester: {student.current_semester}")
    print(f"\n" + "="*70)
    
    # Get all subjects in student's course
    subjects = Subject.objects.filter(
        course=student.course,
        semester=student.current_semester
    )
    
    print(f"\n📚 Aapke Subjects ({subjects.count()}):")
    print("="*70)
    
    faculty_dict = {}
    
    for subject in subjects:
        print(f"\n  📖 Subject: {subject.name} ({subject.code})")
        
        # Get faculty for this subject
        timetable_slots = TimetableSlot.objects.filter(subject=subject)
        
        has_faculty = False
        for slot in timetable_slots:
            faculty = slot.faculty
            if faculty:
                has_faculty = True
                if faculty.user_id not in faculty_dict:
                    try:
                        faculty_profile = Faculty.objects.get(user=faculty.user)
                        emp_id = getattr(faculty_profile, 'employee_id', 'N/A')
                        faculty_dict[faculty.user_id] = {
                            'name': faculty_profile.name if hasattr(faculty_profile, 'name') else faculty.user.email,
                            'employee_id': emp_id,
                            'email': faculty.user.email,
                            'subjects': []
                        }
                    except Faculty.DoesNotExist:
                        faculty_dict[faculty.user_id] = {
                            'name': faculty.user.email,
                            'employee_id': 'N/A',
                            'email': faculty.user.email,
                            'subjects': []
                        }
                
                if subject.code not in faculty_dict[faculty.user_id]['subjects']:
                    faculty_dict[faculty.user_id]['subjects'].append(subject.code)
                    print(f"     👨‍🏫 Faculty: {faculty_dict[faculty.user_id]['name']}")
                    print(f"        Employee ID: {faculty_dict[faculty.user_id]['employee_id']}")
                    print(f"        Email: {faculty_dict[faculty.user_id]['email']}")
        
        if not has_faculty:
            print(f"     ⚠️  No faculty assigned yet")
    
    print(f"\n\n" + "="*70)
    print("📋 YOUR ATTENDANCE FACULTY (Complete List):")
    print("="*70)
    
    if faculty_dict:
        for i, (uid, faculty_info) in enumerate(faculty_dict.items(), 1):
            print(f"\n{i}. {faculty_info['name']}")
            print(f"   🆔 Employee ID: {faculty_info['employee_id']}")
            print(f"   📧 Email: {faculty_info['email']}")
            print(f"   📚 Subjects: {', '.join(faculty_info['subjects'])}")
    else:
        print("\n❌ No faculty assigned to your subjects yet.")
    
    # Check attendance records
    print(f"\n\n" + "="*70)
    print("📊 YOUR ATTENDANCE STATUS:")
    print("="*70)
    
    from attendance_ai.models import LectureSession, AttendanceRecord
    
    sessions = LectureSession.objects.filter(subject__course=student.course)
    total_sessions = sessions.count()
    marked_sessions = AttendanceRecord.objects.filter(student=student.user).count()
    
    print(f"\n   Total Sessions: {total_sessions}")
    print(f"   Marked Attendance: {marked_sessions}")
    if total_sessions > 0:
        pct = (marked_sessions / total_sessions * 100)
        print(f"   Attendance %: {pct:.1f}%")
    
else:
    print("❌ Student named 'Mohit' not found in database.")
    
    # Show all students with similar names
    print("\n🔍 Similar Names Found:")
    similar = Student.objects.filter(name__icontains='ohit')[:10]
    if similar.exists():
        for s in similar:
            print(f"   - {s.name} ({s.enrollment_no})")
    else:
        print("   No similar names found.")
