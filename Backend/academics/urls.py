from django.urls import path
from . import views

urlpatterns = [
    path("courses/", views.course_list, name="course_list"),
    path("courses/<uuid:course_id>/", views.course_detail, name="course_detail"),
    path("rooms/", views.rooms_list, name="rooms_list"),
    path("subjects/", views.subject_list, name="subject_list"),
    path("timetable/", views.timetable_list, name="timetable_list"),
    path("timetable/<uuid:slot_id>/", views.timetable_detail, name="timetable_detail"),
    path("faculty/timetable/", views.faculty_timetable, name="faculty_timetable"),
    path("student/timetable/", views.student_timetable, name="student_timetable"),
    # Exam routes
    path("exams/", views.exam_list, name="exam_list"),
    path("exams/<uuid:exam_id>/", views.exam_detail, name="exam_detail"),
    path("exams/<uuid:exam_id>/questions/", views.question_list, name="question_list"),
    path(
        "exams/<uuid:exam_id>/results/", views.exam_result_list, name="exam_result_list"
    ),
    # Result routes
    path("student/results/", views.student_results, name="student_results"),
    path("student/exams/", views.student_exams, name="student_exams"),
    path("faculty/exams/", views.faculty_exams, name="faculty_exams"),
    # Admin Timetable Management
    path(
        "admin/timetable/generate/",
        views.admin_generate_timetable,
        name="admin_generate_timetable",
    ),
    path(
        "admin/timetable/stats/",
        views.admin_timetable_stats,
        name="admin_timetable_stats",
    ),
    # ONE-CLICK PDF Generation
    path(
        "admin/timetable/pdf/",
        views.admin_generate_timetable_pdf,
        name="admin_generate_timetable_pdf",
    ),
    # New Timetable API Endpoints
    path(
        "admin/timetable/generate-complete/",
        views.generate_complete_timetable,
        name="generate_complete_timetable",
    ),
    path(
        "admin/timetable/clear/",
        views.clear_timetable,
        name="clear_timetable",
    ),
    path(
        "admin/timetable/conflicts/",
        views.get_timetable_conflicts,
        name="get_timetable_conflicts",
    ),
    path(
        "admin/timetable/conflicts/<uuid:conflict_id>/resolve/",
        views.resolve_conflict,
        name="resolve_conflict",
    ),
    path(
        "timetable/course/<uuid:course_id>/<int:semester>/",
        views.get_timetable_by_course,
        name="get_timetable_by_course",
    ),
    path(
        "timetable/faculty/<uuid:faculty_id>/",
        views.get_timetable_by_faculty,
        name="get_timetable_by_faculty",
    ),
    path(
        "timetable/room/<uuid:room_id>/",
        views.get_timetable_by_room,
        name="get_timetable_by_room",
    ),
    # Proxy Lecture Routes
    path("proxy/mark/", views.mark_proxy, name="mark_proxy"),
    path("proxy/<uuid:proxy_id>/cancel/", views.cancel_proxy, name="cancel_proxy"),
    path("proxy/slot/<uuid:slot_id>/", views.get_slot_proxies, name="get_slot_proxies"),
    path("faculty/my-proxies/", views.faculty_my_proxies, name="faculty_my_proxies"),
    path("pyq/search/", views.pyq_search, name="pyq_search"),
]
