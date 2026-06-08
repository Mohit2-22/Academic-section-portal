// faculty.js — Faculty Portal Logic
'use strict';

let batches = [], courses = [];
let jitsiApi = null;

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadProfile();
  loadDashboardStats();
  loadBatchesForDropdowns();
  initForms();
  initDragAndDrop();
});

window.toggleSidebar = function() {
  document.getElementById('app-sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
};

const tabTitles = {
  dashboard: 'Dashboard', batches: 'My Batches', lectures: 'Lectures',
  materials: 'Upload Materials', videos: 'Upload Videos',
  assignments: 'Assignments', feedback: 'Student Feedback', notifications: 'Send Notification'
};

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById(`tab-${tab}`);
  if (pane) pane.classList.add('active');
  const btn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('page-title').textContent = tabTitles[tab] || tab;

  if (tab === 'batches') loadBatches();
  if (tab === 'lectures') loadLectures();
  if (tab === 'materials') loadMyMaterials();
  if (tab === 'videos') loadMyVideos();
  if (tab === 'assignments') loadAssignments();
  if (tab === 'feedback') loadFeedback();
};

window.openModal = function(id) { document.getElementById(id).classList.add('open'); };
window.closeModal = function(id) { document.getElementById(id).classList.remove('open'); };

async function loadProfile() {
  try {
    const data = await api('/api/faculty/profile');
    document.getElementById('welcome-name').textContent = `Welcome, ${data.first_name} ${data.last_name}!`;
    document.getElementById('sidebar-name').textContent = `${data.first_name} ${data.last_name}`;
    document.getElementById('sidebar-avatar').textContent = (data.first_name[0] + data.last_name[0]).toUpperCase();
  } catch(e) {}
}

async function loadDashboardStats() {
  try {
    const [batchData, lectureData, materialData, assignmentData] = await Promise.all([
      api('/api/faculty/batches'),
      api('/api/faculty/lectures'),
      api('/api/faculty/materials'),
      api('/api/faculty/assignments'),
    ]);
    document.getElementById('dash-batches').textContent = batchData.length;
    document.getElementById('dash-lectures').textContent = lectureData.length;
    document.getElementById('dash-materials').textContent = materialData.length;
    document.getElementById('dash-assignments').textContent = assignmentData.length;

    // Today's lectures
    const today = new Date().toISOString().split('T')[0];
    const todayLectures = lectureData.filter(l => l.scheduled_date?.startsWith(today));
    const todayEl = document.getElementById('today-lectures');
    if (!todayLectures.length) {
      todayEl.innerHTML = emptyState('📅', 'No lectures scheduled today', 'Enjoy your day off!');
    } else {
      todayEl.innerHTML = todayLectures.map(l => `
        <div class="timetable-card ${l.status === 'ongoing' ? 'ongoing' : ''}">
          <div style="flex:1">
            <div style="font-weight:700;font-size:15px;color:white">${escHtml(l.title)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${l.batch_name} • ${l.scheduled_time}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="badge ${l.status === 'ongoing' ? 'badge-green' : 'badge-gold'}">${capitalize(l.status)}</span>
            ${l.status === 'scheduled' ? `<button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="startClass('${l.id}')"><i data-lucide="play"></i> Start Class</button>` : ''}
            ${l.status === 'ongoing' ? `<button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="endClass('${l.id}')"><i data-lucide="square"></i> End Class</button>` : ''}
          </div>
        </div>`).join('');
      lucide.createIcons();
    }
  } catch(e) {}
}

async function loadBatchesForDropdowns() {
  try {
    batches = await api('/api/faculty/batches');
    courses = await api('/api/admin/courses');
    const selects = ['lec-batch', 'mat-batch', 'vid-batch', 'asgn-batch', 'notif-batch'];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<option value="">-- Select Batch --</option>' + batches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
      }
    });
    const courseSelects = ['lec-course', 'mat-course', 'vid-course', 'asgn-course'];
    courseSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<option value="">-- Select Subject --</option>' + courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    });
  } catch(e) {}
}

