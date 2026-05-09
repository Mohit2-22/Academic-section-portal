# Testing Documentation — Academic Section Portal
**Project:** Academic Section Portal | **University:** Ganpat University  
**Testing Types:** Functional Testing | Integration Testing

---

## PART A — Functional Test Cases

> **Columns:** S.No | Module | Scenario | Expected Result | Actual Result | Result

---

### Module: User Authentication

| S.No | Module | Scenario | Expected Result | Actual Result | Result |
|------|--------|----------|----------------|---------------|--------|
| F01 | User Authentication | Student logs in with valid email and password | JWT token generated; redirected to Student Dashboard | JWT token generated; Student Dashboard loaded | ✅ Pass |
| F02 | User Authentication | Faculty logs in with valid credentials | JWT token generated; redirected to Faculty Dashboard | JWT token generated; Faculty Dashboard loaded | ✅ Pass |
| F03 | User Authentication | Admin logs in with valid credentials | JWT token generated; redirected to Admin Dashboard | JWT token generated; Admin Dashboard loaded | ✅ Pass |
| F04 | User Authentication | Login with incorrect password | Error message: "Invalid credentials" displayed | "Invalid credentials" error shown | ✅ Pass |
| F05 | User Authentication | Login with unregistered email | Error message: "No account found" displayed | "No account found" error shown | ✅ Pass |
| F06 | User Authentication | Access dashboard without login (no token) | Redirected to login page | Redirected to login page | ✅ Pass |
| F07 | User Authentication | Request password reset with valid email | OTP sent to email; success message shown | OTP email sent; message displayed | ✅ Pass |
| F08 | User Authentication | Submit correct OTP for password reset | OTP validated; password change form shown | OTP validated; form displayed | ✅ Pass |
| F09 | User Authentication | Submit expired OTP | Error: "OTP has expired" | "OTP has expired" shown | ✅ Pass |
| F10 | User Authentication | Submit already-used OTP | Error: "OTP already used" | "OTP already used" shown | ✅ Pass |

---

### Module: Student Dashboard

| S.No | Module | Scenario | Expected Result | Actual Result | Result |
|------|--------|----------|----------------|---------------|--------|
| F11 | Student Dashboard | Student views dashboard after login | Name, course, CGPA, attendance summary, notifications displayed | All data rendered correctly | ✅ Pass |
| F12 | Student Dashboard | Student views timetable | Weekly timetable for current course and semester shown | Timetable rendered with correct subjects and timings | ✅ Pass |
| F13 | Student Dashboard | Student views subject-wise attendance | Attendance percentage per subject shown | Correct percentages displayed per subject | ✅ Pass |
| F14 | Student Dashboard | Student with attendance < 75% sees alert | Red warning badge/alert shown for low attendance subject | Alert shown with correct subject | ✅ Pass |
| F15 | Student Dashboard | Student views semester results | SGPA, percentage, grade, and subject-wise marks shown | All result data correctly displayed | ✅ Pass |
| F16 | Student Dashboard | Student views profile page | Enrollment no, course, semester, batch, branch displayed | Profile rendered correctly | ✅ Pass |

---

### Module: QR Attendance

| S.No | Module | Scenario | Expected Result | Actual Result | Result |
|------|--------|----------|----------------|---------------|--------|
| F17 | QR Attendance | Student scans valid, active QR code | Attendance marked as "present"; success message shown | Attendance marked present; confirmation shown | ✅ Pass |
| F18 | QR Attendance | Student scans expired QR code | Error: "QR code has expired" | "QR code expired" error shown | ✅ Pass |
| F19 | QR Attendance | Student outside geofence scans QR | Error: "You are not in the classroom location" | GPS mismatch error shown | ✅ Pass |
| F20 | QR Attendance | Student scans QR from an unregistered device | Error: "Device not recognized" | Device fingerprint mismatch error shown | ✅ Pass |
| F21 | QR Attendance | Student tries to mark attendance twice | Error: "Attendance already marked" | Duplicate mark error shown | ✅ Pass |
| F22 | QR Attendance | QR token auto-refreshes after 60 seconds | New QR image replaces old one on faculty screen | QR refreshed; old scans invalid | ✅ Pass |

---

### Module: Face Recognition Attendance

