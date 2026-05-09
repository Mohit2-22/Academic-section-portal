import axios from 'axios';

// Get API URLs from environment variables with fallbacks
// Priority: VITE_API_URL env var > localhost:8000 > tunnel URL
const getAPIBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Check if running locally
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000/api';
  }
  // Fall back to tunnel URL
  return 'https://tdw0jf3f-8000.inc1.devtunnels.ms/api';
};

const getExamPaperBase = () => {
  if (import.meta.env.VITE_EXAM_PAPER_BASE) return import.meta.env.VITE_EXAM_PAPER_BASE;
  // Check if running locally
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000/exam-paper';
  }
  // Fall back to tunnel URL
  return 'https://tdw0jf3f-8000.inc1.devtunnels.ms/exam-paper';
};

const API_BASE_URL = getAPIBaseURL();
const EXAM_PAPER_BASE = getExamPaperBase();

// Debug: Log which API URL is being used
console.log('🔗 API Config:', {
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
  API_BASE_URL,
  EXAM_PAPER_BASE,
  env: import.meta.env.VITE_API_URL ? 'from env' : 'auto-detected'
});

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry login requests
      if (originalRequest.url?.includes('/auth/login/')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });

          // Update tokens
          const newAccessToken = res.data.access;
          localStorage.setItem('access_token', newAccessToken);

          // Update refresh token if provided
          if (res.data.refresh) {
            localStorage.setItem('refresh_token', res.data.refresh);
          }

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Token refresh failed - logout user
          handleSessionExpired();
        }
      } else {
        // No refresh token - logout user
        handleSessionExpired();
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to handle session expiration
function handleSessionExpired() {
  // Clear auth data
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');

  // Redirect to login
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const loginPath = isAdminPath ? '/admin/login' : '/login';

  // Use replace to prevent back button issues
  window.location.replace(loginPath);
}

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login/', { email, password }),
  logout: () => {
    const refresh = localStorage.getItem('refresh_token');
    return api.post('/auth/logout/', { refresh });
  },
  refresh: () => {
    const refresh = localStorage.getItem('refresh_token');
    return api.post('/auth/refresh/', { refresh });
  },
  resetPasswordRequest: (loginId) =>
    api.post('/auth/password/reset/request/', { login_id: loginId }),
  resetPasswordVerify: (loginId, otp, newPassword) =>
    api.post('/auth/password/reset/verify/', { login_id: loginId, otp, new_password: newPassword }),
  requestEmailChange: (newEmail) =>
    api.post('/auth/email/change/request/', { new_email: newEmail }),
  verifyEmailChange: (otp) =>
    api.post('/auth/email/change/verify/', { otp }),
  getNotifications: () => api.get('/auth/notifications/'),
};