async function loadBatches() {
  const container = document.getElementById('batches-grid');
  if (container.dataset.loaded) return;
  try {
    const data = await api('/api/faculty/batches');
    if (!data.length) { container.innerHTML = emptyState('👥', 'No batches assigned', 'Admin will assign batches to you'); return; }
    container.innerHTML = data.map(b => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:16px;color:white">${escHtml(b.name)}</div>
          <span class="badge badge-gold">${capitalize(b.status)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:6px">
          <div>Students Enrolled: <strong style="color:white">${b.enrolled_count} / ${b.max_students}</strong></div>
          <div>Lecture Timings: <strong style="color:white">${b.lecture_time || '—'}</strong></div>
          <div>Duration: <strong style="color:white">${formatDate(b.start_date)} to ${formatDate(b.end_date)}</strong></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:14px">
          ${(b.lecture_days||[]).map(d => `<span style="background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:6px;font-size:11px;color:var(--accent-gold)">${d.substring(0,3)}</span>`).join('')}
        </div>
      </div>`).join('');
    container.dataset.loaded = '1';
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

async function loadLectures() {
  const container = document.getElementById('lectures-list');
  try {
    const data = await api('/api/faculty/lectures');
    if (!data.length) { container.innerHTML = emptyState('📅', 'No lectures yet', 'Schedule your first lecture'); return; }
    container.innerHTML = data.map(l => {
      const d = l.scheduled_date ? new Date(l.scheduled_date) : null;
      return `
        <div class="timetable-card ${l.status === 'ongoing' ? 'ongoing' : ''}">
          <div style="display:flex;align-items:center;gap:16px">
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:8px;text-align:center;width:54px">
              <div style="font-size:10px;font-weight:700;color:var(--text-muted)">${d ? d.toLocaleDateString('en-IN',{weekday:'short'}).toUpperCase() : '—'}</div>
              <div style="font-size:18px;font-weight:800;color:var(--accent-gold)">${d ? d.getDate() : '—'}</div>
            </div>
            <div class="timetable-info">
              <div class="timetable-title" style="font-weight:700;font-size:15px;color:white">${escHtml(l.title)}</div>
              <div class="timetable-meta" style="font-size:12px;color:var(--text-muted);margin-top:2px">${l.batch_name || ''} • ${l.course_name || ''} • ${l.scheduled_time || ''}</div>
              <div class="timetable-meta" style="font-family:monospace;font-size:11px;color:var(--accent-gold);margin-top:4px">Room: ${l.jitsi_room || '—'}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            <span class="badge ${l.status === 'ongoing' ? 'badge-green' : 'badge-gold'}">${capitalize(l.status)}</span>
            <div style="display:flex;gap:6px">
              ${l.status === 'scheduled' ? `<button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="startClass('${l.id}')"><i data-lucide="play"></i> Start</button>` : ''}
              ${l.status === 'ongoing' ? `<button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="endClass('${l.id}')"><i data-lucide="square"></i> End</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
    lucide.createIcons();
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

window.startClass = async function(id) {
  try {
    const data = await api(`/api/faculty/lectures/${id}/start`, 'PUT');
    showToast(`Class started! Opening Jitsi classroom...`, 'success');
    
    // Open full-screen Jitsi Meet modal for educator
    document.getElementById('jitsi-modal').classList.add('open');
    
    if (!window.JitsiMeetExternalAPI) {
      await new Promise(res => {
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.onload = res;
        document.head.appendChild(script);
      });
    }

    const domain = 'meet.jit.si';
    const options = {
      roomName: data.room_name || 'RoyalTechClass-' + id,
      width: '100%',
      height: '100%',
      parentNode: document.getElementById('jitsi-container'),
      userInfo: {
        displayName: document.getElementById('sidebar-name').textContent || 'Educator'
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableScreenSharing: false // Educator CAN share screen
      }
    };
    
    document.getElementById('jitsi-container').innerHTML = '';
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
    
    setTimeout(() => {
      loadLectures();
      loadDashboardStats();
    }, 1000);
  } catch(e) { showToast(e.message, 'error'); }
};

window.closeJitsiClass = function() {
  if (jitsiApi) {
    jitsiApi.dispose();
    jitsiApi = null;
  }
  document.getElementById('jitsi-modal').classList.remove('open');
  document.getElementById('jitsi-container').innerHTML = '';
};

window.endClass = async function(id) {
  try {
    await api(`/api/faculty/lectures/${id}/end`, 'PUT');
    showToast('Class ended and marked as completed', 'success');
    loadLectures();
    loadDashboardStats();
  } catch(e) { showToast(e.message, 'error'); }
};

async function loadMyMaterials() {
  const container = document.getElementById('my-materials-list');
  try {
    const data = await api('/api/faculty/materials');
    if (!data.length) { container.innerHTML = emptyState('📁', 'No materials uploaded yet', 'Use the form above to upload your first material'); return; }
    container.innerHTML = data.map(m => `
      <div class="cert-card">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:8px;font-size:12px;font-weight:700;color:var(--accent-gold);text-transform:uppercase;text-align:center;margin-bottom:12px">
          ${m.file_type || 'PDF'}
        </div>
        <div>
          <div style="font-weight:700;font-size:15px;color:white">${escHtml(m.title)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${m.batch_name || ''} • ${m.course_name || ''}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px">${m.file_name} • ${formatDate(m.uploaded_at)}</div>
        </div>
      </div>`).join('');
  } catch(e) {}
}

async function loadMyVideos() {
  const container = document.getElementById('my-videos-list');
  try {
    const data = await api('/api/faculty/videos');
    if (!data.length) { container.innerHTML = emptyState('🎬', 'No videos uploaded yet', 'Use the form above to upload your first video'); return; }
    container.innerHTML = data.map(v => `
      <div class="video-card">
        <div class="video-thumbnail">
          <div class="play-btn"><i data-lucide="play"></i></div>
        </div>
        <div class="video-info">
          <div class="video-title" style="font-weight:700;font-size:14px;color:white">${escHtml(v.title)}</div>
          <div class="video-meta" style="font-size:12px;color:var(--text-muted);margin-top:4px">${v.batch_name || ''} • ${formatDate(v.uploaded_at)}</div>
        </div>
      </div>`).join('');
    lucide.createIcons();
  } catch(e) {}
}

async function loadAssignments() {
  const container = document.getElementById('assignments-list');
  try {
    const data = await api('/api/faculty/assignments');
    if (!data.length) { container.innerHTML = emptyState('📋', 'No assignments created', 'Create your first assignment'); return; }
    container.innerHTML = data.map(a => {
      const due = a.due_date ? new Date(a.due_date) : null;
      const today = new Date();
      let dueClass = 'badge-gold', dueLabel = a.due_date ? formatDate(a.due_date) : 'No deadline';
      if (due) {
        const diff = (due - today) / (1000*60*60*24);
        if (diff < 0) { dueClass = 'badge-green'; dueLabel = 'Completed / Overdue'; }
      }
      return `
        <div class="timetable-card">
          <div style="flex:1">
            <div class="timetable-title" style="font-weight:700;font-size:15px;color:white">${escHtml(a.title)}</div>
            <div class="timetable-meta" style="font-size:12px;color:var(--text-muted);margin-top:2px">${a.batch_name || ''} • ${a.course_name || ''} • Max Marks: ${a.max_marks}</div>
            ${a.description ? `<div style="font-size:13px;color:var(--text-muted);margin-top:6px">${escHtml(a.description)}</div>` : ''}
          </div>
          <span class="badge ${dueClass}">${dueLabel}</span>
        </div>`;
    }).join('');
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

async function loadFeedback() {
  const summaryEl = document.getElementById('feedback-summary');
  const commentsEl = document.getElementById('feedback-comments');
  try {
    const data = await api('/api/faculty/feedback');
    const s = data.summary;
    const params = [
      { key: 'avg_topic', label: 'Topic Explanation' },
      { key: 'avg_knowledge', label: 'Subject Knowledge' },
      { key: 'avg_communication', label: 'Communication' },
      { key: 'avg_punctuality', label: 'Punctuality' },
      { key: 'avg_overall', label: 'Overall Rating' },
    ];
    if (!s || !s.total_responses) {
      summaryEl.innerHTML = `<div class="card" style="grid-column:1/-1">${emptyState('⭐', 'No feedback yet', 'Feedback submitted by your students weekly will show here.')}</div>`;
      return;
    }
    summaryEl.innerHTML = params.map(p => {
      const val = parseFloat(s[p.key] || 0).toFixed(1);
      const stars = '★'.repeat(Math.round(val)) + '☆'.repeat(5 - Math.round(val));
      return `
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">${p.label}</span>
            <span class="stat-value">${val}</span>
            <span class="stat-sub" style="color:var(--accent-gold)">${stars}</span>
          </div>
        </div>`;
    }).join('') + `
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Total Submissions</span>
            <span class="stat-value">${s.total_responses}</span>
            <span class="stat-sub">Active reviews</span>
          </div>
        </div>`;

    if (data.recent?.length) {
      commentsEl.innerHTML = data.recent.filter(r => r.comments).map(r => `
        <div class="timetable-card">
          <div style="flex:1">
            <div style="font-size:14px;color:white;font-style:italic">"${escHtml(r.comments)}"</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px">— Student • Week ${r.week_number}</div>
          </div>
        </div>`).join('') || '<p style="color:var(--text-muted);font-size:13px;padding:20px">No comments submitted yet.</p>';
    }
  } catch(e) {}
}

function initDragAndDrop() {
  ['dropzone-material', 'dropzone-video'].forEach(id => {
    const zone = document.getElementById(id);
    if (!zone) return;
    
    ['dragenter', 'dragover'].forEach(name => {
      zone.addEventListener(name, (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    });
    
    ['dragleave', 'drop'].forEach(name => {
      zone.addEventListener(name, (e) => { e.preventDefault(); zone.classList.remove('dragover'); });
    });
    
    zone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length) {
        const inputId = id === 'dropzone-material' ? 'mat-file' : 'vid-file';
        const fileInput = document.getElementById(inputId);
        if (fileInput) {
          fileInput.files = files;
          const labelId = id === 'dropzone-material' ? 'mat-file-info' : 'vid-file-info';
          document.getElementById(labelId).textContent = `Selected: ${files[0].name} (${formatBytes(files[0].size)})`;
        }
      }
    });
  });
}

function initForms() {
  document.getElementById('mat-file')?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    document.getElementById('mat-file-info').textContent = f ? `Selected: ${f.name} (${formatBytes(f.size)})` : '';
  });
  document.getElementById('vid-file')?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    document.getElementById('vid-file-info').textContent = f ? `Selected: ${f.name} (${formatBytes(f.size)})` : '';
  });
}

window.onSubmitScheduleLecture = async function(e) {
  e.preventDefault();
  try {
    const data = await api('/api/faculty/lectures', 'POST', {
      batch_id: document.getElementById('lec-batch').value,
      course_id: document.getElementById('lec-course').value || null,
      title: document.getElementById('lec-title').value,
      scheduled_date: document.getElementById('lec-date').value,
      scheduled_time: document.getElementById('lec-time').value,
      duration_minutes: parseInt(document.getElementById('lec-duration').value),
    });
    showToast('Lecture scheduled successfully!', 'success');
    closeModal('schedule-lecture-modal');
    document.getElementById('schedule-lecture-form').reset();
    loadLectures();
    loadDashboardStats();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitMaterial = async function(e) {
  e.preventDefault();
  const file = document.getElementById('mat-file').files[0];
  if (!file) { showToast('Please select a file to upload', 'warning'); return; }
  const formData = new FormData();
  formData.append('batch_id', document.getElementById('mat-batch').value);
  formData.append('course_id', document.getElementById('mat-course').value);
  formData.append('title', document.getElementById('mat-title').value);
  formData.append('description', document.getElementById('mat-desc').value);
  formData.append('file', file);
  
  try {
    const resp = await fetch('/api/faculty/materials', { method: 'POST', body: formData });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    showToast('Material uploaded successfully!', 'success');
    document.getElementById('upload-material-form').reset();
    document.getElementById('mat-file-info').textContent = '';
    loadMyMaterials();
    loadDashboardStats();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitVideo = async function(e) {
  e.preventDefault();
  const file = document.getElementById('vid-file').files[0];
  if (!file) { showToast('Please select a video file', 'warning'); return; }
  const formData = new FormData();
  formData.append('batch_id', document.getElementById('vid-batch').value);
  formData.append('course_id', document.getElementById('vid-course').value);
  formData.append('title', document.getElementById('vid-title').value);
  formData.append('description', document.getElementById('vid-desc').value);
  formData.append('file', file);
  showToast('Uploading video... please wait', 'warning');
  
  try {
    const resp = await fetch('/api/faculty/videos', { method: 'POST', body: formData });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    showToast('Video uploaded successfully!', 'success');
    document.getElementById('upload-video-form').reset();
    document.getElementById('vid-file-info').textContent = '';
    loadMyVideos();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitAssignment = async function(e) {
  e.preventDefault();
  try {
    await api('/api/faculty/assignments', 'POST', {
      batch_id: document.getElementById('asgn-batch').value,
      course_id: document.getElementById('asgn-course').value || null,
      title: document.getElementById('asgn-title').value,
      description: document.getElementById('asgn-desc').value,
      due_date: document.getElementById('asgn-due').value || null,
      max_marks: parseInt(document.getElementById('asgn-marks').value),
    });
    showToast('Assignment created!', 'success');
    closeModal('create-assignment-modal');
    document.getElementById('create-assignment-form').reset();
    loadAssignments();
    loadDashboardStats();
  } catch(err) { showToast(err.message, 'error'); }
};

window.onSubmitNotification = async function(e) {
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
    showToast('Notification alert dispatched!', 'success');
    document.getElementById('send-notif-form').reset();
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
function formatBytes(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }
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
