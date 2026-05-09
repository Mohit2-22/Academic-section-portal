# Process Description — Academic Section Portal
**Project:** Academic Section Portal | **University:** Ganpat University  
**Backend:** Django REST Framework | **Frontend:** React (Vite) | **Database:** PostgreSQL (Supabase)

---

## 1. System Overview

The **Academic Section Portal** is a full-stack web application designed for Ganpat University. It centralizes academic operations for three user roles — **Student**, **Faculty**, and **Admin** — into a single unified platform. The system integrates AI-powered attendance, automated timetable generation, PYQ-based exam paper generation, and real-time academic management.

---

## 2. Module-wise Process Description

---

### 2.1 User Authentication & Role Management

**Process:** Login → Token Generation → Role-Based Redirect

1. User visits the portal and enters email and password on the login page.
2. The frontend sends a POST request to `/api/users/login/`.
3. The backend authenticates credentials against the `users` table using Django's `AbstractBaseUser`.
4. On success, a JWT access token and refresh token are generated using `djangorestframework-simplejwt`.
5. The role field (`student`, `faculty`, `admin`) in the `users` table determines which dashboard is loaded.
6. Tokens are stored in `localStorage` on the client side.
7. All subsequent API requests include the JWT token in the `Authorization: Bearer` header.
8. Token refresh happens automatically via `/api/users/token/refresh/` when the access token expires.

**Password Reset Flow:**
1. User requests password reset by submitting their email.
2. A 6-digit OTP is generated, stored in `password_reset_otps` with a 10-minute expiry, and emailed via SMTP.
3. User submits the OTP; backend validates it against `expires_at` and `is_used` fields.
4. On valid OTP, user can set a new password. OTP is marked `is_used = TRUE`.

---

### 2.2 Student Portal

**Process:** Dashboard → Timetable → Attendance → Results → PYQ Generator

1. **Dashboard:** On login, the system fetches the student's profile from `students`, linked course from `courses`, and attendance summary from `ai_attendance_records`. Notifications from `notifications` are displayed.

2. **Timetable View:** The system queries `timetable_slots` filtered by `course_id` and `semester` matching the student's enrolled course and current semester. Results are rendered as a weekly timetable grid.

3. **Attendance View:** The system aggregates `ai_attendance_records` grouped by `subject_id` for all `ai_lecture_sessions` of the student's course and semester. Calculates percentage = (present count / total sessions) × 100. Anomalies from `ai_attendance_anomalies` are shown as alerts.

4. **Results View:** The system fetches `semester_results` and linked `subject_results` for the student. SGPA, percentage, and grade are displayed per semester.

5. **QR Attendance:** Student scans QR code → frontend decodes `qr_token` → POST to `/api/attendance-ai/mark-qr/` → backend validates token against `ai_lecture_sessions.qr_token` and `qr_expires_at` → GPS coordinates checked against `classroom_lat/lng` within `geofence_radius` → device fingerprint matched against `ai_student_devices` → attendance record created in `ai_attendance_records`.

6. **PYQ Generator:** Student selects course, semester, subject, and exam type → POST to `/api/pyq/generate/` → backend ML model (`pyq_ml_model.pkl`) retrieves relevant questions from the question bank CSV → formats paper per Ganpat University pattern → returns JSON stored in `generatedpaper` → frontend renders PDF-style paper.

---

### 2.3 Faculty Portal

**Process:** Dashboard → Session Creation → Attendance → Reports → Timetable

1. **Dashboard:** Faculty login fetches profile from `faculty`, assigned subjects via `faculty_subjects` M2M, and today's sessions from `ai_lecture_sessions`.

2. **Create Lecture Session:**
   - Faculty selects subject and session type (lecture/lab/tutorial).
   - Backend creates a record in `ai_lecture_sessions` with a new `qr_token` (UUID) and sets `qr_expires_at`.
   - A QR code image is generated from the token URL and saved to `media/qr_codes/`.
   - The QR refreshes every `qr_refresh_secs` seconds (default: 60) to prevent screenshot sharing.
   - Faculty optionally sets GPS coordinates for geofencing.

3. **AI Face Recognition Attendance:**
   - Faculty activates face scan mode for a live session.
   - Webcam feed is captured → face detected → compared against `ai_face_encodings` pickle files → student identified if confidence ≥ threshold.
   - Backend creates/updates `ai_attendance_records` with `marked_via = 'face_recognition'` and `confidence_score`.

4. **Attendance Report:**
   - Faculty views session-wise attendance from `ai_attendance_records`.
   - Export to CSV via Django `HttpResponse` with `text/csv` content type.

5. **Timetable View:** Faculty sees their personal timetable from `timetable_slots` filtered by `faculty_id`.

---

### 2.4 Admin Portal

**Process:** Dashboard → User Management → Academic Setup → Timetable Generation → Analytics

1. **Dashboard:** Admin sees system-wide stats — total students, faculty, courses, today's sessions, and attendance anomalies.

