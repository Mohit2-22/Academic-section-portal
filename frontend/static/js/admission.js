// admission.js — Admission Portal Logic
'use strict';

let inquiriesList = [];
const funnelStages = [
  { id: 'lead', label: 'Lead' },
  { id: 'seminar', label: 'Seminar' },
  { id: 'bootcamp', label: 'Bootcamp' },
  { id: 'counselling', label: 'Counselling' },
  { id: 'follow_up_1', label: 'Follow Up 1' },
  { id: 'follow_up_2', label: 'Follow Up 2' },
  { id: 'follow_up_3', label: 'Follow Up 3' },
  { id: 'follow_up_4', label: 'Follow Up 4' },
  { id: 'follow_up_5', label: 'Follow Up 5' },
  { id: 'admission', label: 'Admission ✅' }
];

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadDashboardStats();
  loadInquiries();
});

window.toggleSidebar = function() {
  document.getElementById('app-sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
};

const tabTitles = {
  dashboard: 'CRM Dashboard', funnel: 'Admission pipeline', inquiries: 'Prospect inquiries',
  'new-inquiry': 'Add New Lead', reports: 'Performance Reports'
};

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById(`tab-${tab}`);
  if (pane) pane.classList.add('active');
  const btn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('page-title').textContent = tabTitles[tab] || tab;

  if (tab === 'funnel') renderKanbanBoard();
  if (tab === 'inquiries') loadInquiries();
  if (tab === 'reports') loadReports();
};

window.openModal = function(id) { document.getElementById(id).classList.add('open'); };
window.closeModal = function(id) { document.getElementById(id).classList.remove('open'); };

async function loadDashboardStats() {
  try {
    const stats = await api('/api/admission/funnel-stats');
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const admitted = stats.admission || 0;
    const lost = 0; // Simulated loss leads or dropped
    
    document.getElementById('dash-total').textContent = total;
    document.getElementById('dash-admitted').textContent = admitted;
    document.getElementById('dash-funnel').textContent = total - admitted;
    document.getElementById('dash-lost').textContent = lost;

    // Render distribution chips
    const distEl = document.getElementById('stage-distribution');
    distEl.innerHTML = funnelStages.map(stage => {
      const count = stats[stage.id] || 0;
      return `
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:12px 18px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700">${stage.label}</div>
          <div style="font-size:20px;font-weight:800;color:white;margin-top:4px">${count}</div>
        </div>`;
    }).join('');
  } catch(e) {}
}

async function loadInquiries() {
  const tbody = document.getElementById('inquiries-tbody');
  try {
    inquiriesList = await api('/api/admission/inquiries');
    renderInquiriesTable(inquiriesList);
  } catch(e) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Failed to load inquiries.</td></tr>'; }
}

function renderInquiriesTable(list) {
  const tbody = document.getElementById('inquiries-tbody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No inquiries in pipeline.</td></tr>'; return; }
  tbody.innerHTML = list.map(inq => `
    <tr>
      <td style="font-weight:700">${escHtml(inq.first_name)} ${escHtml(inq.last_name)}</td>
      <td>${inq.mobile}</td>
      <td>${inq.city || '—'}</td>
      <td>${escHtml(inq.course_interest || '—')}</td>
      <td><span class="badge badge-gold">${capitalize(inq.reference_source)}</span></td>
      <td><span class="badge badge-blue">${capitalize(inq.funnel_stage)}</span></td>
      <td>${formatDate(inq.created_at)}</td>
      <td>
        <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="openLeadDetails('${inq.id}')">View Details</button>
      </td>
    </tr>`).join('');
}

window.filterInquiries = function() {
  const q = document.getElementById('inq-search').value.toLowerCase();
  const stage = document.getElementById('inq-stage-filter').value;
  
  const filtered = inquiriesList.filter(inq => {
    const matchSearch = `${inq.first_name} ${inq.last_name}`.toLowerCase().includes(q) || inq.mobile.includes(q);
    const matchStage = stage === '' ? true : inq.funnel_stage === stage;
    return matchSearch && matchStage;
  });
  renderInquiriesTable(filtered);
};

