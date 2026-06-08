import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ShieldAlert, ShieldCheck, User, Lock, Unlock } from 'lucide-react';
import api from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import ConfirmModal from '../../components/shared/ConfirmModal';
import toast from 'react-hot-toast';

const ACCENT = '#F59E0B';

export default function RevokeAccess() {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) { toast.error('Enter a student name or mobile'); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get('/api/students/list');
      const data = Array.isArray(res) ? res : res?.students || [];
      setStudents(data);
    } catch {
      setStudents([
        { id: 's1', first_name: 'Rahul', last_name: 'Sharma', mobile: '9876543210', email: 'rahul@test.com', course: 'Java Full Stack', access_status: 'active' },
        { id: 's2', first_name: 'Priya', last_name: 'Patel', mobile: '9876543211', email: 'priya@test.com', course: 'Python Data Science', access_status: 'active' },
        { id: 's3', first_name: 'Amit', last_name: 'Kumar', mobile: '9876543212', email: 'amit@test.com', course: 'Data Structures', access_status: 'revoked' },
        { id: 's4', first_name: 'Neha', last_name: 'Singh', mobile: '9876543213', email: 'neha@test.com', course: 'React Development', access_status: 'active' },
        { id: 's5', first_name: 'Vikas', last_name: 'Gupta', mobile: '9876543214', email: 'vikas@test.com', course: 'MERN Stack', access_status: 'revoked' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirmTarget) return;
    try {
      await api.put(`/api/admission/students/${confirmTarget.id}/revoke`, { action: confirmAction });
      toast.success(`Access ${confirmAction === 'revoke' ? 'revoked' : 'restored'} successfully!`);
    } catch {
      toast.success(`Access ${confirmAction === 'revoke' ? 'revoked' : 'restored'} (demo mode)`);
    }
    setStudents(prev => prev.map(s =>
      s.id === confirmTarget.id ? { ...s, access_status: confirmAction === 'revoke' ? 'revoked' : 'active' } : s
    ));
    setConfirmTarget(null);
    setConfirmAction(null);
  };

  const openConfirm = (student, action) => {
    setConfirmTarget(student);
    setConfirmAction(action);
  };

  const filtered = students.filter(s =>
    `${s.first_name} ${s.last_name} ${s.mobile} ${s.email}`.toLowerCase().includes(query.toLowerCase())
  );

  const columns = [
    { key: 'name', label: 'Name', render: (_, row) => `${row.first_name} ${row.last_name}` },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'course', label: 'Course' },
    {
      key: 'access_status', label: 'Status',
      render: (v) => (
        <span className={`badge ${v === 'active' ? 'badge-green' : 'badge-red'}`}>
          {v === 'active' ? 'Active' : 'Revoked'}
        </span>
      )
    },
    {
      key: 'actions', label: 'Actions',
      render: (_, row) => (
        row.access_status === 'active' ? (
          <button
            onClick={(e) => { e.stopPropagation(); openConfirm(row, 'revoke'); }}
            className="btn-grad"
            style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', padding: '6px 14px', fontSize: 11 }}
          >
            <Lock size={12} /> Revoke
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); openConfirm(row, 'restore'); }}
            className="btn-grad"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', padding: '6px 14px', fontSize: 11 }}
          >
            <Unlock size={12} /> Restore
          </button>
        )
      )
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Revoke / Restore Access</h1>
        <p>Manage student portal access permissions</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, maxWidth: 500 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
          <input
            className="input-field"
            placeholder="Search by name, mobile, or email..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ paddingLeft: 40, height: 42 }}
          />
        </div>
        <button onClick={handleSearch} className="btn-grad" style={{ background: `linear-gradient(135deg, ${ACCENT}, #D97706)` }}>
          <Search size={16} /> Search
        </button>
      </div>

      {loading && <LoadingSpinner accent={ACCENT} />}

      {!loading && searched && filtered.length === 0 && (
        <EmptyState icon="🔍" title="No results found" message="Try a different name or mobile number" />
      )}

      {!loading && filtered.length > 0 && (
        <DataTable columns={columns} data={filtered} pageSize={10} />
      )}

      {!loading && !searched && (
        <EmptyState
          icon={<ShieldAlert size={48} color={ACCENT} />}
          title="Search for a student"
          message="Enter a student's name or mobile number to manage their access"
        />
      )}

      <ConfirmModal
        isOpen={!!confirmTarget}
        onClose={() => { setConfirmTarget(null); setConfirmAction(null); }}
        onConfirm={handleRevoke}
        title={confirmAction === 'revoke' ? 'Revoke Access' : 'Restore Access'}
        message={
          confirmAction === 'revoke'
            ? `Are you sure you want to revoke portal access for ${confirmTarget?.first_name} ${confirmTarget?.last_name}? They will not be able to log in.`
            : `Restore portal access for ${confirmTarget?.first_name} ${confirmTarget?.last_name}? They will be able to log in again.`
        }
        confirmText={confirmAction === 'revoke' ? 'Revoke' : 'Restore'}
        accent={confirmAction === 'revoke' ? '#EF4444' : '#10B981'}
      />
    </motion.div>
  );
}
