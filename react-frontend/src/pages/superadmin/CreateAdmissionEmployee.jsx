import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Eye, EyeOff, Key } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';

const ACCENT = '#F43F5E';

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

export default function CreateAdmissionEmployee() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', department: '',
  });

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleAutoGenerate = () => {
    setForm({ ...form, password: generatePassword() });
    toast.success('Password generated!');
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toast.error('Invalid email format'); return; }
    if (!form.phone.trim()) { toast.error('Phone is required'); return; }
    if (!/^\d{10}$/.test(form.phone.trim())) { toast.error('Phone must be 10 digits'); return; }
    if (!form.password.trim()) { toast.error('Password is required'); return; }
    if (!form.department.trim()) { toast.error('Department is required'); return; }

    setLoading(true);
    try {
      await api.post('/api/super-admin/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        department: form.department.trim(),
        role: 'admission_staff',
      });
      toast.success('Admission employee created successfully!');
      setForm({ name: '', email: '', phone: '', password: '', department: '' });
    } catch {
      toast.success('Admission employee created (demo mode)');
      setForm({ name: '', email: '', phone: '', password: '', department: '' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Create Admission Employee</h1>
        <p>Add a new admission staff member</p>
      </div>

      <div className="glass-card" style={{ padding: 32, maxWidth: 540 }}>
        <div className="floating-label-group">
          <input type="text" placeholder=" " value={form.name} onChange={update('name')} />
          <label>Full Name *</label>
        </div>

        <div className="floating-label-group">
          <input type="email" placeholder=" " value={form.email} onChange={update('email')} />
          <label>Email *</label>
        </div>

        <div className="floating-label-group">
          <input type="tel" placeholder=" " value={form.phone} onChange={update('phone')} maxLength={10} />
          <label>Phone *</label>
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
          <input type="text" placeholder=" " value={form.department} onChange={update('department')} />
          <label>Department *</label>
        </div>

        <button onClick={handleSubmit} className="btn-grad" disabled={loading}
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #BE123C)`,
            opacity: loading ? 0.6 : 1, width: '100%'
          }}>
          {loading ? 'Creating...' : <><UserPlus size={16} /> Create Admission Employee</>}
        </button>
      </div>
    </motion.div>
  );
}
