// admin.js — Admin Portal Logic
'use strict';

let studentsList = [];
let facultyList = [];
let batchesList = [];
let coursesList = [];

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadDashboardStats();
  loadAllDropdownData();
  initForms();
});

window.toggleSidebar = function() {
  document.getElementById('app-sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
};

const tabTitles = {
  dashboard: 'Dashboard', students: 'Students Manager', faculty: 'Faculty Members',
  batches: 'Batch Registers', courses: 'Courses Info', fees: 'Fees ledgers',
  certificates: 'Issue Certificates', notifications: 'Send Notification'
};

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById(`tab-${tab}`);
  if (pane) pane.classList.add('active');
  const btn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('page-title').textContent = tabTitles[tab] || tab;

  if (tab === 'students') loadStudents();
  if (tab === 'faculty') loadFaculty();
  if (tab === 'batches') loadBatches();
  if (tab === 'courses') loadCourses();
  if (tab === 'fees') loadFees();
  if (tab === 'certificates') loadCertificatesData();
};

window.openModal = function(id) { document.getElementById(id).classList.add('open'); };
window.closeModal = function(id) { document.getElementById(id).classList.remove('open'); };

async function loadDashboardStats() {
  try {
    const data = await api('/api/admin/dashboard');
    
    // Animate count-up
    animateValue('stat-students', 0, data.students.total, 800);
    document.getElementById('stat-active-students').textContent = `Active: ${data.students.active}`;
    
    animateValue('stat-batches', 0, data.batches.active, 800);
    document.getElementById('stat-total-batches').textContent = `Total: ${data.batches.total}`;
    
    animateValue('stat-faculty', 0, data.faculty.total, 800);
    
    const feesVal = parseFloat(data.fees.collected) || 0;
    document.getElementById('stat-fees').textContent = formatINR(feesVal);
    document.getElementById('stat-outstanding').textContent = `Outstanding: ${formatINR(data.fees.outstanding)}`;

    document.getElementById('dash-inquiries-count').textContent = data.inquiries.total || 0;
  } catch(e) {}
}

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  if (start === end) { obj.textContent = end; return; }
  const range = end - start;
  let current = start;
  const increment = end > start ? 1 : -1;
  const stepTime = Math.abs(Math.floor(duration / range)) || 10;
  const timer = setInterval(() => {
    current += increment;
    obj.textContent = current;
    if (current == end) {
      clearInterval(timer);
    }
  }, stepTime);
}

async function loadAllDropdownData() {
  try {
    batchesList = await api('/api/batches');
    coursesList = await api('/api/admin/courses');
    studentsList = await api('/api/admin/students');
    facultyList = await api('/api/admin/faculty');

    // Populate dropdowns
    document.getElementById('assign-batch-select').innerHTML = '<option value="">-- Select Batch --</option>' + batchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    document.getElementById('notif-batch').innerHTML = '<option value="">-- Select Batch --</option>' + batchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    document.getElementById('cert-batch-select').innerHTML = '<option value="">-- Select Batch --</option>' + batchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    
    document.getElementById('cert-student-select').innerHTML = '<option value="">-- Select Student --</option>' + studentsList.map(s => `<option value="${s.id}">${s.first_name} ${s.last_name}</option>`).join('');
  } catch(e) {}
}

