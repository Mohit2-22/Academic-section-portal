import {
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  MessageSquare,
  Users,
  ClipboardList,
  MonitorPlay,
  FileDown,
  Bell,
  BadgeDollarSign,
  School,
  Activity,
  ChartColumn,
  Layers3,
  Video,
  PenSquare,
  FileClock,
  NotebookText,
  ChartNoAxesCombined,
  House,
  CircleDollarSign,
  UserRoundCog,
  UserCog,
  Newspaper,
  Sparkles,
  Wallet,
  TimerReset,
  GraduationCap as GradCap,
} from 'lucide-react';

export const roleMeta = {
  student: {
    label: 'Student',
    accent: 'var(--accent-student)',
    accentDark: '#4F46E5',
    loginPath: '/',
    title: 'Student Portal',
    shortTitle: 'Student',
    accentClass: 'badge-info',
    icon: GraduationCap,
    searchPlaceholder: 'Search timetable, materials, notifications...',
  },
  faculty: {
    label: 'Faculty',
    accent: 'var(--accent-faculty)',
    accentDark: '#059669',
    loginPath: '/faculty',
    title: 'Faculty Portal',
    shortTitle: 'Faculty',
    accentClass: 'badge-success',
    icon: BriefcaseBusiness,
    searchPlaceholder: 'Search lectures, batches, assignments...',
  },
  admin: {
    label: 'Admin',
    accent: 'var(--accent-admin)',
    accentDark: '#7C3AED',
    loginPath: '/admin',
    title: 'Admin Portal',
    shortTitle: 'Admin',
    accentClass: 'badge-info',
    icon: LayoutDashboard,
    searchPlaceholder: 'Search students, faculty, batches...',
  },
  admission: {
    label: 'Admission',
    accent: 'var(--accent-admission)',
    accentDark: '#D97706',
    loginPath: '/admission',
    title: 'Admission Portal',
    shortTitle: 'Admission',
    accentClass: 'badge-warning',
    icon: ClipboardList,
    searchPlaceholder: 'Search inquiries, reports, access...',
  },
  superadmin: {
    label: 'SuperAdmin',
    accent: 'var(--accent-superadmin)',
    accentDark: '#E11D48',
    loginPath: '/superadmin',
    title: 'Super Admin Portal',
    shortTitle: 'SuperAdmin',
    accentClass: 'badge-danger',
    icon: ShieldCheck,
    searchPlaceholder: 'Search staff, revenue, batches...',
  },
};

export const roleOrder = ['student', 'faculty', 'admin', 'admission', 'superadmin'];

export const dummyCredentials = {
  student: { email: 'student@test.com', password: 'Student@123' },
  faculty: { email: 'faculty@test.com', password: 'Faculty@123' },
  admin: { email: 'admin@test.com', password: 'Admin@123' },
  admission: { email: 'admission@test.com', password: 'Admission@123' },
  superadmin: { email: 'superadmin@test.com', password: 'SuperAdmin@123' },
};

export const quickRoleSwitcher = roleOrder.map((role) => ({
  role,
  ...roleMeta[role],
}));

export const roleLoginFeatures = {
  student: [
    { icon: MonitorPlay, title: 'Online Classes', description: 'Join live sessions and rewatch recordings.' },
    { icon: FileDown, title: 'Study Material', description: 'Access shared notes, PDFs, and lab files.' },
    { icon: NotebookText, title: 'Practice IDE', description: 'Code in-browser with starter templates.' },
  ],
  faculty: [
    { icon: CalendarClock, title: 'Schedule Lectures', description: 'Plan sessions with instant Jitsi room links.' },
    { icon: FileDown, title: 'Upload Material', description: 'Share lesson packs and resources with batches.' },
    { icon: PenSquare, title: 'Assignments', description: 'Create and manage assignments from one panel.' },
  ],
  admin: [
    { icon: Users, title: 'Manage Batches', description: 'Build batches, assign faculty, and add students.' },
    { icon: GraduationCap, title: 'Auto Certificates', description: 'Generate PDFs and distribute in bulk.' },
    { icon: ChartColumn, title: 'Analytics', description: 'See enrollment and performance trends.' },
  ],
  admission: [
    { icon: ClipboardList, title: 'Track Inquiries', description: 'Move leads through the funnel in one board.' },
    { icon: Layers3, title: 'Funnel View', description: 'See lead progression and stage-wise counts.' },
    { icon: ChartNoAxesCombined, title: 'Reports', description: 'Export admissions and conversion reports.' },
  ],
  superadmin: [
    { icon: House, title: 'All Controls', description: 'Control admins, admission staff, faculty, and fees.' },
    { icon: CircleDollarSign, title: 'Fees Dashboard', description: 'Monitor revenue and pending collections.' },
    { icon: UserRoundCog, title: 'Manage Staff', description: 'Activate, deactivate, and review all roles.' },
  ],
};

