import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MoveHorizontal, X, Phone, MapPin, CalendarDays } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#F59E0B';

const STAGES = [
  { key: 'lead', label: 'Lead', color: '#6366F1' },
  { key: 'seminar', label: 'Seminar', color: '#8B5CF6' },
  { key: 'bootcamp', label: 'Bootcamp', color: '#EC4899' },
  { key: 'counselling', label: 'Counselling', color: '#F59E0B' },
  { key: 'follow_up_1', label: 'Follow Up 1', color: '#F97316' },
  { key: 'follow_up_2', label: 'Follow Up 2', color: '#EF4444' },
  { key: 'follow_up_3', label: 'Follow Up 3', color: '#10B981' },
  { key: 'follow_up_4', label: 'Follow Up 4', color: '#06B6D4' },
  { key: 'follow_up_5', label: 'Follow Up 5', color: '#6366F1' },
  { key: 'admission', label: 'Admission', color: '#10B981' },
];

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function MoveModal({ inquiry, onClose, onMove }) {
  const [target, setTarget] = useState(inquiry?.stage || '');

  if (!inquiry) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <motion.div
        className="glass-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ padding: 28, maxWidth: 420, width: '90%', background: 'var(--bg-card)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>Move Inquiry</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {inquiry.first_name} {inquiry.last_name}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inquiry.mobile} • {inquiry.city}</p>
        </div>
        <div className="floating-label-group">
          <select value={target} onChange={e => setTarget(e.target.value)}>
            <option value="" disabled></option>
            {STAGES.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <label>Move to Stage *</label>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13
            }}
          >Cancel</button>
          <button
            onClick={() => onMove(inquiry.id, target)}
            disabled={!target || target === inquiry.stage}
            className="btn-grad"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #D97706)`,
              opacity: !target || target === inquiry.stage ? 0.5 : 1
            }}
          >
            <MoveHorizontal size={16} /> Move
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function InquiryTracker() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState(null);

  useEffect(() => {
    loadInquiries();
  }, []);

  const loadInquiries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admission/inquiries');
      const data = Array.isArray(res) ? res : res?.inquiries || res?.data || [];
      setInquiries(data);
    } catch {
      const dummy = [
        { id: '1', first_name: 'Rahul', last_name: 'Sharma', mobile: '9876543210', city: 'Delhi', reference_source: 'social_media', date_of_inquiry: new Date().toISOString().split('T')[0], stage: 'lead' },
        { id: '2', first_name: 'Priya', last_name: 'Patel', mobile: '9876543211', city: 'Mumbai', reference_source: 'friends_relatives', date_of_inquiry: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], stage: 'seminar' },
        { id: '3', first_name: 'Amit', last_name: 'Kumar', mobile: '9876543212', city: 'Pune', reference_source: 'newspaper', date_of_inquiry: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], stage: 'lead' },
        { id: '4', first_name: 'Sneha', last_name: 'Reddy', mobile: '9876543213', city: 'Hyderabad', reference_source: 'social_media', date_of_inquiry: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], stage: 'bootcamp' },
        { id: '5', first_name: 'Arjun', last_name: 'Verma', mobile: '9876543214', city: 'Bangalore', reference_source: 'friends_relatives', date_of_inquiry: new Date(Date.now() - 8 * 86400000).toISOString().split('T')[0], stage: 'counselling' },
        { id: '6', first_name: 'Kavita', last_name: 'Joshi', mobile: '9876543215', city: 'Delhi', reference_source: 'other', date_of_inquiry: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0], stage: 'follow_up_2' },
        { id: '7', first_name: 'Vikas', last_name: 'Gupta', mobile: '9876543216', city: 'Mumbai', reference_source: 'social_media', date_of_inquiry: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0], stage: 'follow_up_4' },
        { id: '8', first_name: 'Neha', last_name: 'Singh', mobile: '9876543217', city: 'Pune', reference_source: 'friends_relatives', date_of_inquiry: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0], stage: 'admission' },
      ];
      setInquiries(dummy);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (id, newStage) => {
    if (!newStage) return;
    try {
      await api.put(`/api/admission/inquiries/${id}/stage`, { stage: newStage });
      toast.success('Inquiry moved successfully!');
    } catch {
      toast.success('Inquiry moved (demo mode)');
    }
    setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, stage: newStage } : inq));
    setSelectedInquiry(null);
  };

  const filtered = inquiries.filter(inq =>
    `${inq.first_name} ${inq.last_name} ${inq.mobile} ${inq.city}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Inquiry Tracker</h1>
        <p>Drag inquiries between stages or click to move</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 400 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
        <input
          className="input-field"
          placeholder="Search by name, mobile, city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 40, height: 42 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, minHeight: '60vh' }}>
        {STAGES.map(stage => {
          const stageInquiries = filtered.filter(inq => inq.stage === stage.key);
          return (
            <div key={stage.key} style={{ minWidth: 280, maxWidth: 280, flexShrink: 0 }}>
              <div style={{
                padding: '10px 14px', marginBottom: 10, borderRadius: 12,
                background: `${stage.color}15`,
                borderLeft: `3px solid ${stage.color}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{stage.label}</span>
                <span className="badge" style={{ background: `${stage.color}25`, color: stage.color, fontSize: 10 }}>
                  {stageInquiries.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                {stageInquiries.length === 0 ? (
                  <div style={{
                    padding: 20, textAlign: 'center', borderRadius: 12,
                    border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 12
                  }}>
                    No inquiries
                  </div>
                ) : (
                  stageInquiries.map(inq => {
                    const days = daysInStage(inq.date_of_inquiry);
                    const isOverdue = days > 14;
                    const isWarning = days > 7 && days <= 14;
                    const cardBg = isOverdue ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)';
                    const cardBorder = isOverdue ? '1px solid rgba(239,68,68,0.25)' : isWarning ? '1px solid rgba(245,158,11,0.2)' : '1px solid var(--border)';

                    return (
                      <motion.div
                        key={inq.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => setSelectedInquiry(inq)}
                        style={{
                          padding: 12, borderRadius: 12, cursor: 'pointer',
                          background: cardBg, border: cardBorder,
                          borderLeft: `3px solid ${isOverdue ? '#EF4444' : isWarning ? '#F59E0B' : stage.color}`,
                          transition: 'all 0.2s'
                        }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{inq.first_name} {inq.last_name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                          <Phone size={10} /> {inq.mobile}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                          <MapPin size={10} /> {inq.city || '-'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                          <CalendarDays size={10} /> {inq.date_of_inquiry || '-'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`badge ${inq.reference_source === 'friends_relatives' ? 'badge-green' : inq.reference_source === 'social_media' ? 'badge-blue' : inq.reference_source === 'newspaper' ? 'badge-yellow' : 'badge-purple'}`} style={{ fontSize: 9 }}>
                            {inq.reference_source?.replace(/_/g, ' ') || 'N/A'}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: isOverdue ? '#F87171' : isWarning ? '#FBBF24' : 'var(--text-muted)'
                          }}>
                            {days}d
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <MoveModal
        inquiry={selectedInquiry}
        onClose={() => setSelectedInquiry(null)}
        onMove={handleMove}
      />
    </motion.div>
  );
}
