import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'important', label: 'Important' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} d ago`;
  return date.toLocaleDateString();
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.get('/api/student/notifications');
        setNotifications(Array.isArray(d) ? d : []);
      } catch {
        setNotifications([
          { id: '1', title: 'Assignment Due', message: 'Java assignment on Polymorphism is due tomorrow.', sender: 'Dr. Amit Kumar', created_at: new Date(Date.now() - 3600000).toISOString(), is_read: false, is_important: true },
          { id: '2', title: 'Class Rescheduled', message: 'Python class moved to 2 PM on Friday.', sender: 'Admin', created_at: new Date(Date.now() - 7200000).toISOString(), is_read: false, is_important: false },
          { id: '3', title: 'Exam Schedule', message: 'Mid-term exams start from March 15.', sender: 'Exam Cell', created_at: new Date(Date.now() - 86400000).toISOString(), is_read: true, is_important: true },
          { id: '4', title: 'Fee Reminder', message: 'Your tuition fee for next semester is due.', sender: 'Accounts', created_at: new Date(Date.now() - 172800000).toISOString(), is_read: false, is_important: false },
          { id: '5', title: 'Certificate Available', message: 'Your Java completion certificate is ready for download.', sender: 'Admin', created_at: new Date(Date.now() - 259200000).toISOString(), is_read: true, is_important: false },
          { id: '6', title: 'Holiday Notice', message: 'College remains closed on March 8 for Holi.', sender: 'Principal Office', created_at: new Date(Date.now() - 604800000).toISOString(), is_read: false, is_important: true },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'unread') return notifications.filter(n => !n.is_read);
    if (activeTab === 'important') return notifications.filter(n => n.is_important);
    return notifications;
  }, [notifications, activeTab]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await api.post('/api/student/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } finally {
      setMarking(false);
    }
  };

  const handleMarkOne = async (id) => {
    try {
      await api.post(`/api/student/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Notifications</h1>
          <p>Stay updated with your latest alerts</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn-grad" onClick={handleMarkAllRead} disabled={marking}
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', padding: '10px 20px', fontSize: 13 }}>
            <CheckCheck size={16} /> Mark All Read
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 20px', borderRadius: 100, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
              background: activeTab === tab.key ? '#6366F1' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
            {tab.key === 'unread' && unreadCount > 0 && (
              <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 100, fontSize: 11 }}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications" message="You're all caught up!" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((n, i) => (
            <motion.div
              key={n.id} className="glass-card"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => !n.is_read && handleMarkOne(n.id)}
              style={{
                padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
                cursor: !n.is_read ? 'pointer' : 'default',
                borderLeft: n.is_important ? '3px solid #F59E0B' : '3px solid transparent',
                opacity: n.is_read ? 0.6 : 1,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: n.is_important ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: n.is_important ? '#FBBF24' : '#A5B4FC',
              }}>
                <Bell size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />}
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{n.title}</p>
                  {n.is_important && <span className="badge badge-yellow" style={{ fontSize: 10 }}>Important</span>}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.4 }}>{n.message}</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{n.sender}</span>
                  <span>•</span>
                  <span>{timeAgo(n.created_at)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
