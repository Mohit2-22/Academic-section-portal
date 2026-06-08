import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar, BookOpen, Video, Upload, FileText, Clock, Users, CheckSquare } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/shared/StatCard';
import EmptyState from '../../components/shared/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const ACCENT = '#10B981';

export default function FacultyHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  const [stats, setStats] = useState({ total: 0, pendingReviews: 0, activeBatches: 0 });
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [lecRes, assignRes] = await Promise.all([
          api.get('/api/faculty/lectures'),
          api.get('/api/faculty/assignments').catch(() => ({ assignments: [] }))
        ]);
        const lecs = Array.isArray(lecRes) ? lecRes : lecRes?.lectures || [];
        setLectures(lecs);
        const pending = (Array.isArray(assignRes) ? assignRes : assignRes?.assignments || [])
          .filter(a => a.status === 'draft').length;
        setPendingAssignments(pending);
        setStats({
          total: lecs.length,
          pendingReviews: lecs.filter(l => l.status === 'completed').length,
          activeBatches: [...new Set(lecs.map(l => l.batch_name).filter(Boolean))].length
        });
      } catch {
        setLectures([
          { id: '1', title: 'Java OOP Concepts', scheduled_date: new Date().toISOString().split('T')[0], status: 'scheduled', time: '10:00-11:30', batch_name: 'Batch A' },
          { id: '2', title: 'Spring Boot Intro', scheduled_date: new Date().toISOString().split('T')[0], status: 'scheduled', time: '14:00-15:30', batch_name: 'Batch B' }
        ]);
        setPendingAssignments(3);
        setStats({ total: 12, pendingReviews: 5, activeBatches: 4 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const name = user?.username || 'Faculty';
  const initial = name[0]?.toUpperCase() || 'F';
  const todayDate = new Date().toISOString().split('T')[0];
  const todayClasses = lectures.filter(l => l.scheduled_date === todayDate);

  const quickActions = [
    { icon: <Calendar size={22} />, label: 'Schedule Lecture', path: '/dashboard/faculty/schedule' },
    { icon: <Video size={22} />, label: 'Start / End Class', path: '/dashboard/faculty/class' },
    { icon: <Upload size={22} />, label: 'Upload Material', path: '/dashboard/faculty/materials' },
    { icon: <FileText size={22} />, label: 'Create Assignment', path: '/dashboard/faculty/assignments' },
  ];

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{
          padding: 32, marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Welcome back, {name}! 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            You have {todayClasses.length} class{todayClasses.length !== 1 ? 'es' : ''} scheduled today
          </p>
        </div>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #10B981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0
        }}>
          {initial}
        </div>
      </motion.div>

      <div className="stats-grid">
        <StatCard icon={<Calendar size={22} />} value={stats.total} label="Total Lectures" accent={ACCENT} />
        <StatCard icon={<CheckSquare size={22} />} value={stats.pendingReviews} label="Pending Reviews" accent="#F59E0B" />
        <StatCard icon={<Users size={22} />} value={stats.activeBatches} label="Active Batches" accent="#6366F1" />
        <StatCard icon={<Clock size={22} />} value={pendingAssignments} label="Pending Assignments" accent="#F43F5E" />
      </div>

      <div className="grid-4" style={{ marginBottom: 28 }}>
        {quickActions.map((action, i) => (
          <motion.div
            key={i} className="glass-card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => navigate(action.path)}
            whileHover={{ scale: 1.03 }}
            style={{
              padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, textAlign: 'center'
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: `${ACCENT}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT
            }}>
              {action.icon}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{action.label}</span>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color={ACCENT} /> Today's Schedule
          </h3>
          {todayClasses.length === 0 ? (
            <EmptyState icon="🎉" title="No classes today" message="Enjoy your day!" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {todayClasses.map((c, i) => (
                <div key={c.id || i} style={{
                  padding: 12, borderRadius: 12,
                  background: c.status === 'ongoing' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${c.status === 'ongoing' ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                  borderLeft: `3px solid ${c.status === 'ongoing' ? '#10B981' : '#6366F1'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{c.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.batch_name} • {c.time || c.scheduled_time}</p>
                    </div>
                    <span className={`badge ${c.status === 'ongoing' ? 'badge-green' : c.status === 'completed' ? 'badge-blue' : 'badge-yellow'}`}>
                      {c.status === 'ongoing' ? '● LIVE' : c.status === 'completed' ? 'Done' : 'Scheduled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color={ACCENT} /> Quick Overview
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Upcoming Classes</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#34D399' }}>{lectures.filter(l => l.status === 'scheduled').length}</p>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Completed</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#A5B4FC' }}>{lectures.filter(l => l.status === 'completed').length}</p>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Draft Assignments</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#FBBF24' }}>{pendingAssignments}</p>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Active Batches</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#F87171' }}>{stats.activeBatches}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
