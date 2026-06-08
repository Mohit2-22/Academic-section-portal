import { motion } from 'framer-motion';

export default function LoadingSpinner({ accent = '#6366F1' }) {
  return (
    <div className="loading-screen">
      <motion.div
        className="spinner"
        style={{ borderTopColor: accent }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
    </div>
  );
}