| S.No | Module | Scenario | Expected Result | Actual Result | Result |
|------|--------|----------|----------------|---------------|--------|
| F23 | Face Recognition | Registered student scanned with clear face | Attendance marked present with confidence score ≥ threshold | Present marked with confidence score shown | ✅ Pass |
| F24 | Face Recognition | Unregistered student face scanned | No match found; attendance not marked | "Face not recognized" shown | ✅ Pass |
| F25 | Face Recognition | Student registers face with 5 photos | Face encoding (.pkl) created; `is_face_registered = TRUE` | Encoding saved; registration flag updated | ✅ Pass |
| F26 | Face Recognition | Admin resets student face data | Encoding file deleted; `is_face_registered = FALSE` | Face data cleared; flag reset | ✅ Pass |
| F27 | Face Recognition | Liveness check fails (photo spoofing) | Error: "Liveness check failed"; attendance not marked | Liveness failure detected; attendance blocked | ✅ Pass |

---

### Module: Faculty Portal

| S.No | Module | Scenario | Expected Result | Actual Result | Result |
|------|--------|----------|----------------|---------------|--------|
| F28 | Faculty Portal | Faculty creates a new lecture session | Session saved in `ai_lecture_sessions`; QR generated | Session created; QR displayed | ✅ Pass |
| F29 | Faculty Portal | Faculty views today's sessions | Active sessions for assigned subjects listed | Today's sessions shown correctly | ✅ Pass |
| F30 | Faculty Portal | Faculty downloads attendance as CSV | CSV file downloaded with correct headers and data | CSV downloaded successfully | ✅ Pass |
| F32 | Faculty Portal | Faculty views assigned timetable | Timetable slots filtered by faculty_id displayed | Personal timetable displayed | ✅ Pass |

---

### Module: Admin Portal

| S.No | Module | Scenario | Expected Result | Actual Result | Result |
|------|--------|----------|----------------|---------------|--------|
| F33 | Admin Portal | Admin adds a new student | Student record created in `students` and `users` tables | Student created; visible in list | ✅ Pass |
| F34 | Admin Portal | Admin adds a new faculty member | Faculty record created in `faculty` and `users` tables | Faculty created; visible in list | ✅ Pass |
| F35 | Admin Portal | Admin assigns subject to faculty | M2M record added to `faculty_subjects` | Assignment saved; faculty sees subject | ✅ Pass |
| F36 | Admin Portal | Admin creates a new course | Course saved in `courses` table | Course visible in course list | ✅ Pass |
| F37 | Admin Portal | Admin creates a subject under a course | Subject saved in `subjects` linked to course | Subject visible under course | ✅ Pass |
| F38 | Admin Portal | Admin toggles semester parity (ODD→EVEN) | `semester_config.current_parity` updated; `timetable_generated = FALSE` | Parity toggled; students see new semester set | ✅ Pass |
| F39 | Admin Portal | Admin publishes timetable | `timetable_schedules.is_published = TRUE` | Timetable visible to students | ✅ Pass |
| F40 | Admin Portal | Admin sends a notification | Notification stored in `notifications`; visible to target users | Notification delivered | ✅ Pass |

---

### Module: PYQ Generator

| S.No | Module | Scenario | Expected Result | Actual Result | Result |
|------|--------|----------|----------------|---------------|--------|
| F41 | PYQ Generator | Student generates Mid Term paper for valid subject | Paper generated with Section A, B, C; correct marks distribution | Paper generated correctly | ✅ Pass |
| F42 | PYQ Generator | Student generates End Term paper | Paper follows 60-mark Ganpat University pattern | Paper generated with correct structure | ✅ Pass |
| F43 | PYQ Generator | Student selects subject with no question data | Graceful error: "No questions available for this subject" | Error message shown | ✅ Pass |
| F44 | PYQ Generator | Generated paper stored in database | Record saved in `generatedpaper` with all fields | Record saved in DB | ✅ Pass |

---

## PART B — Integration Test Cases

> **Columns:** S.No | Journey | Scenario | Expected Result | Actual Result | Result

---

