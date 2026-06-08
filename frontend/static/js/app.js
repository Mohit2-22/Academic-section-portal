// -------------------------------------------------------------
// APP LOGIC & API INTEGRATION (VANILLA JS)
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Role UI layout
  initRoleUI();

  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Tab Routing Setup
  initNavigation();
  
  // Load Default Tab
  const defaultPath = '/';
  loadTabContent(defaultPath);
  
  // Register Form Submissions
  setupFormHandlers();
  
  // Register Student Search
  const searchInput = document.getElementById('student-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      fetchStudents(e.target.value.trim());
    });
  }
});

// --- ROLE-BASED UI INITIALIZATION ---

function initRoleUI() {
  const role = window.USER_ROLE || 'student';
  
  if (role === 'student') {
    // Hide Admin panels and show Student panels
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.student-only').forEach(el => el.classList.remove('hidden'));
    
    // Set Student credentials in Sidebar
    const avatar = document.getElementById('sidebar-user-avatar');
    const name = document.getElementById('sidebar-user-name');
    const roleLabel = document.getElementById('sidebar-user-role');
    
    if (avatar) avatar.textContent = 'AK';
    if (name) name.textContent = 'Aman Kumar';
    if (roleLabel) roleLabel.textContent = 'Student Portal';
  } else {
    // Admin View Mode
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.student-only').forEach(el => el.classList.add('hidden'));
    
    const avatar = document.getElementById('sidebar-user-avatar');
    const name = document.getElementById('sidebar-user-name');
    const roleLabel = document.getElementById('sidebar-user-role');
    
    if (avatar) avatar.textContent = 'AD';
    if (name) name.textContent = 'Admin User';
    if (roleLabel) roleLabel.textContent = 'Management Portal';
  }
}

// --- NAVIGATION & ROUTER ---

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-item');
      if (!btn) return;
      
      const path = btn.getAttribute('data-path');
      switchTab(path);
      
      // Close mobile sidebar on nav item click
      const sidebar = document.getElementById('app-sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    });
  });
}

function switchTab(path) {
  // Update active state in bottom bar
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-path') === path) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch Active Pane
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach(pane => pane.classList.remove('active'));

  // Update Header Title based on route
  const pageTitle = document.getElementById('page-title');
  const role = window.USER_ROLE || 'student';
  
  let targetTabId = 'tab-dashboard';
  
  if (path === '/') {
    if (role === 'student') {
      targetTabId = 'tab-student-dashboard';
      pageTitle.textContent = 'Student Dashboard';
    } else {
      targetTabId = 'tab-dashboard';
      pageTitle.textContent = 'Dashboard';
    }
  } else if (path === '/students') {
    targetTabId = 'tab-students';
    pageTitle.textContent = 'Students';
  } else if (path === '/admissions') {
    targetTabId = 'tab-admissions';
    pageTitle.textContent = 'Admissions Pipeline';
  } else if (path === '/courses') {
    targetTabId = 'tab-courses';
    pageTitle.textContent = 'Courses';
  } else if (path === '/fees') {
    targetTabId = 'tab-fees';
    pageTitle.textContent = 'Fees Management';
  }

  const activePane = document.getElementById(targetTabId);
  if (activePane) activePane.classList.add('active');

  // Fetch data for the active tab
  loadTabContent(path);
}

function loadTabContent(path) {
  const role = window.USER_ROLE || 'student';
  
  if (path === '/') {
    if (role === 'student') {
      fetchStudentProfile();
      fetchStudentAnnouncements();
      fetchStudentSchedule();
      fetchStudentSyllabus();
      fetchStudentGrades();
    } else {
      fetchDashboardStats();
    }
  } else if (path === '/students') {
    fetchStudents();
    populateCourseDropdowns();
  } else if (path === '/admissions') {
    fetchAdmissions();
  } else if (path === '/courses') {
    fetchCourses();
  } else if (path === '/fees') {
    fetchFees();
  }
}

