import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Video, Download, Award, Code2, Calendar } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/shared/StatCard';
import EmptyState from '../../components/shared/EmptyState';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, t] = await Promise.all([
          api.get('/api/student/profile'),
          api.get('/api/student/timetable')
        ]);
        setProfile(p);
        setClasses(t);
      } catch (e) {
        // use dummy data if backend not available
        setProfile({ first_name: 'John', last_name: 'Doe', city: 'Mumbai', batches: ['Batch A - Java'] });
        setClasses([
          { id: '1', title: 'Java OOP & Polymorphism', scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '10:00 AM - 12:00 PM', status: 'scheduled', faculty_name: 'Dr. Amit Kumar', batch_name: 'Batch A - Java Morning' }
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user?.username || 'Student' : 'Student';
  const initial = name[0]?.toUpperCase() || 'S';

  const ongoingClass = classes?.find(c => c.status === 'ongoing');
  const nextClass = classes?.filter(c => c.status === 'scheduled')?.[0];

  return (
    <div>
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{
          padding: 32, marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Welcome back, {name}! 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {profile?.batches?.[0] || 'Ready to learn something new today?'}
          </p>
        </div>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0
        }}>
          {initial}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { icon: <Video size={22} />, color: '#6366F1', label: 'Join Class', onClick: () => navigate('/dashboard/student/online-class') },
          { icon: <Download size={22} />, color: '#10B981', label: 'Download Material', onClick: () => navigate('/dashboard/student/materials') },
          { icon: <Award size={22} />, color: '#F59E0B', label: 'Certificates', onClick: () => navigate('/dashboard/student/certificates') },
          { icon: <Code2 size={22} />, color: '#F43F5E', label: 'Practice IDE', onClick: () => navigate('/dashboard/student/ide') },
        ].map((action, i) => (
          <motion.div
            key={i} className="glass-card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={action.onClick}
            whileHover={{ scale: 1.03 }}
            style={{
              padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, textAlign: 'center'
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${action.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color }}>
              {action.icon}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{action.label}</span>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Today's Timetable */}
        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} /> Today's Schedule
          </h3>
          {classes?.length === 0 ? (
            <EmptyState icon="🎉" title="No classes today" message="Enjoy your day off!" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes?.slice(0, 3).map((c, i) => {
                const isOngoing = c.status === 'ongoing';
                return (
                  <div key={c.id || i} style={{
                    padding: 12, borderRadius: 12,
                    background: isOngoing ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isOngoing ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    borderLeft: `3px solid ${isOngoing ? '#10B981' : '#6366F1'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{c.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.faculty_name} • {c.batch_name}</p>
                      </div>
                      <span className={`badge ${isOngoing ? 'badge-green' : c.status === 'completed' ? 'badge-blue' : 'badge-yellow'}`}>
                        {isOngoing ? '● LIVE' : c.status === 'completed' ? 'Done' : c.scheduled_time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Overview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Upcoming Classes</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#A5B4FC' }}>{classes?.filter(c => c.status === 'scheduled').length || 0}</p>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Completed</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#34D399' }}>{classes?.filter(c => c.status === 'completed').length || 0}</p>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Materials</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#FBBF24' }}>12</p>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Pending Feedback</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#F87171' }}>2</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
