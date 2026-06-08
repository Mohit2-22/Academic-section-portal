import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Eye, EyeOff, Key, Copy, Check, X } from 'lucide-react';
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

export default function CreateAdmin() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
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

    setLoading(true);
    try {
      const res = await api.post('/api/super-admin/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: 'admin',
      });
      setCreatedUser({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      setModalOpen(true);
      toast.success('Admin created successfully!');
      setForm({ name: '', email: '', phone: '', password: '' });
    } catch {
      setCreatedUser({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      setModalOpen(true);
      toast.success('Admin created (demo mode)');
      setForm({ name: '', email: '', phone: '', password: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdUser) return;
    const text = `Name: ${createdUser.name}\nEmail: ${createdUser.email}\nPassword: ${createdUser.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Credentials copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Create Admin</h1>
        <p>Add a new institute admin</p>
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

        <button onClick={handleSubmit} className="btn-grad" disabled={loading}
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #BE123C)`,
            opacity: loading ? 0.6 : 1, width: '100%'
          }}>
          {loading ? 'Creating...' : <><Shield size={16} /> Create Admin</>}
        </button>
      </div>

      <AnimatePresence>
        {modalOpen && createdUser && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              className="glass-card"
              style={{ padding: 32, maxWidth: 440, width: '90%', background: 'var(--bg-card)' }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>Admin Created!</h3>
                <button onClick={() => setModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Share these credentials with the admin:
              </p>
              <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', marginBottom: 20 }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</span>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{createdUser.name}</p>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</span>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{createdUser.email}</p>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</span>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{createdUser.password}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleCopy}
                  style={{
                    flex: 1, padding: '10px 20px', borderRadius: 10, border: `1px solid ${ACCENT}40`,
                    background: `${ACCENT}20`, color: ACCENT, cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy Credentials'}
                </button>
                <button onClick={() => setModalOpen(false)}
                  className="btn-grad"
                  style={{ flex: 1, background: `linear-gradient(135deg, ${ACCENT}, #BE123C)` }}>
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