// --- MODAL UTILITIES ---

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    
    // Custom actions on modal opening
    if (id === 'add-student-modal') {
      populateCourseDropdowns();
    } else if (id === 'record-payment-modal') {
      populateFeeRecordDropdown();
    }
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
  }
}

// Close modal on background click
window.onclick = function(event) {
  if (event.target.classList.contains('modal-overlay')) {
    event.target.classList.remove('active');
  }
}


// --- API FETCH & RENDER CALLS ---

// 1. Dashboard Stats (Admin Only)
async function fetchDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);
    
    document.getElementById('dash-total-students').textContent = data.total_students;
    document.getElementById('dash-active-students').textContent = `Active: ${data.active_students}`;
    document.getElementById('dash-new-admissions').textContent = data.new_admissions;
    document.getElementById('dash-active-courses').textContent = data.active_courses;
    document.getElementById('dash-enrolled-courses').textContent = `${data.enrolled_in_courses} enrolled`;
    document.getElementById('dash-fees-collected').textContent = data.fees_collected;
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

// 2. Student Portal Details (Student Only: Aman Kumar context)
async function fetchStudentProfile() {
  try {
    const res = await fetch('/api/student/profile');
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);
    
    // Update dashboard details
    document.getElementById('student-portal-name').textContent = `${data.first_name} ${data.last_name}`;
    document.getElementById('stud-course-name').textContent = data.course_name || 'No Course';
    document.getElementById('stud-course-instructor').textContent = `Instructor: ${data.course_instructor || 'N/A'}`;
    document.getElementById('stud-course-duration').textContent = data.duration_weeks ? `${data.duration_weeks} Weeks` : 'N/A';
    document.getElementById('stud-course-start').textContent = `Start: ${formatSQLDate(data.start_date)}`;
    
    const paidVal = parseFloat(data.paid_amount || 0);
    const outstandingVal = parseFloat(data.outstanding_amount || 0);
    const totalVal = parseFloat(data.total_amount || 0);
    
    document.getElementById('stud-fee-paid').textContent = `₹${paidVal.toLocaleString('en-IN')}`;
    document.getElementById('stud-fee-pending').textContent = `₹${outstandingVal.toLocaleString('en-IN')}`;
    
    const dueEl = document.getElementById('stud-fee-due');
    if (outstandingVal > 0) {
      dueEl.textContent = `Due Date: ${formatSQLDate(data.due_date)}`;
      dueEl.style.color = 'var(--danger)';
    } else {
      dueEl.textContent = 'All cleared!';
      dueEl.style.color = 'var(--success)';
    }
    
    // Card specifics
    document.getElementById('stud-card-course-title').textContent = data.course_name || 'N/A';
    document.getElementById('stud-portal-status').textContent = data.enrollment_status;
    document.getElementById('stud-portal-status').className = `student-status-badge ${data.enrollment_status}`;
    
    document.getElementById('stud-bill-total').textContent = `₹${totalVal.toLocaleString('en-IN')}`;
    document.getElementById('stud-bill-paid').textContent = `₹${paidVal.toLocaleString('en-IN')}`;
    document.getElementById('stud-bill-pending').textContent = `₹${outstandingVal.toLocaleString('en-IN')}`;
    
    // Render payment action or thanks text
    const actionsRow = document.getElementById('stud-payment-action-block');
    actionsRow.innerHTML = '';
    
    if (outstandingVal > 0) {
      actionsRow.innerHTML = `
        <button onclick="openPayModal('${data.fee_id}', ${outstandingVal})" class="btn btn-danger btn-block">
          <i data-lucide="credit-card"></i> Pay Outstanding Fees Online
        </button>
      `;
    } else {
      actionsRow.innerHTML = `
        <span style="color: var(--success); font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
          <i data-lucide="check-circle"></i> All Fees Cleared! Thank You!
        </span>
      `;
    }
    
    lucide.createIcons(); // Hydrate newly added icons
  } catch (err) {
    console.error('Error fetching student profile details:', err);
  }
}

