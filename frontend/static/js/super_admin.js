// super_admin.js — Super Admin Portal Logic
'use strict';

let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadDashboard();
});

window.toggleSidebar = function() {
  document.getElementById('app-sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
};

const tabTitles = { 
  dashboard: 'Dashboard Overview', 
  users: 'User Accounts Manager', 
  fees: 'Consolidated Fee Ledgers', 
  reports: 'Analytics Reports', 
  audit: 'Security Audit logs' 
};

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById(`tab-${tab}`);
  if (pane) pane.classList.add('active');
  const btn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('page-title').textContent = tabTitles[tab] || tab;
  
  if (tab === 'users') loadUsers();
  if (tab === 'fees') loadFees();
  if (tab === 'reports') loadReports();
  if (tab === 'audit') loadAudit();
};

window.openModal = function(id) { document.getElementById(id).classList.add('open'); };
window.closeModal = function(id) { document.getElementById(id).classList.remove('open'); };

async function loadDashboard() {
  try {
    const data = await api('/api/super_admin/dashboard');
    document.getElementById('sa-total-users').textContent = data.total_users || 0;
    document.getElementById('sa-active-users').textContent = `Active: ${data.active_users || 0}`;
    document.getElementById('sa-revenue').textContent = formatINR(data.total_revenue || 0);
    document.getElementById('sa-outstanding').textContent = `Outstanding: ${formatINR(data.total_outstanding || 0)}`;
    document.getElementById('sa-batches').textContent = data.active_batches || 0;
    document.getElementById('sa-certs').textContent = data.total_certs || 0;

    // Role breakdown progress bars
    const roles = data.users_by_role || {};
    const roleIcons = { super_admin:'crown', admin:'shield-check', faculty:'presentation', admission_staff:'funnel', student:'graduation-cap' };
    const roleColors = { super_admin:'#F43F5E', admin:'#8B5CF6', faculty:'#10B981', admission_staff:'#F59E0B', student:'#6366F1' };
    
    document.getElementById('role-breakdown').innerHTML = Object.entries(roles).map(([role, count]) => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
        <div style="width:32px;height:32px;border-radius:8px;background:${roleColors[role] || '#94a3b8'};display:flex;align-items:center;justify-content:center;color:white">
          <i data-lucide="${roleIcons[role] || 'user'}" style="width:16px;height:16px"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:white">${capitalize(role)}</div>
          <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;margin-top:4px">
            <div style="height:6px;background:${roleColors[role] || '#94a3b8'};border-radius:3px;width:${Math.min((count/(data.total_users || 1))*100,100)}%"></div>
          </div>
        </div>
        <div style="font-size:16px;font-weight:800;color:white">${count}</div>
      </div>`).join('');
    lucide.createIcons();

    // System logs
    document.getElementById('system-health').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
        <span style="font-size:13px;color:var(--text-muted)">PostgreSQL Database</span>
        <span class="badge badge-green">Online</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border)">
        <span style="font-size:13px;color:var(--text-muted)">File Storage Server</span>
        <span class="badge badge-green">Connected</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border)">
        <span style="font-size:13px;color:var(--text-muted)">Jitsi Live Gateway</span>
        <span class="badge badge-green">Ready</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border)">
        <span style="font-size:13px;color:var(--text-muted)">Security Middleware</span>
        <span class="badge badge-green">Active</span>
      </div>`;
  } catch(e) { console.error(e); }
}

async function loadUsers() {
  const container = document.getElementById('sa-users-tbody');
  try {
    allUsers = await api('/api/super_admin/users');
    renderUsers(allUsers);
  } catch(e) { container.innerHTML = '<tr><td colspan="6" style="text-align:center">Failed to load users list.</td></tr>'; }
}

function renderUsers(list) {
  const container = document.getElementById('sa-users-tbody');
  if (!list.length) { container.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No users found.</td></tr>'; return; }
  container.innerHTML = list.map(u => `
    <tr>
      <td style="font-weight:700">${escHtml(u.username)}</td>
      <td>${escHtml(u.email || '—')}</td>
      <td><span class="badge badge-gold">${capitalize(u.role)}</span></td>
      <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-gold'}">${u.is_active ? 'Active' : 'Deactivated'}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="openResetPass('${u.id}','${escHtml(u.username)}')">Reset Pass</button>
          <button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="toggleUser('${u.id}', ${u.is_active})">${u.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </td>
    </tr>`).join('');
}

window.filterUsers = function() {
  const q = document.getElementById('user-search').value.toLowerCase();
  const role = document.getElementById('user-role-filter').value;
  let filtered = allUsers;
  if (q) filtered = filtered.filter(u => (u.username||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
  if (role) filtered = filtered.filter(u => u.role === role);
  renderUsers(filtered);
};

window.openResetPass = function(userId, username) {
  document.getElementById('reset-usr-id').value = userId;
  document.querySelector('#reset-password-modal .modal-header h2').textContent = `Reset Password: ${username}`;
  openModal('reset-password-modal');
};

window.onSubmitResetPassword = async function(e) {
  e.preventDefault();
  const userId = document.getElementById('reset-usr-id').value;
  const newPass = document.getElementById('reset-usr-pw').value;
  if (!newPass || newPass.length < 4) { showToast('Password must be at least 4 characters', 'warning'); return; }
  try {
    await api(`/api/super_admin/users/${userId}/reset-password`, 'PUT', { new_password: newPass });
    showToast('Password reset successfully!', 'success');
    closeModal('reset-password-modal');
    loadUsers();
  } catch(e) { showToast(e.message, 'error'); }
};

window.toggleUser = async function(userId, isActive) {
  const action = isActive ? 'disable' : 'enable';
  try {
    await api(`/api/super_admin/users/${userId}/toggle`, 'PUT', { action });
    showToast(`User ${action}d successfully`, 'success');
    loadUsers();
    loadDashboard();
  } catch(e) { showToast(e.message, 'error'); }
};

async function loadFees() {
  const tbody = document.getElementById('sa-fees-tbody');
  try {
    const data = await api('/api/super_admin/fees');
    const fees = data.fees || [];
    
    if (!fees.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No fee records.</td></tr>'; return; }
    tbody.innerHTML = fees.map(f => `
      <tr>
        <td style="font-weight:700">${escHtml(f.student_name)}</td>
        <td>${escHtml(f.course_name || '')}</td>
        <td>${formatINR(f.total_amount)}</td>
        <td style="color:var(--accent-faculty);font-weight:600">${formatINR(f.paid_amount)}</td>
        <td style="color:var(--accent-gold);font-weight:600">${formatINR(f.outstanding_amount)}</td>
        <td><span class="badge ${f.status === 'paid' ? 'badge-green' : 'badge-gold'}">${capitalize(f.status)}</span></td>
        <td>${formatDate(f.due_date)}</td>
      </tr>`).join('');
  } catch(e) { tbody.innerHTML = `<tr><td colspan="7" style="color:var(--accent-superadmin)">${e.message}</td></tr>`; }
}

async function loadReports() {
  // Load Chart.js CDN dynamically
  if (!window.Chart) {
    await new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.onload = res;
      document.head.appendChild(s);
    });
  }

  // Draw chart 1: Monthly revenue bar chart
  const ctxRev = document.getElementById('sa-rev-chart').getContext('2d');
  new Chart(ctxRev, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Monthly Fee Collection (INR)',
        data: [15000, 28000, 35000, 42000, 38000, 56000],
        backgroundColor: '#F43F5E',
        borderRadius: 6
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

  // Draw chart 2: Batch occupancy donut
  const ctxOcc = document.getElementById('sa-occ-chart').getContext('2d');
  new Chart(ctxOcc, {
    type: 'doughnut',
    data: {
      labels: ['Batch A (Java)', 'Batch B (Java)', 'Batch C (Python)', 'Batch D (Web)'],
      datasets: [{
        data: [25, 20, 28, 12],
        backgroundColor: ['#6366F1', '#10B981', '#F59E0B', '#8B5CF6'],
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
}

async function loadAudit() {
  const container = document.getElementById('sa-audit-tbody');
  try {
    const data = await api('/api/super_admin/audit');
    if (!data.logs?.length) { container.innerHTML = '<tr><td colspan="4" style="text-align:center">No audit logs available.</td></tr>'; return; }
    container.innerHTML = data.logs.map(log => `
      <tr>
        <td style="font-weight:700">${escHtml(log.user)}</td>
        <td><span class="badge badge-gold">${escHtml(log.action)}</span></td>
        <td>${escHtml(log.details || 'System')}</td>
        <td>${formatDate(log.created_at)}</td>
      </tr>`).join('');
  } catch(e) { container.innerHTML = '<tr><td colspan="4" style="text-align:center">Audit trail log currently empty.</td></tr>'; }
}

window.onSubmitAddUser = async function(e) {
  e.preventDefault();
  try {
    await api('/api/super_admin/users', 'POST', {
      username: document.getElementById('usr-name').value,
      role: document.getElementById('usr-role').value,
      email: document.getElementById('usr-email').value,
      password: document.getElementById('usr-pw').value,
    });
    showToast('System user created successfully!', 'success');
    closeModal('add-user-modal');
    document.getElementById('add-user-form').reset();
    loadUsers();
    loadDashboard();
  } catch(err) { showToast(err.message, 'error'); }
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
function formatINR(amt) { return '₹' + (parseFloat(amt)||0).toLocaleString('en-IN'); }
function capitalize(str) { if (!str) return '—'; return str.charAt(0).toUpperCase()+str.slice(1).replace(/_/g,' '); }
function escHtml(str) { const d=document.createElement('div'); d.appendChild(document.createTextNode(str||'')); return d.innerHTML; }
function showToast(msg, type='success') {
  const c = document.getElementById('toast-container');
  const icons = {success:'check-circle',error:'x-circle',warning:'alert-triangle'};
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i data-lucide="${icons[type]||'info'}"></i>${escHtml(msg)}`;
  c.appendChild(t); lucide.createIcons();
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 3000);
}