2. **Student/Faculty Management:**
   - Admin can create, edit, and delete `students` and `faculty` records.
   - Bulk import via Excel/CSV → data validated and inserted into `students` and `users` tables.
   - Admin can view face registration status of each student from `ai_student_profiles` and `ai_face_encodings`.
   - Admin can reset/delete student face data (deletes `ai_face_encodings` record and resets `is_face_registered = FALSE`).

3. **Course & Subject Setup:**
   - Admin creates `courses` with code, duration, shift, and department.
   - Admin creates `subjects` linked to a `course_id` and assigns `semester` and `credits`.
   - Admin assigns subjects to faculty via the M2M `faculty_subjects` junction table.

4. **Timetable Generation:**
   - Admin configures `shifts`, `time_slots`, `break_slots`, and `day_types`.
   - Admin creates a `timetable_template` for a course/semester.
   - Admin triggers AI timetable generation → backend algorithm allocates subjects, faculty, and rooms avoiding conflicts.
   - Conflicts are saved to `timetable_conflicts`. Admin reviews and resolves them.
   - Admin publishes the schedule via `timetable_schedules.is_published = TRUE`.

5. **Semester Toggle:**
   - Admin toggles `semester_config.current_parity` between ODD and EVEN.
   - This controls which semesters are visible to students and faculty.
   - `timetable_generated` resets to FALSE on toggle, requiring new timetable generation.

6. **Notifications:**
   - Admin creates targeted notifications by role or specific user.
   - Stored in `notifications` table with `target`, `type`, and `priority`.

7. **Exam & Results Management:**
   - Admin or Faculty creates `exams` linked to subjects.
   - Results are entered into `exam_results` and `semester_results`.
   - Students view their results on the student portal.

---

### 2.5 AI Attendance System

**Process:** Registration → Session → Mark → Anomaly Detection → Alerts

1. **Face Registration:**
   - Student uploads 5 face photos on the registration page.
   - Backend processes images using `face_recognition` library → generates 128-dimension face encoding → saves as `.pkl` file to `media/face_encodings/`.
   - Path stored in `ai_face_encodings.encoding_path`.
   - `is_face_registered` set to `TRUE` in both `students` and `ai_student_profiles`.

2. **Session Management:**
   - Faculty creates session → QR generated → students scan or face scan is activated.
   - Session stays active (`is_active = TRUE`) until faculty closes it.

3. **Anomaly Detection:**
   - After each session, the system calculates attendance percentage per student per subject.
   - If percentage < 75%, or 3+ consecutive absences, or sudden drop — an `ai_attendance_anomalies` record is created.
   - LLM (Google Gemini API) generates a human-readable alert description.
   - `ai_attendance_notifications` record sent to relevant faculty/admin.

4. **Device Binding (Anti-Proxy):**
   - On first QR mark, student's `device_id` (browser fingerprint) is stored in `ai_student_devices`.
   - Subsequent marks must use the same device; mismatches set `device_verified = FALSE`.

---

### 2.6 PYQ AI Exam Paper Generator

**Process:** Selection → ML Retrieval → Paper Formatting → PDF Output

1. Student or faculty selects: Course → Semester → Subject → Exam Type (Mid/End Term).
2. Frontend sends request to `/api/pyq/generate/`.
3. Backend loads the trained ML model (`pyq_ml_model.pkl`) — a TF-IDF + cosine similarity model trained on Ganpat University past question data.
4. Questions are retrieved from `pyq_questions_clean.csv` matching the subject code and exam type.
5. Questions are grouped into sections per Ganpat University exam pattern:
   - Section A: Short questions (2 marks each)
   - Section B: Medium questions (4 marks each)
   - Section C: Long questions (7 marks each)
6. Generated paper JSON is stored in `generatedpaper` table.
7. Frontend renders the paper in a formatted, printable PDF-style layout.

---

## 3. Data Flow Summary

```
[Student] ──► Login ──► JWT Token ──► Student Dashboard
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
             QR Attendance           View Timetable         PYQ Generator
                    │                      │                      │
             ai_lecture_sessions    timetable_slots        generatedpaper
             ai_attendance_records  courses/subjects        ML Model (.pkl)

[Faculty] ──► Login ──► Faculty Dashboard
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
       Create Session    Face Recognition   Export Report
              │               │                │
       ai_lecture_sessions  ai_face_encodings  CSV Report

[Admin] ──► Login ──► Admin Dashboard
                           │
         ┌─────────────────┼──────────────────┐
         ▼                 ▼                  ▼
   Manage Users     Setup Academics    Generate Timetable
         │                 │                  │
   students/faculty  courses/subjects   timetable_slots
   users             semester_config    timetable_conflicts
```

---

## 4. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (Vite), Axios, React Router v6 |
| Backend | Django 4.x, Django REST Framework |
| Authentication | JWT (SimpleJWT) |
| Database | PostgreSQL via Supabase |
| AI Attendance | face_recognition, OpenCV, dlib |
| PYQ Generator | Scikit-learn (TF-IDF), pandas, NumPy |
| LLM Integration | Google Gemini API |
| Export | Python csv (CSV download) |
| Storage | Django MEDIA_ROOT (local filesystem) |
| Deployment | Supabase (DB), local Django server |