| S.No | Journey | Scenario | Expected Result | Actual Result | Result |
|------|---------|----------|----------------|---------------|--------|
| I01 | Student Registration to Login | Admin creates student account → student logs in | Student record in DB; login returns JWT; student dashboard loads | Full flow works end-to-end | ✅ Pass |
| I02 | Course Setup to Timetable Visibility | Admin creates course → adds subjects → generates timetable → publishes → student views timetable | Student sees correct timetable for their course/semester | Timetable visible to student after publish | ✅ Pass |
| I03 | Subject Assignment to Faculty Timetable | Admin assigns subject to faculty → faculty logs in → views timetable | Faculty sees only their assigned subjects in timetable | Faculty timetable shows correct subjects | ✅ Pass |
| I04 | Face Registration to Attendance Marking | Student registers face → faculty creates session → face scan → attendance record created | `is_face_registered = TRUE`; attendance record in DB with `face_recognition` as `marked_via` | Full biometric attendance flow works | ✅ Pass |
| I05 | QR Session to Student Dashboard Update | Faculty creates session → student scans QR → attendance marked → student refreshes dashboard | Attendance count updated on student dashboard | Dashboard attendance percentage updated | ✅ Pass |
| I06 | Anomaly Detection to Notification | Student misses 3+ sessions → system detects anomaly → notification created → faculty sees alert | `ai_attendance_anomalies` record created; `ai_attendance_notifications` sent; faculty sees alert | Anomaly detected; notification delivered | ✅ Pass |
| I07 | Exam Creation to Student Result View | Faculty creates exam → admin enters results → student views marks | `exams` → `exam_results` → `semester_results` chain populated; student sees result | End-to-end result flow works | ✅ Pass |
| I08 | PYQ Generation to PDF Download | Student selects subject → generates paper → views formatted paper → downloads/prints | Paper JSON stored in DB; frontend renders PDF layout correctly | Full PYQ generation and render works | ✅ Pass |
| I09 | Password Reset Full Flow | Student requests OTP → receives email → enters OTP → sets new password → logs in | OTP validated, `is_used = TRUE`; new password set; login succeeds | Complete reset flow works | ✅ Pass |
| I10 | Admin Semester Toggle to Student Dashboard | Admin toggles ODD→EVEN → students log in → dashboard shows EVEN semester subjects | `semester_config.current_parity = 'EVEN'`; student dashboard, timetable, attendance update | Semester toggle reflects across portal | ✅ Pass |
| I11 | Device Binding to Proxy Prevention | Student marks attendance on Device A → same student tries from Device B | Device B rejected with `device_verified = FALSE`; attendance not marked | Proxy attempt blocked | ✅ Pass |

| I13 | Bulk Student Import to Profile Creation | Admin uploads Excel/CSV file → students imported → students can log in | All students created in `students` and `users` tables; login works for each | Bulk import flow works | ✅ Pass |
| I14 | Timetable Conflict Detection and Resolution | Admin generates timetable with overlapping faculty schedules → conflict detected → admin resolves → timetable republished | Conflict stored in `timetable_conflicts`; after resolution `is_resolved = TRUE`; timetable republished | Conflict detection and resolution works | ✅ Pass |
| I15 | Notification Delivery to Target Role | Admin creates notification with target='student' → all students see notification in dashboard | Notification visible on all student dashboards | Broadcast notification works | ✅ Pass |
| I16 | Face Reset to Re-registration | Admin resets student face → student re-registers new face photos → attendance via face works again | Old encoding deleted; new encoding saved; face attendance works | Face reset and re-registration flow works | ✅ Pass |
| I17 | Subject Result to SGPA Calculation | Admin enters subject marks for a student → semester result SGPA and grade auto-calculated → visible on student portal | `subject_results` saved; `semester_results.sgpa` and `grade` computed correctly | SGPA calculation and display works | ✅ Pass |
| I18 | Session Geofence to Attendance Block | Faculty sets GPS coordinates for session → student outside radius scans QR → attendance blocked | `gps_verified = FALSE`; attendance not created | Geofence enforcement works | ✅ Pass |
| I19 | QR Token Rotation to Old Scan Rejection | Faculty starts session (60s rotation) → student takes screenshot of QR → tries to use it after rotation | Old token rejected with "QR expired" error; new token required | Token rotation anti-fraud works | ✅ Pass |
| I20 | Admin Face Status View to Student Count | Admin views "Face Registration Status" page → correct count of registered vs unregistered students shown | Count matches records in `ai_face_encodings` | Face registration report accurate | ✅ Pass |