// 2a. Student Notice Board
async function fetchStudentAnnouncements() {
  try {
    const res = await fetch('/api/student/announcements');
    const notices = await res.json();
    
    const container = document.getElementById('student-notices-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (notices.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-3">No announcements posted.</div>';
      return;
    }
    
    notices.forEach(n => {
      const noticeDiv = document.createElement('div');
      noticeDiv.className = `notice-item ${n.type}`;
      
      let icon = 'info';
      if (n.type === 'warning') icon = 'alert-triangle';
      else if (n.type === 'success') icon = 'check-circle-2';
      
      noticeDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="${icon}" style="width:16px; height:16px; flex-shrink:0;"></i>
          <span class="notice-title">${n.title}</span>
        </div>
        <p class="notice-content">${n.content}</p>
        <span class="notice-date">${formatSQLDate(n.date)}</span>
      `;
      container.appendChild(noticeDiv);
    });
    
    lucide.createIcons();
  } catch (err) {
    console.error('Error fetching announcements:', err);
  }
}

// 2b. Student Schedule / Timetable
async function fetchStudentSchedule() {
  try {
    const res = await fetch('/api/student/schedule');
    const schedule = await res.json();
    
    const container = document.getElementById('student-schedule-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (schedule.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-3">No classes scheduled.</div>';
      return;
    }
    
    schedule.forEach(s => {
      const item = document.createElement('div');
      item.className = 'schedule-item';
      item.innerHTML = `
        <div class="schedule-day-badge">${s.day}</div>
        <div class="schedule-info">
          <span class="schedule-topic">${s.topic}</span>
          <div class="schedule-time-room">
            <span style="display:inline-flex; align-items:center; gap:3px;"><i data-lucide="clock" style="width:12px; height:12px;"></i> ${s.time}</span>
            <span style="display:inline-flex; align-items:center; gap:3px;"><i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${s.room}</span>
          </div>
        </div>
      `;
      container.appendChild(item);
    });
    
    lucide.createIcons();
  } catch (err) {
    console.error('Error fetching schedule:', err);
  }
}

// 2c. Student Syllabus Tracker
async function fetchStudentSyllabus() {
  try {
    const res = await fetch('/api/student/syllabus');
    const syllabus = await res.json();
    
    const container = document.getElementById('student-syllabus-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    syllabus.forEach(s => {
      const item = document.createElement('div');
      item.className = `syllabus-item ${s.status}`;
      
      let icon = 'circle';
      if (s.status === 'completed') icon = 'check-circle-2';
      else if (s.status === 'ongoing') icon = 'play-circle';
      
      item.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span>${s.topic}</span>
      `;
      container.appendChild(item);
    });
    
    lucide.createIcons();
  } catch (err) {
    console.error('Error fetching syllabus tracker:', err);
  }
}