export const sidebarMenus = {
  student: [
    { label: 'Home', path: '/dashboard/student/home', icon: House },
    { label: 'Timetable', path: '/dashboard/student/timetable', icon: CalendarClock },
    { label: 'Online Class', path: '/dashboard/student/online-class', icon: MonitorPlay },
    { label: 'Materials', path: '/dashboard/student/materials', icon: FileDown },
    { label: 'Video Tutorials', path: '/dashboard/student/videos', icon: Video },
    { label: 'Certificates', path: '/dashboard/student/certificates', icon: GraduationCap },
    { label: 'IDE Practice', path: '/dashboard/student/ide', icon: NotebookText },
    { label: 'Notifications', path: '/dashboard/student/notifications', icon: Bell },
    { label: 'Feedback', path: '/dashboard/student/feedback', icon: MessageSquare },
  ],
  faculty: [
    { label: 'Home', path: '/dashboard/faculty/home', icon: House },
    { label: 'My Schedule', path: '/dashboard/faculty/home#schedule', icon: CalendarClock },
    { label: 'Schedule Lecture', path: '/dashboard/faculty/schedule-lecture', icon: CalendarClock },
    { label: 'Start Class', path: '/dashboard/faculty/start-class', icon: MonitorPlay },
    { label: 'Upload Material', path: '/dashboard/faculty/upload-material', icon: FileDown },
    { label: 'Video Tutorials', path: '/dashboard/faculty/video-tutorials', icon: Video },
    { label: 'Assignments', path: '/dashboard/faculty/assignments', icon: PenSquare },
    { label: 'Notifications', path: '/dashboard/faculty/notifications', icon: Bell },
  ],
  admin: [
    { label: 'Dashboard', path: '/dashboard/admin/dashboard', icon: House },
    { label: 'Students', path: '/dashboard/admin/students/list', icon: Users },
    { label: 'Faculty', path: '/dashboard/admin/faculty/list', icon: BriefcaseBusiness },
    { label: 'Batches', path: '/dashboard/admin/batches/list', icon: Layers3 },
    { label: 'Certificates', path: '/dashboard/admin/certificates', icon: GraduationCap },
    { label: 'Notifications', path: '/dashboard/admin/notifications', icon: Bell },
  ],
  admission: [
    { label: 'Dashboard', path: '/dashboard/admission/dashboard', icon: House },
    { label: 'Inquiry Tracker', path: '/dashboard/admission/tracker', icon: ClipboardList },
    { label: 'Reports', path: '/dashboard/admission/reports', icon: ChartColumn },
    { label: 'Fees Status', path: '/dashboard/admission/fees-status', icon: CircleDollarSign },
    { label: 'Manage Access', path: '/dashboard/admission/access', icon: UserCog },
    { label: 'Notifications', path: '/dashboard/admission/notifications', icon: Bell },
  ],
  superadmin: [
    { label: 'Dashboard', path: '/dashboard/superadmin/dashboard', icon: House },
    { label: 'Manage Admins', path: '/dashboard/superadmin/admins', icon: UserRoundCog },
    { label: 'Admission Staff', path: '/dashboard/superadmin/admission-staff', icon: Users },
    { label: 'Manage Faculty', path: '/dashboard/superadmin/faculty', icon: BriefcaseBusiness },
    { label: 'Fees Dashboard', path: '/dashboard/superadmin/fees', icon: Wallet },
    { label: 'Batches Overview', path: '/dashboard/superadmin/batches', icon: Layers3 },
  ],
};

export const starterCode = {
  python: '# Python starter\nprint("Hello, World!")\n',
  javascript: '// JavaScript\nconsole.log("Hello, World!");\n',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello World");\n  }\n}',
  cpp: '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello World" << endl;\n  return 0;\n}',
  sql: "-- Sample DB: students(id, name, grade), courses(id, title)\nSELECT * FROM students WHERE grade = 'A';",
};

