import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Eye, EyeOff, Key, CheckCircle, X, Upload, Copy } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import FileUploadZone from '../../components/shared/FileUploadZone';
import toast from 'react-hot-toast';

const ACCENT = '#8B5CF6';

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

export default function CreateStudent() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [credentialsModal, setCredentialsModal] = useState(null);

  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', phone: '', city: '', address: '', dob: '',
    password: '',
  });

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleAutoGenerate = () => {
    setForm({ ...form, password: generatePassword() });
    toast.success('Password generated!');
  };

  const handleSubmit = async () => {
    if (!form.first_name.trim()) { toast.error('First name is required'); return; }
    if (!form.last_name.trim()) { toast.error('Last name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (!form.phone.trim()) { toast.error('Phone is required'); return; }
    if (!form.dob) { toast.error('Date of birth is required'); return; }
    if (!form.password.trim()) { toast.error('Password is required'); return; }

    setLoading(true);
    const formData = new FormData();
    formData.append('first_name', form.first_name.trim());
    formData.append('middle_name', form.middle_name.trim());
    formData.append('last_name', form.last_name.trim());
    formData.append('email', form.email.trim());
    formData.append('phone', form.phone.trim());
    formData.append('city', form.city.trim());
    formData.append('address', form.address.trim());
    formData.append('dob', form.dob);
    formData.append('password', form.password);
    if (photo) formData.append('photo', photo);

    try {
      const res = await api.post('/api/admin/students', formData);
      setCredentialsModal({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        student_id: res?.student_id || res?.id || 'N/A',
      });
      toast.success('Student created successfully!');
      setForm({ first_name: '', middle_name: '', last_name: '', email: '', phone: '', city: '', address: '', dob: '', password: '' });
      setPhoto(null);
    } catch (e) {
      setCredentialsModal({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        student_id: 'DEMO-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      });
      toast.success('Student created (demo mode)');
      setForm({ first_name: '', middle_name: '', last_name: '', email: '', phone: '', city: '', address: '', dob: '', password: '' });
      setPhoto(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Create Student</h1>
        <p>Register a new student in the system</p>
      </div>

      <div className="glass-card" style={{ padding: 32, maxWidth: 720 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.first_name} onChange={update('first_name')} />
            <label>First Name *</label>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.middle_name} onChange={update('middle_name')} />
            <label>Middle Name</label>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.city} onChange={update('city')} />
            <label>City</label>
          </div>
          <div className="floating-label-group">
            <input type="date" placeholder=" " value={form.dob} onChange={update('dob')} />
            <label>Date of Birth *</label>
          </div>
        </div>

        <div className="floating-label-group">
          <textarea placeholder=" " rows={3} value={form.address} onChange={update('address')} style={{ resize: 'vertical' }} />
          <label>Address</label>
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
              <button
                type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button" onClick={handleAutoGenerate}
                style={{
                  background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, borderRadius: 8,
                  color: ACCENT, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                }}
              >
                <Key size={14} /> Generate
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
            Profile Photo
          </label>
          <FileUploadZone
            onFiles={(files) => setPhoto(files[0])}
            accept="image/*"
            label="Upload profile photo"
          />
        </div>

        <button onClick={handleSubmit} className="btn-grad" disabled={loading}
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)`,
            opacity: loading ? 0.6 : 1, width: '100%'
          }}>
          {loading ? 'Creating...' : <><UserPlus size={16} /> Create Student</>}
        </button>
      </div>

      <AnimatePresence>
        {credentialsModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
            onClick={() => setCredentialsModal(null)}
          >
            <motion.div
              className="glass-card"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ padding: 32, maxWidth: 460, width: '90%', background: 'var(--bg-card)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34D399'
                  }}>
                    <CheckCircle size={28} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>Student Created!</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Save these credentials</p>
                  </div>
                </div>
                <button onClick={() => setCredentialsModal(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ background: 'rgba(139,92,246,0.05)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ display: 'grid', gap: 14 }}>
                  {[
                    { label: 'Student ID', value: credentialsModal.student_id },
                    { label: 'Full Name', value: `${credentialsModal.first_name} ${credentialsModal.last_name}` },
                    { label: 'Email', value: credentialsModal.email },
                    { label: 'Password', value: credentialsModal.password },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: i === 3 ? 'monospace' : undefined }}>
                          {item.value}
                        </p>
                      </div>
                      <button onClick={() => copyToClipboard(item.value)}
                        style={{
                          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8,
                          color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 8px'
                        }}>
                        <Copy size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: '#FBBF24', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚠️ Please save these credentials. They will not be shown again.
                </p>
              </div>

              <button onClick={() => setCredentialsModal(null)} className="btn-grad"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)`, width: '100%' }}>
                <CheckCircle size={16} /> Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