window.openLeadDetails = function(id) {
  const inq = inquiriesList.find(x => x.id === id);
  if (!inq) return;
  const container = document.getElementById('inquiry-detail-body');
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div>
        <p style="color:var(--text-muted)">Full Name</p>
        <p style="font-weight:700;color:white;font-size:16px">${inq.first_name} ${inq.middle_name || ''} ${inq.last_name}</p>
      </div>
      <div>
        <p style="color:var(--text-muted)">Mobile Number</p>
        <p style="font-weight:700;color:white;font-size:16px">${inq.mobile}</p>
      </div>
      <div>
        <p style="color:var(--text-muted)">City Location</p>
        <p style="font-weight:700;color:white">${inq.city || '—'}</p>
      </div>
      <div>
        <p style="color:var(--text-muted)">Course Interest</p>
        <p style="font-weight:700;color:white">${inq.course_interest || '—'}</p>
      </div>
      <div>
        <p style="color:var(--text-muted)">Father's Occupation & Phone</p>
        <p style="font-weight:700;color:white">${inq.father_occupation || '—'} (${inq.father_phone || '—'})</p>
      </div>
      <div>
        <p style="color:var(--text-muted)">Mother's Occupation & Phone</p>
        <p style="font-weight:700;color:white">${inq.mother_occupation || '—'} (${inq.mother_phone || '—'})</p>
      </div>
      <div>
        <p style="color:var(--text-muted)">Reference Source</p>
        <p style="font-weight:700;color:white">${capitalize(inq.reference_source)} ${inq.reference_other ? `(${inq.reference_other})` : ''}</p>
      </div>
      <div>
        <p style="color:var(--text-muted)">Pipeline Stage</p>
        <select onchange="updateLeadStage('${inq.id}', this.value)" style="padding:6px 12px;border-radius:8px;background:var(--bg-primary);color:white;border:1px solid var(--border)">
          ${funnelStages.map(s => `<option value="${s.id}" ${inq.funnel_stage === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px">
      <div style="font-weight:700;color:white;margin-bottom:8px">Counselling Conversation Notes</div>
      <textarea id="modal-notes-area" style="width:100%;height:100px;margin-bottom:8px" placeholder="Write internal notes here...">${inq.notes || ''}</textarea>
      <button class="btn btn-primary" onclick="saveLeadNotes('${inq.id}')">Save Notes</button>
    </div>
  `;
  openModal('inquiry-detail-modal');
};

window.updateLeadStage = async function(id, newStage) {
  try {
    await api(`/api/admission/inquiries/${id}/stage`, 'PUT', { stage: newStage });
    showToast(`Lead stage updated to ${capitalize(newStage)}`, 'success');
    loadInquiries();
    loadDashboardStats();
    if (document.getElementById('tab-funnel').classList.contains('active')) renderKanbanBoard();
  } catch(e) { showToast(e.message, 'error'); }
};

window.saveLeadNotes = async function(id) {
  const notes = document.getElementById('modal-notes-area').value;
  try {
    await api(`/api/admission/inquiries/${id}/notes`, 'PUT', { notes });
    showToast('Lead notes saved successfully!', 'success');
    loadInquiries();
  } catch(e) { showToast(e.message, 'error'); }
};

// Kanban Board Rendering with HTML5 DnD support
async function renderKanbanBoard() {
  const board = document.getElementById('funnel-board');
  board.innerHTML = '';
  
  try {
    const inquiries = await api('/api/admission/inquiries');
    
    funnelStages.forEach(stage => {
      const stageInqs = inquiries.filter(x => x.funnel_stage === stage.id);
      
      const column = document.createElement('div');
      column.className = 'kanban-column';
      column.id = `column-${stage.id}`;
      column.setAttribute('ondragover', 'allowDrop(event)');
      column.setAttribute('ondrop', `dropLead(event, '${stage.id}')`);
      
      column.innerHTML = `
        <div class="kanban-header">
          <span>${stage.label}</span>
          <span class="kanban-count">${stageInqs.length}</span>
        </div>
        <div class="kanban-cards" id="cards-${stage.id}"></div>
      `;
      
      const cardsContainer = column.querySelector(`.kanban-cards`);
      
      stageInqs.forEach(inq => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.id = `lead-${inq.id}`;
        card.setAttribute('ondragstart', 'dragLead(event)');
        card.onclick = () => openLeadDetails(inq.id);
        
        card.innerHTML = `
          <div style="font-weight:700;font-size:14px;color:white;margin-bottom:6px">${escHtml(inq.first_name)} ${escHtml(inq.last_name)}</div>
          <div style="font-size:11px;color:var(--text-muted)">Mobile: ${inq.mobile}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">City: ${inq.city || 'Mumbai'}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span class="badge badge-gold" style="font-size:9px">${capitalize(inq.reference_source)}</span>
          </div>
        `;
        cardsContainer.appendChild(card);
      });
      
      board.appendChild(column);
    });
  } catch(e) {}
}

window.allowDrop = function(ev) {
  ev.preventDefault();
};

window.dragLead = function(ev) {
  ev.dataTransfer.setData("text", ev.target.id);
};

window.dropLead = async function(ev, targetStage) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text");
  const id = data.replace('lead-', '');
  await updateLeadStage(id, targetStage);
};

