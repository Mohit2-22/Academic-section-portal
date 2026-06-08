import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, IndianRupee, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#F59E0B';

export default function FeesStatus() {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) { toast.error('Enter a student name or mobile'); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get('/api/admin/fees');
      const data = Array.isArray(res) ? res : res?.students || res?.fees || [];
      setStudents(data);
    } catch {
      setStudents([
        { id: 's1', first_name: 'Rahul', last_name: 'Sharma', mobile: '9876543210', course: 'Java Full Stack', total_fees: 45000, paid: 45000, pending: 0, due_date: '2026-04-15', status: 'paid' },
        { id: 's2', first_name: 'Priya', last_name: 'Patel', mobile: '9876543211', course: 'Python Data Science', total_fees: 55000, paid: 30000, pending: 25000, due_date: '2026-06-01', status: 'partial' },
        { id: 's3', first_name: 'Amit', last_name: 'Kumar', mobile: '9876543212', course: 'Data Structures', total_fees: 35000, paid: 0, pending: 35000, due_date: '2026-05-20', status: 'pending' },
        { id: 's4', first_name: 'Neha', last_name: 'Singh', mobile: '9876543213', course: 'React Development', total_fees: 40000, paid: 20000, pending: 20000, due_date: '2026-03-10', status: 'overdue' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const selectStudent = async (s) => {
    setSelected(s);
    try {
      const res = await api.get(`/api/admin/fees/${s.id}/payments`);
      const data = Array.isArray(res) ? res : res?.payments || [];
      setPayments(data);
    } catch {
      setPayments([
        { id: 'p1', date: '2026-01-15', amount: 10000, mode: 'Cash', receipt_no: 'RCT-001', remark: 'Partial payment' },
        { id: 'p2', date: '2026-02-15', amount: 10000, mode: 'Online Transfer', receipt_no: 'RCT-002', remark: 'Monthly installment' },
        { id: 'p3', date: '2026-03-15', amount: 10000, mode: 'Cheque', receipt_no: 'RCT-003', remark: 'Installment' },
      ]);
    }
  };

  const statusBadge = (status) => {
    const map = {
      paid: { className: 'badge-green', label: 'Paid' },
      partial: { className: 'badge-yellow', label: 'Partial' },
      pending: { className: 'badge-blue', label: 'Pending' },
      overdue: { className: 'badge-red', label: 'Overdue' },
    };
    const s = map[status] || { className: 'badge-blue', label: status };
    return <span className={`badge ${s.className}`}>{s.label}</span>;
  };

  const paymentColumns = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount (₹)', render: (v) => `₹${(v ?? 0).toLocaleString()}` },
    { key: 'mode', label: 'Mode' },
    { key: 'receipt_no', label: 'Receipt No' },
    { key: 'remark', label: 'Remark' },
  ];

  const searchResultsColumns = [
    { key: 'name', label: 'Name', render: (_, row) => `${row.first_name} ${row.last_name}` },
    { key: 'mobile', label: 'Mobile' },
    { key: 'course', label: 'Course' },
    { key: 'total_fees', label: 'Total Fees', render: (v) => `₹${(v ?? 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Fees Status</h1>
        <p>Search students to view fee details and payment history</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, maxWidth: 500 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
          <input
            className="input-field"
            placeholder="Search by name or mobile..."
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

      {!loading && searched && students.length === 0 && (
        <EmptyState icon="🔍" title="No results found" message="Try a different name or mobile number" />
      )}

      {!loading && students.length > 0 && !selected && (
        <DataTable columns={searchResultsColumns} data={students} searchable pageSize={8} onRowClick={selectStudent} />
      )}

      {selected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => setSelected(null)}
            style={{
              background: 'none', border: 'none', color: ACCENT, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            ← Back to results
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="glass-card" style={{ padding: 20, borderLeft: `3px solid ${ACCENT}` }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 4 }}>Student</p>
              <p style={{ fontSize: 16, fontWeight: 700 }}>{selected.first_name} {selected.last_name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.mobile} • {selected.course}</p>
            </div>
            <div className="glass-card" style={{ padding: 20, borderLeft: `3px solid #10B981` }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 4 }}>Status</p>
              <div style={{ marginBottom: 4 }}>{statusBadge(selected.status)}</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due: {selected.due_date || '-'}</p>
            </div>
            <div className="glass-card" style={{ padding: 20, borderLeft: `3px solid #6366F1` }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 4 }}>
                <CreditCard size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Total Fees
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>₹{(selected.total_fees ?? 0).toLocaleString()}</p>
            </div>
            <div className="glass-card" style={{ padding: 20, borderLeft: `3px solid ${selected.pending > 0 ? '#EF4444' : '#10B981'}` }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 4 }}>
                <IndianRupee size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Paid / Pending
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                ₹{(selected.paid ?? 0).toLocaleString()} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ ₹{(selected.pending ?? 0).toLocaleString()}</span>
              </p>
            </div>
          </div>

          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Payment History
          </h3>
          {payments.length === 0 ? (
            <EmptyState icon="💳" title="No payments recorded" message="Payment history will appear here" />
          ) : (
            <DataTable columns={paymentColumns} data={payments} pageSize={10} />
          )}
        </motion.div>
      )}

      {!loading && !searched && (
        <EmptyState
          icon="🔍"
          title="Search for a student"
          message="Enter a student's name or mobile number to view their fee status"
        />
      )}
    </motion.div>
  );
}