export const studentSeed = {
  me: { name: 'Aarav Sharma', email: 'student@test.com', role: 'student', batch: 'CSE-101' },
  classes: [
    { id: 1, subject: 'Web Development', faculty: 'Dr. Neha Verma', time: '09:00 - 10:30', status: 'Live', room: 'web-dev-101' },
    { id: 2, subject: 'Database Systems', faculty: 'Prof. R. Jain', time: '11:00 - 12:30', status: 'Upcoming', room: 'db-202' },
    { id: 3, subject: 'Data Structures', faculty: 'Mr. Adil Khan', time: '14:00 - 15:30', status: 'Completed', room: 'ds-303' },
  ],
  stats: [
    { label: 'Attendance %', value: '91%', trend: '+4%' },
    { label: 'Materials Downloaded', value: '24', trend: '+6' },
    { label: 'Certificates', value: '7', trend: '+1' },
    { label: 'Pending Feedback', value: '2', trend: '-1' },
  ],
  timetable: [
    { day: 'Mon', subject: 'Maths', faculty: 'Dr. Rao', time: '09:00', color: 'var(--accent-student)' },
    { day: 'Tue', subject: 'DBMS', faculty: 'Prof. Jain', time: '10:00', color: '#F59E0B' },
    { day: 'Wed', subject: 'React', faculty: 'Ms. Sen', time: '11:30', color: '#10B981' },
    { day: 'Thu', subject: 'Java', faculty: 'Mr. Nair', time: '13:00', color: '#8B5CF6' },
    { day: 'Fri', subject: 'ML Basics', faculty: 'Dr. Ali', time: '14:30', color: '#F43F5E' },
    { day: 'Sat', subject: 'Project Lab', faculty: 'Team', time: '16:00', color: '#38BDF8' },
  ],
  materials: [
    { id: 1, name: 'React Hooks Notes.pdf', subject: 'Web Development', type: 'pdf', size: '1.8 MB', date: '2026-05-30' },
    { id: 2, name: 'DBMS Lab Sheet.xlsx', subject: 'Database Systems', type: 'xlsx', size: '880 KB', date: '2026-05-28' },
    { id: 3, name: 'DSA Practice Set.zip', subject: 'Data Structures', type: 'zip', size: '22 MB', date: '2026-05-25' },
  ],
  videos: [
    { id: 1, title: 'State and Props Deep Dive', subject: 'Web Development', duration: '18:40', date: '2026-05-29' },
    { id: 2, title: 'Normalization Explained', subject: 'Database Systems', duration: '24:10', date: '2026-05-27' },
    { id: 3, title: 'Linked List Traversal', subject: 'Data Structures', duration: '14:55', date: '2026-05-22' },
  ],
  certificates: [
    { id: 1, name: 'Internship Certificate', date: '2026-05-12' },
    { id: 2, name: 'React Workshop', date: '2026-04-18' },
  ],
  notifications: [
    { id: 1, title: 'Live class starts in 5 minutes', message: 'Your Web Development lecture is ready to join.', type: 'class', unread: true, time: '2h ago' },
    { id: 2, title: 'Weekly feedback reminder', message: 'Rate your faculty for this week before Sunday.', type: 'feedback', unread: true, time: '5h ago' },
    { id: 3, title: 'Material uploaded', message: 'New DBMS notes were shared by your faculty.', type: 'material', unread: false, time: 'Yesterday' },
  ],
  faculty: [
    { id: 1, name: 'Dr. Neha Verma', subject: 'Web Development' },
    { id: 2, name: 'Prof. R. Jain', subject: 'Database Systems' },
    { id: 3, name: 'Mr. Adil Khan', subject: 'Data Structures' },
  ],
};

export const facultySeed = {
  me: { name: 'Prof. R. Jain', email: 'faculty@test.com', role: 'faculty' },
  lectures: [
    { id: 1, batch: 'CSE-101', topic: 'React Components', time: '09:00 - 10:30', status: 'Live', students: 34, room: 'faculty-react-1' },
    { id: 2, batch: 'CSE-102', topic: 'SQL Joins', time: '11:00 - 12:30', status: 'Upcoming', students: 30, room: 'faculty-sql-2' },
    { id: 3, batch: 'CSE-103', topic: 'Trees', time: '14:00 - 15:30', status: 'Completed', students: 28, room: 'faculty-tree-3' },
  ],
  stats: [
    { label: 'Total Students', value: '92', trend: '+12' },
    { label: 'Pending Assignments', value: '14', trend: '-3' },
    { label: 'Materials Uploaded', value: '26', trend: '+4' },
    { label: 'Avg Feedback Rating', value: '4.7', trend: '+0.2' },
  ],
};

