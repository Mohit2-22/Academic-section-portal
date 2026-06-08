import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, TrendingUp, Download, Search, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/client';
import StatCard from '../../components/shared/StatCard';
import DataTable from '../../components/shared/DataTable';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#F43F5E';

const DUMMY = {
  summary: { total_collected: 4850000, total_pending: 1280000 },
  monthly_revenue: [
    { month: 'Jan', collected: 420000, pending: 80000 },
    { month: 'Feb', collected: 390000, pending: 95000 },
    { month: 'Mar', collected: 510000, pending: 110000 },
    { month: 'Apr', collected: 480000, pending: 105000 },
    { month: 'May', collected: 460000, pending: 90000 },
    { month: 'Jun', collected: 590000, pending: 120000 },
    { month: 'Jul', collected: 570000, pending: 115000 },
    { month: 'Aug', collected: 620000, pending: 130000 },
    { month: 'Sep', collected: 600000, pending: 125000 },
    { month: 'Oct', collected: 550000, pending: 100000 },
    { month: 'Nov', collected: 580000, pending: 105000 },
    { month: 'Dec', collected: 650000, pending: 95000 },
  ],
  student_fees: [
    { id: 's1', name: 'Arjun Mehta', batch: 'Batch A', total_fees: 85000, paid: 85000, pending: 0, status: 'paid', due_date: '2026-01-15' },
    { id: 's2', name: 'Bhavna Patel', batch: 'Batch A', total_fees: 85000, paid: 60000, pending: 25000, status: 'partial', due_date: '2026-02-20' },
    { id: 's3', name: 'Chirag Shah', batch: 'Batch B', total_fees: 95000, paid: 95000, pending: 0, status: 'paid', due_date: '2026-03-10' },
    { id: 's4', name: 'Deepika Rao', batch: 'Batch B', total_fees: 95000, paid: 0, pending: 95000, status: 'unpaid', due_date: '2026-01-05' },
    { id: 's5', name: 'Esha Gupta', batch: 'Batch C', total_fees: 75000, paid: 75000, pending: 0, status: 'paid', due_date: '2026-04-18' },
    { id: 's6', name: 'Farhan Khan', batch: 'Batch C', total_fees: 75000, paid: 45000, pending: 30000, status: 'partial', due_date: '2026-02-28' },
    { id: 's7', name: 'Gauri Joshi', batch: 'Batch D', total_fees: 80000, paid: 80000, pending: 0, status: 'paid', due_date: '2026-05-01' },
    { id: 's8', name: 'Harsh Tiwari', batch: 'Batch D', total_fees: 80000, paid: 40000, pending: 40000, status: 'partial', due_date: '2026-02-14' },
    { id: 's9', name: 'Ishita Desai', batch: 'Batch A', total_fees: 85000, paid: 0, pending: 85000, status: 'unpaid', due_date: '2026-03-22' },
    { id: 's10', name: 'Jay Verma', batch: 'Batch B', total_fees: 95000, paid: 95000, pending: 0, status: 'paid', due_date: '2026-04-11' },
    { id: 's11', name: 'Kavya Nair', batch: 'Batch E', total_fees: 70000, paid: 70000, pending: 0, status: 'paid', due_date: '2026-05-30' },
    { id: 's12', name: 'Lokesh Reddy', batch: 'Batch E', total_fees: 70000, paid: 35000, pending: 35000, status: 'partial', due_date: '2026-01-19' },
  ],
};

export default function FeesDashboard() {
  const [summary, setSummary] = useState(DUMMY.summary);
  const [monthlyRevenue, setMonthlyRevenue] = useState(DUMMY.monthly_revenue);
  const [studentFees, setStudentFees] = useState(DUMMY.student_fees);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/super-admin/fees');
        setSummary({
          total_collected: res.total_collected ?? res.totalCollected ?? DUMMY.summary.total_collected,
          total_pending: res.total_pending ?? res.totalPending ?? DUMMY.summary.total_pending,
        });
        setMonthlyRevenue(res.monthly_revenue ?? res.monthlyRevenue ?? DUMMY.monthly_revenue);
        setStudentFees(res.student_fees ?? res.studentFees ?? DUMMY.student_fees);
      } catch {
        setSummary(DUMMY.summary);
        setMonthlyRevenue(DUMMY.monthly_revenue);
        setStudentFees(DUMMY.student_fees);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleExport = () => {
    const rows = [['Name', 'Batch', 'Total Fees', 'Paid', 'Pending', 'Status', 'Due Date']];
    studentFees.forEach(s => {
      rows.push([s.name, s.batch, s.total_fees, s.paid, s.pending, s.status, s.due_date]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fees_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Fees report exported!');
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'batch', label: 'Batch' },
    {
      key: 'total_fees', label: 'Total Fees',
      render: (v) => `₹${v?.toLocaleString() ?? 0}`,
    },
    {
      key: 'paid', label: 'Paid',
      render: (v) => `₹${v?.toLocaleString() ?? 0}`,
    },
    {
      key: 'pending', label: 'Pending',
      render: (v) => `₹${v?.toLocaleString() ?? 0}`,
    },
    {
      key: 'status', label: 'Status',
      render: (v) => {
        const colors = {
          paid: { bg: 'rgba(16,185,129,0.15)', color: '#34D399', border: 'rgba(16,185,129,0.3)' },
          partial: { bg: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: 'rgba(245,158,11,0.3)' },
          unpaid: { bg: 'rgba(239,68,68,0.15)', color: '#F87171', border: 'rgba(239,68,68,0.3)' },
        };
        const c = colors[v] || colors.unpaid;
        return (
          <span style={{
            padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: c.bg, color: c.color, border: `1px solid ${c.border}`,
            textTransform: 'capitalize'
          }}>
            {v}
          </span>
        );
      },
    },
    {
      key: 'due_date', label: 'Due Date',
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Fees Dashboard</h1>
          <p>Track fees collections and pending payments</p>
        </div>
        <button onClick={handleExport}
          style={{
            padding: '10px 20px', borderRadius: 10, border: `1px solid ${ACCENT}40`,
            background: `${ACCENT}20`, color: ACCENT, cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'
          }}>
          <Download size={16} /> Export Report
        </button>
      </div>

      <div className="stats-grid">
        <StatCard icon={<IndianRupee size={22} />} value={`₹${summary.total_collected.toLocaleString()}`} label="Total Collected" accent="#10B981" />
        <StatCard icon={<IndianRupee size={22} />} value={`₹${summary.total_pending.toLocaleString()}`} label="Total Pending" accent={ACCENT} />
      </div>

      <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24, marginBottom: 28 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} color={ACCENT} /> Monthly Revenue Breakdown
        </h3>
        {monthlyRevenue.length === 0 ? (
          <EmptyState icon="📊" title="No revenue data" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
                formatter={(value, name) => [`₹${value.toLocaleString()}`, name === 'collected' ? 'Collected' : 'Pending']}
              />
              <Bar dataKey="collected" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={24} name="collected" />
              <Bar dataKey="pending" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={24} name="pending" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <FileText size={18} color={ACCENT} /> Student-wise Fees Status
      </h3>
      {studentFees.length === 0 ? (
        <EmptyState icon="📭" title="No fee records" />
      ) : (
        <DataTable columns={columns} data={studentFees} searchable pageSize={10} />
      )}
    </motion.div>
  );
}