window.onSubmitNewInquiry = async function(e) {
  e.preventDefault();
  const refSelect = document.getElementById('ni-ref');
  const refOther = document.getElementById('ni-other').value;
  try {
    await api('/api/admission/inquiries', 'POST', {
      first_name: document.getElementById('ni-first').value,
      middle_name: document.getElementById('ni-middle').value,
      last_name: document.getElementById('ni-last').value,
      city: document.getElementById('ni-city').value,
      mobile: document.getElementById('ni-mobile').value,
      father_occupation: document.getElementById('ni-father-occ').value,
      father_mobile: document.getElementById('ni-father-mob').value,
      mother_occupation: document.getElementById('ni-mother-occ').value,
      mother_mobile: document.getElementById('ni-mother-mob').value,
      reference_source: refSelect.value,
      reference_other: refSelect.value === 'other' ? refOther : '',
      course_interest: document.getElementById('ni-course').value,
      notes: document.getElementById('ni-notes').value,
    });
    showToast('Lead inquiry recorded!', 'success');
    document.getElementById('new-inquiry-form').reset();
    document.getElementById('ni-other-group').style.display = 'none';
    loadInquiries();
    loadDashboardStats();
  } catch(err) { showToast(err.message, 'error'); }
};

window.toggleRefOther = function() {
  const s = document.getElementById('ni-ref').value;
  document.getElementById('ni-other-group').style.display = s === 'other' ? 'block' : 'none';
};

// Dynamic chart reports with Chart.js
async function loadReports() {
  const refBreakdown = document.getElementById('ref-breakdown');
  const monthlyTrend = document.getElementById('monthly-trend');
  
  refBreakdown.innerHTML = '<div style="height:250px;width:100%"><canvas id="ref-chart"></canvas></div>';
  monthlyTrend.innerHTML = '<div style="height:250px;width:100%"><canvas id="trend-chart"></canvas></div>';
  
  // Load Chart.js CDN dynamically
  if (!window.Chart) {
    await new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.onload = res;
      document.head.appendChild(s);
    });
  }

  // Draw chart 1: Source conversion Breakdown
  const ctxRef = document.getElementById('ref-chart').getContext('2d');
  new Chart(ctxRef, {
    type: 'doughnut',
    data: {
      labels: ['Social Media', 'Newspaper', 'Friends/Relatives', 'Other'],
      datasets: [{
        data: [45, 25, 20, 10],
        backgroundColor: ['#6366F1', '#E8B84B', '#10B981', '#8B5CF6'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94A3B8' } }
      }
    }
  });

  // Draw chart 2: Line chart trend
  const ctxTrend = document.getElementById('trend-chart').getContext('2d');
  new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Monthly Admissions',
        data: [15, 22, 30, 28, 35, 42],
        borderColor: '#E8B84B',
        backgroundColor: 'rgba(232, 184, 75, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } }
      },
      plugins: {
        legend: { labels: { color: '#94A3B8' } }
      }
    }
  });
}

window.exportCSV = function() {
  if (!inquiriesList.length) { showToast('No data to export', 'warning'); return; }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Name,Mobile,City,Course,Reference,Stage,Created At\n";
  
  inquiriesList.forEach(inq => {
    const name = `"${inq.first_name} ${inq.last_name}"`;
    const mobile = `"${inq.mobile}"`;
    const city = `"${inq.city || ''}"`;
    const course = `"${inq.course_interest || ''}"`;
    const ref = `"${inq.reference_source}"`;
    const stage = `"${inq.funnel_stage}"`;
    const date = `"${inq.created_at}"`;
    csvContent += [name, mobile, city, course, ref, stage, date].join(",") + "\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Royal_Tech_Inquiries_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Inquiries exported as CSV successfully!', 'success');
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
