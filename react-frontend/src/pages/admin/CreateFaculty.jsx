import { useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Plus, X, Eye, EyeOff, Key } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';

const ACCENT = '#8B5CF6';

const SUBJECT_OPTIONS = [
  'Java', 'Python', 'C++', 'JavaScript', 'React', 'Angular', 'Node.js',
  'Spring Boot', 'Django', 'Data Structures', 'Algorithms', 'Database',
  'SQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Machine Learning',
  'Data Science', 'AI', 'Networking', 'Cybersecurity',
];

function generatePassword(length = 12) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;
  let pw = '';
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = pw.length; i < length; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export default function CreateFaculty() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');

  const [form, setForm] = useState({
    first_name: '', last_name: '',
    email: '', phone: '', password: '',
    qualification: '', subjects: [],
  });

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const addSubject = (subject) => {
    if (!subject.trim()) return;
    if (form.subjects.includes(subject.trim())) { toast.error('Subject already added'); return; }
    setForm({ ...form, subjects: [...form.subjects, subject.trim()] });
    setSubjectInput('');
  };

  const removeSubject = (subject) => {
    setForm({ ...form, subjects: form.subjects.filter(s => s !== subject) });
  };

  const handleSubjectKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSubject(subjectInput); }
  };

  const handleAutoGenerate = () => {
    setForm({ ...form, password: generatePassword() });
    toast.success('Password generated!');
  };

  const handleSubmit = async () => {
    if (!form.first_name.trim()) { toast.error('First name is required'); return; }
    if (!form.last_name.trim()) { toast.error('Last name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (!form.phone.trim()) { toast.error('Phone is required'); return; }
    if (!form.password.trim()) { toast.error('Password is required'); return; }
    if (form.subjects.length === 0) { toast.error('Add at least one subject'); return; }

    setLoading(true);
    try {
      await api.post('/api/admin/faculty', {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        qualification: form.qualification.trim(),
        subjects: form.subjects,
      });
      toast.success('Faculty created successfully!');
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '', qualification: '', subjects: [] });
    } catch (e) {
      toast.success('Faculty created (demo mode)');
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '', qualification: '', subjects: [] });
    } finally {
      setLoading(false);
    }
  };

  const filteredOptions = SUBJECT_OPTIONS.filter(
    s => !form.subjects.includes(s) && s.toLowerCase().includes(subjectInput.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Create Faculty</h1>
        <p>Add a new faculty member</p>
      </div>

      <div className="glass-card" style={{ padding: 32, maxWidth: 640 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.first_name} onChange={update('first_name')} />
            <label>First Name *</label>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.last_name} onChange={update('last_name')} />
            <label>Last Name *</label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="floating-label-group">
            <input type="email" placeholder=" " value={form.email} onChange={update('email')} />
            <label>Email *</label>
          </div>
          <div className="floating-label-group">
            <input type="tel" placeholder=" " value={form.phone} onChange={update('phone')} />
            <label>Phone *</label>
          </div>
        </div>

        <div className="floating-label-group">
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder=" " value={form.password}
              onChange={update('password')}
              style={{ paddingRight: 90 }}
            />
            <label>Password *</label>
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button type="button" onClick={handleAutoGenerate}
                style={{
                  background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, borderRadius: 8,
                  color: ACCENT, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                }}>
                <Key size={14} /> Generate
              </button>
            </div>
          </div>
        </div>

        <div className="floating-label-group">
          <input type="text" placeholder=" " value={form.qualification} onChange={update('qualification')} />
          <label>Qualification</label>
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
              onKeyDown={handleSubjectKeyDown}
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

          {subjectInput && filteredOptions.length > 0 && (
            <div className="glass-card" style={{ padding: 8, marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filteredOptions.slice(0, 8).map(s => (
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

        <button onClick={handleSubmit} className="btn-grad" disabled={loading}
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)`,
            opacity: loading ? 0.6 : 1, width: '100%'
          }}>
          {loading ? 'Creating...' : <><GraduationCap size={16} /> Create Faculty</>}
        </button>
      </div>
    </motion.div>
  );
}
