import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, BookOpen, List } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#10B981';

export default function ScheduleLecture() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    batch_id: '',
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    description: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [batchesRes, lecRes] = await Promise.all([
          api.get('/api/faculty/batches'),
          api.get('/api/faculty/lectures')
        ]);
        setBatches(Array.isArray(batchesRes) ? batchesRes : batchesRes?.batches || []);
        setLectures(Array.isArray(lecRes) ? lecRes : lecRes?.lectures || []);
      } catch {
        setBatches([
          { id: 'b1', name: 'Batch A - Java Morning' },
          { id: 'b2', name: 'Batch B - Python Evening' },
        ]);
        setLectures([
          { id: 'l1', title: 'Java OOP', batch_name: 'Batch A', scheduled_date: '2026-06-10', start_time: '10:00', end_time: '11:30', status: 'scheduled' }
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const validate = () => {
    const errs = {};
    if (!form.batch_id) errs.batch_id = 'Select a batch';
    if (!form.title?.trim()) errs.title = 'Topic name is required';
    if (!form.date) errs.date = 'Date is required';
    if (!form.start_time) errs.start_time = 'Start time is required';
    if (!form.end_time) errs.end_time = 'End time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/faculty/lectures', form);
      const jitsiRoom = res?.jitsi_room || `faculty-${Date.now()}`;
      const roomLink = `https://meet.jit.si/${jitsiRoom}`;
      toast.success(
        <div>
          <p>Lecture scheduled successfully!</p>
          <a href={roomLink} target="_blank" rel="noopener noreferrer"
            style={{ color: '#10B981', textDecoration: 'underline', fontSize: 13 }}>
            Join Room: {jitsiRoom}
          </a>
        </div>,
        { duration: 6000 }
      );
      setForm({ batch_id: '', title: '', date: '', start_time: '', end_time: '', description: '' });
      setErrors({});
      const lecRes = await api.get('/api/faculty/lectures');
      setLectures(Array.isArray(lecRes) ? lecRes : lecRes?.lectures || []);
    } catch (e) {
      toast.error(e.message || 'Failed to schedule lecture');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Schedule Lecture</h1>
        <p>Create a new lecture with Jitsi video room</p>
      </div>

      <div className="glass-card" style={{ padding: 32, marginBottom: 28 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="floating-label-group">
              <select value={form.batch_id} onChange={e => handleChange('batch_id', e.target.value)}
                style={{ borderColor: errors.batch_id ? '#EF4444' : undefined }}>
                <option value="" disabled></option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <label>Select Batch *</label>
              {errors.batch_id && <span style={{ color: '#EF4444', fontSize: 11, position: 'absolute', bottom: -18, left: 0 }}>{errors.batch_id}</span>}
            </div>
            <div className="floating-label-group">
              <input type="text" placeholder=" " value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                style={{ borderColor: errors.title ? '#EF4444' : undefined }} />
              <label>Topic Name *</label>
              {errors.title && <span style={{ color: '#EF4444', fontSize: 11, position: 'absolute', bottom: -18, left: 0 }}>{errors.title}</span>}
            </div>
            <div className="floating-label-group">
              <input type="date" placeholder=" " value={form.date}
                onChange={e => handleChange('date', e.target.value)}
                style={{ borderColor: errors.date ? '#EF4444' : undefined }} />
              <label>Date *</label>
              {errors.date && <span style={{ color: '#EF4444', fontSize: 11, position: 'absolute', bottom: -18, left: 0 }}>{errors.date}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="floating-label-group">
                <input type="time" placeholder=" " value={form.start_time}
                  onChange={e => handleChange('start_time', e.target.value)}
                  style={{ borderColor: errors.start_time ? '#EF4444' : undefined }} />
                <label>Start *</label>
                {errors.start_time && <span style={{ color: '#EF4444', fontSize: 11, position: 'absolute', bottom: -18, left: 0 }}>{errors.start_time}</span>}
              </div>
              <div className="floating-label-group">
                <input type="time" placeholder=" " value={form.end_time}
                  onChange={e => handleChange('end_time', e.target.value)}
                  style={{ borderColor: errors.end_time ? '#EF4444' : undefined }} />
                <label>End *</label>
                {errors.end_time && <span style={{ color: '#EF4444', fontSize: 11, position: 'absolute', bottom: -18, left: 0 }}>{errors.end_time}</span>}
              </div>
            </div>
          </div>
          <div className="floating-label-group" style={{ marginBottom: 24 }}>
            <textarea placeholder=" " rows={3} value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              style={{ resize: 'vertical' }} />
            <label>Description (optional)</label>
          </div>
          <button type="submit" className="btn-grad" disabled={submitting}
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #059669)`, opacity: submitting ? 0.6 : 1, width: '100%' }}>
            {submitting ? 'Scheduling...' : <><Calendar size={16} /> Schedule Lecture</>}
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <List size={18} color={ACCENT} /> Upcoming Scheduled Lectures
        </h3>
        {lectures.filter(l => l.status === 'scheduled').length === 0 ? (
          <EmptyState icon="📅" title="No upcoming lectures" message="Schedule your first lecture above" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lectures.filter(l => l.status === 'scheduled').map((lec, i) => (
              <div key={lec.id || i} style={{
                padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)', borderLeft: `3px solid ${ACCENT}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{lec.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {lec.batch_name} • {lec.scheduled_date} • {lec.start_time || lec.scheduled_time} - {lec.end_time}
                  </p>
                </div>
                <span className="badge badge-green">
                  {lec.scheduled_date === new Date().toISOString().split('T')[0] ? 'Today' : lec.scheduled_date}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
