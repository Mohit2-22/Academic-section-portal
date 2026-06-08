import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function Timetable() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.get('/api/student/timetable');
        setClasses(Array.isArray(d) ? d : []);
      } catch {
        setClasses([
          { id: '1', title: 'Java OOP', scheduled_time: '10:00 AM - 12:00 PM', faculty_name: 'Dr. Amit', batch_name: 'Batch A', lecture_days: ['Monday', 'Wednesday', 'Friday'] },
          { id: '2', title: 'Python Pro', scheduled_time: '04:00 PM - 06:00 PM', faculty_name: 'Sarah J.', batch_name: 'Batch C', lecture_days: ['Monday', 'Wednesday', 'Friday'] },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  const getColor = (title) => COLORS[title.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {DAYS.map(day => {
          const isToday = day === today;
          const dayClasses = classes.filter(c => (c.lecture_days || []).includes(day));
          return (
            <div key={day} className={`glass-card ${isToday ? 'animate-fadeIn' : ''}`} style={{
              padding: 16, minHeight: 200,
              border: isToday ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)',
              background: isToday ? 'rgba(99,102,241,0.08)' : ''
            }}>
              <div style={{
                textAlign: 'center', paddingBottom: 12, marginBottom: 12,
                borderBottom: '1px solid var(--border)'
              }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{day.slice(0, 3)}</p>
                {isToday && <span style={{ fontSize: 10, color: '#6366F1', fontWeight: 600 }}>● TODAY</span>}
              </div>
              {dayClasses.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>No classes</p>
              ) : (
                dayClasses.map((c, i) => (
                  <div key={i} style={{
                    padding: 10, borderRadius: 10, marginBottom: 8,
                    background: `${getColor(c.title)}15`,
                    borderLeft: `3px solid ${getColor(c.title)}`
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{c.title}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.faculty_name}</p>
                    <p style={{ fontSize: 10, color: getColor(c.title) }}>{c.scheduled_time}</p>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
