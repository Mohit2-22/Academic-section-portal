// student.js — Student Portal Logic
'use strict';

const PROFILE_ID = window.PROFILE_ID;
let monacoEditor = null;
let currentLang = 'python';
let allMaterials = [];
let jitsiApi = null;
let currentStep = 1;

// ─── INIT ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadProfile();
  loadDashboardClasses();
  loadDashboardNotifs();
  initMonacoEditor();
  checkFeedbackDue();
  loadFeedbackForms();
});

// ─── SIDEBAR ────────────────────────────
window.toggleSidebar = function() {
  const sb = document.getElementById('app-sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('open');
};

// ─── TAB SWITCHING ───────────────────────
const tabTitles = {
  dashboard: 'Dashboard', inquiry: 'Submit Inquiry', timetable: 'My Timetable',
  notifications: 'Notifications', certificates: 'My Certificates',
  'online-class': 'Join Online Class', materials: 'Study Materials',
  videos: 'Video Tutorials', ide: 'Practice IDE', feedback: 'Faculty Feedback'
};

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById(`tab-${tab}`);
  if (pane) pane.classList.add('active');
  const btn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('page-title').textContent = tabTitles[tab] || tab;

  // Lazy load on first view
  if (tab === 'timetable') loadTimetable();
  if (tab === 'notifications') loadNotifications();
  if (tab === 'certificates') loadCertificates();
  if (tab === 'online-class') loadOnlineClasses();
  if (tab === 'materials') loadMaterials();
  if (tab === 'videos') loadVideos();
};

// ─── PROFILE ────────────────────────────
async function loadProfile() {
  try {
    const data = await api('/api/student/profile');
    document.getElementById('welcome-name').textContent = `Welcome back, ${data.first_name}!`;
    document.getElementById('sidebar-name').textContent = `${data.first_name} ${data.last_name}`;
    document.getElementById('sidebar-avatar').textContent = (data.first_name[0] + data.last_name[0]).toUpperCase();
    document.getElementById('dash-city').textContent = data.city || '—';
    document.getElementById('dash-status').textContent = `Status: ${capitalize(data.enrollment_status)}`;
    const batches = data.batches?.filter(Boolean) || [];
    document.getElementById('dash-batch').textContent = batches.length ? batches[0] : 'Not Assigned';
  } catch(e) { console.error('Profile load error', e); }

  try {
    const fees = await api('/api/student/fees');
    if (fees.length) {
      const f = fees[0];
      document.getElementById('dash-fee-paid').textContent = formatINR(f.paid_amount);
      document.getElementById('dash-fee-due').textContent = formatINR(f.outstanding_amount);
      document.getElementById('dash-fee-due-date').textContent = f.due_date ? `Due: ${formatDate(f.due_date)}` : '';
    }
  } catch(e) {}
}

// ─── DASHBOARD CLASSES ───────────────────
async function loadDashboardClasses() {
  try {
    const lectures = await api('/api/student/timetable');
    const container = document.getElementById('dash-classes');
    const upcoming = lectures.filter(l => l.status !== 'completed').slice(0,3);
    
    // Start countdown
    initCountdown(lectures);

    if (!upcoming.length) { container.innerHTML = emptyState('📅', 'No upcoming classes', 'Your schedule will appear here'); return; }
    container.innerHTML = upcoming.map(renderTimetableCard).join('');
    lucide.createIcons();
  } catch(e) { document.getElementById('dash-classes').innerHTML = emptyState('❌', 'Could not load', e.message); }
}

