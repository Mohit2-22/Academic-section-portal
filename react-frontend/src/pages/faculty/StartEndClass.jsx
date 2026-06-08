import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, Play, Square, Monitor, X } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import ConfirmModal from '../../components/shared/ConfirmModal';
import toast from 'react-hot-toast';

const ACCENT = '#10B981';

export default function StartEndClass() {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeClass, setActiveClass] = useState(null);
  const [jitsiUrl, setJitsiUrl] = useState(null);
  const [endModal, setEndModal] = useState({ open: false, lecture: null });

  const loadLectures = async () => {
    try {
      const res = await api.get('/api/faculty/lectures');
      const lecs = Array.isArray(res) ? res : res?.lectures || [];
      setLectures(lecs);
      const ongoing = lecs.find(l => l.status === 'ongoing');
      if (ongoing) setJitsiUrl(`https://meet.jit.si/${ongoing.jitsi_room || `class-${ongoing.id}`}`);
    } catch {
      setLectures([
        { id: '1', title: 'Java OOP Concepts', batch_name: 'Batch A', scheduled_date: new Date().toISOString().split('T')[0], start_time: '10:00', end_time: '11:30', status: 'scheduled', jitsi_room: 'demo-java' },
        { id: '2', title: 'Python Basics', batch_name: 'Batch B', scheduled_date: new Date().toISOString().split('T')[0], start_time: '14:00', end_time: '15:30', status: 'scheduled', jitsi_room: 'demo-python' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLectures(); }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayLectures = lectures.filter(l => l.scheduled_date === today);

  const handleStart = async (lec) => {
    try {
      await api.put(`/api/faculty/lectures/${lec.id}/start`);
    } catch {}
    const room = lec.jitsi_room || `class-${lec.id}-${Date.now()}`;
    setJitsiUrl(`https://meet.jit.si/${room}`);
    setActiveClass(lec);
    toast.success('Class started!');
    loadLectures();
  };

  const handleEndConfirm = async () => {
    const lec = endModal.lecture;
    if (!lec) return;
    try {
      await api.put(`/api/faculty/lectures/${lec.id}/end`);
      toast.success('Class ended');
    } catch {
      toast.error('Failed to end class');
    }
    setEndModal({ open: false, lecture: null });
    setJitsiUrl(null);
    setActiveClass(null);
    loadLectures();
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Start / End Class</h1>
        <p>Manage your live classes with Jitsi integration</p>
      </div>

      {jitsiUrl && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Video size={18} color={ACCENT} /> Live Class: {activeClass?.title || 'Ongoing'}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-grad"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px', fontSize: 12 }}
                onClick={() => { navigator.clipboard?.writeText(jitsiUrl); toast.success('Link copied!'); }}>
                <Monitor size={14} /> Share Screen
              </button>
              <button className="btn-grad"
                style={{ background: '#EF4444', padding: '8px 16px', fontSize: 12 }}
                onClick={() => { setJitsiUrl(null); setActiveClass(null); }}>
                <X size={14} /> Close
              </button>
            </div>
          </div>
          <div className="glass-card" style={{ overflow: 'hidden', padding: 4, height: '70vh' }}>
            <iframe
              src={jitsiUrl}
              title="Jitsi Meet"
              allow="camera; microphone; display-capture; autoplay"
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
            />
          </div>
        </motion.div>
      )}

      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Video size={18} color={ACCENT} /> Today's Classes
        </h3>
        {todayLectures.length === 0 ? (
          <EmptyState icon="📭" title="No classes scheduled today" message="Schedule a lecture to see it here" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {todayLectures.map((lec, i) => {
              const isOngoing = lec.status === 'ongoing';
              const isCompleted = lec.status === 'completed';
              return (
                <div key={lec.id || i} style={{
                  padding: 16, borderRadius: 12,
                  background: isOngoing ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isOngoing ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                  borderLeft: `3px solid ${isOngoing ? '#10B981' : isCompleted ? '#6366F1' : '#F59E0B'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{lec.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {lec.batch_name} • {lec.start_time || lec.scheduled_time} - {lec.end_time}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {isOngoing && <span className="badge badge-green">● LIVE</span>}
                      {isOngoing ? (
                        <button className="btn-grad"
                          style={{ background: '#EF4444', padding: '8px 16px', fontSize: 12 }}
                          onClick={() => setEndModal({ open: true, lecture: lec })}>
                          <Square size={14} /> End
                        </button>
                      ) : isCompleted ? (
                        <span className="badge badge-blue">Completed</span>
                      ) : (
                        <button className="btn-grad"
                          style={{ background: `linear-gradient(135deg, ${ACCENT}, #059669)`, padding: '8px 16px', fontSize: 12 }}
                          onClick={() => handleStart(lec)}
                          disabled={!!jitsiUrl}>
                          <Play size={14} /> Start
                        </button>
                      )}
                      {isCompleted && (
                        <button className="btn-grad"
                          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '8px 16px', fontSize: 12 }}>
                          <Monitor size={14} /> Recording
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={endModal.open}
        onClose={() => setEndModal({ open: false, lecture: null })}
        onConfirm={handleEndConfirm}
        title="End Class"
        message="Are you sure you want to end this class? Students will be disconnected."
        confirmText="End Class"
        accent="#EF4444"
      />
    </motion.div>
  );
}