// Student API
export const studentAPI = {
  dashboard: () => api.get('/student/dashboard/'),
  results: () => api.get('/student/results/'),
  attendance: () => api.get('/student/attendance/'),
  assignments: () => api.get('/student/assignments/'),
  submitAssignment: (formData) =>
    api.post('/student/assignments/submit/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  profile: () => api.get('/student/profile/'),
  updateProfile: (data) => api.put('/student/profile/', data),
  requestPYQ: (data) => api.post('/pyqs/request/', data),
  timetable: () => api.get('/academics/student/timetable/'),

  // AI Career Guidance APIs
  getCareerStats: () => api.get('/career/stats/'),
  getCareerRecommendations: (data) => api.post('/career/recommend/', data),
  analyzeResumeFit: (data) => api.post('/career/analyze/', data),
  generateQuiz: (data) => api.post('/career/generate-quiz/', data),
  submitQuiz: (data) => api.post('/career/submit-quiz/', data),
  getLearningResources: (data) => api.post('/career/learning-resources/', data),
  searchInternships: (data) => api.post('/career/internships/', data),
  exportResume: (data) => api.post('/career/resume-export/', data),
  getCareerHistory: () => api.get('/career/history/'),
};

// Faculty API
export const facultyAPI = {
  dashboard: () => api.get('/faculty/dashboard/'),
  attendanceClasses: () => api.get('/faculty/attendance/classes/'),
  students: (params) => api.get('/faculty/students/', { params }),
  markAttendance: (data) => api.post('/faculty/attendance/mark/', data),
  checkAttendance: (params) => api.get('/faculty/attendance/check/', { params }),
  exams: () => api.get('/faculty/exams/'),
  createExam: (data) => api.post('/faculty/exams/create/', data),
  generateQuestions: (data) => api.post('/faculty/exams/generate-questions/', data),
  schedule: () => api.get('/faculty/schedule/'),
  profile: () => api.get('/faculty/profile/'),
  updateProfile: (data) => api.put('/faculty/profile/', data),
  timetable: () => api.get('/academics/faculty/timetable/'),
  // Grading (Class Teachers)
  gradingStudents: () => api.get('/faculty/grading/students/'),
  gradingSubmit: (data) => api.post('/faculty/grading/submit/', data),
  // Proxy Lectures
  markProxy: (data) => api.post('/academics/proxy/mark/', data),
  cancelProxy: (proxyId) => api.post(`/academics/proxy/${proxyId}/cancel/`),
  getMyProxies: () => api.get('/academics/faculty/my-proxies/'),
};

// Admin API
export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard/'),
  users: (params) => api.get('/admin/users/', { params }),
  students: (params) => api.get('/admin/students/', { params }),
  faculty: () => api.get('/admin/faculty/'),
  createUser: (data) => api.post('/admin/users/create/', data),
  updateUser: (userId, data) => api.put(`/admin/users/${userId}/`, data),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}/delete/`),
  analytics: () => api.get('/admin/analytics/'),
  assignSubjects: (facultyId, subjectIds) => api.put(`/admin/faculty/${facultyId}/assign-subjects/`, { subject_ids: subjectIds }),
  settings: () => api.get('/admin/settings/'),
  updateSettings: (data) => api.put('/admin/settings/', data),
  generateReport: (type) => api.get('/admin/reports/generate/', { params: { type } }),
  notifications: () => api.get('/admin/notifications/'),
  createNotification: (data) => api.post('/admin/notifications/', data),
  terms: () => api.get('/admin/terms/'),
  createTerm: (data) => api.post('/admin/terms/', data),
  updateTerm: (termId, data) => api.put(`/admin/terms/${termId}/`, data),
  deleteTerm: (termId) => api.delete(`/admin/terms/${termId}/delete/`),
  holidays: () => api.get('/admin/holidays/'),
  createHoliday: (data) => api.post('/admin/holidays/', data),
  deleteHoliday: (holidayId) => api.delete(`/admin/holidays/${holidayId}/`),
  // Semester Config
  semesterConfig: () => api.get('/super-admin/semester-config/'),
  toggleSemester: (data) => api.post('/super-admin/semester-config/toggle/', data),
};

// Academics API
export const academicsAPI = {
  courses: () => api.get('/academics/courses/'),
  createCourse: (data) => api.post('/academics/courses/', data),
  updateCourse: (courseId, data) => api.put(`/academics/courses/${courseId}/`, data),
  subjects: (params) => api.get('/academics/subjects/', { params }),
  rooms: (params) => api.get('/academics/rooms/', { params }),
  timetable: (params) => api.get('/academics/timetable/', { params }),
  createTimetableSlot: (data) => api.post('/academics/timetable/', data),
  deleteTimetableSlot: (slotId) => api.delete(`/academics/timetable/${slotId}/`),
  // Admin Timetable Management
  generateTimetable: (branch, clear) => api.post('/academics/admin/timetable/generate/', { branch, clear }),
  timetableStats: () => api.get('/academics/admin/timetable/stats/'),
  // ONE-CLICK PDF Generation
  generateTimetablePDF: (courseCode = null, semester = null) => {
    return api.post('/academics/admin/timetable/pdf/', 
      { course_code: courseCode, semester },
      { responseType: 'blob' }
    );
  },
  pyqSearch: (params) => api.get('/academics/pyq/search/', { params }),
};

export default api;

// Exam Paper Generator API
// Uses environment variable or default for base URL
export const examPaperAPI = {
  getSemesters: (course) =>
    fetch(`${EXAM_PAPER_BASE}/api/faculty/semesters/?course=${encodeURIComponent(course)}`)
      .then(r => r.json()),
  getSubjects: (course, semester) =>
    fetch(`${EXAM_PAPER_BASE}/api/faculty/subjects/?course=${encodeURIComponent(course)}&semester=${semester}`)
      .then(r => r.json()),
  generatePaper: (data) =>
    fetch(`${EXAM_PAPER_BASE}/api/faculty/generate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  downloadPdf: (paper) =>
    fetch(`${EXAM_PAPER_BASE}/api/faculty/download-pdf/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paper),
    }),
};

// ─── AI Attendance System API ────────────────────────────────────────────────
export const attendanceAI = {
  // ── Student: Setup ──────────────────────────────────────────────────────────
  getRegistrationStatus: () =>
    api.get('/attendance-ai/registration-status/'),

  getActiveSessions: () =>
    api.get('/attendance-ai/student/active-sessions/'),

  fillDetails: (data) =>
    api.post('/attendance-ai/fill-details/', data),

  registerFace: (studentId, images) =>
    api.post('/attendance-ai/register-face/', { student_id: studentId, images }),

  // ── QR Attendance ───────────────────────────────────────────────────────────
  /** Public — no auth needed */
  verifySession: (qrToken) =>
    api.get(`/attendance-ai/verify-session/${qrToken}/`),

  markAttendanceQR: (qrToken, frame = null, livenessFrames = [], lat = null, lng = null, deviceId = '') =>
    api.post('/attendance-ai/mark-attendance-qr/', {
      qr_token: qrToken,
      frame,
      liveness_frames: livenessFrames,
      latitude: lat,
      longitude: lng,
      device_id: deviceId,
    }),

  // ── Faculty: Session CRUD ───────────────────────────────────────────────────
  createLecture: (data) =>
    api.post('/attendance-ai/lecture/create/', data),

  getLectureStatus: (sessionId) =>
    api.get(`/attendance-ai/lecture/${sessionId}/status/`),

  endLecture: (sessionId) =>
    api.post(`/attendance-ai/lecture/${sessionId}/end/`),

  markManual: (sessionId, studentId, status) =>
    api.post(`/attendance-ai/lecture/${sessionId}/mark-manual/`, { student_id: studentId, status }),

  // ── Faculty: Face Recognition ────────────────────────────────────────────────
  markAttendanceFace: (sessionId, frame) =>
    api.post('/attendance-ai/mark-attendance-face/', { session_id: sessionId, frame }),

  markAttendanceMultiFace: (sessionId, frame) =>
    api.post('/attendance-ai/mark-attendance-multi-face/', { session_id: sessionId, frame }),

  // ── Liveness Detection ──────────────────────────────────────────────────────
  checkLiveness: (frames) =>
    api.post('/attendance-ai/check-liveness/', { frames }),

  checkLivenessSingle: (frame) =>
    api.post('/attendance-ai/check-liveness/', { frame }),

  getFacultySessions: () =>
    api.get('/attendance-ai/faculty/sessions/'),

  getFacultySubjects: (params) =>
    api.get('/academics/subjects/', { params }),

  // ── Reports ──────────────────────────────────────────────────────────────────
  getStudentReport: (studentId) =>
    api.get(`/attendance-ai/student/${studentId}/report/`),

  generatePDFReport: (subjectId, dateFrom, dateTo) =>
    api.post('/attendance-ai/generate-pdf-report/', {
      subject_id: subjectId, date_from: dateFrom, date_to: dateTo
    }),

  // ── Anomalies ─────────────────────────────────────────────────────────────────
  getAnomalies: (params) =>
    api.get('/attendance-ai/anomalies/', { params }),

  resolveAnomaly: (anomalyId) =>
    api.post(`/attendance-ai/anomalies/${anomalyId}/resolve/`),

  // ── Notifications ─────────────────────────────────────────────────────────────
  getNotifications: () =>
    api.get('/attendance-ai/notifications/'),

  markNotificationRead: (notifId) =>
    api.post(`/attendance-ai/notifications/${notifId}/read/`),

  // ── Admin ─────────────────────────────────────────────────────────────────────
  getStudentFaceStatus: (params) =>
    api.get('/attendance-ai/admin/student-face-status/', { params: { ...params, _t: Date.now() } }),

  sendReminder: (studentId) =>
    api.post(`/attendance-ai/admin/send-reminder/${studentId}/`),

  bulkRemind: () =>
    api.post('/attendance-ai/admin/bulk-remind/'),



  downloadCSV: (sessionId) =>
    api.get(`/attendance-ai/download-csv/${sessionId}/`, { responseType: 'blob' }),

  // ── Admin: Face Management ────────────────────────────────────────────────
  deleteStudentFace: (studentId) =>
    api.post(`/attendance-ai/admin/student/${studentId}/delete-face/`),

  uploadStudentPhoto: (studentId, formData) =>
    api.post(`/attendance-ai/admin/student/${studentId}/upload-photo/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getStudentAttendanceStats: (studentId) =>
    api.get(`/attendance-ai/admin/student/${studentId}/attendance-stats/`),

  // ── Faculty: Attendance Reports ───────────────────────────────────────────
  getAttendanceReport: (params) =>
    api.get('/attendance-ai/faculty/sessions/', { params }),

  // ── NEW: Security Endpoints ───────────────────────────────────────────────
  /** Faculty: Set GPS anchor + geofence radius for a session. */
  setSessionLocation: (sessionId, lat, lng, radius = 50) =>
    api.post(`/attendance-ai/lecture/${sessionId}/set-location/`, {
      latitude: lat,
      longitude: lng,
      radius,
    }),

  /** Faculty: Rotate QR token (call every qr_refresh_secs seconds). */
  refreshQR: (sessionId) =>
    api.post(`/attendance-ai/lecture/${sessionId}/refresh-qr/`),

  /** Admin: Reset device binding for a student. */
  resetStudentDevice: (studentId) =>
    api.post(`/attendance-ai/admin/student/${studentId}/reset-device/`),
};