export const adminSeed = {
  dashboard: {
    stats: [
      { label: 'Total Students', value: '1,240', trend: '+80' },
      { label: 'Total Faculty', value: '48', trend: '+4' },
      { label: 'Active Batches', value: '18', trend: '+2' },
      { label: 'Certificates Issued', value: '690', trend: '+120' },
    ],
    todayLectures: studentSeed.classes,
  },
  students: studentSeed.materials.map((item, index) => ({
    id: index + 1,
    name: ['Aarav Sharma', 'Meera Shah', 'Rohan Das'][index],
    email: ['aarav@test.com', 'meera@test.com', 'rohan@test.com'][index],
    phone: ['+91 98765 43210', '+91 98989 89898', '+91 90000 11111'][index],
    batch: 'CSE-101',
    status: index === 1 ? 'Revoked' : 'Active',
  })),
  faculty: [
    { id: 1, name: 'Dr. Neha Verma', email: 'neha@test.com', subjects: 'Web Dev, React', status: 'Active' },
    { id: 2, name: 'Prof. R. Jain', email: 'rjain@test.com', subjects: 'DBMS, SQL', status: 'Active' },
    { id: 3, name: 'Mr. Adil Khan', email: 'adil@test.com', subjects: 'DSA, C++', status: 'Inactive' },
  ],
  batches: [
    { id: 1, name: 'CSE-101', students: '32/40', days: 'Mon Wed Fri', subjects: 'React, DBMS' },
    { id: 2, name: 'CSE-102', students: '28/35', days: 'Tue Thu Sat', subjects: 'Java, DSA' },
    { id: 3, name: 'CSE-103', students: '19/30', days: 'Mon Tue Thu', subjects: 'Python, SQL' },
  ],
};

export const admissionSeed = {
  stages: ['Lead', 'Seminar', 'Bootcamp', 'Counselling', 'Follow Up 1', 'Follow Up 2', 'Follow Up 3', 'Follow Up 4', 'Follow Up 5', 'Admission'],
  inquiries: [
    { id: 1, name: 'Rahul Kumar', city: 'Indore', phone: '9876543210', source: 'social', stage: 'Lead', days: 2 },
    { id: 2, name: 'Sneha Verma', city: 'Pune', phone: '9090909090', source: 'friends', stage: 'Counselling', days: 4 },
    { id: 3, name: 'Pooja Singh', city: 'Jaipur', phone: '9000000001', source: 'newspaper', stage: 'Follow Up 2', days: 8 },
    { id: 4, name: 'Amit Mishra', city: 'Bhopal', phone: '9000000002', source: 'other', stage: 'Admission', days: 1 },
  ],
};

export const superAdminSeed = {
  dashboard: {
    stats: [
      { label: 'Total Revenue', value: '₹28.4L', trend: '+18%' },
      { label: 'Total Students', value: '1,240', trend: '+80' },
      { label: 'Total Faculty', value: '48', trend: '+4' },
      { label: 'Total Batches', value: '18', trend: '+2' },
      { label: 'Active Admins', value: '6', trend: '+1' },
      { label: 'Admission Staff', value: '9', trend: '+2' },
    ],
  },
  admins: [
    { id: 1, name: 'Priya Nair', email: 'admin1@test.com', status: 'Active', created: '2026-01-10' },
    { id: 2, name: 'Sanjay Patil', email: 'admin2@test.com', status: 'Inactive', created: '2026-02-12' },
  ],
  staff: [
    { id: 1, name: 'Anita Joshi', email: 'admission1@test.com', status: 'Active', created: '2026-02-01' },
    { id: 2, name: 'Rahul Bhat', email: 'admission2@test.com', status: 'Active', created: '2026-03-15' },
  ],
  batches: adminSeed.batches,
};

export const inquirySources = {
  newspaper: { label: 'Newspaper', badge: 'badge-info' },
  social: { label: 'Social Media', badge: 'badge-warning' },
  friends: { label: 'Friends/Relatives', badge: 'badge-success' },
  other: { label: 'Other', badge: 'badge-neutral' },
};

export const notificationTypes = {
  class: { icon: MonitorPlay, label: 'Class' },
  material: { icon: FileDown, label: 'Material' },
  alert: { icon: Sparkles, label: 'Alert' },
  feedback: { icon: MessageSquare, label: 'Feedback' },
};

export const sortOptions = ['Newest', 'Oldest', 'Name'];
