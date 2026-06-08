import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, LogIn, GraduationCap, Users, ShieldCheck, Funnel, Crown, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function RoleLogin({ role = 'student', accent = '#6366F1', icon = '🎓', title = 'Student', subtitle = 'Student Portal' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, role);
      toast.success(`Welcome to ${title} Portal!`);
      const roleRoute = role === 'student' ? '/dashboard/student/home' :
        role === 'faculty' ? '/dashboard/faculty/home' :
        role === 'admin' ? '/dashboard/admin/home' :
        role === 'admission_staff' ? '/dashboard/admission/home' :
        '/dashboard/superadmin/home';
      navigate(roleRoute);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { role: 'student', accent: '#6366F1', icon: '🎓', label: 'Student', path: '/' },
    { role: 'faculty', accent: '#10B981', icon: '👨‍🏫', label: 'Faculty', path: '/faculty' },
    { role: 'admin', accent: '#8B5CF6', icon: '🛡️', label: 'Admin', path: '/admin' },
    { role: 'admission_staff', accent: '#F59E0B', icon: '📋', label: 'Admission', path: '/admission' },
    { role: 'super_admin', accent: '#F43F5E', icon: '👑', label: 'Super Admin', path: '/superadmin' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      {/* Left Panel - Animated Background */}
      <div style={{
        flex: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px', position: 'relative', overflow: 'hidden'
      }}>
        {/* Animated blobs */}
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%',
          borderRadius: '50%', background: `${accent}30`, filter: 'blur(120px)',
          animation: 'blob 8s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%',
          borderRadius: '50%', background: `${accent}20`, filter: 'blur(100px)',
          animation: 'blob 10s ease-in-out infinite', animationDelay: '-3s'
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '20%', width: '30%', height: '30%',
          borderRadius: '50%', background: `${accent}15`, filter: 'blur(80px)',
          animation: 'blob 12s ease-in-out infinite', animationDelay: '-6s'
        }} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, color: '#fff',
              boxShadow: `0 12px 40px ${accent}40`
            }}>TP</div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32, color: '#fff', lineHeight: 1.2 }}>TechPro</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Computer Institute</p>
            </div>
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 42, fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.2 }}>{subtitle}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 480, marginBottom: 48 }}>
            {role === 'student' ? 'Access your courses, join live classes, and track your learning journey.' :
             role === 'faculty' ? 'Manage lectures, upload materials, and engage with your students.' :
             role === 'admin' ? 'Manage students, faculty, batches, and institute operations.' :
             role === 'admission_staff' ? 'Track inquiries, manage leads, and drive admissions.' :
             'Full system oversight — users, fees, batches, and analytics.'}
          </p>

          {/* Feature highlight cards */}
          {[
            { icon: '🚀', title: 'Smart Learning', desc: 'AI-powered personalized education experience' },
            { icon: '🔒', title: 'Secure Platform', desc: 'Role-based access with enterprise-grade security' },
            { icon: '📊', title: 'Real-time Analytics', desc: 'Track progress with detailed insights and reports' },
          ].map((f, i) => (
            <motion.div
              key={i} className="glass-card"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              style={{ padding: 16, marginBottom: 12, maxWidth: 400, display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <span style={{ fontSize: 28 }}>{f.icon}</span>
              <div>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: '#fff' }}>{f.title}</h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Right Panel - Login Form */}
      <div style={{
        flex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40, position: 'relative'
      }}>
        <div style={{
          position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 1,
          background: `linear-gradient(to bottom, transparent, ${accent}40, transparent)`
        }} />
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card"
          style={{ width: '100%', maxWidth: 420, padding: 36, background: 'var(--bg-card)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 32 }}>{icon}</span>
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: '#fff' }}>Welcome Back</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sign in to continue</p>
              </div>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, background: `${accent}20`, border: `1px solid ${accent}40`, marginBottom: 28 }}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="animate-shake"
                style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#F87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                <span>⚠️</span> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit}>
            <div className="floating-label-group">
              <input type="text" id="email" placeholder=" " value={email} onChange={e => setEmail(e.target.value)} required />
              <label htmlFor="email">Username / Email</label>
            </div>
            <div className="floating-label-group" style={{ position: 'relative' }}>
              <input type={showPwd ? 'text' : 'password'} id="password" placeholder=" " value={password} onChange={e => setPassword(e.target.value)} required />
              <label htmlFor="password">Password</label>
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
              }}>
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <a href="#" style={{ color: accent, fontSize: 12, textDecoration: 'none' }}
                onClick={e => { e.preventDefault(); toast('Contact admin to reset password'); }}>
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="btn-grad"
              style={{
                width: '100%', height: 48, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                fontSize: 15, opacity: loading ? 0.7 : 1
              }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{
                    width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Signing in...
                </span>
              ) : (
                <><LogIn size={18} /> Sign in to {title} Portal</>
              )}
            </button>
          </form>

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>Quick Switch Portal</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {roles.map(r => (
                <motion.button
                  key={r.role}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => window.location.href = r.path}
                  style={{
                    width: 42, height: 42, borderRadius: 12, border: `1px solid ${r.accent}40`,
                    background: r.role === role ? `${r.accent}20` : 'transparent',
                    cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  title={r.label}
                >
                  {r.icon}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
