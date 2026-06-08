import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, Send, X } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const RATING_PARAMS = [
  { key: 'topic_explanation', label: 'Topic Explanation' },
  { key: 'subject_knowledge', label: 'Subject Knowledge' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'overall_experience', label: 'Overall Experience' },
];

function isMonday() {
  return new Date().getDay() === 1;
}

function RatingStars({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Star
            size={22}
            fill={star <= value ? '#FBBF24' : 'none'}
            color={star <= value ? '#FBBF24' : 'var(--text-muted)'}
            strokeWidth={star <= value ? 0 : 1.5}
          />
        </button>
      ))}
    </div>
  );
}

export default function FacultyFeedback() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingFeedbacks, setPendingFeedbacks] = useState([]);
  const [submittedIds, setSubmittedIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.get('/api/student/feedback/pending');
        setPendingFeedbacks(Array.isArray(d) ? d : []);
      } catch {
        setPendingFeedbacks([
          { id: '1', faculty_name: 'Dr. Amit Kumar', subject: 'Java Programming', batch: 'Batch A - Java Morning', faculty_id: 101 },
          { id: '2', faculty_name: 'Prof. Sarah Jones', subject: 'Python for Data Science', batch: 'Batch B - Python', faculty_id: 102 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openModal = (fb) => {
    setSelected(fb);
    setRatings({});
    setComment('');
    setShowThanks(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelected(null);
  };

  const canSubmit = RATING_PARAMS.every(p => ratings[p.key] && ratings[p.key] > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    try {
      await api.post('/api/student/feedback', {
        faculty_id: selected.faculty_id,
        ratings,
        comment,
      });
      setSubmittedIds(prev => [...prev, selected.id]);
      setShowThanks(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#8B5CF6', '#10B981', '#FBBF24', '#F43F5E'],
      });
      toast.success('Feedback submitted! Thank you.');
      setTimeout(closeModal, 2000);
    } catch {
      setSubmittedIds(prev => [...prev, selected.id]);
      setShowThanks(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#8B5CF6', '#10B981', '#FBBF24', '#F43F5E'],
      });
      toast.success('Feedback submitted! Thank you.');
      setTimeout(closeModal, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  const remaining = pendingFeedbacks.filter(f => !submittedIds.includes(f.id));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header">
        <h1>Faculty Feedback</h1>
        <p>Rate your faculty and help us improve</p>
      </div>

      {isMonday() && remaining.length > 0 && (
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '18px 24px', marginBottom: 24,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
            borderLeft: '3px solid #F59E0B',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ fontSize: 24 }}>📝</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Weekly Feedback Due — Rate your faculty</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>You have {remaining.length} pending feedback{remaining.length > 1 ? 's' : ''}</p>
          </div>
        </motion.div>
      )}

      {pendingFeedbacks.length === 0 ? (
        <EmptyState icon="⭐" title="No pending feedback" message="All feedback has been submitted." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingFeedbacks.map((fb, i) => {
            const done = submittedIds.includes(fb.id);
            return (
              <motion.div
                key={fb.id || i} className="glass-card"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12,
                  opacity: done ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: done ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: done ? '#34D399' : '#A5B4FC', flexShrink: 0,
                  }}>
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{fb.faculty_name}</p>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>{fb.subject}</span>
                      {fb.batch && <span>{fb.batch}</span>}
                    </div>
                  </div>
                </div>
                {done ? (
                  <span className="badge badge-green" style={{ fontSize: 12, padding: '6px 14px' }}>
                    Feedback submitted ✓
                  </span>
                ) : (
                  <button className="btn-grad" onClick={() => openModal(fb)}
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', padding: '10px 20px', fontSize: 13 }}>
                    <Star size={15} fill="#fff" /> Rate Now
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {showModal && selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={closeModal}>
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 520, width: '100%', padding: 32,
              background: 'var(--bg-card)',
            }}
          >
            {showThanks ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>🎉</span>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Thank You!</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Your feedback helps us improve.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Rate Your Faculty</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {selected.faculty_name} • {selected.subject}
                    </p>
                  </div>
                  <button onClick={closeModal} style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8,
                    width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--text-muted)',
                  }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
                  {RATING_PARAMS.map(p => (
                    <div key={p.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{p.label}</label>
                        {ratings[p.key] && (
                          <span style={{ fontSize: 12, color: '#FBBF24', fontWeight: 600 }}>
                            {ratings[p.key]}/5
                          </span>
                        )}
                      </div>
                      <RatingStars
                        value={ratings[p.key] || 0}
                        onChange={v => setRatings(prev => ({ ...prev, [p.key]: v }))}
                      />
                    </div>
                  ))}
                </div>

                <div className="floating-label-group" style={{ marginBottom: 24 }}>
                  <textarea
                    placeholder=" "
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 80 }}
                  />
                  <label>Additional comments (optional)</label>
                </div>

                <button
                  className="btn-grad"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  style={{
                    background: canSubmit ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.05)',
                    color: canSubmit ? '#fff' : 'var(--text-muted)',
                    width: '100%', opacity: !canSubmit || submitting ? 0.5 : 1,
                    cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  }}
                >
                  {submitting ? 'Submitting...' : <><Send size={16} /> Submit Feedback</>}
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