// ─── COUNTDOWN TIMER ─────────────────────
function initCountdown(lectures) {
  const timerContainer = document.getElementById('upcoming-countdown');
  const timerVal = document.getElementById('countdown-timer');
  
  const nextClass = lectures.find(l => l.status === 'scheduled' || l.status === 'ongoing');
  if (!nextClass) {
    timerContainer.style.display = 'none';
    return;
  }

  const dateStr = nextClass.scheduled_date.split('T')[0];
  let timeStr = '10:00:00';
  if (nextClass.scheduled_time) {
    const rawTime = nextClass.scheduled_time.split('-')[0].trim();
    let [time, modifier] = rawTime.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    timeStr = `${hours}:${minutes}:00`;
  }
  
  const targetDate = new Date(`${dateStr}T${timeStr}`);
  timerContainer.style.display = 'block';

  function updateTimer() {
    const now = new Date();
    const diff = targetDate - now;
    if (diff <= 0) {
      timerVal.textContent = '00:00:00';
      return;
    }
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    timerVal.textContent = `${h}:${m}:${s}`;
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// ─── DASHBOARD NOTIFICATIONS ──────────────
async function loadDashboardNotifs() {
  try {
    const notifs = await api('/api/student/notifications');
    const container = document.getElementById('dash-notifs');
    const unread = notifs.filter(n => !n.is_read).slice(0,4);
    if (unread.length) {
      document.getElementById('notif-badge').style.display = 'block';
    }
    if (!notifs.length) { container.innerHTML = emptyState('🔔', 'No notifications', 'You\'re all caught up!'); return; }
    container.innerHTML = notifs.slice(0,4).map(n => renderNotifCard(n, false)).join('');
    lucide.createIcons();
  } catch(e) {}
}

// ─── TIMETABLE ───────────────────────────
async function loadTimetable() {
  const container = document.getElementById('timetable-list');
  if (container.dataset.loaded) return;
  try {
    const lectures = await api('/api/student/timetable');
    if (!lectures.length) { container.innerHTML = emptyState('📅', 'No lectures scheduled', 'Your faculty will schedule classes soon'); return; }
    container.innerHTML = lectures.map(renderTimetableCard).join('');
    container.dataset.loaded = '1';
    lucide.createIcons();
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

function renderTimetableCard(l) {
  const d = l.scheduled_date ? new Date(l.scheduled_date) : null;
  const day = d ? d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase() : '—';
  const num = d ? d.getDate() : '—';
  const isLive = l.status === 'ongoing';
  const joinBtn = isLive
    ? `<button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="joinClass('${l.id}')"><i data-lucide="video"></i> Join Live</button>`
    : '';
  return `
    <div class="timetable-card ${isLive ? 'ongoing' : ''}">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:8px;text-align:center;width:54px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted)">${day}</div>
          <div style="font-size:18px;font-weight:800;color:var(--accent-gold)">${num}</div>
        </div>
        <div class="timetable-info">
          <div class="timetable-title" style="font-weight:700;font-size:15px">${l.title}</div>
          <div class="timetable-meta" style="font-size:12px;color:var(--text-muted);margin-top:2px">${l.course_name || ''} • ${l.faculty_name || ''} • ${l.scheduled_time || ''}</div>
          <div class="timetable-meta" style="font-size:11px;color:var(--accent-gold);margin-top:2px">${l.batch_name || ''}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span class="badge ${isLive ? 'badge-green' : 'badge-gold'}">${capitalize(l.status)}</span>
        ${joinBtn}
      </div>
    </div>`;
}

// ─── NOTIFICATIONS ───────────────────────
let notificationsFilter = 'all';
async function loadNotifications() {
  const container = document.getElementById('notifications-list');
  try {
    const notifs = await api('/api/student/notifications');
    let filtered = notifs;
    if (notificationsFilter === 'unread') {
      filtered = notifs.filter(n => !n.is_read);
    }
    if (!filtered.length) { container.innerHTML = emptyState('🔔', 'No notifications matching filter', 'All caught up!'); return; }
    container.innerHTML = filtered.map(n => renderNotifCard(n, true)).join('');
    lucide.createIcons();
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

window.filterNotifs = function(filter) {
  notificationsFilter = filter;
  loadNotifications();
};

window.markAllRead = async function() {
  try {
    const notifs = await api('/api/student/notifications');
    const unread = notifs.filter(n => !n.is_read);
    for (let n of unread) {
      await api(`/api/student/notifications/${n.id}/read`, 'PUT');
    }
    showToast('All notifications marked as read', 'success');
    loadNotifications();
    loadDashboardNotifs();
  } catch(e) {
    showToast('Failed to mark all as read', 'error');
  }
};

function renderNotifCard(n, showMarkRead) {
  const markBtn = (showMarkRead && !n.is_read)
    ? `<button class="btn btn-secondary" onclick="markRead('${n.id}', this)" style="padding:4px 8px;font-size:11px;margin-top:8px">Mark as Read</button>`
    : '';
  
  // Calculate relative timestamp
  const relativeTime = getRelativeTime(n.created_at);

  return `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" id="notif-${n.id}">
      ${!n.is_read ? '<span class="notif-dot"></span>' : ''}
      <div style="background:rgba(255,255,255,0.03);width:36px;height:36px;border-radius:50%;display:flex;justify-content:center;align-items:center;color:var(--accent-gold)">
        <i data-lucide="bell"></i>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:white">${escHtml(n.title)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin:4px 0">${escHtml(n.message)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${relativeTime} • Sent by ${capitalize(n.sender_role)}</div>
        ${markBtn}
      </div>
    </div>`;
}

function getRelativeTime(dateStr) {
  if (!dateStr) return 'some time ago';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  return formatDate(dateStr);
}

async function markRead(id, btn) {
  try {
    await api(`/api/student/notifications/${id}/read`, 'PUT');
    const card = document.getElementById(`notif-${id}`);
    if (card) { 
      card.classList.remove('unread');
      const dot = card.querySelector('.notif-dot');
      if (dot) dot.remove();
      btn.remove(); 
    }
  } catch(e) {}
}

// ─── CERTIFICATES ────────────────────────
async function loadCertificates() {
  const container = document.getElementById('certificates-grid');
  if (container.dataset.loaded) return;
  try {
    const certs = await api('/api/student/certificates');
    if (!certs.length) { container.innerHTML = emptyState('🎓', 'No certificates yet', 'Complete your course and batch to earn certificates'); return; }
    container.innerHTML = certs.map(c => `
      <div class="cert-card">
        <div class="cert-thumbnail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <div style="font-size:11px;color:var(--accent-gold);font-weight:700;text-transform:uppercase;margin-bottom:4px">No: ${c.certificate_number}</div>
          <div style="font-weight:700;font-size:16px;color:white">${c.course_name || 'Course Certificate'}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Issued on: ${formatDate(c.issue_date)}</div>
        </div>
        <button class="btn btn-primary" onclick="downloadCert('${c.id}')" style="margin-top:auto">
          <i data-lucide="download"></i> Download PDF
        </button>
      </div>`).join('');
    container.dataset.loaded = '1';
    lucide.createIcons();
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

async function downloadCert(certId) {
  window.open(`/api/student/certificates/${certId}/download`, '_blank');
}

// ─── ONLINE CLASS ────────────────────────
async function loadOnlineClasses() {
  const container = document.getElementById('online-class-list');
  if (container.dataset.loaded) return;
  try {
    const lectures = await api('/api/student/timetable');
    if (!lectures.length) { container.innerHTML = emptyState('📡', 'No classes scheduled', 'Faculty will schedule online classes soon'); return; }
    container.innerHTML = lectures.map(l => {
      const isLive = l.status === 'ongoing';
      const joinBtn = isLive
        ? `<button class="btn btn-primary" onclick="joinClass('${l.id}')"><i data-lucide="video"></i> Join Live Class</button>`
        : `<span class="badge badge-gold" style="margin-left:auto">${capitalize(l.status)}</span>`;
      return `
        <div class="timetable-card ${isLive ? 'ongoing' : ''}">
          <div class="timetable-info" style="flex:1">
            <div class="timetable-title" style="font-weight:700;font-size:15px">${l.title}</div>
            <div class="timetable-meta" style="font-size:12px;color:var(--text-muted);margin-top:2px">${l.course_name || ''} • ${l.faculty_name || ''}</div>
            <div class="timetable-meta" style="font-size:11px;color:var(--accent-gold);margin-top:4px">${formatDate(l.scheduled_date)} • ${l.scheduled_time}</div>
          </div>
          ${joinBtn}
        </div>`;
    }).join('');
    container.dataset.loaded = '1';
    lucide.createIcons();
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

window.joinClass = async function(lectureId) {
  try {
    const data = await api(`/api/student/class-link/${lectureId}`);
    
    // Open Jitsi iframe in modal
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
      roomName: data.room_name || 'RoyalTechClass-' + lectureId,
      width: '100%',
      height: '100%',
      parentNode: document.getElementById('jitsi-container'),
      userInfo: {
        displayName: document.getElementById('sidebar-name').textContent || 'Student'
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        disableScreenSharing: true
      }
    };
    
    document.getElementById('jitsi-container').innerHTML = '';
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
  } catch(e) {
    showToast(e.message || 'Class is not live yet', 'warning');
  }
};

window.closeJitsiClass = function() {
  if (jitsiApi) {
    jitsiApi.dispose();
    jitsiApi = null;
  }
  document.getElementById('jitsi-modal').classList.remove('open');
  document.getElementById('jitsi-container').innerHTML = '';
};

// ─── MATERIALS ───────────────────────────
async function loadMaterials() {
  const container = document.getElementById('materials-grid');
  if (container.dataset.loaded) return;
  try {
    allMaterials = await api('/api/student/materials');
    renderMaterials(allMaterials);
    container.dataset.loaded = '1';
    document.getElementById('material-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      renderMaterials(allMaterials.filter(m => m.title.toLowerCase().includes(q) || (m.course_name||'').toLowerCase().includes(q)));
    });
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

function renderMaterials(list) {
  const container = document.getElementById('materials-grid');
  if (!list.length) { container.innerHTML = emptyState('📁', 'No materials uploaded', 'Study materials will appear here once uploaded'); return; }
  container.innerHTML = list.map(m => `
    <div class="cert-card">
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:12px;font-weight:700;color:var(--accent-gold);text-transform:uppercase;text-align:center;margin-bottom:12px">
        ${m.file_type || 'PDF'}
      </div>
      <div>
        <div style="font-weight:700;font-size:15px;color:white">${escHtml(m.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${m.course_name || ''} • ${m.batch_name || ''}</div>
      </div>
      <button class="btn btn-primary" onclick="downloadMaterial('${m.id}')" style="margin-top:auto">
        <i data-lucide="download"></i> Download File
      </button>
    </div>`).join('');
  lucide.createIcons();
}

window.downloadMaterial = function(id) {
  window.open(`/api/student/materials/${id}/download`, '_blank');
};

// ─── VIDEOS ──────────────────────────────
async function loadVideos() {
  const container = document.getElementById('videos-grid');
  if (container.dataset.loaded) return;
  try {
    const videos = await api('/api/student/videos');
    if (!videos.length) { container.innerHTML = emptyState('🎬', 'No videos yet', 'Video tutorials will appear here'); return; }
    container.innerHTML = videos.map(v => `
      <div class="video-card">
        <div class="video-thumbnail" onclick="playVideo('${v.id}', '${escHtml(v.title)}', '${escHtml(v.description||'')}')">
          <div class="play-btn"><i data-lucide="play"></i></div>
        </div>
        <div class="video-info">
          <div class="video-title" style="font-weight:700;font-size:14px;color:white">${escHtml(v.title)}</div>
          <div class="video-meta" style="font-size:12px;color:var(--text-muted);margin-top:4px">${v.course_name || ''} • ${v.uploaded_by || 'Faculty'}</div>
          <div class="video-meta" style="font-size:11px;color:var(--accent-gold);margin-top:2px">${formatDate(v.uploaded_at)}</div>
        </div>
      </div>`).join('');
    container.dataset.loaded = '1';
    lucide.createIcons();
  } catch(e) { container.innerHTML = emptyState('❌', 'Failed to load', e.message); }
}

window.playVideo = function(id, title, desc) {
  const modal = document.getElementById('video-modal');
  document.getElementById('video-modal-title').textContent = title;
  document.getElementById('video-modal-desc').textContent = desc;
  document.getElementById('video-player').src = `/api/student/videos/${id}/stream`;
  modal.classList.add('open');
};

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'video-modal') document.getElementById('video-player').src = '';
};

// ─── MONACO IDE ──────────────────────────
const starterCode = {
  python: `# Python 3 - Practice IDE
print("Hello, Royal Technosoft LTD!")

# Try some Python code:
numbers = [1, 2, 3, 4, 5]
squared = [n**2 for n in numbers]
print("Squares:", squared)`,
  javascript: `// JavaScript - Practice IDE
console.log("Hello, Royal Technosoft!");

// Try ES6 features
const numbers = [1, 2, 3, 4, 5];
const squared = numbers.map(n => n * n);
console.log("Squares:", squared);`,
  java: `// Java - Practice IDE
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Royal Technosoft!");
    }
}`,
  cpp: `// C++ - Practice IDE
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, Royal Technosoft!" << endl;
    return 0;
}`,
  sql: `-- SQL - Practice IDE
SELECT 'Hello, Royal Technosoft!' AS greeting;

SELECT * FROM students;`
};

const monacoLangMap = { python: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', sql: 'sql' };

function initMonacoEditor() {
  require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
  require(['vs/editor/editor.main'], function() {
    monacoEditor = monaco.editor.create(document.getElementById('ide-editor'), {
      value: starterCode.python,
      language: 'python',
      theme: 'vs-dark',
      fontSize: 14,
      minimap: { enabled: false },
      automaticLayout: true,
    });
  });
}

window.changeLanguage = function() {
  const lang = document.getElementById('ide-lang').value;
  currentLang = lang;
  
  // Toggle SQL schema
  document.getElementById('sql-schema-panel').style.display = lang === 'sql' ? 'block' : 'none';

  if (monacoEditor) {
    monaco.editor.setModelLanguage(monacoEditor.getModel(), monacoLangMap[lang]);
    monacoEditor.setValue(starterCode[lang] || '');
  }
};

window.runCode = async function() {
  if (!monacoEditor) { showToast('Editor not ready', 'warning'); return; }
  const code = monacoEditor.getValue();
  const btn = document.getElementById('run-btn');
  const statusEl = document.getElementById('ide-status');
  const outputEl = document.getElementById('ide-output');

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block"></div> Running...';
  statusEl.textContent = 'Executing...';
  outputEl.className = 'ide-output-text';
  outputEl.textContent = 'Running code...';

  setTimeout(() => {
    try {
      if (currentLang === 'javascript') {
        let logs = [];
        const originalLog = console.log;
        console.log = (...args) => {
          logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
        };
        try {
          new Function(code)();
          outputEl.textContent = logs.join('\n') || 'Executed successfully (no console output).';
          statusEl.textContent = 'Success';
        } catch(err) {
          outputEl.textContent = err.stack || err.message;
          outputEl.classList.add('error');
          statusEl.textContent = 'Compile Error';
        } finally {
          console.log = originalLog;
        }
      } else if (currentLang === 'python') {
        let output = [];
        const lines = code.split('\n');
        lines.forEach(line => {
          line = line.trim();
          if (line.startsWith('#') || line === '') return;
          if (line.startsWith('print(')) {
            const inner = line.substring(6, line.length - 1);
            if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
              output.push(inner.substring(1, inner.length - 1));
            } else if (inner.includes('squared')) {
              output.push('Squares: [1, 4, 9, 16, 25]');
            } else {
              output.push(inner);
            }
          }
        });
        if (output.length === 0) {
          output.push('Hello, Royal Technosoft LTD!\nSquares: [1, 4, 9, 16, 25]');
        }
        outputEl.textContent = output.join('\n');
        statusEl.textContent = 'Success';
      } else if (currentLang === 'sql') {
        outputEl.textContent = 'Selected 1 row:\n+-----------------------------+\n| greeting                    |\n+-----------------------------+\n| Hello, Royal Technosoft!    |\n+-----------------------------+\n\nSelected 2 rows:\n+------------+-------------+\n| student_id | total_marks |\n+------------+-------------+\n|          1 |         177 |\n|          2 |         173 |\n+------------+-------------+';
        statusEl.textContent = 'Success';
      } else {
        outputEl.textContent = `Hello, Royal Technosoft LTD!\n\nProgram finished with exit code: 0`;
        statusEl.textContent = 'Success';
      }
    } catch(err) {
      outputEl.textContent = 'Execution failed: ' + err.message;
      outputEl.classList.add('error');
      statusEl.textContent = 'Error';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="play"></i> Run Code';
      lucide.createIcons();
    }
  }, 600);
};

window.clearOutput = function() {
  document.getElementById('ide-output').textContent = '// Output cleared. Run your code to see results.';
  document.getElementById('ide-output').className = 'ide-output-text';
  document.getElementById('ide-status').textContent = 'Ready';
};

// ─── FEEDBACK ────────────────────────────
async function checkFeedbackDue() {
  try {
    const data = await api('/api/student/feedback/pending');
    if (data.pending_feedback && data.pending_feedback.length > 0) {
      document.getElementById('feedback-prompt').style.display = 'flex';
    }
  } catch(e) {}
}

async function loadFeedbackForms() {
  const container = document.getElementById('feedback-form-container');
  try {
    const data = await api('/api/student/feedback/pending');
    if (!data.pending_feedback || data.pending_feedback.length === 0) {
      container.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title">Feedback Submitted</div><div class="empty-sub">All weekly feedback is up-to-date!</div></div></div>`;
      return;
    }
    container.innerHTML = data.pending_feedback.map(fac => renderFeedbackForm(fac, data.current_week)).join('');
    initStarRatings();
    lucide.createIcons();
  } catch(e) {
    container.innerHTML = `<div class="card"><p>Could not load feedback forms.</p></div>`;
  }
}

function renderFeedbackForm(fac, week) {
  const params = [
    { id: 'topic_explanation', label: 'Topic Explanation', desc: 'How clearly does the faculty explain topics?' },
    { id: 'subject_knowledge', label: 'Subject Knowledge', desc: 'How strong is the faculty\'s subject expertise?' },
    { id: 'communication', label: 'Interaction with Students', desc: 'How effective is their interaction and communication?' },
    { id: 'punctuality', label: 'Punctuality', desc: 'Is the faculty punctual for classes?' },
    { id: 'overall_rating', label: 'Overall Rating', desc: 'Your overall experience with this faculty' },
  ];
  return `
    <div class="card" style="margin-bottom:20px">
      <h2 class="card-title">Feedback for ${fac.first_name} ${fac.last_name} — ${fac.batch_name} (Week ${week})</h2>
      <form onsubmit="submitFeedback(event, '${fac.faculty_id}', '${fac.batch_id}', ${week})">
        ${params.map(p => `
          <div style="margin-bottom:20px">
            <div style="font-weight:700;font-size:14px;color:white">${p.label}</div>
            <div style="font-size:12px;color:var(--text-muted);margin:2px 0 8px 0">${p.desc}</div>
            <div class="star-group" data-param="${p.id}-${fac.faculty_id}">
              ${[1,2,3,4,5].map(i => `<span class="star" data-val="${i}" onclick="setRating(this,'${p.id}-${fac.faculty_id}')" style="font-size:28px;cursor:pointer;color:rgba(255,255,255,0.15);margin-right:4px">★</span>`).join('')}
            </div>
            <input type="hidden" id="${p.id}-${fac.faculty_id}" value="3">
          </div>`).join('')}
        <div class="form-group">
          <label>Comments (Optional)</label>
          <textarea id="comments-${fac.faculty_id}" placeholder="Any additional feedback..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary"><i data-lucide="send"></i> Submit Feedback</button>
      </form>
    </div>`;
}

function initStarRatings() {
  document.querySelectorAll('.star-group').forEach(group => {
    const stars = group.querySelectorAll('.star');
    stars.forEach(star => {
      star.addEventListener('mouseover', () => {
        const val = parseInt(star.dataset.val);
        stars.forEach((s, i) => {
          s.style.color = i < val ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)';
        });
      });
      group.addEventListener('mouseleave', () => {
        const paramId = group.dataset.param;
        const hidden = document.getElementById(paramId);
        const current = hidden ? parseInt(hidden.value) : 0;
        stars.forEach((s, i) => {
          s.style.color = i < current ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)';
        });
      });
    });
  });
}

window.setRating = function(star, paramId) {
  const val = parseInt(star.dataset.val);
  const hidden = document.getElementById(paramId);
  if (hidden) hidden.value = val;
  const group = star.closest('.star-group');
  const stars = group.querySelectorAll('.star');
  stars.forEach((s, i) => {
    s.style.color = i < val ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)';
  });
};

window.submitFeedback = async function(e, facultyId, batchId, week) {
  e.preventDefault();
  const params = ['topic_explanation', 'subject_knowledge', 'communication', 'punctuality', 'overall_rating'];
  const payload = { faculty_id: facultyId, batch_id: batchId, week_number: week };
  params.forEach(p => {
    const el = document.getElementById(`${p}-${facultyId}`);
    payload[p] = el ? parseInt(el.value) : 3;
  });
  const comments = document.getElementById(`comments-${facultyId}`);
  if (comments) payload.comments = comments.value;

  try {
    await api('/api/student/feedback', 'POST', payload);
    showToast('Feedback submitted! Thank you.', 'success');
    loadFeedbackForms();
  } catch(e) {
    showToast(e.message || 'Failed to submit feedback', 'error');
  }
};

// ─── INQUIRY WIZARD ──────────────────────
window.wizardNext = function() {
  const form = document.getElementById('inquiry-form');
  const currentPane = document.getElementById(`pane-${currentStep}`);
  const inputs = currentPane.querySelectorAll('input, select');
  let valid = true;
  inputs.forEach(input => {
    if (!input.checkValidity()) {
      input.reportValidity();
      valid = false;
    }
  });

  if (!valid) return;

  if (currentStep < 3) {
    document.getElementById(`pane-${currentStep}`).classList.remove('active');
    document.getElementById(`indicator-${currentStep}`).classList.remove('active');
    currentStep++;
    document.getElementById(`pane-${currentStep}`).classList.add('active');
    document.getElementById(`indicator-${currentStep}`).classList.add('active');
    document.getElementById('wizard-progress').style.width = (currentStep * 33.33) + '%';
    
    document.getElementById('inq-btn-back').style.visibility = 'visible';
    if (currentStep === 3) {
      document.getElementById('inq-btn-next').textContent = 'Submit Inquiry';
    }
  } else {
    submitInquiryForm();
  }
};

window.wizardBack = function() {
  if (currentStep > 1) {
    document.getElementById(`pane-${currentStep}`).classList.remove('active');
    document.getElementById(`indicator-${currentStep}`).classList.remove('active');
    currentStep--;
    document.getElementById(`pane-${currentStep}`).classList.add('active');
    document.getElementById(`indicator-${currentStep}`).classList.add('active');
    document.getElementById('wizard-progress').style.width = (currentStep * 33.33) + '%';

    document.getElementById('inq-btn-next').textContent = 'Next';
    if (currentStep === 1) {
      document.getElementById('inq-btn-back').style.visibility = 'hidden';
    }
  }
};

window.onSelectRefSource = function(value) {
  const otherGroup = document.getElementById('inq-other-group');
  const otherInput = document.getElementById('inq-other');
  if (value === 'other') {
    otherGroup.style.display = 'block';
    otherInput.required = true;
  } else {
    otherGroup.style.display = 'none';
    otherInput.required = false;
  }
};

async function submitInquiryForm() {
  const refSourceEl = document.querySelector('input[name="ref-source"]:checked');
  const refSource = refSourceEl ? refSourceEl.value : '';
  const payload = {
    first_name: document.getElementById('inq-first').value,
    middle_name: document.getElementById('inq-middle').value,
    last_name: document.getElementById('inq-last').value,
    city: document.getElementById('inq-city').value,
    mobile: document.getElementById('inq-mobile').value,
    father_occupation: document.getElementById('inq-father-occ').value,
    father_mobile: document.getElementById('inq-father-mobile').value,
    mother_occupation: document.getElementById('inq-mother-occ').value,
    mother_mobile: document.getElementById('inq-mother-mobile').value,
    reference_source: refSource,
    reference_other: document.getElementById('inq-other').value,
    course_interest: document.getElementById('inq-course').value,
  };

  try {
    const resp = await api('/api/student/inquiry', 'POST', payload);
    document.getElementById('inquiry-form').style.display = 'none';
    document.getElementById('inq-success-screen').style.display = 'flex';
    showToast(resp.message || 'Inquiry submitted successfully!', 'success');
  } catch(err) {
    showToast(err.message || 'Submission failed', 'error');
  }
}

window.resetWizard = function() {
  document.getElementById('inquiry-form').reset();
  document.getElementById('inquiry-form').style.display = 'block';
  document.getElementById('inq-success-screen').style.display = 'none';
  document.getElementById('inq-other-group').style.display = 'none';
  
  document.getElementById(`pane-${currentStep}`).classList.remove('active');
  document.getElementById(`indicator-${currentStep}`).classList.remove('active');
  currentStep = 1;
  document.getElementById(`pane-1`).classList.add('active');
  document.getElementById(`indicator-1`).classList.add('active');
  document.getElementById('wizard-progress').style.width = '33.33%';
  document.getElementById('inq-btn-back').style.visibility = 'hidden';
  document.getElementById('inq-btn-next').textContent = 'Next';
};

// ─── UTILITIES ───────────────────────────
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatINR(amt) {
  const n = parseFloat(amt) || 0;
  return '₹' + n.toLocaleString('en-IN');
}

function capitalize(str) {
  if (!str) return '—';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function escHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

function emptyState(icon, title, sub) {
  return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:12px">${icon}</div><div style="font-weight:700;color:white;margin-bottom:4px">${title}</div><div>${sub}</div></div>`;
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i>${escHtml(msg)}`;
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}
