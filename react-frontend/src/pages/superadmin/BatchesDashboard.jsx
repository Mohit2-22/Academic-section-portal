import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, GraduationCap, ChevronDown, ChevronUp, X } from 'lucide-react';
import api from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#F43F5E';

const DUMMY_BATCHES = [
  {
    id: 'b1', name: 'Batch A - Full Stack Java', max_students: 35, students_count: 28,
    subjects: ['Java', 'Spring Boot', 'React', 'SQL'],
    faculty: [{ name: 'Dr. Vikram Mehta', subject: 'Java' }, { name: 'Prof. Anjali Gupta', subject: 'React' }],
    status: 'active', start_date: '2026-01-15', end_date: '2026-07-15',
    students: [
      { id: 's1', name: 'Arjun Mehta', email: 'arjun@email.com', phone: '9876540101' },
      { id: 's2', name: 'Bhavna Patel', email: 'bhavna@email.com', phone: '9876540102' },
      { id: 's3', name: 'Ishita Desai', email: 'ishita@email.com', phone: '9876540103' },
    ],
  },
  {
    id: 'b2', name: 'Batch B - Python Full Stack', max_students: 35, students_count: 32,
    subjects: ['Python', 'Django', 'React', 'MongoDB'],
    faculty: [{ name: 'Dr. Vikram Mehta', subject: 'Python' }, { name: 'Dr. Sneha Reddy', subject: 'Django' }],
    status: 'active', start_date: '2026-02-01', end_date: '2026-08-01',
    students: [
      { id: 's4', name: 'Chirag Shah', email: 'chirag@email.com', phone: '9876540104' },
      { id: 's5', name: 'Deepika Rao', email: 'deepika@email.com', phone: '9876540105' },
      { id: 's6', name: 'Jay Verma', email: 'jay@email.com', phone: '9876540106' },
    ],
  },
  {
    id: 'b3', name: 'Batch C - Data Science', max_students: 30, students_count: 18,
    subjects: ['Python', 'Machine Learning', 'Data Science', 'SQL'],
    faculty: [{ name: 'Prof. Anjali Gupta', subject: 'Machine Learning' }],
    status: 'active', start_date: '2026-03-10', end_date: '2026-09-10',
    students: [
      { id: 's7', name: 'Esha Gupta', email: 'esha@email.com', phone: '9876540107' },
      { id: 's8', name: 'Farhan Khan', email: 'farhan@email.com', phone: '9876540108' },
    ],
  },
  {
    id: 'b4', name: 'Batch D - MERN Stack', max_students: 30, students_count: 25,
    subjects: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
    faculty: [{ name: 'Dr. Vikram Mehta', subject: 'Node.js' }],
    status: 'active', start_date: '2026-04-05', end_date: '2026-10-05',
    students: [
      { id: 's9', name: 'Gauri Joshi', email: 'gauri@email.com', phone: '9876540109' },
      { id: 's10', name: 'Harsh Tiwari', email: 'harsh@email.com', phone: '9876540110' },
    ],
  },
  {
    id: 'b5', name: 'Batch E - AWS & DevOps', max_students: 25, students_count: 15,
    subjects: ['AWS', 'Docker', 'Kubernetes', 'Linux'],
    faculty: [{ name: 'Prof. Anjali Gupta', subject: 'AWS' }],
    status: 'upcoming', start_date: '2026-06-20', end_date: '2026-12-20',
    students: [
      { id: 's11', name: 'Kavya Nair', email: 'kavya@email.com', phone: '9876540111' },
      { id: 's12', name: 'Lokesh Reddy', email: 'lokesh@email.com', phone: '9876540112' },
    ],
  },
  {
    id: 'b6', name: 'Batch F - Competitive Programming', max_students: 30, students_count: 30,
    subjects: ['C++', 'Algorithms', 'Data Structures'],
    faculty: [{ name: 'Dr. Vikram Mehta', subject: 'Algorithms' }, { name: 'Dr. Sneha Reddy', subject: 'C++' }],
    status: 'completed', start_date: '2025-07-01', end_date: '2026-01-01',
    students: [
      { id: 's13', name: 'Manish Yadav', email: 'manish@email.com', phone: '9876540113' },
      { id: 's14', name: 'Nisha Agarwal', email: 'nisha@email.com', phone: '9876540114' },
    ],
  },
];

const STATUS_STYLES = {
  active: { bg: 'rgba(16,185,129,0.15)', color: '#34D399', border: 'rgba(16,185,129,0.3)' },
  upcoming: { bg: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: 'rgba(245,158,11,0.3)' },
  completed: { bg: 'rgba(99,102,241,0.15)', color: '#818CF8', border: 'rgba(99,102,241,0.3)' },
};

export default function BatchesDashboard() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/super-admin/batches-dashboard');
        setBatches(Array.isArray(res) ? res : res?.batches || []);
      } catch {
        setBatches(DUMMY_BATCHES);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Batches Dashboard</h1>
        <p>View all batches, students, and occupancy</p>
      </div>

      {batches.length === 0 ? (
        <EmptyState icon="📚" title="No batches found" message="No batches have been created yet." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {batches.map((batch, i) => {
            const statusStyle = STATUS_STYLES[batch.status] || STATUS_STYLES.active;
            const occupancyPct = batch.max_students > 0 ? (batch.students_count / batch.max_students) * 100 : 0;
            const isExpanded = expandedBatch?.id === batch.id;

            return (
              <motion.div
                key={batch.id}
                className="glass-card"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                style={{ padding: 24, cursor: 'pointer' }}
                onClick={() => setExpandedBatch(isExpanded ? null : batch)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                      {batch.name}
                    </h3>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
                      textTransform: 'capitalize'
                    }}>
                      {batch.status}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Users size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {batch.students_count} / {batch.max_students} students
                    {batch.status === 'completed' && ` (${batch.students_count}/${batch.max_students})`}
                  </span>
                </div>

                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(occupancyPct, 100)}%`, height: '100%',
                    borderRadius: 3,
                    background: batch.status === 'completed' ? '#818CF8' :
                      occupancyPct >= 80 ? '#34D399' :
                      occupancyPct >= 50 ? '#FBBF24' : ACCENT,
                    transition: 'width 0.6s ease'
                  }} />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {batch.subjects?.map(sub => (
                    <span key={sub} style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11,
                      background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30`
                    }}>
                      {sub}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <GraduationCap size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {batch.faculty?.map(f => f.name).join(', ') || 'No faculty assigned'}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {expandedBatch && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExpandedBatch(null)}
          >
            <motion.div
              className="glass-card"
              style={{ padding: 32, maxWidth: 700, width: '90%', maxHeight: '80vh', overflow: 'auto', background: 'var(--bg-card)' }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                    {expandedBatch.name}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {expandedBatch.students_count} students • {expandedBatch.subjects?.length} subjects
                  </p>
                </div>
                <button onClick={() => setExpandedBatch(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 2 }}>Duration</span>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
                    {expandedBatch.start_date} to {expandedBatch.end_date}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 2 }}>Faculty</span>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
                    {expandedBatch.faculty?.map(f => `${f.name} (${f.subject})`).join(', ') || 'None'}
                  </span>
                </div>
              </div>

              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Students in this Batch
              </h4>
              {(!expandedBatch.students || expandedBatch.students.length === 0) ? (
                <EmptyState icon="👤" title="No students enrolled" message="This batch has no students yet." />
              ) : (
                <DataTable columns={columns} data={expandedBatch.students} pageSize={10} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
