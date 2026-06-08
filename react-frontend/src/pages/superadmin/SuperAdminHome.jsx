import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, GraduationCap, BookOpen, IndianRupee, Monitor, TrendingUp, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../api/client';
import StatCard from '../../components/shared/StatCard';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';

const ACCENT = '#F43F5E';

const DUMMY = {
  stats: { total_revenue: 4850000, total_students: 1248, total_faculty: 64, total_batches: 28, active_sessions: 7 },
  monthly_revenue: [
    { month: 'Jan', revenue: 520000 }, { month: 'Feb', revenue: 480000 }, { month: 'Mar', revenue: 610000 },
    { month: 'Apr', revenue: 590000 }, { month: 'May', revenue: 560000 }, { month: 'Jun', revenue: 720000 },
    { month: 'Jul', revenue: 680000 }, { month: 'Aug', revenue: 740000 }, { month: 'Sep', revenue: 710000 },
    { month: 'Oct', revenue: 650000 }, { month: 'Nov', revenue: 690000 }, { month: 'Dec', revenue: 780000 },
  ],
  batch_occupancy: [
    { name: 'Batch A', students: 28, max: 35, color: '#F43F5E' },
    { name: 'Batch B', students: 32, max: 35, color: '#8B5CF6' },
    { name: 'Batch C', students: 18, max: 30, color: '#10B981' },
    { name: 'Batch D', students: 25, max: 30, color: '#F59E0B' },
    { name: 'Batch E', students: 15, max: 25, color: '#06B6D4' },
    { name: 'Others', students: 42, max: 100, color: '#6B7280' },
  ],
  recent_activity: [
    { id: 'a1', type: 'user', message: 'New faculty Dr. Mehta joined', time: '2 hours ago' },
    { id: 'a2', type: 'payment', message: 'Payment of ₹25,000 received from Student #1024', time: '3 hours ago' },
    { id: 'a3', type: 'batch', message: 'Batch "React Pro" started with 22 students', time: '5 hours ago' },
    { id: 'a4', type: 'user', message: 'Admission staff Priya Singh created', time: '1 day ago' },
    { id: 'a5', type: 'payment', message: 'Batch C fees collected: ₹1,80,000', time: '1 day ago' },
    { id: 'a6', type: 'system', message: 'Monthly backup completed successfully', time: '1 day ago' },
    { id: 'a7', type: 'batch', message: 'Certificate batch #24 generated for 15 students', time: '2 days ago' },
  ],
};

export default function SuperAdminHome() {
  const [stats, setStats] = useState(DUMMY.stats);
  const [monthlyRevenue, setMonthlyRevenue] = useState(DUMMY.monthly_revenue);
  const [batchOccupancy, setBatchOccupancy] = useState(DUMMY.batch_occupancy);
  const [recentActivity, setRecentActivity] = useState(DUMMY.recent_activity);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/super-admin/dashboard');
        setStats({
          total_revenue: res.total_revenue ?? res.totalRevenue ?? DUMMY.stats.total_revenue,
          total_students: res.total_students ?? res.totalStudents ?? DUMMY.stats.total_students,
          total_faculty: res.total_faculty ?? res.totalFaculty ?? DUMMY.stats.total_faculty,
          total_batches: res.total_batches ?? res.totalBatches ?? DUMMY.stats.total_batches,
          active_sessions: res.active_sessions ?? res.activeSessions ?? DUMMY.stats.active_sessions,
        });
        setMonthlyRevenue(res.monthly_revenue ?? res.monthlyRevenue ?? DUMMY.monthly_revenue);
        setBatchOccupancy(res.batch_occupancy ?? res.batchOccupancy ?? DUMMY.batch_occupancy);
        setRecentActivity(res.recent_activity ?? res.recentActivity ?? DUMMY.recent_activity);
      } catch {
        setStats(DUMMY.stats);
        setMonthlyRevenue(DUMMY.monthly_revenue);
        setBatchOccupancy(DUMMY.batch_occupancy);
        setRecentActivity(DUMMY.recent_activity);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const totalOccupied = batchOccupancy.reduce((s, b) => s + b.students, 0);
  const totalCapacity = batchOccupancy.reduce((s, b) => s + b.max, 0);

  const activityIcons = { user: '👤', payment: '💰', batch: '📚', system: '⚙️' };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card" style={{
          padding: 32, marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(244,63,94,0.05))',
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Super Admin Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Complete overview of the institute</p>
      </motion.div>

      <div className="stats-grid">
        <StatCard icon={<IndianRupee size={22} />} value={`₹${stats.total_revenue.toLocaleString()}`} label="Total Revenue" accent={ACCENT} />
        <StatCard icon={<Users size={22} />} value={stats.total_students} label="Total Students" accent="#8B5CF6" />
        <StatCard icon={<GraduationCap size={22} />} value={stats.total_faculty} label="Total Faculty" accent="#10B981" />
        <StatCard icon={<BookOpen size={22} />} value={stats.total_batches} label="Total Batches" accent="#F59E0B" />
        <StatCard icon={<Monitor size={22} />} value={stats.active_sessions} label="Active Sessions" accent="#06B6D4" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color={ACCENT} /> Monthly Revenue
          </h3>
          {monthlyRevenue.length === 0 ? (
            <EmptyState icon="📊" title="No revenue data" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                  labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
                  itemStyle={{ color: '#FDA4AF' }}
                  formatter={v => [`₹${v.toLocaleString()}`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, stroke: ACCENT, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: ACCENT }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color={ACCENT} /> Batch Occupancy
          </h3>
          {batchOccupancy.length === 0 ? (
            <EmptyState icon="📊" title="No batch data" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width="60%" height={240}>
                <PieChart>
                  <Pie data={batchOccupancy} dataKey="students" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    innerRadius={50} stroke="none">
                    {batchOccupancy.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                    labelStyle={{ color: '#F1F5F9' }}
                    formatter={(value, name, props) => [`${value}/${props.payload.max} students`, props.payload.name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>{totalOccupied}</span> / {totalCapacity} seats filled
                </div>
                {batchOccupancy.map(b => (
                  <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                    <span style={{ color: '#fff', fontWeight: 600, minWidth: 60 }}>{b.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{b.students}/{b.max}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ width: `${(b.students / b.max) * 100}%`, height: '100%', borderRadius: 2, background: b.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color={ACCENT} /> Recent Activity
        </h3>
        {recentActivity.length === 0 ? (
          <EmptyState icon="📭" title="No recent activity" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentActivity.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  borderRadius: 12, background: 'rgba(255,255,255,0.02)',
                  borderLeft: `3px solid ${ACCENT}40`
                }}
              >
                <span style={{ fontSize: 20 }}>{activityIcons[a.type] || '📌'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{a.message}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