// 2d. Student Academic Report
async function fetchStudentGrades() {
  try {
    const res = await fetch('/api/student/grades');
    const grades = await res.json();
    
    const container = document.getElementById('student-grades-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (grades.length === 0) {
      container.innerHTML = '<tr><td colspan="4" class="text-center py-3">No grade records.</td></tr>';
      return;
    }
    
    grades.forEach(g => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${g.exam}</td>
        <td>${g.score}</td>
        <td><span class="grade-badge ${g.grade.toLowerCase().replace('+', '-plus')}">${g.grade}</span></td>
        <td>${formatSQLDate(g.date)}</td>
      `;
      container.appendChild(tr);
    });
  } catch (err) {
    console.error('Error fetching report grades:', err);
  }
}

// Open Student Payment gateway simulator modal
function openPayModal(feeId, pendingAmt) {
  document.getElementById('student-pay-fee-id').value = feeId;
  document.getElementById('student-pay-pending-val').textContent = `₹${parseFloat(pendingAmt).toLocaleString('en-IN')}`;
  document.getElementById('student-pay-amount').value = pendingAmt;
  openModal('student-pay-modal');
}

// 3. Students Tab (Admin Only)
async function fetchStudents(filterText = '') {
  try {
    const res = await fetch('/api/students');
    const students = await res.json();
    
    if (students.error) throw new Error(students.error);
    
    const container = document.getElementById('students-list');
    container.innerHTML = '';
    
    const filtered = students.filter(s => {
      const query = filterText.toLowerCase();
      return (
        s.first_name.toLowerCase().includes(query) ||
        s.last_name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.course.toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="card text-muted text-center py-4">No students found.</div>';
      return;
    }

    filtered.forEach(s => {
      const initial = `${s.first_name[0]}${s.last_name[0]}`;
      const card = document.createElement('div');
      card.className = 'student-card';
      card.innerHTML = `
        <div class="student-meta">
          <div class="avatar-badge">${initial}</div>
          <div class="student-details">
            <span class="student-name">${s.first_name} ${s.last_name}</span>
            <span class="student-course">${s.course}</span>
          </div>
        </div>
        <span class="student-status-badge ${s.status}">${s.status}</span>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error fetching students:', err);
  }
}

// Helper: Populate student enrollment dropdowns with active courses
async function populateCourseDropdowns() {
  try {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    
    const select = document.getElementById('student-course-select');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Select Optional Course --</option>';
    
    courses.forEach(c => {
      if (c.status === 'active' || c.status === 'upcoming') {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.fee_amount})`;
        select.appendChild(opt);
      }
    });
    
    select.value = currentVal;
  } catch (err) {
    console.error('Error loading courses for dropdown:', err);
  }
}

// 4. Admissions Tab (Admin Only)
async function fetchAdmissions() {
  try {
    const res = await fetch('/api/admissions');
    const admissions = await res.json();
    
    if (admissions.error) throw new Error(admissions.error);
    
    const inquiryList = document.getElementById('list-inquiry');
    const appliedList = document.getElementById('list-applied');
    const enrolledList = document.getElementById('list-enrolled');
    
    inquiryList.innerHTML = '';
    appliedList.innerHTML = '';
    enrolledList.innerHTML = '';
    
    let counts = { inquiry: 0, applied: 0, enrolled: 0 };
    
    admissions.forEach(a => {
      if (a.stage in counts) {
        counts[a.stage]++;
        const card = document.createElement('div');
        card.className = 'kanban-card';
        
        let actionBtnHtml = '';
        if (a.stage === 'inquiry') {
          actionBtnHtml = `<button onclick="moveLead('${a.id}', 'applied')" class="btn-move">Apply →</button>`;
        } else if (a.stage === 'applied') {
          actionBtnHtml = `<button onclick="moveLead('${a.id}', 'enrolled')" class="btn-move">Enroll →</button>`;
        }
        
        card.innerHTML = `
          <div class="kanban-card-info">
            <h4>${a.student_name}</h4>
            <span class="kanban-card-course">${a.course_name}</span>
            <span class="kanban-card-date">${formatSQLDate(a.created_at)}</span>
          </div>
          <div class="kanban-card-actions">
            ${actionBtnHtml}
          </div>
        `;
        
        if (a.stage === 'inquiry') inquiryList.appendChild(card);
        else if (a.stage === 'applied') appliedList.appendChild(card);
        else if (a.stage === 'enrolled') enrolledList.appendChild(card);
      }
    });
    
    // Update count labels
    document.getElementById('count-inquiry').textContent = counts.inquiry;
    document.getElementById('count-applied').textContent = counts.applied;
    document.getElementById('count-enrolled').textContent = counts.enrolled;
  } catch (err) {
    console.error('Error fetching admissions:', err);
  }
}

// Move lead state
async function moveLead(id, nextStage) {
  try {
    const res = await fetch(`/api/admissions/${id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage })
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    fetchAdmissions();
  } catch (err) {
    alert('Error moving admission stage: ' + err.message);
  }
}

// 5. Courses Tab (Shared)
async function fetchCourses() {
  try {
    const res = await fetch('/api/courses');
    const courses = await res.json();
    
    if (courses.error) throw new Error(courses.error);
    
    const container = document.getElementById('courses-list');
    container.innerHTML = '';
    
    courses.forEach(c => {
      const enrollmentPercent = (c.enrolled_count / c.max_students) * 100;
      const card = document.createElement('div');
      card.className = 'course-card';
      card.innerHTML = `
        <div class="course-header">
          <div class="course-title-group">
            <h3>${c.name}</h3>
            <span class="course-instructor">${c.instructor}</span>
          </div>
          <span class="course-badge ${c.status}">${c.status}</span>
        </div>
        
        <div class="course-details-row">
          <div class="course-detail-item">
            <i data-lucide="clock"></i>
            <span>${c.duration_weeks} weeks</span>
          </div>
          <div class="course-detail-item">
            <i data-lucide="indian-rupee"></i>
            <span>₹${parseFloat(c.fee_amount).toLocaleString('en-IN')}</span>
          </div>
          <div class="course-detail-item">
            <i data-lucide="calendar"></i>
            <span>${formatSQLDate(c.start_date)}</span>
          </div>
        </div>

        <div class="course-enrollment">
          <div class="enrollment-label-row">
            <span>Enrolled: ${c.enrolled_count}/${c.max_students}</span>
            <span>${Math.round(enrollmentPercent)}%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-fill" style="width: ${enrollmentPercent}%"></div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
    
    lucide.createIcons(); // Initialize newly added icons
  } catch (err) {
    console.error('Error fetching courses:', err);
  }
}

// 6. Fees Tab (Admin Only)
async function fetchFees() {
  try {
    // Fetch stats
    const statsRes = await fetch('/api/fees/stats');
    const stats = await statsRes.json();
    document.getElementById('fee-stat-collected').textContent = stats.collected;
    document.getElementById('fee-stat-pending').textContent = stats.pending;
    document.getElementById('fee-stat-overdue').textContent = stats.overdue;

    // Fetch records list
    const recsRes = await fetch('/api/fees/records');
    const records = await recsRes.json();
    
    if (records.error) throw new Error(records.error);
    
    const container = document.getElementById('fees-list');
    container.innerHTML = '';
    
    records.forEach(r => {
      const card = document.createElement('div');
      card.className = 'fee-record-card';
      
      let badgeClass = r.status;
      
      let statusDetailsHtml = '';
      if (r.status === 'paid') {
        statusDetailsHtml = `<span style="color: var(--success); font-weight:600;">Paid ${formatSQLDate(r.paid_date)}</span>`;
      } else if (r.status === 'partial') {
        statusDetailsHtml = `<span style="color: var(--warning); font-weight:600;">Paid: ₹${parseFloat(r.paid_amount).toLocaleString('en-IN')}</span>`;
      } else if (r.status === 'overdue') {
        statusDetailsHtml = `<span style="color: var(--danger); font-weight:600;">Due: ₹${parseFloat(r.outstanding_amount).toLocaleString('en-IN')}</span>`;
      } else {
        statusDetailsHtml = `<span style="color: var(--text-muted);">Unpaid</span>`;
      }
      
      card.innerHTML = `
        <div class="fee-record-header">
          <div>
            <span class="fee-record-student">${r.student}</span>
            <div class="fee-record-course">${r.course}</div>
          </div>
          <span class="fee-status-badge ${badgeClass}">${r.status}</span>
        </div>
        <div class="fee-record-details">
          <div>
            <span class="fee-amount-lbl">Total: ₹${parseFloat(r.total_amount).toLocaleString('en-IN')}</span>
            <div class="fee-due-lbl">Due: ${formatSQLDate(r.due_date)}</div>
          </div>
          <div>
            ${statusDetailsHtml}
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error fetching fees:', err);
  }
}

// Helper: Populate fee records dropdown in the payment record modal (Admin Only)
async function populateFeeRecordDropdown() {
  try {
    const res = await fetch('/api/fees/records');
    const records = await res.json();
    
    const select = document.getElementById('payment-fee-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Choose student fee statement --</option>';
    
    records.forEach(r => {
      if (r.status !== 'paid') {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.student} - ${r.course} (Total: ₹${parseFloat(r.total_amount).toLocaleString('en-IN')}, Pending: ₹${parseFloat(r.outstanding_amount).toLocaleString('en-IN')})`;
        select.appendChild(opt);
      }
    });
  } catch (err) {
    console.error('Error populating fee dropdown:', err);
  }
}


// --- FORM SUBMISSION HANDLERS ---

function setupFormHandlers() {
  // Add Student Form (Admin)
  const addStudentForm = document.getElementById('add-student-form');
  if (addStudentForm) {
    addStudentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        first_name: document.getElementById('student-first-name').value.trim(),
        last_name: document.getElementById('student-last-name').value.trim(),
        email: document.getElementById('student-email').value.trim(),
        phone: document.getElementById('student-phone').value.trim(),
        course_id: document.getElementById('student-course-select').value || null
      };

      try {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.error) throw new Error(result.error);
        
        closeModal('add-student-modal');
        addStudentForm.reset();
        
        fetchStudents();
      } catch (err) {
        alert('Error adding student: ' + err.message);
      }
    });
  }

  // Record Payment Form (Admin)
  const recordPaymentForm = document.getElementById('record-payment-form');
  if (recordPaymentForm) {
    recordPaymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        fee_id: document.getElementById('payment-fee-select').value,
        amount_paid: parseFloat(document.getElementById('payment-amount').value)
      };

      try {
        const res = await fetch('/api/fees/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.error) throw new Error(result.error);
        
        closeModal('record-payment-modal');
        recordPaymentForm.reset();
        
        fetchFees();
      } catch (err) {
        alert('Error recording payment: ' + err.message);
      }
    });
  }

  // Create Course Form (Admin)
  const createCourseForm = document.getElementById('create-course-form');
  if (createCourseForm) {
    createCourseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        name: document.getElementById('course-name').value.trim(),
        instructor: document.getElementById('course-instructor').value.trim(),
        duration_weeks: parseInt(document.getElementById('course-duration').value),
        fee_amount: parseFloat(document.getElementById('course-fee').value),
        max_students: parseInt(document.getElementById('course-capacity').value),
        start_date: document.getElementById('course-start-date').value
      };

      try {
        const res = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.error) throw new Error(result.error);
        
        closeModal('create-course-modal');
        createCourseForm.reset();
        
        fetchCourses();
      } catch (err) {
        alert('Error creating course: ' + err.message);
      }
    });
  }

  // Add Admission Lead Form (Admin)
  const addAdmissionForm = document.getElementById('add-admission-form');
  if (addAdmissionForm) {
    addAdmissionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        student_name: document.getElementById('admission-student-name').value.trim(),
        course_name: document.getElementById('admission-course-name').value.trim(),
        stage: document.getElementById('admission-stage-select').value
      };

      try {
        const res = await fetch('/api/admissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.error) throw new Error(result.error);
        
        closeModal('add-admission-modal');
        addAdmissionForm.reset();
        
        fetchAdmissions();
      } catch (err) {
        alert('Error adding lead: ' + err.message);
      }
    });
  }

  // Student Pay Form (Student Portal Online Simulator Gateway)
  const studentPayForm = document.getElementById('student-pay-form');
  if (studentPayForm) {
    studentPayForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        fee_id: document.getElementById('student-pay-fee-id').value,
        amount_paid: parseFloat(document.getElementById('student-pay-amount').value)
      };

      try {
        const res = await fetch('/api/fees/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.error) throw new Error(result.error);
        
        closeModal('student-pay-modal');
        studentPayForm.reset();
        
        // Refresh student profile dashboard metrics
        fetchStudentProfile();
      } catch (err) {
        alert('Error making simulated payment: ' + err.message);
      }
    });
  }
}

// --- GENERAL HELPERS ---

function formatSQLDate(dateString) {
  if (!dateString) return 'Pending';
  
  const cleanStr = dateString.split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1]) - 1;
    const day = parts[2];
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[monthIndex]} ${day}, ${year}`;
  }
  return dateString;
}

// --- MOBILE SIDEBAR TOGGLE ---
function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) {
    sidebar.classList.toggle('active');
  }
  if (overlay) {
    overlay.classList.toggle('active');
  }
}
