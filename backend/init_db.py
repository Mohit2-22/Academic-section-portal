import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from urllib.parse import urlparse
import hashlib

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

SCHEMA_SQL = """
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- USERS (central auth for all 5 roles)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin','admin','faculty','admission_staff','student')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- FACULTY PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  specialization text,
  qualification text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- STUDENTS (extended)
-- ==========================================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  city text,
  father_occupation text,
  father_phone text,
  mother_occupation text,
  mother_phone text,
  reference_source text CHECK (reference_source IN ('newspaper','social_media','friends_relatives','other')),
  reference_other text,
  enrollment_status text DEFAULT 'active' CHECK (enrollment_status IN ('active','completed','dropped','suspended','revoked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- COURSES / SUBJECTS
-- ==========================================
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  duration_weeks integer,
  fee_amount numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','completed','upcoming')),
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- BATCHES
-- ==========================================
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  max_students integer DEFAULT 30,
  lecture_days text[],       -- e.g. ARRAY['Monday','Wednesday','Friday']
  lecture_time text,         -- e.g. '04:00 PM - 06:00 PM'
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active','completed','upcoming')),
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- BATCH <-> STUDENTS (many-to-many)
-- ==========================================
CREATE TABLE IF NOT EXISTS batch_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, student_id)
);

-- ==========================================
-- BATCH <-> SUBJECTS (many-to-many)
-- ==========================================
CREATE TABLE IF NOT EXISTS batch_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL,
  UNIQUE(batch_id, course_id)
);

-- ==========================================
-- LECTURES (scheduled by faculty per batch)
-- ==========================================
CREATE TABLE IF NOT EXISTS lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL,
  duration_minutes integer DEFAULT 90,
  jitsi_room text,           -- auto-generated Jitsi room name
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- MATERIALS (uploaded by faculty)
-- ==========================================
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  uploaded_at timestamptz DEFAULT now()
);

-- ==========================================
-- VIDEO TUTORIALS (uploaded by faculty)
-- ==========================================
CREATE TABLE IF NOT EXISTS video_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  thumbnail_path text,
  duration_seconds integer,
  uploaded_at timestamptz DEFAULT now()
);

-- ==========================================
-- ASSIGNMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid REFERENCES faculty(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  max_marks integer DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- STUDENT ASSIGNMENTS (submissions)
-- ==========================================
CREATE TABLE IF NOT EXISTS student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_text text,
  file_path text,
  submitted_at timestamptz,
  marks_obtained integer,
  feedback text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','submitted','graded')),
  UNIQUE(assignment_id, student_id)
);

-- ==========================================
-- CERTIFICATES
-- ==========================================
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  certificate_number text UNIQUE,
  issue_date date DEFAULT CURRENT_DATE,
  file_path text,
  is_auto_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_role text NOT NULL,
  sender_id uuid,
  target_type text NOT NULL CHECK (target_type IN ('all','batch','student')),
  target_id uuid,            -- batch_id or student_id based on target_type
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- NOTIFICATION READS (per student)
-- ==========================================
CREATE TABLE IF NOT EXISTS notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, student_id)
);

-- ==========================================
-- FACULTY FEEDBACK (weekly by students)
-- ==========================================
CREATE TABLE IF NOT EXISTS faculty_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  week_number integer,
  topic_explanation integer CHECK (topic_explanation BETWEEN 1 AND 5),
  subject_knowledge integer CHECK (subject_knowledge BETWEEN 1 AND 5),
  communication integer CHECK (communication BETWEEN 1 AND 5),
  punctuality integer CHECK (punctuality BETWEEN 1 AND 5),
  overall_rating integer CHECK (overall_rating BETWEEN 1 AND 5),
  comments text,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(student_id, faculty_id, week_number)
);

-- ==========================================
-- INQUIRIES (detailed inquiry form)
-- ==========================================
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  city text,
  mobile text NOT NULL,
  father_occupation text,
  father_mobile text,
  mother_occupation text,
  mother_mobile text,
  reference_source text CHECK (reference_source IN ('newspaper','social_media','friends_relatives','other')),
  reference_other text,
  course_interest text,
  funnel_stage text DEFAULT 'lead' CHECK (
    funnel_stage IN ('lead','seminar','bootcamp','counselling',
                     'follow_up_1','follow_up_2','follow_up_3',
                     'follow_up_4','follow_up_5','admission')
  ),
  notes text,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  converted_student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- FEES (linked to students)
-- ==========================================
CREATE TABLE IF NOT EXISTS fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  student_name text NOT NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  course_name text,
  total_amount numeric(10,2) NOT NULL,
  paid_amount numeric(10,2) DEFAULT 0,
  outstanding_amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue')),
  paid_date date,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- FEE PAYMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id uuid NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','card','transfer','cheque','upi')),
  reference_number text,
  created_at timestamptz DEFAULT now()
);
"""

