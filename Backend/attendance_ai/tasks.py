"""
Celery tasks for AI Attendance System.
  1. detect_anomalies(student_id, subject_id)
  2. generate_ai_description(anomaly_id, stats_dict)
  3. send_notifications(anomaly_id, stats_dict)
  4. generate_attendance_pdf(subject_id, date_from, date_to)
"""
import os
import logging
from datetime import date, timedelta, datetime

from celery import shared_task
from django.conf import settings
from django.utils.timezone import now

logger = logging.getLogger(__name__)


# ─── OpenRouter LLM helper ────────────────────────────────────────────────────

def _call_llm(system_prompt: str, user_prompt: str) -> str:
    """Call OpenRouter API and return assistant text. Returns '' on failure."""
    import requests as req
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '') or os.getenv('OPENROUTER_API_KEY', '')
    base_url = getattr(settings, 'OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1/chat/completions')
    model = getattr(settings, 'OPENROUTER_MODEL', 'nousresearch/hermes-3-llama-3.1-405b:free')

    if not api_key:
        logger.warning("OPENROUTER_API_KEY not set — skipping LLM call.")
        return ''

    try:
        resp = req.post(
            base_url,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://ampics.gnu.ac.in',
                'X-Title': 'AMPICS AI Attendance System',
            },
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user',   'content': user_prompt},
                ],
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        logger.error(f"OpenRouter LLM call failed: {e}")
        return ''


def _student_subject_stats(student, subject):
    """(total, present, consecutive_recent_absences)"""
    from attendance_ai.models import AttendanceRecord
    records = (
        AttendanceRecord.objects
        .filter(session__subject=subject, student=student)
        .order_by('session__date', 'session__start_time')
    )
    total = records.count()
    present = records.filter(status__in=['present', 'late']).count()
    statuses = list(records.values_list('status', flat=True))
    consecutive = 0
    for s in reversed(statuses):
        if s == 'absent':
            consecutive += 1
        else:
            break
    return total, present, consecutive


# ─── Task 1: detect_anomalies ─────────────────────────────────────────────────

@shared_task(name='attendance_ai.tasks.detect_anomalies')
def detect_anomalies(student_id: str, subject_id: str):
    """Triggered after each session ends. Checks 3 anomaly conditions."""
    from attendance_ai.models import AttendanceRecord, AttendanceAnomaly
    from django.contrib.auth import get_user_model
    from academics.models import Subject

    User = get_user_model()
    try:
        student = User.objects.get(user_id=student_id)
        subject = Subject.objects.get(subject_id=subject_id)
    except Exception as e:
        logger.error(f"detect_anomalies lookup failed: {e}")
        return

    total, present, consecutive = _student_subject_stats(student, subject)
    if total == 0:
        return

    pct = (present / total) * 100
    try:
        student_name = student.student_profile.name
    except Exception:
        student_name = student.email

    anomalies_to_process = []

    # Check 1: Low attendance %
    if pct < 75:
        severity = 'critical' if pct < 50 else ('high' if pct < 60 else 'medium')
        already = AttendanceAnomaly.objects.filter(
            student=student, subject=subject, anomaly_type='low_percentage', is_resolved=False
        ).exists()
        if not already:
            a = AttendanceAnomaly.objects.create(
                student=student, subject=subject,
                anomaly_type='low_percentage', severity=severity, description='',
            )
            anomalies_to_process.append((a.id, {
                'student_name': student_name, 'subject': subject.name,
                'percentage': round(pct, 1), 'total': total, 'present': present,
                'consecutive_count': consecutive,
            }))

    # Check 2: 3+ consecutive absences
    if consecutive >= 3:
        severity = 'critical' if consecutive >= 7 else ('high' if consecutive >= 5 else 'medium')
        already = AttendanceAnomaly.objects.filter(
            student=student, subject=subject, anomaly_type='consecutive_absent', is_resolved=False
        ).exists()
        if not already:
            a = AttendanceAnomaly.objects.create(
                student=student, subject=subject,
                anomaly_type='consecutive_absent', severity=severity, description='',
            )
            anomalies_to_process.append((a.id, {
                'student_name': student_name, 'subject': subject.name,
                'consecutive_count': consecutive, 'percentage': round(pct, 1),
                'total': total, 'present': present,
            }))

    # Check 3: Sudden drop (>20% drop last 14 days vs before)
    two_weeks_ago = date.today() - timedelta(weeks=2)
    from attendance_ai.models import AttendanceRecord
    all_records = AttendanceRecord.objects.filter(session__subject=subject, student=student)
    recent = all_records.filter(session__date__gte=two_weeks_ago)
    older = all_records.filter(session__date__lt=two_weeks_ago)
    if recent.count() >= 3 and older.count() >= 3:
        recent_pct = (recent.filter(status__in=['present', 'late']).count() / recent.count()) * 100
        older_pct = (older.filter(status__in=['present', 'late']).count() / older.count()) * 100
        if (older_pct - recent_pct) > 20:
            already = AttendanceAnomaly.objects.filter(
                student=student, subject=subject, anomaly_type='sudden_drop', is_resolved=False
            ).exists()
            if not already:
                a = AttendanceAnomaly.objects.create(
                    student=student, subject=subject,
                    anomaly_type='sudden_drop', severity='high', description='',
                )
                anomalies_to_process.append((a.id, {
                    'student_name': student_name, 'subject': subject.name,
                    'recent_pct': round(recent_pct, 1), 'older_pct': round(older_pct, 1),
                    'drop': round(older_pct - recent_pct, 1),
                    'percentage': round(pct, 1), 'total': total, 'present': present,
                    'consecutive_count': consecutive,
                }))

    for anomaly_id, stats in anomalies_to_process:
        generate_ai_description.delay(anomaly_id, stats)


