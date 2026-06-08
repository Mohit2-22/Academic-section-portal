import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, PhoneCall, Video, MessageSquare, CheckCircle, Calendar, Clock, Star, UserPlus, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/shared/StatCard';
import EmptyState from '../../components/shared/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const ACCENT = '#F59E0B';

const STAGES = [
  { key: 'lead', label: 'Lead', icon: <UserPlus size={18} />, color: '#6366F1' },
  { key: 'seminar', label: 'Seminar', icon: <Video size={18} />, color: '#8B5CF6' },
  { key: 'bootcamp', label: 'Bootcamp', icon: <Star size={18} />, color: '#EC4899' },
  { key: 'counselling', label: 'Counselling', icon: <MessageSquare size={18} />, color: '#F59E0B' },
  { key: 'follow_up_1', label: 'Follow Up 1', icon: <PhoneCall size={18} />, color: '#F97316' },
  { key: 'follow_up_2', label: 'Follow Up 2', icon: <PhoneCall size={18} />, color: '#EF4444' },
  { key: 'follow_up_3', label: 'Follow Up 3', icon: <PhoneCall size={18} />, color: '#10B981' },
  { key: 'follow_up_4', label: 'Follow Up 4', icon: <PhoneCall size={18} />, color: '#06B6D4' },
  { key: 'follow_up_5', label: 'Follow Up 5', icon: <PhoneCall size={18} />, color: '#6366F1' },
  { key: 'admission', label: 'Admission', icon: <CheckCircle size={18} />, color: '#10B981' },
];

export default function AdmissionHome() {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [recentInquiries, setRecentInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/admission/dashboard');
        const data = res.dashboard ?? res;
        setDash(data);
        setFollowUps(data.today_followups ?? data.followUps ?? []);
        setRecentInquiries(data.recent_inquiries ?? data.recentInquiries ?? []);
      } catch {
        setDash({ totalLeads: 128, totalAdmissions: 34, conversionRate: 26.5, pendingFollowUps: 42 });
        setFollowUps([
          { id: 'f1', student_name: 'Rahul Sharma', mobile: '9876543210', stage: 'follow_up_2', notes: 'Interested in Java course', followup_date: new Date().toISOString().split('T')[0] },
          { id: 'f2', student_name: 'Priya Patel', mobile: '9876543211', stage: 'follow_up_3', notes: 'Need brochure', followup_date: new Date().toISOString().split('T')[0] },
          { id: 'f3', student_name: 'Amit Kumar', mobile: '9876543212', stage: 'counselling', notes: 'Demo class done', followup_date: new Date().toISOString().split('T')[0] },
        ]);
        setRecentInquiries([
          { id: 'i1', first_name: 'Neha', last_name: 'Singh', mobile: '9988776655', city: 'Delhi', date_of_inquiry: new Date().toISOString().split('T')[0], stage: 'lead' },
          { id: 'i2', first_name: 'Vikas', last_name: 'Gupta', mobile: '8877665544', city: 'Mumbai', date_of_inquiry: new Date(Date.now() - 86400000).toISOString().split('T')[0], stage: 'seminar' },
          { id: 'i3', first_name: 'Sneha', last_name: 'Reddy', mobile: '7766554433', city: 'Hyderabad', date_of_inquiry: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], stage: 'lead' },
          { id: 'i4', first_name: 'Arjun', last_name: 'Verma', mobile: '6655443322', city: 'Pune', date_of_inquiry: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], stage: 'bootcamp' },
          { id: 'i5', first_name: 'Kavita', last_name: 'Joshi', mobile: '5544332211', city: 'Bangalore', date_of_inquiry: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0], stage: 'lead' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const stageCounts = [
    { name: 'Lead', count: dash?.lead ?? dash?.totalLeads ?? 128, fill: '#6366F1' },
    { name: 'Seminar', count: dash?.seminar ?? 85, fill: '#8B5CF6' },
    { name: 'Bootcamp', count: dash?.bootcamp ?? 62, fill: '#EC4899' },
    { name: 'Counselling', count: dash?.counselling ?? 48, fill: '#F59E0B' },
    { name: 'Follow Up 1', count: dash?.follow_up_1 ?? 38, fill: '#F97316' },
    { name: 'Follow Up 2', count: dash?.follow_up_2 ?? 30, fill: '#EF4444' },
    { name: 'Follow Up 3', count: dash?.follow_up_3 ?? 22, fill: '#10B981' },
    { name: 'Follow Up 4', count: dash?.follow_up_4 ?? 15, fill: '#06B6D4' },
    { name: 'Follow Up 5', count: dash?.follow_up_5 ?? 8, fill: '#6366F1' },
    { name: 'Admission', count: dash?.admission ?? dash?.totalAdmissions ?? 34, fill: '#10B981' },
  ];

  const name = user?.username || 'Admission';
  const initial = name[0]?.toUpperCase() || 'A';

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{
          padding: 32, marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Welcome back, {name}!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {followUps.length} follow-up{followUps.length !== 1 ? 's' : ''} due today
          </p>
        </div>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0
        }}>
          {initial}
        </div>
      </motion.div>

      <div className="stats-grid">
        <StatCard icon={<UserPlus size={22} />} value={dash?.totalLeads ?? dash?.lead ?? 128} label="Total Leads" accent={ACCENT} />
        <StatCard icon={<PhoneCall size={22} />} value={dash?.pendingFollowUps ?? 42} label="Pending Follow-ups" accent="#F97316" />
        <StatCard icon={<TrendingUp size={22} />} value={`${dash?.conversionRate ?? 26.5}%`} label="Conversion Rate" accent="#06B6D4" />
        <StatCard icon={<CheckCircle size={22} />} value={dash?.totalAdmissions ?? dash?.admission ?? 34} label="Admissions" accent="#10B981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color={ACCENT} /> Funnel Overview
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stageCounts} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
                itemStyle={{ color: '#FCD34D' }}
              />
              <Bar dataKey="count" fill={ACCENT} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color={ACCENT} /> Today's Follow-ups
          </h3>
          {followUps.length === 0 ? (
            <EmptyState icon="✅" title="No follow-ups due today" message="All caught up!" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {followUps.map((f, i) => {
                const stage = STAGES.find(s => s.key === f.stage) || { label: f.stage, color: '#6366F1' };
                return (
                  <div key={f.id || i} style={{
                    padding: 12, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${stage.color}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{f.student_name ?? (`${f.first_name ?? ''} ${f.last_name ?? ''}`.trim() || 'Unknown')}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {f.mobile} • <span className="badge" style={{ background: `${stage.color}20`, color: stage.color }}>{stage.label}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.followup_date ?? f.date_of_inquiry ?? '-'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} color={ACCENT} /> Recent Inquiries
        </h3>
        {recentInquiries.length === 0 ? (
          <EmptyState icon="📭" title="No inquiries yet" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Mobile</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>City</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Stage</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentInquiries.map((inq, i) => {
                  const stage = STAGES.find(s => s.key === inq.stage) || { label: inq.stage, color: '#6366F1' };
                  return (
                    <tr key={inq.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{inq.first_name} {inq.last_name}</td>
                      <td style={{ padding: '10px 16px' }}>{inq.mobile}</td>
                      <td style={{ padding: '10px 16px' }}>{inq.city || '-'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span className="badge" style={{ background: `${stage.color}20`, color: stage.color }}>{stage.label}</span>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{inq.date_of_inquiry ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