SEED_SQL_PARTS = []

def build_seed_data(hash_fn):
    pw_super = hash_fn("superadmin123")
    pw_admin = hash_fn("admin123")
    pw_faculty1 = hash_fn("faculty123")
    pw_faculty2 = hash_fn("faculty456")
    pw_staff = hash_fn("staff123")
    pw_student1 = hash_fn("student123")
    pw_student2 = hash_fn("student456")

    return f"""
-- USERS
INSERT INTO users (username, email, password_hash, role) VALUES
  ('superadmin', 'superadmin@institute.com', '{pw_super}', 'super_admin'),
  ('admin1', 'admin@institute.com', '{pw_admin}', 'admin'),
  ('dr_amit', 'amit.kumar@institute.com', '{pw_faculty1}', 'faculty'),
  ('sarah_j', 'sarah.johnson@institute.com', '{pw_faculty2}', 'faculty'),
  ('admission1', 'admission@institute.com', '{pw_staff}', 'admission_staff'),
  ('aman.kumar', 'aman.kumar@gmail.com', '{pw_student1}', 'student'),
  ('priya.shah', 'priya.shah@gmail.com', '{pw_student2}', 'student')
ON CONFLICT (username) DO NOTHING;

-- FACULTY (link user_id via subquery)
INSERT INTO faculty (user_id, first_name, last_name, email, phone, specialization, qualification)
SELECT u.id, 'Amit', 'Kumar', 'amit.kumar@institute.com', '9911223344', 'Java & Python', 'M.Tech CS'
FROM users u WHERE u.username = 'dr_amit'
ON CONFLICT (email) DO NOTHING;

INSERT INTO faculty (user_id, first_name, last_name, email, phone, specialization, qualification)
SELECT u.id, 'Sarah', 'Johnson', 'sarah.johnson@institute.com', '9922334455', 'Web Design & React', 'B.Tech IT'
FROM users u WHERE u.username = 'sarah_j'
ON CONFLICT (email) DO NOTHING;

-- COURSES
INSERT INTO courses (name, code, description, duration_weeks, fee_amount, status) VALUES
  ('Java Programming', 'JAVA101', 'Core Java, OOP, Collections, File I/O', 8, 5000.00, 'active'),
  ('Python Pro', 'PY201', 'Python basics to advanced, data science intro', 12, 8000.00, 'active'),
  ('Web Design Masterclass', 'WEB301', 'HTML, CSS, JavaScript, React basics', 10, 7500.00, 'active'),
  ('Database Management (SQL)', 'SQL101', 'MySQL, PostgreSQL, query optimization', 6, 4000.00, 'active'),
  ('C++ Programming', 'CPP101', 'C++ fundamentals, STL, OOP', 8, 5000.00, 'upcoming')
ON CONFLICT DO NOTHING;

-- BATCHES
INSERT INTO batches (name, max_students, lecture_days, lecture_time, start_date, end_date, status) VALUES
  ('Batch A - Java Morning', 25, ARRAY['Monday','Wednesday','Friday'], '10:00 AM - 12:00 PM', '2026-01-15', '2026-03-15', 'active'),
  ('Batch B - Java Evening', 25, ARRAY['Tuesday','Thursday','Saturday'], '05:00 PM - 07:00 PM', '2026-02-01', '2026-03-31', 'active'),
  ('Batch C - Python Pro', 30, ARRAY['Monday','Wednesday','Friday'], '04:00 PM - 06:00 PM', '2026-01-20', '2026-04-20', 'active'),
  ('Batch D - Web Design', 20, ARRAY['Tuesday','Thursday'], '02:00 PM - 05:00 PM', '2026-02-10', '2026-04-30', 'upcoming')
ON CONFLICT DO NOTHING;

-- STUDENTS (link user_id, insert 2)
INSERT INTO students (user_id, first_name, last_name, email, phone, city, enrollment_status)
SELECT u.id, 'Aman', 'Kumar', 'aman.kumar@gmail.com', '9876543210', 'Mumbai', 'active'
FROM users u WHERE u.username = 'aman.kumar'
ON CONFLICT (email) DO NOTHING;

INSERT INTO students (user_id, first_name, last_name, email, phone, city, enrollment_status)
SELECT u.id, 'Priya', 'Shah', 'priya.shah@gmail.com', '9876543211', 'Pune', 'active'
FROM users u WHERE u.username = 'priya.shah'
ON CONFLICT (email) DO NOTHING;

-- Seed some inquiries
INSERT INTO inquiries (first_name, last_name, mobile, city, reference_source, course_interest, funnel_stage) VALUES
  ('Harsha', 'Verma', '9800001111', 'Delhi', 'social_media', 'Python Pro', 'lead'),
  ('Neha', 'Gupta', '9800002222', 'Mumbai', 'newspaper', 'Java Programming', 'seminar'),
  ('Deepak', 'Singh', '9800003333', 'Bangalore', 'friends_relatives', 'Web Design Masterclass', 'bootcamp'),
  ('Anjali', 'Iyer', '9800004444', 'Chennai', 'social_media', 'Java Programming', 'counselling'),
  ('Rohit', 'Mehta', '9800005555', 'Hyderabad', 'newspaper', 'Python Pro', 'follow_up_1'),
  ('Kavita', 'Nair', '9800006666', 'Kochi', 'friends_relatives', 'Database Management (SQL)', 'follow_up_2'),
  ('Sanjay', 'Patil', '9800007777', 'Pune', 'social_media', 'C++ Programming', 'admission')
ON CONFLICT DO NOTHING;
"""