# ─── Task 2: generate_ai_description ─────────────────────────────────────────

@shared_task(name='attendance_ai.tasks.generate_ai_description')
def generate_ai_description(anomaly_id: int, stats_dict: dict):
    """Calls LLM to write faculty alert and saves to AttendanceAnomaly.description."""
    from attendance_ai.models import AttendanceAnomaly
    try:
        anomaly = AttendanceAnomaly.objects.get(id=anomaly_id)
    except AttendanceAnomaly.DoesNotExist:
        return

    system = (
        "You are an academic advisor at a college. Generate a brief, helpful, empathetic alert "
        "message in 2-3 sentences in English for a faculty member about a student's attendance "
        "issue. Be professional and constructive."
    )
    user = (
        f"Student: {stats_dict.get('student_name', 'Unknown')}, "
        f"Subject: {stats_dict.get('subject', 'Unknown')}, "
        f"Anomaly: {anomaly.anomaly_type}, "
        f"Current attendance: {stats_dict.get('percentage', 0)}%, "
        f"Total classes: {stats_dict.get('total', 0)}, "
        f"Present: {stats_dict.get('present', 0)}, "
        f"Consecutive absences: {stats_dict.get('consecutive_count', 0)}"
    )

    description = _call_llm(system, user)
    if not description:
        description = (
            f"Student {stats_dict.get('student_name', '')} has a "
            f"{anomaly.anomaly_type.replace('_', ' ')} issue in {stats_dict.get('subject', 'this subject')}. "
            f"Current attendance: {stats_dict.get('percentage', 0)}%. "
            "Please review and take appropriate action."
        )

    anomaly.description = description
    anomaly.save(update_fields=['description'])
    send_notifications.delay(anomaly_id, stats_dict)


# ─── Task 3: send_notifications ──────────────────────────────────────────────

