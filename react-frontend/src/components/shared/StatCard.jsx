import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

export default function StatCard({ icon, value, label, trend, accent = '#6366F1', onClick }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
    const duration = 1500;
    const steps = 30;
    const stepVal = num / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += stepVal;
      if (current >= num) { setDisplayed(num); clearInterval(interval); }
      else setDisplayed(current);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [visible, value]);

  const formatVal = (v) => {
    if (typeof value === 'string' && value.startsWith('₹')) return `₹${Math.round(v).toLocaleString()}`;
    if (typeof value === 'string' && value.startsWith('+')) return `+${Math.round(v)}`;
    return Math.round(v).toLocaleString();
  };

  return (
    <motion.div
      ref={ref}
      className="glass-card"
      onClick={onClick}
      style={{
        padding: 24, cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${accent}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}
      whileHover={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>{label}</p>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color: '#fff' }}>
          {formatVal(displayed)}
        </h2>
        {trend && (
          <span className={`badge ${trend > 0 ? 'badge-green' : 'badge-red'}`} style={{ marginTop: 8 }}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, fontSize: 22
      }}>{icon}</div>
    </motion.div>
  );
}