def create_database_if_not_exists():
    try:
        parsed = urlparse(DATABASE_URL)
        target_db = parsed.path.lstrip('/')
        default_db_url = DATABASE_URL.replace(parsed.path, '/postgres')
        default_conn = psycopg2.connect(default_db_url)
        default_conn.autocommit = True
        default_cur = default_conn.cursor()
        default_cur.execute(f"SELECT 1 FROM pg_database WHERE datname='{target_db}';")
        exists = default_cur.fetchone()
        if not exists:
            print(f"Creating database '{target_db}'...")
            default_cur.execute(f"CREATE DATABASE {target_db};")
        else:
            print(f"Database '{target_db}' exists.")
        default_cur.close()
        default_conn.close()
    except Exception as e:
        print(f"Notice: {e}")

def init_db():
    create_database_if_not_exists()
    print(f"\nConnecting to: {DATABASE_URL}")
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        cur = conn.cursor()

        print("Creating tables...")
        cur.execute(SCHEMA_SQL)
        conn.commit()
        print("Tables created.")

        # Check if already seeded
        cur.execute("SELECT COUNT(*) as cnt FROM users;")
        row = cur.fetchone()
        count = row['cnt'] if row else 0

        if count == 0:
            print("Seeding initial data...")
            seed_sql = build_seed_data(hash_password)
            cur.execute(seed_sql)
            conn.commit()
            print("Seed data inserted.")
        else:
            print(f"Database already has {count} users, skipping seed.")

        # Link batch_students: assign Aman to Batch A, Priya to Batch C
        cur.execute("""
            INSERT INTO batch_students (batch_id, student_id)
            SELECT b.id, s.id FROM batches b, students s
            WHERE b.name = 'Batch A - Java Morning' AND s.email = 'aman.kumar@gmail.com'
            ON CONFLICT DO NOTHING;
        """)
        cur.execute("""
            INSERT INTO batch_students (batch_id, student_id)
            SELECT b.id, s.id FROM batches b, students s
            WHERE b.name = 'Batch C - Python Pro' AND s.email = 'priya.shah@gmail.com'
            ON CONFLICT DO NOTHING;
        """)
        # Link batch_subjects
        cur.execute("""
            INSERT INTO batch_subjects (batch_id, course_id, faculty_id)
            SELECT b.id, c.id, f.id FROM batches b, courses c, faculty f
            WHERE b.name = 'Batch A - Java Morning' AND c.code = 'JAVA101' AND f.email = 'amit.kumar@institute.com'
            ON CONFLICT DO NOTHING;
        """)
        cur.execute("""
            INSERT INTO batch_subjects (batch_id, course_id, faculty_id)
            SELECT b.id, c.id, f.id FROM batches b, courses c, faculty f
            WHERE b.name = 'Batch C - Python Pro' AND c.code = 'PY201' AND f.email = 'amit.kumar@institute.com'
            ON CONFLICT DO NOTHING;
        """)

        # Seed a lecture for Batch A
        cur.execute("""
            INSERT INTO lectures (batch_id, faculty_id, course_id, title, scheduled_date, scheduled_time, jitsi_room, status)
            SELECT b.id, f.id, c.id,
                   'Java OOP & Polymorphism',
                   CURRENT_DATE + INTERVAL '1 day',
                   '10:00 AM - 12:00 PM',
                   'institute-batch-a-java-' || to_char(CURRENT_DATE + INTERVAL '1 day', 'YYYY-MM-DD'),
                   'scheduled'
            FROM batches b, faculty f, courses c
            WHERE b.name = 'Batch A - Java Morning'
              AND f.email = 'amit.kumar@institute.com'
              AND c.code = 'JAVA101'
            ON CONFLICT DO NOTHING;
        """)

        # Seed fees for Aman
        cur.execute("""
            INSERT INTO fees (student_id, student_name, batch_id, course_name, total_amount, paid_amount, outstanding_amount, due_date, status, paid_date)
            SELECT s.id, s.first_name || ' ' || s.last_name, b.id, 'Java Programming',
                   5000.00, 5000.00, 0.00, CURRENT_DATE + INTERVAL '30 days', 'paid', CURRENT_DATE - INTERVAL '10 days'
            FROM students s, batches b
            WHERE s.email = 'aman.kumar@gmail.com' AND b.name = 'Batch A - Java Morning'
            ON CONFLICT DO NOTHING;
        """)

        # Seed a notification
        cur.execute("""
            INSERT INTO notifications (sender_role, target_type, title, message)
            VALUES ('admin', 'all', 'Welcome to the Institute Portal!',
                    'Your student portal is now active. You can view your timetable, join online classes, and download materials.')
            ON CONFLICT DO NOTHING;
        """)

        conn.commit()
        print("All relational links and seed notifications created.")
        cur.close()
        conn.close()
        print("\n[OK] Database initialization complete!")
        print("\nLogin Credentials:")
        print("  Super Admin : superadmin / superadmin123")
        print("  Admin       : admin1     / admin123")
        print("  Faculty     : dr_amit    / faculty123")
        print("  Faculty     : sarah_j    / faculty456")
        print("  Adm. Staff  : admission1 / staff123")
        print("  Student     : aman.kumar / student123")
        print("  Student     : priya.shah / student456")

    except Exception as e:
        print(f"Error: {e}")
        raise

if __name__ == "__main__":
    init_db()