@shared_task(name='attendance_ai.tasks.send_notifications')
def send_notifications(anomaly_id: int, stats_dict: dict):
    """Send student, faculty, and optionally admin notifications."""
    from attendance_ai.models import AttendanceAnomaly, AttendanceNotification
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        anomaly = AttendanceAnomaly.objects.select_related('student', 'subject').get(id=anomaly_id)
    except AttendanceAnomaly.DoesNotExist:
        return

    student = anomaly.student
    subject = anomaly.subject

    # Student notification (encouraging)
    student_msg = _call_llm(
        system=(
            "You are a supportive academic counselor. Write a short, encouraging notification "
            "in 2 sentences for a student about their attendance. Be warm, motivating, not threatening."
        ),
        user=(
            f"Student: {stats_dict.get('student_name', '')}, "
            f"Subject: {subject.name}, Issue: {anomaly.anomaly_type}, "
            f"Attendance: {stats_dict.get('percentage', 0)}%"
        ),
    )
    if not student_msg:
        student_msg = (
            f"Hi! We noticed your attendance in {subject.name} needs some attention "
            f"({stats_dict.get('percentage', 0)}%). Your academic success matters — please try "
            "to attend regularly. You've got this! 💪"
        )
    AttendanceNotification.objects.create(
        recipient=student, notification_type='student_alert',
        message=student_msg, triggered_by=anomaly,
    )

    # Faculty notifications
    faculty_users = User.objects.filter(
        role='faculty', faculty_profile__subjects=subject
    ).distinct()
    for fac in faculty_users:
        AttendanceNotification.objects.create(
            recipient=fac, notification_type='faculty_info',
            message=anomaly.description or (
                f"Attendance alert: {stats_dict.get('student_name', student.email)} "
                f"has attendance issue in {subject.name} ({stats_dict.get('percentage', 0)}%)."
            ),
            triggered_by=anomaly,
        )

    # Admin notification — critical only
    if anomaly.severity == 'critical':
        admins = User.objects.filter(role='admin')
        for admin in admins:
            AttendanceNotification.objects.create(
                recipient=admin, notification_type='admin_critical',
                message=(
                    f"[CRITICAL] {stats_dict.get('student_name', student.email)} "
                    f"has critically low attendance ({stats_dict.get('percentage', 0)}%) "
                    f"in {subject.name}. Immediate attention required."
                ),
                triggered_by=anomaly,
            )


# ─── Task 4: generate_attendance_pdf ─────────────────────────────────────────