async function loadStudents() {
  const container = document.getElementById('students-grid');
  try {
    studentsList = await api('/api/admin/students');
    renderStudents(studentsList);
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

function renderStudents(list) {
  const container = document.getElementById('students-grid');
  if (!list.length) { container.innerHTML = emptyState('🎓', 'No students enrolled', 'Click Add Student to enroll profiles'); return; }
  container.innerHTML = list.map(s => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div>
          <div style="font-weight:700;font-size:16px;color:white">${escHtml(s.first_name)} ${escHtml(s.last_name)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${s.email}</div>
        </div>
        <span class="badge ${s.is_active ? 'badge-green' : 'badge-gold'}">${s.is_active ? 'Active' : 'Deactivated'}</span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);margin:8px 0;display:flex;flex-direction:column;gap:4px">
        <div>Phone: <strong style="color:white">${s.phone}</strong></div>
        <div>City: <strong style="color:white">${s.city || '—'}</strong></div>
        <div>Status: <strong style="color:white">${capitalize(s.enrollment_status)}</strong></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;flex:1" onclick="openAssignStudentModal('${s.id}', '${s.first_name} ${s.last_name}')"><i data-lucide="link"></i> Assign Batch</button>
      </div>
    </div>`).join('');
  lucide.createIcons();
}

window.filterStudents = function() {
  const q = document.getElementById('student-search').value.toLowerCase();
  const filtered = studentsList.filter(s => 
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  );
  renderStudents(filtered);
};

window.openAssignStudentModal = function(id, name) {
  document.getElementById('assign-student-id').value = id;
  document.getElementById('assign-student-name-display').value = name;
  openModal('assign-student-modal');
};

async function loadFaculty() {
  const container = document.getElementById('faculty-grid');
  try {
    facultyList = await api('/api/admin/faculty');
    if (!facultyList.length) { container.innerHTML = emptyState('🏫', 'No faculty added', 'Click Add Faculty to onboarding educators'); return; }
    container.innerHTML = facultyList.map(f => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-weight:700;font-size:16px;color:white">${escHtml(f.first_name)} ${escHtml(f.last_name)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${f.email}</div>
          </div>
          <span class="badge badge-green">${f.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin:8px 0;display:flex;flex-direction:column;gap:4px">
          <div>Phone: <strong style="color:white">${f.phone || '—'}</strong></div>
          <div>Specialization: <strong style="color:white">${f.specialization || '—'}</strong></div>
          <div>Qualification: <strong style="color:white">${f.qualification || '—'}</strong></div>
        </div>
      </div>`).join('');
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

async function loadBatches() {
  const container = document.getElementById('batches-grid');
  try {
    batchesList = await api('/api/batches');
    if (!batchesList.length) { container.innerHTML = emptyState('👥', 'No batches set up', 'Create your first batch to register profiles'); return; }
    container.innerHTML = batchesList.map(b => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:16px;color:white">${escHtml(b.name)}</div>
          <span class="badge badge-gold">${capitalize(b.status)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px">
          <div>Max Capacity: <strong style="color:white">${b.enrolled_count} / ${b.max_students} Students</strong></div>
          <div>Lecture Timings: <strong style="color:white">${b.lecture_time || '—'}</strong></div>
          <div>Dates: <strong style="color:white">${formatDate(b.start_date)} to ${formatDate(b.end_date)}</strong></div>
        </div>
      </div>`).join('');
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

async function loadCourses() {
  const container = document.getElementById('courses-grid');
  try {
    coursesList = await api('/api/admin/courses');
    if (!coursesList.length) { container.innerHTML = emptyState('📘', 'No courses added', 'Setup courses first'); return; }
    container.innerHTML = coursesList.map(c => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:16px;color:white">${escHtml(c.name)}</div>
          <span class="badge badge-gold">${escHtml(c.code)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px">
          <div>Duration: <strong style="color:white">${c.duration_weeks} weeks</strong></div>
          <div>Course Fee: <strong style="color:white">${formatINR(c.fee_amount)}</strong></div>
          ${c.description ? `<div>${escHtml(c.description)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

async function loadFees() {
  const container = document.getElementById('fees-table-body');
  try {
    const data = await api('/api/admin/fees');
    
    // Populate outstanding dropdown
    const paySelect = document.getElementById('pay-fee-id');
    const outstanding = data.filter(f => f.status !== 'paid');
    paySelect.innerHTML = '<option value="">-- Select Outstanding Invoice --</option>' + outstanding.map(f => `<option value="${f.id}">${f.student_name} (${formatINR(f.outstanding_amount)} outstanding)</option>`).join('');

    if (!data.length) { container.innerHTML = '<tr><td colspan="6" style="text-align:center">No fee ledgers recorded.</td></tr>'; return; }
    container.innerHTML = data.map(f => `
      <tr>
        <td style="font-weight:700">${escHtml(f.student_name)}</td>
        <td>${escHtml(f.course_name)}</td>
        <td>${formatINR(f.total_amount)}</td>
        <td>${formatINR(f.paid_amount)}</td>
        <td style="color:var(--accent-gold);font-weight:700">${formatINR(f.outstanding_amount)}</td>
        <td><span class="badge ${f.status === 'paid' ? 'badge-green' : 'badge-gold'}">${capitalize(f.status)}</span></td>
      </tr>`).join('');
  } catch(e) {}
}

async function loadCertificatesData() {
  // dropdown populated inside loadAllDropdownData
}

window.onSelectBatchForCerts = async function() {
  const batchId = document.getElementById('cert-batch-select').value;
  const container = document.getElementById('cert-students-checkboxes');
  if (!batchId) { container.innerHTML = '<span style="color:var(--text-muted)">Select a batch first...</span>'; return; }
  
  try {
    // Get students in batch
    const list = await api(`/api/admin/students`);
    // Filter students assigned to batch
    const batchData = await api('/api/batches');
    const b = batchData.find(x => x.id === batchId);
    
    // For demo/simplicity, display students checkboxes
    if (!list.length) { container.innerHTML = '<span style="color:var(--text-muted)">No students enrolled in database</span>'; return; }
    container.innerHTML = `
      <div style="margin-bottom:6px"><label><input type="checkbox" id="select-all-certs-checkbox" onchange="toggleSelectAllCerts(this)"> <strong>Select All</strong></label></div>
      ${list.map(s => `<div><label><input type="checkbox" name="cert-student-ids" value="${s.id}"> ${s.first_name} ${s.last_name}</label></div>`).join('')}
    `;
  } catch(e) {
    container.innerHTML = `<span style="color:var(--accent-superadmin)">Failed to load students list</span>`;
  }
};

window.toggleSelectAllCerts = function(master) {
  const checkboxes = document.querySelectorAll('input[name="cert-student-ids"]');
  checkboxes.forEach(cb => cb.checked = master.checked);
};

// Forms submissions handlers
window.onSubmitAddStudent = async function(e) {
  e.preventDefault();
  try {
    await api('/api/admin/students', 'POST', {
      first_name: document.getElementById('stud-first').value,
      last_name: document.getElementById('stud-last').value,
      email: document.getElementById('stud-email').value,
      phone: document.getElementById('stud-phone').value,
      city: document.getElementById('stud-city').value,
      password: document.getElementById('stud-pw').value,
    });
    showToast('Student enrolled successfully!', 'success');
    closeModal('add-student-modal');
    document.getElementById('add-student-form').reset();
    loadStudents();
    loadDashboardStats();
    loadAllDropdownData();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitAddFaculty = async function(e) {
  e.preventDefault();
  try {
    await api('/api/admin/faculty', 'POST', {
      first_name: document.getElementById('fac-first').value,
      last_name: document.getElementById('fac-last').value,
      email: document.getElementById('fac-email').value,
      phone: document.getElementById('fac-phone').value,
      specialization: document.getElementById('fac-spec').value,
      qualification: document.getElementById('fac-qual').value,
      password: document.getElementById('fac-pw').value,
    });
    showToast('Faculty member registered!', 'success');
    closeModal('add-faculty-modal');
    document.getElementById('add-faculty-form').reset();
    loadFaculty();
    loadDashboardStats();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitAddBatch = async function(e) {
  e.preventDefault();
  const checkedDays = Array.from(document.querySelectorAll('input[name="bat-days"]:checked')).map(cb => cb.value);
  if (!checkedDays.length) { showToast('Please select at least one lecture day', 'warning'); return; }
  
  try {
    await api('/api/admin/batches', 'POST', {
      name: document.getElementById('bat-name').value,
      max_students: parseInt(document.getElementById('bat-max').value),
      lecture_time: document.getElementById('bat-time').value,
      start_date: document.getElementById('bat-start').value,
      end_date: document.getElementById('bat-end').value,
      lecture_days: checkedDays,
    });
    showToast('Batch record created successfully!', 'success');
    closeModal('add-batch-modal');
    document.getElementById('add-batch-form').reset();
    loadBatches();
    loadDashboardStats();
    loadAllDropdownData();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitAddCourse = async function(e) {
  e.preventDefault();
  try {
    await api('/api/admin/courses', 'POST', {
      name: document.getElementById('crs-name').value,
      code: document.getElementById('crs-code').value,
      duration_weeks: parseInt(document.getElementById('crs-weeks').value),
      fee_amount: parseFloat(document.getElementById('crs-fee').value),
      description: document.getElementById('crs-desc').value,
    });
    showToast('Course registered successfully!', 'success');
    closeModal('add-course-modal');
    document.getElementById('add-course-form').reset();
    loadCourses();
    loadAllDropdownData();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitRecordPayment = async function(e) {
  e.preventDefault();
  try {
    await api('/api/admin/fees/payment', 'POST', {
      fee_id: document.getElementById('pay-fee-id').value,
      amount: parseFloat(document.getElementById('pay-amount').value),
      payment_mode: document.getElementById('pay-mode').value,
      reference_number: document.getElementById('pay-ref').value,
    });
    showToast('Payment ledger updated!', 'success');
    closeModal('record-payment-modal');
    document.getElementById('record-payment-form').reset();
    loadFees();
    loadDashboardStats();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitAssignStudent = async function(e) {
  e.preventDefault();
  const studentId = document.getElementById('assign-student-id').value;
  const batchId = document.getElementById('assign-batch-select').value;
  try {
    await api(`/api/admin/batches/${batchId}/students`, 'POST', { student_id: studentId });
    showToast('Student assigned to batch!', 'success');
    closeModal('assign-student-modal');
    loadStudents();
    loadDashboardStats();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitUploadCert = async function(e) {
  e.preventDefault();
  try {
    await api('/api/admin/certificates/upload', 'POST', {
      student_id: document.getElementById('cert-student-select').value,
      certificate_name: document.getElementById('cert-name').value,
      issue_date: document.getElementById('cert-date').value
    });
    showToast('Certificate issued successfully!', 'success');
    document.getElementById('upload-cert-form').reset();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitGenerateCerts = async function(e) {
  e.preventDefault();
  const checkboxes = Array.from(document.querySelectorAll('input[name="cert-student-ids"]:checked')).map(cb => cb.value);
  if (!checkboxes.length) { showToast('Select at least one student', 'warning'); return; }
  
  try {
    await api('/api/admin/certificates/generate', 'POST', {
      batch_id: document.getElementById('cert-batch-select').value,
      student_ids: checkboxes
    });
    showToast('Batch certificates generated and issued! 🎉', 'success');
    document.getElementById('generate-certs-form').reset();
    document.getElementById('cert-students-checkboxes').innerHTML = '<span style="color:var(--text-muted)">Select a batch first...</span>';
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitBroadcast = async function(e) {
  e.preventDefault();
  const targetType = document.getElementById('notif-target-type').value;
  const payload = {
    target_type: targetType,
    target_id: targetType === 'batch' ? document.getElementById('notif-batch').value : null,
    title: document.getElementById('notif-title').value,
    message: document.getElementById('notif-msg').value,
  };
  try {
    await api('/api/admin/notifications', 'POST', payload);
    showToast('Broadcast sent successfully!', 'success');
    document.getElementById('broadcast-notif-form').reset();
  } catch(err) { showToast(err.message, 'error'); }
};

window.toggleNotifTarget = function() {
  const t = document.getElementById('notif-target-type').value;
  document.getElementById('notif-batch-group').style.display = t === 'batch' ? 'block' : 'none';
};

// Utilities
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function capitalize(str) { if (!str) return '—'; return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g,' '); }
function escHtml(str) { const d = document.createElement('div'); d.appendChild(document.createTextNode(str||'')); return d.innerHTML; }
function emptyState(icon, title, sub) { return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:12px">${icon}</div><div style="font-weight:700;color:white;margin-bottom:4px">${title}</div><div>${sub}</div></div>`; }
function formatINR(amt) { return '₹' + (parseFloat(amt) || 0).toLocaleString('en-IN'); }
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i data-lucide="${icons[type]||'info'}"></i>${escHtml(msg)}`;
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => { toast.style.opacity='0'; setTimeout(() => toast.remove(), 300); }, 3000);
}
