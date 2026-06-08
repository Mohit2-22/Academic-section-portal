import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Power, PowerOff, Trash2, Search, X } from 'lucide-react';
import api from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import ConfirmModal from '../../components/shared/ConfirmModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#F43F5E';

const ROLES = ['admin', 'admission_staff', 'faculty'];
const ROLE_LABELS = { admin: 'Admin', admission_staff: 'Admission Staff', faculty: 'Faculty' };

const DUMMY_USERS = [
  { id: 'u1', name: 'Rahul Sharma', email: 'rahul@institute.com', role: 'admin', phone: '9876543210', status: 'active', created_at: '2025-01-15', last_login: '2026-06-04' },
  { id: 'u2', name: 'Priya Verma', email: 'priya@institute.com', role: 'admin', phone: '9876543211', status: 'active', created_at: '2025-02-10', last_login: '2026-06-03' },
  { id: 'u3', name: 'Amit Kumar', email: 'amit@institute.com', role: 'admin', phone: '9876543212', status: 'inactive', created_at: '2025-03-05', last_login: '2026-04-20' },
  { id: 'u4', name: 'Neha Singh', email: 'neha@institute.com', role: 'admission_staff', phone: '9876543213', status: 'active', created_at: '2025-01-20', last_login: '2026-06-04' },
  { id: 'u5', name: 'Raj Patel', email: 'raj@institute.com', role: 'admission_staff', phone: '9876543214', status: 'active', created_at: '2025-04-12', last_login: '2026-06-02' },
  { id: 'u6', name: 'Sneha Reddy', email: 'sneha@institute.com', role: 'admission_staff', phone: '9876543215', status: 'inactive', created_at: '2025-05-18', last_login: '2026-03-15' },
  { id: 'u7', name: 'Dr. Vikram Mehta', email: 'vikram@institute.com', role: 'faculty', phone: '9876543216', status: 'active', created_at: '2025-01-10', last_login: '2026-06-04' },
  { id: 'u8', name: 'Prof. Anjali Gupta', email: 'anjali@institute.com', role: 'faculty', phone: '9876543217', status: 'active', created_at: '2025-02-22', last_login: '2026-06-03' },
];

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/super-admin/users');
        setUsers(Array.isArray(res) ? res : res?.users || []);
      } catch {
        setUsers(DUMMY_USERS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredUsers = activeTab === 'all' ? users : users.filter(u => u.role === activeTab);

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
  };

  const handleEditSave = async () => {
    if (!editForm.name.trim()) { toast.error('Name is required'); return; }
    if (!editForm.email.trim()) { toast.error('Email is required'); return; }
    if (!editForm.phone.trim()) { toast.error('Phone is required'); return; }
    try {
      await api.put(`/api/super-admin/users/${editingUser.id}`, editForm);
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...editForm } : u));
      toast.success('User updated successfully!');
    } catch {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...editForm } : u));
      toast.success('User updated (demo mode)');
    } finally {
      setEditingUser(null);
    }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    try {
      await api.put(`/api/super-admin/users/${toggleTarget.id}/toggle`);
      setUsers(users.map(u => u.id === toggleTarget.id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u));
      toast.success(`User ${toggleTarget.status === 'active' ? 'deactivated' : 'activated'} successfully!`);
    } catch {
      setUsers(users.map(u => u.id === toggleTarget.id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u));
      toast.success(`User ${toggleTarget.status === 'active' ? 'deactivated' : 'activated'} (demo mode)`);
    } finally {
      setToggleTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/super-admin/users/${deleteTarget.id}`);
      setUsers(users.filter(u => u.id !== deleteTarget.id));
      toast.success('User deleted successfully!');
    } catch {
      setUsers(users.filter(u => u.id !== deleteTarget.id));
      toast.success('User deleted (demo mode)');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'phone', label: 'Phone',
      render: (v) => v || '-',
    },
    {
      key: 'role', label: 'Role',
      render: (v) => (
        <span className="badge" style={{
          background: `${ACCENT}20`, color: ACCENT, borderRadius: 8, padding: '3px 10px',
          fontSize: 11, fontWeight: 600, border: `1px solid ${ACCENT}40`
        }}>
          {ROLE_LABELS[v] || v}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (v) => (
        <span className={`badge ${v === 'active' ? 'badge-green' : 'badge-red'}`}
          style={{ borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
          {v === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at', label: 'Created At',
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      key: 'last_login', label: 'Last Login',
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            <Edit2 size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setToggleTarget(row); }}
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid',
              borderColor: row.status === 'active' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
              background: row.status === 'active' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              color: row.status === 'active' ? '#F87171' : '#34D399',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            {row.status === 'active' ? <PowerOff size={13} /> : <Power size={13} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', color: '#F87171',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Manage Users</h1>
        <p>Manage all platform users (admins, admission staff, faculty)</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ key: 'all', label: 'All Users' }, ...ROLES.map(r => ({ key: r, label: ROLE_LABELS[r] }))].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 18px', borderRadius: 10, border: '1px solid',
              borderColor: activeTab === tab.key ? ACCENT : 'var(--border)',
              background: activeTab === tab.key ? `${ACCENT}20` : 'transparent',
              color: activeTab === tab.key ? ACCENT : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 600, fontSize: 13,
              fontFamily: 'var(--font-heading)', transition: 'all 0.2s'
            }}>
            {tab.label} {tab.key !== 'all' && `(${users.filter(u => u.role === tab.key).length})`}
          </button>
        ))}
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState icon="👥" title="No users found" message="No users match the current filter." />
      ) : (
        <DataTable columns={columns} data={filteredUsers} searchable pageSize={10} />
      )}

      <AnimatePresence>
        {editingUser && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              className="glass-card"
              style={{ padding: 32, maxWidth: 440, width: '90%', background: 'var(--bg-card)' }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>Edit User</h3>
                <button onClick={() => setEditingUser(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>
              <div className="floating-label-group">
                <input type="text" placeholder=" " value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                <label>Name</label>
              </div>
              <div className="floating-label-group">
                <input type="email" placeholder=" " value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                <label>Email</label>
              </div>
              <div className="floating-label-group">
                <input type="tel" placeholder=" " value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} maxLength={10} />
                <label>Phone</label>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={() => setEditingUser(null)}
                  style={{
                    flex: 1, padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13
                  }}>Cancel</button>
                <button onClick={handleEditSave} className="btn-grad"
                  style={{ flex: 1, background: `linear-gradient(135deg, ${ACCENT}, #BE123C)` }}>
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.status === 'active' ? 'Deactivate User?' : 'Activate User?'}
        message={`Are you sure you want to ${toggleTarget?.status === 'active' ? 'deactivate' : 'activate'} ${toggleTarget?.name}?`}
        confirmText={toggleTarget?.status === 'active' ? 'Deactivate' : 'Activate'}
        accent={toggleTarget?.status === 'active' ? '#F87171' : '#34D399'}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User?"
        message={`This will permanently delete ${deleteTarget?.name}. This action cannot be undone.`}
        confirmText="Delete"
        accent="#F87171"
      />
    </motion.div>
  );
}
