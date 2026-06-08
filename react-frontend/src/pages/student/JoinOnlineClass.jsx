import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, Clock, User, ExternalLink, X } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

function parseTime(timeStr) {
  if (!timeStr) return null;
  const clean = timeStr.replace(/\s/g, '');
  const match = clean.match(/^(\d{1,2}):(\d{2})(AM|PM)?/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, m };
}

function canJoin(scheduledTime) {
  if (!scheduledTime) return false;
  const parsed = parseTime(scheduledTime);
  if (!parsed) return false;
  const now = new Date();
  const classDate = new Date();
  classDate.setHours(parsed.h, parsed.m, 0, 0);
  const diff = (classDate.getTime() - now.getTime()) / 60000;
  return diff <= 5 && diff > -120;
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '-';
  const parsed = parseTime(timeStr);
  if (!parsed) return timeStr;
  const h = parsed.h % 12 || 12;
  const ampm = parsed.h >= 12 ? 'PM' : 'AM';
  return `${h}:${String(parsed.m).padStart(2, '0')} ${ampm}`;
}

function getTodaySchedule(classes) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return (classes || []).filter(c => {
    const days = c.lecture_days || [];
    return days.length === 0 || days.includes(today);
  });
}

export default function JoinOnlineClass() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeClass, setActiveClass] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.get('/api/student/timetable');
        setClasses(Array.isArray(d) ? d : []);
      } catch {
        setClasses([
          { id: '1', title: 'Java OOP & Polymorphism', scheduled_time: new Date(Date.now() + 120000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), faculty_name: 'Dr. Amit Kumar', batch_name: 'Batch A - Java Morning', jitsi_room: 'java-oop-001' },
          { id: '2', title: 'Python Data Structures', scheduled_time: new Date(Date.now() + 7200000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), faculty_name: 'Prof. Sarah Jones', batch_name: 'Batch B - Python', jitsi_room: 'python-ds-002' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const todayClasses = getTodaySchedule(classes);

  const handleJoin = (c) => {
    setActiveClass(c);
  };

  const closeModal = () => setActiveClass(null);

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header">
        <h1>Join Online Class</h1>
        <p>Click "Join" when your class is ready (active 5 min before start)</p>
      </div>

      {todayClasses.length === 0 ? (
        <EmptyState icon="📅" title="No classes today" message="You have no scheduled classes for today." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {todayClasses.map((c, i) => {
            const joinable = canJoin(c.scheduled_time);
            return (
              <motion.div
                key={c.id || i} className="glass-card"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderLeft: `3px solid ${joinable ? '#10B981' : 'var(--border)'}`,
                  flexWrap: 'wrap', gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: joinable ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: joinable ? '#34D399' : '#A5B4FC', flexShrink: 0,
                  }}>
                    <Video size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{c.title}</h3>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} /> {c.faculty_name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {formatTimeDisplay(c.scheduled_time)}
                      </span>
                      {c.batch_name && <span>{c.batch_name}</span>}
                    </div>
                  </div>
                </div>
                <button
                  className="btn-grad"
                  onClick={() => handleJoin(c)}
                  disabled={!joinable}
                  style={{
                    background: joinable ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(255,255,255,0.05)',
                    color: joinable ? '#fff' : 'var(--text-muted)',
                    padding: '10px 24px', fontSize: 13, minWidth: 110,
                    cursor: joinable ? 'pointer' : 'not-allowed',
                    opacity: joinable ? 1 : 0.5,
                  }}
                >
                  {joinable ? 'Join Class' : 'Not Available'}
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {activeClass && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#000', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', background: '#0F172A', borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{activeClass.title}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeClass.faculty_name}</p>
            </div>
            <button onClick={closeModal} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10,
              padding: '8px 16px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13,
            }}>
              <X size={18} /> Leave
            </button>
          </div>
          <iframe
            title="Jitsi Meet"
            src={`https://meet.jit.si/${activeClass.jitsi_room || `class-${activeClass.id}`}#config.startWithAudioMuted=true&config.startWithVideoMuted=true&config.disableScreenSharing=true`}
            style={{ flex: 1, border: 'none', width: '100%' }}
            allow="camera; microphone; fullscreen; display-capture"
          />
        </div>
      )}
    </motion.div>
  );
}
