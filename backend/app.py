import os
import uuid
import hashlib
import csv
import io
from datetime import date, datetime
from flask import (Flask, render_template, jsonify, request, session,
                   redirect, url_for, send_file, make_response, send_from_directory)
from functools import wraps
from dotenv import load_dotenv
from flask import send_from_directory
import database
import certificate_generator
import file_manager

load_dotenv()

app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
)
app.secret_key = os.getenv("SECRET_KEY", "institute_management_secret_key_2026")

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOAD_FOLDER, "materials"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, "videos"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, "certificates"), exist_ok=True)

# ─────────────────────────────────────────
# UTILITY
# ─────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def make_json_serializable(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return str(obj)

def serialize_rows(rows):
    result = []
    for row in rows:
        new_row = {}
        for k, v in row.items():
            if isinstance(v, (date, datetime)):
                new_row[k] = v.isoformat()
            elif isinstance(v, list):
                new_row[k] = v
            else:
                new_row[k] = v
        result.append(new_row)
    return result

# ─────────────────────────────────────────
# AUTH DECORATORS
# ─────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({"error": "Unauthorized"}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Unauthorized"}), 401
                return redirect(url_for('login'))
            if session.get('role') not in roles:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Forbidden"}), 403
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated
    return decorator

# ─────────────────────────────────────────
# PAGE ROUTES
# ─────────────────────────────────────────

@app.route('/')
def root():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    role = session.get('role')
    portal_map = {
        'super_admin': 'super_admin_portal',
        'admin': 'admin_portal',
        'faculty': 'faculty_portal',
        'admission_staff': 'admission_portal',
        'student': 'student_portal',
    }
    return redirect(url_for(portal_map.get(role, 'login')))

def login_helper(target_role):
    # Handle active sessions
    if 'user_id' in session:
        # If already logged in with the target role, redirect to root
        if session.get('role') == target_role:
            return redirect(url_for('root'))
        else:
            # Otherwise, clear the session so they can switch roles
            session.clear()

    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        pw_hash = hash_password(password)

        try:
            rows = database.execute_query(
                "SELECT id, username, role, is_active FROM users WHERE username=%s AND password_hash=%s",
                (username, pw_hash), fetch=True
            )
            if rows and rows[0]['is_active']:
                user = rows[0]
                
                # Check if user's role matches the login route's target role
                if user['role'] != target_role:
                    role_names = {
                        'student': 'Student',
                        'faculty': 'Faculty',
                        'admin': 'Admin',
                        'admission_staff': 'Admission Staff',
                        'super_admin': 'Super Admin'
                    }
                    error = f"This account does not have access to the {role_names.get(target_role, 'requested')} portal."
                else:
                    session['user_id'] = str(user['id'])
                    session['username'] = user['username']
                    session['role'] = user['role']

                    # Get linked profile id if student or faculty
                    if user['role'] == 'student':
                        s = database.execute_query(
                            "SELECT id FROM students WHERE user_id=%s", (user['id'],), fetch=True
                        )
                        session['profile_id'] = str(s[0]['id']) if s else None
                    elif user['role'] == 'faculty':
                        f = database.execute_query(
                            "SELECT id FROM faculty WHERE user_id=%s", (user['id'],), fetch=True
                        )
                        session['profile_id'] = str(f[0]['id']) if f else None

                    return redirect(url_for('root'))
            else:
                error = "Invalid credentials or account is deactivated."
        except Exception as e:
            error = f"Login error: {str(e)}"

    return render_template('login.html', error=error, default_role=target_role)

@app.route('/login', methods=['GET', 'POST'])
def login():
    return login_helper('student')

@app.route('/faculty', methods=['GET', 'POST'])
def faculty_login():
    return login_helper('faculty')

@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    return login_helper('admin')

@app.route('/admission', methods=['GET', 'POST'])
def admission_login():
    return login_helper('admission_staff')

@app.route('/supera', methods=['GET', 'POST'])
@app.route('/superadmin', methods=['GET', 'POST'])
def super_admin_login():
    return login_helper('super_admin')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/portal/student')
@role_required('student')
def student_portal():
    return render_template('student_portal.html',
                           username=session.get('username'),
                           profile_id=session.get('profile_id'))

@app.route('/portal/faculty')
@role_required('faculty')
def faculty_portal():
    return render_template('faculty_portal.html',
                           username=session.get('username'),
                           profile_id=session.get('profile_id'))

@app.route('/portal/admin')
@role_required('admin')
def admin_portal():
    return render_template('admin_portal.html',
                           username=session.get('username'))

@app.route('/portal/admission')
@role_required('admission_staff')
def admission_portal():
    return render_template('admission_portal.html',
                           username=session.get('username'))

@app.route('/portal/super-admin')
@role_required('super_admin')
def super_admin_portal():
    return render_template('super_admin_portal.html',
                           username=session.get('username'))

@app.route('/inquiry')
def public_inquiry():
    return render_template('inquiry.html')

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory(app.static_folder, 'manifest.json')

@app.route('/favicon.ico')
def serve_favicon():
    return send_from_directory(app.static_folder, 'favicon.ico')

# ─────────────────────────────────────────
# API: AUTH INFO
# ─────────────────────────────────────────

@app.route('/api/me')
@login_required
def api_me():
    return jsonify({
        'user_id': session.get('user_id'),
        'username': session.get('username'),
        'role': session.get('role'),
        'profile_id': session.get('profile_id')
    })

# ─────────────────────────────────────────
# API: SUPER ADMIN
# ─────────────────────────────────────────

