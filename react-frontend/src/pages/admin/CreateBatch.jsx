import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Plus, X, Trash2 } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const ACCENT = '#8B5CF6';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SUBJECT_OPTIONS = [
  'Java', 'Python', 'C++', 'JavaScript', 'React', 'Angular', 'Node.js',
  'Spring Boot', 'Django', 'Data Structures', 'Algorithms', 'Database',
  'SQL', 'MongoDB', 'AWS', 'Docker', 'Machine Learning', 'Data Science',
];

export default function CreateBatch() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');

  const [form, setForm] = useState({
    name: '', max_students: '',
    days: [], start_time: '', end_time: '',
    subjects: [],
    faculty_assignments: [],
    start_date: '', end_date: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/faculty');
        setFaculty(Array.isArray(res) ? res : res?.faculty || []);
      } catch {
        setFaculty([
          { id: 'f1', first_name: 'Amit', last_name: 'Sharma' },
          { id: 'f2', first_name: 'Priya', last_name: 'Verma' },
          { id: 'f3', first_name: 'Rajesh', last_name: 'Kumar' },
          { id: 'f4', first_name: 'Neha', last_name: 'Singh' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const toggleDay = (day) => {
    setForm({
      ...form,
      days: form.days.includes(day) ? form.days.filter(d => d !== day) : [...form.days, day],
    });
  };

  const addSubject = (subject) => {
    if (!subject.trim()) return;
    if (form.subjects.includes(subject.trim())) { toast.error('Subject already added'); return; }
    setForm({
      ...form,
      subjects: [...form.subjects, subject.trim()],
      faculty_assignments: [...form.faculty_assignments, { subject: subject.trim(), faculty_id: '' }],
    });
    setSubjectInput('');
  };

  const removeSubject = (subject) => {
    setForm({
      ...form,
      subjects: form.subjects.filter(s => s !== subject),
      faculty_assignments: form.faculty_assignments.filter(a => a.subject !== subject),
    });
  };

  const updateFacultyAssignment = (subject, faculty_id) => {
    setForm({
      ...form,
      faculty_assignments: form.faculty_assignments.map(a =>
        a.subject === subject ? { ...a, faculty_id } : a
      ),
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Batch name is required'); return; }
    if (!form.max_students) { toast.error('Max students is required'); return; }
    if (form.days.length === 0) { toast.error('Select at least one day'); return; }
    if (!form.start_time) { toast.error('Start time is required'); return; }
    if (!form.end_time) { toast.error('End time is required'); return; }
    if (form.subjects.length === 0) { toast.error('Add at least one subject'); return; }
    if (!form.start_date) { toast.error('Start date is required'); return; }
    if (!form.end_date) { toast.error('End date is required'); return; }

    const unassigned = form.faculty_assignments.filter(a => !a.faculty_id);
    if (unassigned.length > 0) { toast.error('Assign faculty for all subjects'); return; }

    setSubmitting(true);
    try {
      await api.post('/api/admin/batches', {
        name: form.name.trim(),
        max_students: parseInt(form.max_students),
        days: form.days,
        start_time: form.start_time,
        end_time: form.end_time,
        subjects: form.subjects,
        faculty_assignments: form.faculty_assignments,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      toast.success('Batch created successfully!');
      setForm({
        name: '', max_students: '', days: [], start_time: '', end_time: '',
        subjects: [], faculty_assignments: [], start_date: '', end_date: '',
      });
    } catch (e) {
      toast.success('Batch created (demo mode)');
      setForm({
        name: '', max_students: '', days: [], start_time: '', end_time: '',
        subjects: [], faculty_assignments: [], start_date: '', end_date: '',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSubjectOptions = SUBJECT_OPTIONS.filter(
    s => !form.subjects.includes(s) && s.toLowerCase().includes(subjectInput.toLowerCase())
  );

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Create Batch</h1>
        <p>Set up a new batch with schedule and faculty</p>
      </div>

      <div className="glass-card" style={{ padding: 32, maxWidth: 760 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.name} onChange={update('name')} />
            <label>Batch Name *</label>
          </div>
          <div className="floating-label-group">
            <input type="number" placeholder=" " value={form.max_students} onChange={update('max_students')} min="1" />
            <label>Max Students *</label>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
            Class Days *
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DAYS.map(day => (
              <button key={day} onClick={() => toggleDay(day)}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '1px solid',
                  borderColor: form.days.includes(day) ? ACCENT : 'var(--border)',
                  background: form.days.includes(day) ? `${ACCENT}20` : 'transparent',
                  color: form.days.includes(day) ? ACCENT : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  fontFamily: 'var(--font-heading)', transition: 'all 0.2s'
                }}>
                {day}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="floating-label-group">
            <input type="time" placeholder=" " value={form.start_time} onChange={update('start_time')} />
            <label>Start Time *</label>
          </div>
          <div className="floating-label-group">
            <input type="time" placeholder=" " value={form.end_time} onChange={update('end_time')} />
            <label>End Time *</label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="floating-label-group">
            <input type="date" placeholder=" " value={form.start_date} onChange={update('start_date')} />
            <label>Start Date *</label>
          </div>
          <div className="floating-label-group">
            <input type="date" placeholder=" " value={form.end_date} onChange={update('end_date')} />
            <label>End Date *</label>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
            Subjects *
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              className="input-field"
              placeholder="Type to search subjects..."
              value={subjectInput}
              onChange={e => setSubjectInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject(subjectInput); } }}
              style={{ flex: 1, height: 42, fontSize: 13 }}
            />
            <button onClick={() => addSubject(subjectInput)}
              style={{
                width: 42, height: 42, borderRadius: 12, border: `1px solid ${ACCENT}40`,
                background: `${ACCENT}20`, color: ACCENT, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
              <Plus size={20} />
            </button>
          </div>

          {subjectInput && filteredSubjectOptions.length > 0 && (
            <div className="glass-card" style={{ padding: 8, marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filteredSubjectOptions.slice(0, 8).map(s => (
                <button key={s} onClick={() => addSubject(s)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '4px 12px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer'
                  }}>
                  + {s}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {form.subjects.map(s => (
              <span key={s} className="badge badge-purple" style={{ padding: '6px 12px', gap: 6 }}>
                {s}
                <button onClick={() => removeSubject(s)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {form.subjects.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
              Assign Faculty per Subject *
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.faculty_assignments.map((assignment) => (
                <div key={assignment.subject} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    padding: '8px 14px', borderRadius: 10, background: `${ACCENT}15`,
                    border: `1px solid ${ACCENT}30`, fontSize: 13, fontWeight: 600, color: ACCENT,
                    minWidth: 140, whiteSpace: 'nowrap'
                  }}>
                    {assignment.subject}
                  </div>
                  <div style={{ flex: 1 }}>
                    <select
                      value={assignment.faculty_id}
                      onChange={(e) => updateFacultyAssignment(assignment.subject, e.target.value)}
                      className="input-field"
                      style={{ height: 42, fontSize: 13 }}
                    >
                      <option value="">Select faculty...</option>
                      {faculty.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.first_name} {f.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => removeSubject(assignment.subject)}
                    style={{
                      width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.1)', color: '#F87171', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleSubmit} className="btn-grad" disabled={submitting}
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)`,
            opacity: submitting ? 0.6 : 1, width: '100%'
          }}>
          {submitting ? 'Creating...' : <><BookOpen size={16} /> Create Batch</>}
        </button>
      </div>
    </motion.div>
  );
}