@shared_task(name='attendance_ai.tasks.generate_attendance_pdf')
def generate_attendance_pdf(subject_id: str, date_from: str, date_to: str) -> str:
    """Generate 4-page PDF attendance report using ReportLab."""
    from attendance_ai.models import LectureSession, AttendanceRecord
    from academics.models import Subject
    from users.models import Student

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        )
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.barcharts import VerticalBarChart
    except ImportError:
        logger.error("ReportLab not installed.")
        return ''

    try:
        subject = Subject.objects.get(subject_id=subject_id)
    except Subject.DoesNotExist:
        return ''

    d_from = datetime.strptime(date_from, '%Y-%m-%d').date()
    d_to = datetime.strptime(date_to, '%Y-%m-%d').date()

    sessions = LectureSession.objects.filter(
        subject=subject, date__range=(d_from, d_to), is_active=False
    )
    total_sessions = sessions.count()

    try:
        students = Student.objects.filter(course=subject.course).select_related('user')
    except Exception:
        students = []

    student_stats = []
    for stu in students:
        records = AttendanceRecord.objects.filter(session__in=sessions, student=stu.user)
        present_c = records.filter(status__in=['present', 'late']).count()
        pct = round((present_c / total_sessions * 100), 1) if total_sessions > 0 else 0
        student_stats.append({
            'name': stu.name,
            'roll': stu.enrollment_no,
            'total': total_sessions,
            'present': present_c,
            'absent': total_sessions - present_c,
            'pct': pct,
            'flagged': pct < 75,
        })

    out_dir = os.path.join(settings.MEDIA_ROOT, 'reports')
    os.makedirs(out_dir, exist_ok=True)
    fname = f"attendance_{subject_id}_{date.today().isoformat()}.pdf"
    out_path = os.path.join(out_dir, fname)

    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    gold = colors.HexColor('#D4AF37')
    dark_red = colors.HexColor('#7B0D0D')
    title_s = ParagraphStyle('T', parent=styles['Heading1'], textColor=dark_red, fontSize=18, spaceAfter=6)
    h2_s = ParagraphStyle('H2', parent=styles['Heading2'], textColor=dark_red, fontSize=14, spaceAfter=4)

    story = []

    # Page 1: Summary
    story.append(Paragraph("Ganpat University – AMPICS", title_s))
    story.append(Paragraph("AI Attendance Report", title_s))
    story.append(Spacer(1, .4*cm))
    info = [
        ['Subject', f"{subject.code} – {subject.name}"],
        ['Course', subject.course.name],
        ['Semester', str(subject.semester)],
        ['Date Range', f"{d_from} to {d_to}"],
        ['Total Sessions', str(total_sessions)],
        ['Total Students', str(len(student_stats))],
        ['Generated', date.today().isoformat()],
    ]
    t = Table(info, colWidths=[5*cm, 10*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), gold), ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('ROWBACKGROUNDS', (1, 0), (-1, -1), [colors.whitesmoke, colors.white]),
        ('GRID', (0, 0), (-1, -1), .5, colors.grey), ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story += [t, PageBreak()]

    # Page 2: Student table
    story.append(Paragraph("Student-wise Attendance", h2_s))
    story.append(Spacer(1, .3*cm))
    td = [['#', 'Name', 'Roll No', 'Total', 'Present', 'Absent', '%', 'Status']]
    for i, s in enumerate(student_stats, 1):
        td.append([str(i), s['name'], s['roll'], str(s['total']), str(s['present']),
                   str(s['absent']), f"{s['pct']}%", '⚠ Low' if s['flagged'] else 'OK'])
    st = Table(td, colWidths=[1*cm, 4.5*cm, 3 *cm, 1.8*cm, 1.8*cm, 1.8*cm, 1.8*cm, 2*cm], repeatRows=1)
    st.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), dark_red), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ('GRID', (0, 0), (-1, -1), .4, colors.grey), ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    for i, s in enumerate(student_stats, 1):
        if s['flagged']:
            st.setStyle(TableStyle([
                ('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FFE4E4')),
                ('TEXTCOLOR', (6, i), (7, i), colors.red),
            ]))
    story += [st, PageBreak()]

    # Page 3: Bar chart
    story.append(Paragraph("Daily Attendance – Present vs Absent", h2_s))
    story.append(Spacer(1, .4*cm))
    day_data = {}
    for sess in sessions:
        day_str = sess.date.strftime('%d/%m')
        recs = AttendanceRecord.objects.filter(session=sess)
        day_data[day_str] = (
            recs.filter(status__in=['present', 'late']).count(),
            recs.filter(status='absent').count(),
        )
    if day_data:
        labels = list(day_data.keys())[:20]
        drawing = Drawing(450, 200)
        bc = VerticalBarChart()
        bc.x, bc.y, bc.height, bc.width = 50, 20, 160, 380
        bc.data = [[day_data[d][0] for d in labels], [day_data[d][1] for d in labels]]
        bc.categoryAxis.categoryNames = labels
        bc.categoryAxis.labels.angle = 45
        bc.categoryAxis.labels.fontSize = 7
        bc.bars[0].fillColor = gold
        bc.bars[1].fillColor = colors.HexColor('#E05252')
        drawing.add(bc)
        story.append(drawing)
    story.append(PageBreak())

    # Page 4: Flagged students
    story.append(Paragraph("Students Below 75% Attendance", h2_s))
    story.append(Spacer(1, .3*cm))
    flagged = [s for s in student_stats if s['flagged']]
    if flagged:
        fd = [['Name', 'Roll No', 'Attendance %', 'Absent Sessions']]
        for s in flagged:
            fd.append([s['name'], s['roll'], f"{s['pct']}%", str(s['absent'])])
        ft = Table(fd, colWidths=[5.5*cm, 4*cm, 4*cm, 4*cm])
        ft.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.red), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFE4E4'), colors.white]),
            ('GRID', (0, 0), (-1, -1), .4, colors.grey), ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(ft)
    else:
        story.append(Paragraph("All students have attendance above 75% ✓", styles['Normal']))

    doc.build(story)
    logger.info(f"PDF saved: {out_path}")
    return f"reports/{fname}"