@app.route('/api/super-admin/users', methods=['GET'])
@role_required('super_admin')
def sa_list_users():
    try:
        rows = database.execute_query(
            "SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC",
            fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super-admin/users', methods=['POST'])
@role_required('super_admin')
def sa_create_user():
    data = request.json or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', '')

    if not all([username, email, password, role]):
        return jsonify({"error": "Missing required fields"}), 400
    if role not in ('admin', 'faculty', 'admission_staff', 'super_admin'):
        return jsonify({"error": "Invalid role"}), 400

    try:
        pw_hash = hash_password(password)
        conn = database.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (%s,%s,%s,%s) RETURNING id",
                (username, email, pw_hash, role)
            )
            user_id = cur.fetchone()['id']

            # Auto-create faculty profile if role is faculty
            if role == 'faculty':
                first = data.get('first_name', username)
                last = data.get('last_name', '')
                spec = data.get('specialization', '')
                qual = data.get('qualification', '')
                cur.execute(
                    "INSERT INTO faculty (user_id, first_name, last_name, email, specialization, qualification) VALUES (%s,%s,%s,%s,%s,%s)",
                    (user_id, first, last, email, spec, qual)
                )
            conn.commit()
            return jsonify({"id": str(user_id), "message": "User created successfully"}), 201
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super-admin/users/<user_id>/toggle', methods=['PUT'])
@role_required('super_admin')
def sa_toggle_user(user_id):
    try:
        rows = database.execute_query("SELECT is_active FROM users WHERE id=%s", (user_id,), fetch=True)
        if not rows:
            return jsonify({"error": "User not found"}), 404
        new_status = not rows[0]['is_active']
        database.execute_query("UPDATE users SET is_active=%s WHERE id=%s", (new_status, user_id))
        return jsonify({"is_active": new_status, "message": "Status updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super-admin/fees-dashboard', methods=['GET'])
@role_required('super_admin')
def sa_fees_dashboard():
    try:
        stats = database.execute_query(
            """SELECT
               COALESCE(SUM(paid_amount),0) as total_collected,
               COALESCE(SUM(outstanding_amount),0) as total_outstanding,
               COUNT(*) as total_records,
               COUNT(CASE WHEN status='paid' THEN 1 END) as paid_count,
               COUNT(CASE WHEN status='pending' THEN 1 END) as pending_count,
               COUNT(CASE WHEN status='overdue' THEN 1 END) as overdue_count,
               COUNT(CASE WHEN status='partial' THEN 1 END) as partial_count
               FROM fees""", fetch=True
        )
        return jsonify(serialize_rows(stats)[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super-admin/batches-dashboard', methods=['GET'])
@role_required('super_admin')
def sa_batches_dashboard():
    try:
        rows = database.execute_query(
            """SELECT b.id, b.name, b.max_students, b.status, b.start_date, b.end_date,
               COUNT(bs.student_id) as enrolled_count
               FROM batches b
               LEFT JOIN batch_students bs ON b.id=bs.batch_id
               GROUP BY b.id ORDER BY b.created_at DESC""", fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# API: ADMIN
# ─────────────────────────────────────────

@app.route('/api/admin/dashboard', methods=['GET'])
@role_required('admin', 'super_admin')
def admin_dashboard():
    try:
        students = database.execute_query(
            "SELECT COUNT(*) as total, COUNT(CASE WHEN enrollment_status='active' THEN 1 END) as active FROM students",
            fetch=True
        )[0]
        batches = database.execute_query(
            "SELECT COUNT(*) as total, COUNT(CASE WHEN status='active' THEN 1 END) as active FROM batches",
            fetch=True
        )[0]
        faculty_count = database.execute_query("SELECT COUNT(*) as total FROM faculty WHERE is_active=true", fetch=True)[0]
        fees = database.execute_query(
            "SELECT COALESCE(SUM(paid_amount),0) as collected, COALESCE(SUM(outstanding_amount),0) as outstanding FROM fees",
            fetch=True
        )[0]
        inquiries = database.execute_query(
            "SELECT COUNT(*) as total FROM inquiries WHERE funnel_stage != 'admission'", fetch=True
        )[0]
        return jsonify({
            "students": serialize_rows([students])[0],
            "batches": serialize_rows([batches])[0],
            "faculty": serialize_rows([faculty_count])[0],
            "fees": serialize_rows([fees])[0],
            "inquiries": serialize_rows([inquiries])[0]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/students', methods=['GET', 'POST'])
@role_required('admin', 'super_admin')
def admin_students():
    if request.method == 'GET':
        try:
            rows = database.execute_query(
                """SELECT s.id, s.first_name, s.middle_name, s.last_name, s.email, s.phone,
                   s.city, s.enrollment_status, s.created_at,
                   u.username, u.is_active
                   FROM students s LEFT JOIN users u ON s.user_id=u.id
                   ORDER BY s.created_at DESC""", fetch=True
            )
            return jsonify(serialize_rows(rows))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        data = request.json or {}
        required = ['first_name', 'last_name', 'email', 'phone', 'password']
        if not all(data.get(f) for f in required):
            return jsonify({"error": "Missing required fields: " + ", ".join(required)}), 400

        try:
            conn = database.get_db_connection()
            cur = conn.cursor()
            try:
                pw_hash = hash_password(data['password'])
                username = data.get('username') or data['email'].split('@')[0]

                cur.execute(
                    "INSERT INTO users (username, email, password_hash, role) VALUES (%s,%s,%s,'student') RETURNING id",
                    (username, data['email'], pw_hash)
                )
                user_id = cur.fetchone()['id']

                cur.execute(
                    """INSERT INTO students (user_id, first_name, middle_name, last_name, email, phone,
                       city, father_occupation, father_phone, mother_occupation, mother_phone,
                       reference_source, reference_other)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (user_id, data['first_name'], data.get('middle_name'), data['last_name'],
                     data['email'], data['phone'], data.get('city'),
                     data.get('father_occupation'), data.get('father_phone'),
                     data.get('mother_occupation'), data.get('mother_phone'),
                     data.get('reference_source'), data.get('reference_other'))
                )
                student_id = cur.fetchone()['id']

                # Optionally add to a batch
                if data.get('batch_id'):
                    cur.execute(
                        "INSERT INTO batch_students (batch_id, student_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                        (data['batch_id'], student_id)
                    )
                    # Create fee record
                    batch_row = database.execute_query(
                        "SELECT name FROM batches WHERE id=%s", (data['batch_id'],), fetch=True
                    )
                    if batch_row:
                        fee_amount = float(data.get('fee_amount', 0))
                        cur.execute(
                            """INSERT INTO fees (student_id, student_name, batch_id, course_name,
                               total_amount, paid_amount, outstanding_amount, due_date, status)
                               VALUES (%s,%s,%s,%s,%s,0,%s, CURRENT_DATE + INTERVAL '30 days','pending')""",
                            (student_id, f"{data['first_name']} {data['last_name']}",
                             data['batch_id'], data.get('course_name', ''),
                             fee_amount, fee_amount)
                        )
                conn.commit()
                return jsonify({"student_id": str(student_id), "message": "Student created"}), 201
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                conn.close()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/admin/students/<student_id>', methods=['GET'])
@role_required('admin', 'super_admin', 'admission_staff')
def admin_get_student(student_id):
    try:
        rows = database.execute_query(
            """SELECT s.*, u.username, u.is_active,
               array_agg(DISTINCT b.name) FILTER (WHERE b.name IS NOT NULL) as batches
               FROM students s
               LEFT JOIN users u ON s.user_id=u.id
               LEFT JOIN batch_students bs ON s.id=bs.student_id
               LEFT JOIN batches b ON bs.batch_id=b.id
               WHERE s.id=%s GROUP BY s.id, u.username, u.is_active""",
            (student_id,), fetch=True
        )
        if not rows:
            return jsonify({"error": "Student not found"}), 404
        return jsonify(serialize_rows(rows)[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/faculty', methods=['GET', 'POST'])
@role_required('admin', 'super_admin')
def admin_faculty():
    if request.method == 'GET':
        try:
            rows = database.execute_query(
                "SELECT f.*, u.username, u.is_active FROM faculty f LEFT JOIN users u ON f.user_id=u.id ORDER BY f.created_at DESC",
                fetch=True
            )
            return jsonify(serialize_rows(rows))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        data = request.json or {}
        try:
            conn = database.get_db_connection()
            cur = conn.cursor()
            try:
                pw_hash = hash_password(data.get('password', 'faculty123'))
                username = data.get('username') or data['email'].split('@')[0]
                cur.execute(
                    "INSERT INTO users (username, email, password_hash, role) VALUES (%s,%s,%s,'faculty') RETURNING id",
                    (username, data['email'], pw_hash)
                )
                user_id = cur.fetchone()['id']
                cur.execute(
                    """INSERT INTO faculty (user_id, first_name, last_name, email, phone, specialization, qualification)
                       VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (user_id, data['first_name'], data['last_name'], data['email'],
                     data.get('phone'), data.get('specialization'), data.get('qualification'))
                )
                fac_id = cur.fetchone()['id']
                conn.commit()
                return jsonify({"faculty_id": str(fac_id), "message": "Faculty created"}), 201
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                conn.close()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/admin/batches', methods=['GET', 'POST'])
@role_required('admin', 'super_admin')
def admin_batches():
    if request.method == 'GET':
        try:
            rows = database.execute_query(
                """SELECT b.id, b.name, b.max_students, b.lecture_days, b.lecture_time,
                   b.start_date, b.end_date, b.status,
                   COUNT(bs.student_id) as enrolled_count
                   FROM batches b
                   LEFT JOIN batch_students bs ON b.id=bs.batch_id
                   GROUP BY b.id ORDER BY b.created_at DESC""", fetch=True
            )
            return jsonify(serialize_rows(rows))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        data = request.json or {}
        try:
            conn = database.get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute(
                    """INSERT INTO batches (name, max_students, lecture_days, lecture_time, start_date, end_date, status)
                       VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (data['name'], data.get('max_students', 30),
                     data.get('lecture_days', []), data.get('lecture_time'),
                     data.get('start_date'), data.get('end_date'),
                     data.get('status', 'upcoming'))
                )
                batch_id = cur.fetchone()['id']

                # Assign subjects
                for sub in data.get('subjects', []):
                    cur.execute(
                        "INSERT INTO batch_subjects (batch_id, course_id, faculty_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                        (batch_id, sub.get('course_id'), sub.get('faculty_id'))
                    )
                conn.commit()
                return jsonify({"batch_id": str(batch_id), "message": "Batch created"}), 201
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                conn.close()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/admin/batches/<batch_id>/students', methods=['POST', 'DELETE'])
@role_required('admin', 'super_admin')
def admin_batch_students(batch_id):
    data = request.json or {}
    student_ids = data.get('student_ids', [])
    if not student_ids:
        return jsonify({"error": "No student_ids provided"}), 400
    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        try:
            for sid in student_ids:
                if request.method == 'POST':
                    cur.execute(
                        "INSERT INTO batch_students (batch_id, student_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                        (batch_id, sid)
                    )
                else:
                    cur.execute(
                        "DELETE FROM batch_students WHERE batch_id=%s AND student_id=%s",
                        (batch_id, sid)
                    )
            conn.commit()
            return jsonify({"message": "Batch students updated"})
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/courses', methods=['GET'])
@login_required
def get_courses():
    try:
        rows = database.execute_query("SELECT * FROM courses ORDER BY created_at DESC", fetch=True)
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/courses', methods=['POST'])
@role_required('admin', 'super_admin')
def create_course():
    data = request.json or {}
    try:
        database.execute_query(
            "INSERT INTO courses (name, code, description, duration_weeks, fee_amount, status) VALUES (%s,%s,%s,%s,%s,%s)",
            (data['name'], data.get('code'), data.get('description'),
             data.get('duration_weeks'), data.get('fee_amount', 0), data.get('status', 'active'))
        )
        return jsonify({"message": "Course created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Certificates
@app.route('/api/admin/certificates/generate', methods=['POST'])
@role_required('admin', 'super_admin')
def admin_generate_certificates():
    data = request.json or {}
    batch_id = data.get('batch_id')
    student_ids = data.get('student_ids', [])

    try:
        if batch_id and not student_ids:
            # Generate for all students in batch
            rows = database.execute_query(
                """SELECT s.id, s.first_name, s.last_name,
                   b.name as batch_name
                   FROM students s
                   JOIN batch_students bs ON s.id=bs.student_id
                   JOIN batches b ON bs.batch_id=b.id
                   WHERE b.id=%s""", (batch_id,), fetch=True
            )
        elif student_ids:
            placeholders = ','.join(['%s'] * len(student_ids))
            rows = database.execute_query(
                f"""SELECT s.id, s.first_name, s.last_name,
                    COALESCE(b.name, 'General') as batch_name
                    FROM students s
                    LEFT JOIN batch_students bs ON s.id=bs.student_id AND bs.batch_id=%s
                    LEFT JOIN batches b ON bs.batch_id=b.id
                    WHERE s.id IN ({placeholders})""",
                [batch_id] + student_ids if batch_id else student_ids, fetch=True
            )
        else:
            return jsonify({"error": "Provide batch_id or student_ids"}), 400

        generated = []
        conn = database.get_db_connection()
        cur = conn.cursor()
        try:
            for student in rows:
                student_name = f"{student['first_name']} {student['last_name']}"
                batch_name = student['batch_name'] or 'General'
                cert_num = f"CERT-{date.today().year}-{uuid.uuid4().hex[:6].upper()}"

                # Get course name
                if batch_id:
                    course_rows = database.execute_query(
                        """SELECT c.name FROM courses c
                           JOIN batch_subjects bs ON c.id=bs.course_id
                           WHERE bs.batch_id=%s LIMIT 1""", (batch_id,), fetch=True
                    )
                    course_name = course_rows[0]['name'] if course_rows else 'Course'
                else:
                    course_name = 'Course Completion'

                file_path, cert_num = certificate_generator.generate_certificate(
                    student_name, course_name, batch_name, cert_num
                )

                cur.execute(
                    """INSERT INTO certificates (student_id, batch_id, certificate_number, file_path, is_auto_generated)
                       VALUES (%s, %s, %s, %s, true)
                       ON CONFLICT (certificate_number) DO NOTHING""",
                    (student['id'], batch_id, cert_num, file_path)
                )
                generated.append({"student": student_name, "cert_number": cert_num})

            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return jsonify({"generated": generated, "count": len(generated)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/certificates/upload', methods=['POST'])
@role_required('admin', 'super_admin')
def admin_upload_certificate():
    student_id = request.form.get('student_id')
    batch_id = request.form.get('batch_id')
    if not student_id:
        return jsonify({"error": "student_id required"}), 400
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files['file']
    cert_num = f"CERT-{date.today().year}-{uuid.uuid4().hex[:6].upper()}"
    save_path = os.path.join(UPLOAD_FOLDER, 'certificates', f"{cert_num}_{f.filename}")
    f.save(save_path)

    try:
        database.execute_query(
            "INSERT INTO certificates (student_id, batch_id, certificate_number, file_path, is_auto_generated) VALUES (%s,%s,%s,%s,false)",
            (student_id, batch_id, cert_num, save_path)
        )
        return jsonify({"message": "Certificate uploaded", "cert_number": cert_num}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Admin Notifications
@app.route('/api/admin/notifications', methods=['POST'])
@role_required('admin', 'super_admin', 'faculty', 'admission_staff')
def send_notification():
    data = request.json or {}
    try:
        database.execute_query(
            """INSERT INTO notifications (sender_role, sender_id, target_type, target_id, title, message)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (session.get('role'), session.get('user_id'),
             data.get('target_type', 'all'), data.get('target_id'),
             data['title'], data['message'])
        )
        return jsonify({"message": "Notification sent"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Admin fees
@app.route('/api/admin/fees', methods=['GET'])
@role_required('admin', 'super_admin', 'admission_staff')
def admin_fees():
    try:
        rows = database.execute_query(
            """SELECT f.*, s.first_name, s.last_name, b.name as batch_name
               FROM fees f
               LEFT JOIN students s ON f.student_id=s.id
               LEFT JOIN batches b ON f.batch_id=b.id
               ORDER BY f.created_at DESC""", fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/fees/payment', methods=['POST'])
@role_required('admin', 'super_admin', 'admission_staff')
def record_payment():
    data = request.json or {}
    fee_id = data.get('fee_id')
    amount = float(data.get('amount', 0))
    mode = data.get('payment_mode', 'cash')
    if not fee_id or amount <= 0:
        return jsonify({"error": "Invalid fee_id or amount"}), 400

    try:
        conn = database.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT total_amount, paid_amount FROM fees WHERE id=%s", (fee_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Fee record not found"}), 404
            new_paid = float(row['paid_amount']) + amount
            new_outstanding = max(0.0, float(row['total_amount']) - new_paid)
            new_status = 'paid' if new_outstanding == 0 else 'partial'
            cur.execute(
                "UPDATE fees SET paid_amount=%s, outstanding_amount=%s, status=%s, paid_date=CURRENT_DATE WHERE id=%s",
                (new_paid, new_outstanding, new_status, fee_id)
            )
            cur.execute(
                "INSERT INTO fee_payments (fee_id, amount, payment_mode) VALUES (%s,%s,%s)",
                (fee_id, amount, mode)
            )
            conn.commit()
            return jsonify({"message": "Payment recorded"})
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# API: FACULTY
# ─────────────────────────────────────────

@app.route('/api/faculty/profile', methods=['GET'])
@role_required('faculty')
def faculty_profile():
    try:
        fac_id = session.get('profile_id')
        rows = database.execute_query(
            "SELECT * FROM faculty WHERE id=%s", (fac_id,), fetch=True
        )
        if not rows:
            return jsonify({"error": "Profile not found"}), 404
        return jsonify(serialize_rows(rows)[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/batches', methods=['GET'])
@role_required('faculty')
def faculty_batches():
    try:
        fac_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT DISTINCT b.id, b.name, b.max_students, b.lecture_days,
               b.lecture_time, b.start_date, b.end_date, b.status,
               COUNT(bs2.student_id) as enrolled_count
               FROM batches b
               JOIN batch_subjects bsub ON b.id=bsub.batch_id
               LEFT JOIN batch_students bs2 ON b.id=bs2.batch_id
               WHERE bsub.faculty_id=%s
               GROUP BY b.id ORDER BY b.created_at DESC""",
            (fac_id,), fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/lectures', methods=['GET', 'POST'])
@role_required('faculty')
def faculty_lectures():
    fac_id = session.get('profile_id')
    if request.method == 'GET':
        try:
            rows = database.execute_query(
                """SELECT l.*, b.name as batch_name, c.name as course_name
                   FROM lectures l
                   LEFT JOIN batches b ON l.batch_id=b.id
                   LEFT JOIN courses c ON l.course_id=c.id
                   WHERE l.faculty_id=%s ORDER BY l.scheduled_date DESC, l.created_at DESC""",
                (fac_id,), fetch=True
            )
            return jsonify(serialize_rows(rows))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        data = request.json or {}
        try:
            batch_id = data['batch_id']
            course_id = data.get('course_id')
            title = data['title']
            sched_date = data['scheduled_date']
            sched_time = data['scheduled_time']
            duration = data.get('duration_minutes', 90)

            # Auto-generate Jitsi room name
            room_name = f"institute-{batch_id[:8]}-{uuid.uuid4().hex[:6]}"

            database.execute_query(
                """INSERT INTO lectures (batch_id, faculty_id, course_id, title, scheduled_date, scheduled_time, duration_minutes, jitsi_room)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                (batch_id, fac_id, course_id, title, sched_date, sched_time, duration, room_name)
            )
            return jsonify({"message": "Lecture scheduled", "jitsi_room": room_name}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/lectures/<lecture_id>/start', methods=['PUT'])
@role_required('faculty')
def start_lecture(lecture_id):
    try:
        rows = database.execute_query("SELECT jitsi_room FROM lectures WHERE id=%s", (lecture_id,), fetch=True)
        if not rows:
            return jsonify({"error": "Lecture not found"}), 404
        database.execute_query(
            "UPDATE lectures SET status='ongoing', started_at=NOW() WHERE id=%s", (lecture_id,)
        )
        jitsi_url = f"https://meet.jit.si/{rows[0]['jitsi_room']}"
        return jsonify({"message": "Class started", "jitsi_url": jitsi_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/lectures/<lecture_id>/end', methods=['PUT'])
@role_required('faculty')
def end_lecture(lecture_id):
    try:
        database.execute_query(
            "UPDATE lectures SET status='completed', ended_at=NOW() WHERE id=%s", (lecture_id,)
        )
        return jsonify({"message": "Class ended"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/materials', methods=['GET', 'POST'])
@role_required('faculty')
def faculty_materials():
    fac_id = session.get('profile_id')
    if request.method == 'GET':
        try:
            rows = database.execute_query(
                """SELECT m.*, b.name as batch_name, c.name as course_name
                   FROM materials m
                   LEFT JOIN batches b ON m.batch_id=b.id
                   LEFT JOIN courses c ON m.course_id=c.id
                   WHERE m.faculty_id=%s ORDER BY m.uploaded_at DESC""",
                (fac_id,), fetch=True
            )
            return jsonify(serialize_rows(rows))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        batch_id = request.form.get('batch_id')
        course_id = request.form.get('course_id')
        title = request.form.get('title')
        description = request.form.get('description')

        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        try:
            file_info = file_manager.save_material(request.files['file'])
            database.execute_query(
                """INSERT INTO materials (batch_id, faculty_id, course_id, title, description, file_name, file_path, file_type, file_size_bytes)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (batch_id, fac_id, course_id, title, description,
                 file_info['file_name'], file_info['file_path'],
                 file_info['file_type'], file_info['file_size_bytes'])
            )
            return jsonify({"message": "Material uploaded"}), 201
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/videos', methods=['GET', 'POST'])
@role_required('faculty')
def faculty_videos():
    fac_id = session.get('profile_id')
    if request.method == 'GET':
        try:
            rows = database.execute_query(
                """SELECT v.*, b.name as batch_name, c.name as course_name
                   FROM video_tutorials v
                   LEFT JOIN batches b ON v.batch_id=b.id
                   LEFT JOIN courses c ON v.course_id=c.id
                   WHERE v.faculty_id=%s ORDER BY v.uploaded_at DESC""",
                (fac_id,), fetch=True
            )
            return jsonify(serialize_rows(rows))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        batch_id = request.form.get('batch_id')
        course_id = request.form.get('course_id')
        title = request.form.get('title')
        description = request.form.get('description')

        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        try:
            file_info = file_manager.save_video(request.files['file'])
            database.execute_query(
                """INSERT INTO video_tutorials (batch_id, faculty_id, course_id, title, description, file_name, file_path)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (batch_id, fac_id, course_id, title, description,
                 file_info['file_name'], file_info['file_path'])
            )
            return jsonify({"message": "Video uploaded"}), 201
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/assignments', methods=['GET', 'POST'])
@role_required('faculty')
def faculty_assignments():
    fac_id = session.get('profile_id')
    if request.method == 'GET':
        try:
            rows = database.execute_query(
                """SELECT a.*, b.name as batch_name, c.name as course_name
                   FROM assignments a
                   LEFT JOIN batches b ON a.batch_id=b.id
                   LEFT JOIN courses c ON a.course_id=c.id
                   WHERE a.faculty_id=%s ORDER BY a.created_at DESC""",
                (fac_id,), fetch=True
            )
            return jsonify(serialize_rows(rows))
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        data = request.json or {}
        try:
            database.execute_query(
                """INSERT INTO assignments (faculty_id, course_id, batch_id, title, description, due_date, max_marks)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (fac_id, data.get('course_id'), data.get('batch_id'),
                 data['title'], data.get('description'),
                 data.get('due_date'), data.get('max_marks', 100))
            )
            return jsonify({"message": "Assignment created"}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# Feedback stats for faculty
@app.route('/api/faculty/feedback', methods=['GET'])
@role_required('faculty')
def faculty_feedback_stats():
    fac_id = session.get('profile_id')
    try:
        rows = database.execute_query(
            """SELECT
               AVG(topic_explanation) as avg_topic,
               AVG(subject_knowledge) as avg_knowledge,
               AVG(communication) as avg_communication,
               AVG(punctuality) as avg_punctuality,
               AVG(overall_rating) as avg_overall,
               COUNT(*) as total_responses
               FROM faculty_feedback WHERE faculty_id=%s""",
            (fac_id,), fetch=True
        )
        recent = database.execute_query(
            """SELECT ff.*, s.first_name, s.last_name
               FROM faculty_feedback ff
               JOIN students s ON ff.student_id=s.id
               WHERE ff.faculty_id=%s ORDER BY ff.submitted_at DESC LIMIT 10""",
            (fac_id,), fetch=True
        )
        return jsonify({
            "summary": serialize_rows(rows)[0],
            "recent": serialize_rows(recent)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# API: STUDENT
# ─────────────────────────────────────────

@app.route('/api/student/profile', methods=['GET'])
@role_required('student')
def student_profile():
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT s.*,
               array_agg(DISTINCT b.name) FILTER (WHERE b.name IS NOT NULL) as batches
               FROM students s
               LEFT JOIN batch_students bs ON s.id=bs.student_id
               LEFT JOIN batches b ON bs.batch_id=b.id
               WHERE s.id=%s GROUP BY s.id""",
            (student_id,), fetch=True
        )
        if not rows:
            return jsonify({"error": "Profile not found"}), 404
        return jsonify(serialize_rows(rows)[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/timetable', methods=['GET'])
@role_required('student')
def student_timetable():
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT l.id, l.title, l.scheduled_date, l.scheduled_time, l.duration_minutes,
               l.status, l.jitsi_room,
               b.name as batch_name, b.lecture_days, b.lecture_time as batch_time,
               c.name as course_name,
               f.first_name || ' ' || f.last_name as faculty_name
               FROM lectures l
               JOIN batches b ON l.batch_id=b.id
               JOIN batch_students bs ON b.id=bs.batch_id
               LEFT JOIN courses c ON l.course_id=c.id
               LEFT JOIN faculty f ON l.faculty_id=f.id
               WHERE bs.student_id=%s
               ORDER BY l.scheduled_date ASC, l.scheduled_time ASC""",
            (student_id,), fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/notifications', methods=['GET'])
@role_required('student')
def student_notifications():
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT n.id, n.title, n.message, n.sender_role, n.created_at,
               (nr.id IS NOT NULL) as is_read
               FROM notifications n
               LEFT JOIN notification_reads nr ON n.id=nr.notification_id AND nr.student_id=%s
               WHERE n.target_type='all'
                  OR (n.target_type='student' AND n.target_id=%s)
                  OR (n.target_type='batch' AND n.target_id IN (
                      SELECT batch_id FROM batch_students WHERE student_id=%s
                  ))
               ORDER BY n.created_at DESC LIMIT 50""",
            (student_id, student_id, student_id), fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/notifications/<notif_id>/read', methods=['PUT'])
@role_required('student')
def mark_notification_read(notif_id):
    student_id = session.get('profile_id')
    try:
        database.execute_query(
            "INSERT INTO notification_reads (notification_id, student_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
            (notif_id, student_id)
        )
        return jsonify({"message": "Marked read"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/certificates', methods=['GET'])
@role_required('student')
def student_certificates():
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT c.id, c.certificate_number, c.issue_date, c.is_auto_generated,
               b.name as batch_name, co.name as course_name
               FROM certificates c
               LEFT JOIN batches b ON c.batch_id=b.id
               LEFT JOIN courses co ON c.course_id=co.id
               WHERE c.student_id=%s ORDER BY c.created_at DESC""",
            (student_id,), fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/certificates/<cert_id>/download', methods=['GET'])
@role_required('student')
def download_certificate(cert_id):
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            "SELECT file_path, certificate_number FROM certificates WHERE id=%s AND student_id=%s",
            (cert_id, student_id), fetch=True
        )
        if not rows or not rows[0]['file_path']:
            return jsonify({"error": "Certificate not found"}), 404
        file_path = rows[0]['file_path']
        cert_num = rows[0]['certificate_number']
        if not os.path.isfile(file_path):
            return jsonify({"error": "Certificate file not found on server"}), 404
        return send_file(file_path, as_attachment=True,
                         download_name=f"{cert_num}.pdf",
                         mimetype='application/pdf')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/materials', methods=['GET'])
@role_required('student')
def student_materials():
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT m.id, m.title, m.description, m.file_name, m.file_type,
               m.file_size_bytes, m.uploaded_at,
               b.name as batch_name, c.name as course_name,
               f.first_name || ' ' || f.last_name as uploaded_by
               FROM materials m
               JOIN batches b ON m.batch_id=b.id
               JOIN batch_students bs ON b.id=bs.batch_id
               LEFT JOIN courses c ON m.course_id=c.id
               LEFT JOIN faculty f ON m.faculty_id=f.id
               WHERE bs.student_id=%s ORDER BY m.uploaded_at DESC""",
            (student_id,), fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/materials/<material_id>/download', methods=['GET'])
@role_required('student')
def download_material(material_id):
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT m.file_path, m.file_name FROM materials m
               JOIN batch_students bs ON m.batch_id=bs.batch_id
               WHERE m.id=%s AND bs.student_id=%s""",
            (material_id, student_id), fetch=True
        )
        if not rows:
            return jsonify({"error": "Material not found"}), 404
        file_path = file_manager.get_material_path(rows[0]['file_path'])
        return send_file(file_path, as_attachment=True, download_name=rows[0]['file_name'])
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/videos', methods=['GET'])
@role_required('student')
def student_videos():
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT v.id, v.title, v.description, v.file_name,
               v.duration_seconds, v.uploaded_at,
               b.name as batch_name, c.name as course_name,
               f.first_name || ' ' || f.last_name as uploaded_by
               FROM video_tutorials v
               JOIN batches b ON v.batch_id=b.id
               JOIN batch_students bs ON b.id=bs.batch_id
               LEFT JOIN courses c ON v.course_id=c.id
               LEFT JOIN faculty f ON v.faculty_id=f.id
               WHERE bs.student_id=%s ORDER BY v.uploaded_at DESC""",
            (student_id,), fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/videos/<video_id>/stream', methods=['GET'])
@role_required('student')
def stream_video(video_id):
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT v.file_path, v.file_name FROM video_tutorials v
               JOIN batch_students bs ON v.batch_id=bs.batch_id
               WHERE v.id=%s AND bs.student_id=%s""",
            (video_id, student_id), fetch=True
        )
        if not rows:
            return jsonify({"error": "Video not found"}), 404
        file_path = file_manager.get_video_path(rows[0]['file_path'])
        return send_file(file_path, mimetype='video/mp4', conditional=True)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/class-link/<lecture_id>', methods=['GET'])
@role_required('student')
def student_class_link(lecture_id):
    try:
        student_id = session.get('profile_id')
        rows = database.execute_query(
            """SELECT l.jitsi_room, l.status, l.title, l.scheduled_date, l.scheduled_time
               FROM lectures l
               JOIN batch_students bs ON l.batch_id=bs.batch_id
               WHERE l.id=%s AND bs.student_id=%s""",
            (lecture_id, student_id), fetch=True
        )
        if not rows:
            return jsonify({"error": "Class not found or not in your batch"}), 404
        row = rows[0]
        if row['status'] != 'ongoing':
            return jsonify({"error": "Class is not currently live", "status": row['status']}), 400
        return jsonify({
            "jitsi_url": f"https://meet.jit.si/{row['jitsi_room']}",
            "title": row['title'],
            "status": row['status']
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/feedback', methods=['POST'])
@role_required('student')
def submit_feedback():
    data = request.json or {}
    student_id = session.get('profile_id')
    try:
        database.execute_query(
            """INSERT INTO faculty_feedback
               (student_id, faculty_id, batch_id, week_number,
                topic_explanation, subject_knowledge, communication, punctuality, overall_rating, comments)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (student_id, faculty_id, week_number) DO UPDATE SET
               topic_explanation=EXCLUDED.topic_explanation,
               subject_knowledge=EXCLUDED.subject_knowledge,
               communication=EXCLUDED.communication,
               punctuality=EXCLUDED.punctuality,
               overall_rating=EXCLUDED.overall_rating,
               comments=EXCLUDED.comments""",
            (student_id, data['faculty_id'], data.get('batch_id'),
             data.get('week_number', 1),
             data.get('topic_explanation', 3),
             data.get('subject_knowledge', 3),
             data.get('communication', 3),
             data.get('punctuality', 3),
             data.get('overall_rating', 3),
             data.get('comments'))
        )
        return jsonify({"message": "Feedback submitted. Thank you!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/feedback/pending', methods=['GET'])
@role_required('student')
def feedback_pending():
    """Check if student has pending weekly feedback to submit."""
    student_id = session.get('profile_id')
    try:
        from datetime import datetime
        current_week = datetime.now().isocalendar()[1]
        rows = database.execute_query(
            """SELECT f.id as faculty_id, f.first_name, f.last_name,
               b.id as batch_id, b.name as batch_name
               FROM faculty f
               JOIN batch_subjects bsub ON f.id=bsub.faculty_id
               JOIN batch_students bs ON bsub.batch_id=bs.batch_id
               JOIN batches b ON bsub.batch_id=b.id
               WHERE bs.student_id=%s
               AND NOT EXISTS (
                   SELECT 1 FROM faculty_feedback ff
                   WHERE ff.student_id=%s AND ff.faculty_id=f.id AND ff.week_number=%s
               )""",
            (student_id, student_id, current_week), fetch=True
        )
        return jsonify({"pending_feedback": serialize_rows(rows), "current_week": current_week})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/inquiry', methods=['POST'])
def submit_inquiry():
    data = request.json or {}
    required = ['first_name', 'last_name', 'mobile']
    if not all(data.get(f) for f in required):
        return jsonify({"error": "first_name, last_name, mobile are required"}), 400
    try:
        database.execute_query(
            """INSERT INTO inquiries (first_name, middle_name, last_name, city, mobile,
               father_occupation, father_mobile, mother_occupation, mother_mobile,
               reference_source, reference_other, course_interest)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (data['first_name'], data.get('middle_name'), data['last_name'],
             data.get('city'), data['mobile'],
             data.get('father_occupation'), data.get('father_mobile'),
             data.get('mother_occupation'), data.get('mother_mobile'),
             data.get('reference_source'), data.get('reference_other'),
             data.get('course_interest'))
        )
        return jsonify({"message": "Inquiry submitted successfully! We will contact you shortly."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/student/fees', methods=['GET'])
@role_required('student')
def student_fees():
    student_id = session.get('profile_id')
    try:
        rows = database.execute_query(
            "SELECT * FROM fees WHERE student_id=%s ORDER BY created_at DESC",
            (student_id,), fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# API: ADMISSION STAFF
# ─────────────────────────────────────────

FUNNEL_STAGES = ['lead', 'seminar', 'bootcamp', 'counselling',
                 'follow_up_1', 'follow_up_2', 'follow_up_3',
                 'follow_up_4', 'follow_up_5', 'admission']

@app.route('/api/admission/inquiries', methods=['GET'])
@role_required('admission_staff', 'admin', 'super_admin')
def admission_inquiries():
    try:
        stage = request.args.get('stage')
        search = request.args.get('search', '')
        query = """SELECT i.*,
                   u.username as assigned_username
                   FROM inquiries i
                   LEFT JOIN users u ON i.assigned_to=u.id
                   WHERE 1=1"""
        params = []
        if stage and stage in FUNNEL_STAGES:
            query += " AND i.funnel_stage=%s"
            params.append(stage)
        if search:
            query += " AND (i.first_name ILIKE %s OR i.last_name ILIKE %s OR i.mobile ILIKE %s)"
            params.extend([f'%{search}%', f'%{search}%', f'%{search}%'])
        query += " ORDER BY i.created_at DESC"
        rows = database.execute_query(query, params or None, fetch=True)
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admission/inquiries', methods=['POST'])
@role_required('admission_staff', 'admin', 'super_admin')
def create_inquiry():
    data = request.json or {}
    try:
        database.execute_query(
            """INSERT INTO inquiries (first_name, middle_name, last_name, city, mobile,
               father_occupation, father_mobile, mother_occupation, mother_mobile,
               reference_source, reference_other, course_interest, funnel_stage, notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (data['first_name'], data.get('middle_name'), data['last_name'],
             data.get('city'), data['mobile'],
             data.get('father_occupation'), data.get('father_mobile'),
             data.get('mother_occupation'), data.get('mother_mobile'),
             data.get('reference_source'), data.get('reference_other'),
             data.get('course_interest'), data.get('funnel_stage', 'lead'),
             data.get('notes'))
        )
        return jsonify({"message": "Inquiry created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admission/inquiries/<inquiry_id>/stage', methods=['PUT'])
@role_required('admission_staff', 'admin', 'super_admin')
def update_inquiry_stage(inquiry_id):
    data = request.json or {}
    new_stage = data.get('stage')
    if new_stage not in FUNNEL_STAGES:
        return jsonify({"error": f"Invalid stage. Must be one of: {FUNNEL_STAGES}"}), 400
    try:
        database.execute_query(
            "UPDATE inquiries SET funnel_stage=%s, updated_at=NOW() WHERE id=%s",
            (new_stage, inquiry_id)
        )
        return jsonify({"message": "Stage updated", "new_stage": new_stage})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admission/inquiries/<inquiry_id>/notes', methods=['PUT'])
@role_required('admission_staff', 'admin', 'super_admin')
def update_inquiry_notes(inquiry_id):
    data = request.json or {}
    try:
        database.execute_query(
            "UPDATE inquiries SET notes=%s, updated_at=NOW() WHERE id=%s",
            (data.get('notes'), inquiry_id)
        )
        return jsonify({"message": "Notes updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admission/funnel-stats', methods=['GET'])
@role_required('admission_staff', 'admin', 'super_admin')
def funnel_stats():
    try:
        rows = database.execute_query(
            "SELECT funnel_stage, COUNT(*) as count FROM inquiries GROUP BY funnel_stage",
            fetch=True
        )
        stats = {stage: 0 for stage in FUNNEL_STAGES}
        for row in rows:
            stats[row['funnel_stage']] = row['count']
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admission/reports', methods=['GET'])
@role_required('admission_staff', 'admin', 'super_admin')
def admission_reports():
    report_type = request.args.get('type', 'inquiries')
    fmt = request.args.get('format', 'json')

    try:
        if report_type == 'inquiries':
            rows = database.execute_query(
                "SELECT first_name, last_name, mobile, city, course_interest, funnel_stage, created_at FROM inquiries ORDER BY created_at DESC",
                fetch=True
            )
        elif report_type == 'fees':
            rows = database.execute_query(
                "SELECT student_name, course_name, total_amount, paid_amount, outstanding_amount, status, due_date FROM fees ORDER BY due_date",
                fetch=True
            )
        elif report_type == 'students':
            rows = database.execute_query(
                "SELECT first_name, last_name, email, phone, city, enrollment_status, created_at FROM students ORDER BY created_at DESC",
                fetch=True
            )
        else:
            return jsonify({"error": "Invalid report type"}), 400

        rows = serialize_rows(rows)

        if fmt == 'csv':
            output = io.StringIO()
            if rows:
                writer = csv.DictWriter(output, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename={report_type}_report.csv'
            return response

        return jsonify({"data": rows, "count": len(rows)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admission/students/<student_id>/revoke', methods=['PUT'])
@role_required('admission_staff', 'admin', 'super_admin')
def revoke_student(student_id):
    try:
        database.execute_query(
            "UPDATE students SET enrollment_status='revoked' WHERE id=%s", (student_id,)
        )
        database.execute_query(
            "UPDATE users SET is_active=false WHERE id=(SELECT user_id FROM students WHERE id=%s)",
            (student_id,)
        )
        return jsonify({"message": "Student access revoked"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# SHARED: All batches (for dropdowns)
# ─────────────────────────────────────────
@app.route('/api/batches', methods=['GET'])
@login_required
def all_batches():
    try:
        rows = database.execute_query(
            "SELECT id, name, status, start_date FROM batches ORDER BY name", fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/students/list', methods=['GET'])
@role_required('admin', 'super_admin', 'admission_staff')
def students_list():
    try:
        rows = database.execute_query(
            "SELECT id, first_name, last_name, email, phone, enrollment_status FROM students ORDER BY first_name",
            fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/faculty/list', methods=['GET'])
@login_required
def faculty_list():
    try:
        rows = database.execute_query(
            "SELECT id, first_name, last_name, email, specialization FROM faculty WHERE is_active=true ORDER BY first_name",
            fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# API: SUPER ADMIN (comprehensive)
# ─────────────────────────────────────────

@app.route('/api/super_admin/dashboard', methods=['GET'])
@app.route('/api/super-admin/dashboard', methods=['GET'])
@role_required('super_admin')
def sa_full_dashboard():
    try:
        users = database.execute_query(
            "SELECT COUNT(*) as total, COUNT(CASE WHEN is_active THEN 1 END) as active FROM users",
            fetch=True
        )[0]
        by_role_rows = database.execute_query(
            "SELECT role, COUNT(*) as cnt FROM users GROUP BY role", fetch=True
        )
        by_role = {r['role']: r['cnt'] for r in by_role_rows}
        batches = database.execute_query(
            "SELECT COUNT(CASE WHEN status='active' THEN 1 END) as active FROM batches", fetch=True
        )[0]
        fees = database.execute_query(
            "SELECT COALESCE(SUM(paid_amount),0) as rev, COALESCE(SUM(outstanding_amount),0) as out FROM fees",
            fetch=True
        )[0]
        certs = database.execute_query("SELECT COUNT(*) as total FROM certificates", fetch=True)[0]
        return jsonify({
            "total_users": users['total'],
            "active_users": users['active'],
            "users_by_role": by_role,
            "active_batches": batches['active'],
            "total_revenue": float(fees['rev']),
            "total_outstanding": float(fees['out']),
            "total_certs": certs['total'],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/users', methods=['GET'])
@app.route('/api/super-admin/all-users', methods=['GET'])
@role_required('super_admin')
def sa_all_users():
    try:
        rows = database.execute_query(
            "SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC",
            fetch=True
        )
        return jsonify(serialize_rows(rows))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/users', methods=['POST'])
@role_required('super_admin')
def sa_create_user_v2():
    data = request.json or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', '')
    if not all([username, password, role]):
        return jsonify({"error": "Username, password and role are required"}), 400
    if role not in ('admin', 'faculty', 'admission_staff', 'student', 'super_admin'):
        return jsonify({"error": "Invalid role"}), 400
    try:
        pw_hash = hash_password(password)
        conn = database.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (%s,%s,%s,%s) RETURNING id",
                (username, email or None, pw_hash, role)
            )
            user_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"id": str(user_id), "message": "User created"}), 201
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/users/<user_id>/toggle', methods=['PUT'])
@role_required('super_admin')
def sa_toggle_user_v2(user_id):
    try:
        data = request.json or {}
        action = data.get('action', 'toggle')
        if action == 'enable':
            new_status = True
        elif action == 'disable':
            new_status = False
        else:
            rows = database.execute_query("SELECT is_active FROM users WHERE id=%s", (user_id,), fetch=True)
            if not rows:
                return jsonify({"error": "User not found"}), 404
            new_status = not rows[0]['is_active']
        database.execute_query("UPDATE users SET is_active=%s WHERE id=%s", (new_status, user_id))
        return jsonify({"is_active": new_status, "message": "Status updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/users/<user_id>/reset-password', methods=['PUT'])
@role_required('super_admin')
def sa_reset_password(user_id):
    data = request.json or {}
    new_password = data.get('new_password', '').strip()
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    try:
        pw_hash = hash_password(new_password)
        database.execute_query("UPDATE users SET password_hash=%s WHERE id=%s", (pw_hash, user_id))
        return jsonify({"message": "Password reset successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/fees', methods=['GET'])
@role_required('super_admin')
def sa_all_fees():
    try:
        fees = database.execute_query(
            """SELECT f.id, f.total_amount, f.paid_amount, f.outstanding_amount,
               f.status, f.due_date, f.created_at,
               f.student_name, f.course_name
               FROM fees f
               ORDER BY f.created_at DESC""",
            fetch=True
        )
        summary = database.execute_query(
            """SELECT COALESCE(SUM(total_amount),0) as total_billed,
               COALESCE(SUM(paid_amount),0) as total_collected,
               COALESCE(SUM(outstanding_amount),0) as total_outstanding
               FROM fees""", fetch=True
        )[0]
        return jsonify({
            "fees": serialize_rows(fees),
            "summary": {
                "total_billed": float(summary['total_billed']),
                "total_collected": float(summary['total_collected']),
                "total_outstanding": float(summary['total_outstanding']),
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/reports', methods=['GET'])
@role_required('super_admin')
def sa_reports():
    try:
        stages = database.execute_query(
            "SELECT funnel_stage as stage, COUNT(*) as cnt FROM inquiries GROUP BY funnel_stage",
            fetch=True
        )
        funnel_stages = {r['stage']: r['cnt'] for r in stages}
        monthly = database.execute_query(
            """SELECT TO_CHAR(date_trunc('month', created_at), 'Mon YYYY') as month,
               COALESCE(SUM(paid_amount),0) as collected
               FROM fees
               GROUP BY date_trunc('month', created_at)
               ORDER BY date_trunc('month', created_at) DESC
               LIMIT 6""",
            fetch=True
        )
        return jsonify({
            "funnel_stages": funnel_stages,
            "fee_monthly": [{"month": r['month'], "collected": float(r['collected'])} for r in monthly]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/export/<data_type>', methods=['GET'])
@role_required('super_admin')
def sa_export(data_type):
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        if data_type == 'students':
            rows = database.execute_query(
                "SELECT first_name, last_name, email, phone, city, enrollment_status, created_at FROM students ORDER BY created_at",
                fetch=True
            )
            writer.writerow(['First Name', 'Last Name', 'Email', 'Phone', 'City', 'Status', 'Enrolled On'])
            for r in rows:
                writer.writerow([r['first_name'], r['last_name'], r['email'], r['phone'] or '', r['city'] or '', r['enrollment_status'], r['created_at']])
        elif data_type == 'fees':
            rows = database.execute_query(
                """SELECT f.student_name as student, f.course_name as course,
                   f.total_amount, f.paid_amount, f.outstanding_amount, f.status, f.due_date
                   FROM fees f
                   ORDER BY f.created_at""",
                fetch=True
            )
            writer.writerow(['Student', 'Course', 'Total', 'Paid', 'Outstanding', 'Status', 'Due Date'])
            for r in rows:
                writer.writerow([r['student'], r['course'] or '', r['total_amount'], r['paid_amount'], r['outstanding_amount'], r['status'], r['due_date']])
        else:
            return jsonify({"error": "Unknown export type"}), 400
        output.seek(0)
        resp = make_response(output.getvalue())
        resp.headers['Content-Disposition'] = f'attachment; filename={data_type}_export.csv'
        resp.headers['Content-Type'] = 'text/csv'
        return resp
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/super_admin/audit', methods=['GET'])
@role_required('super_admin')
def sa_audit_log():
    # Simple synthesized audit from DB activity
    try:
        recent_certs = database.execute_query(
            """SELECT u.username as user, u.role, 'CERTIFICATE_ISSUED' as action, cert.certificate_number as details, cert.created_at
               FROM certificates cert JOIN users u ON u.role='admin' LIMIT 5""",
            fetch=True
        )
        recent_students = database.execute_query(
            """SELECT 'system' as user, 'admin' as role, 'STUDENT_ENROLLED' as action, first_name || ' ' || last_name as details, created_at
               FROM students ORDER BY created_at DESC LIMIT 10""",
            fetch=True
        )
        logs = sorted(
            serialize_rows(recent_certs) + serialize_rows(recent_students),
            key=lambda x: x.get('created_at', ''),
            reverse=True
        )[:20]
        return jsonify({"logs": logs})
    except Exception as e:
        return jsonify({"logs": [], "note": str(e)})

@app.route('/api/admission/dashboard', methods=['GET'])
@role_required('admission_staff', 'admin', 'super_admin')
def admission_dashboard():
    try:
        total = database.execute_query("SELECT COUNT(*) as cnt FROM inquiries", fetch=True)[0]['cnt']
        admitted = database.execute_query(
            "SELECT COUNT(*) as cnt FROM inquiries WHERE funnel_stage='admission'", fetch=True
        )[0]['cnt']
        in_funnel = database.execute_query(
            "SELECT COUNT(*) as cnt FROM inquiries WHERE funnel_stage NOT IN ('admission','lost')", fetch=True
        )[0]['cnt']
        try:
            lost = database.execute_query(
                "SELECT COUNT(*) as cnt FROM inquiries WHERE funnel_stage='lost'", fetch=True
            )[0]['cnt']
        except:
            lost = 0
        stage_rows = database.execute_query(
            "SELECT funnel_stage, COUNT(*) as cnt FROM inquiries GROUP BY funnel_stage", fetch=True
        )
        by_stage = {r['funnel_stage']: r['cnt'] for r in stage_rows}
        return jsonify({
            "total": total, "admitted": admitted,
            "in_funnel": in_funnel, "lost": lost,
            "by_stage": by_stage
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admission/reports/export', methods=['GET'])
@role_required('admission_staff', 'admin', 'super_admin')
def admission_export():
    try:
        rows = database.execute_query(
            """SELECT first_name, last_name, mobile, city, course_interest,
               reference_source, funnel_stage, created_at FROM inquiries ORDER BY created_at""",
            fetch=True
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['First Name', 'Last Name', 'Mobile', 'City', 'Course Interest', 'Reference', 'Stage', 'Date'])
        for r in rows:
            writer.writerow([r['first_name'], r['last_name'], r['mobile'], r['city'] or '', r['course_interest'] or '', r['reference_source'] or '', r['funnel_stage'], r['created_at']])
        output.seek(0)
        resp = make_response(output.getvalue())
        resp.headers['Content-Disposition'] = 'attachment; filename=admissions_export.csv'
        resp.headers['Content-Type'] = 'text/csv'
        return resp
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# SERVE REACT SPA (catch-all for frontend routes)
# ─────────────────────────────────────────
REACT_DIST = os.path.join(os.path.dirname(__file__), '..', 'react-frontend', 'dist')

@app.route('/assets/<path:filename>')
def react_assets(filename):
    return send_from_directory(os.path.join(REACT_DIST, 'assets'), filename)

@app.route('/favicon.svg')
def react_favicon():
    return send_from_directory(REACT_DIST, 'favicon.svg')

@app.route('/icons.svg')
def react_icons():
    return send_from_directory(REACT_DIST, 'icons.svg')

# SPA catch-all: serve index.html for unmatched routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def react_spa(path):
    if path.startswith('api/') or path.startswith('portal/'):
        return jsonify({"error": "Not found"}), 404
    spa_file = os.path.join(REACT_DIST, 'index.html')
    if os.path.isfile(spa_file):
        return send_from_directory(REACT_DIST, 'index.html')
    return app.send_static_file('index.html')

# ─────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)

