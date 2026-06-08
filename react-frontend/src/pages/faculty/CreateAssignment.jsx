import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Send, Save, Users, Calendar } from 'lucide-react';
import api from '../../api/client';
import FileUploadZone from '../../components/shared/FileUploadZone';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#10B981';

export default function CreateAssignment() {
  const [batches, setBatches] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    subject: '',
    description: '',
    due_date: ''
  });
  const [selectedBatch, setSelectedBatch] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [bRes, aRes] = await Promise.all([
          api.get('/api/faculty/batches'),
          api.get('/api/faculty/assignments')
        ]);
        setBatches(Array.isArray(bRes) ? bRes : bRes?.batches || []);
        setAssignments(Array.isArray(aRes) ? aRes : aRes?.assignments || []);
      } catch {
        setBatches([{ id: 'b1', name: 'Batch A - Java Morning' }, { id: 'b2', name: 'Batch B - Python Evening' }]);
        setAssignments([
          { id: 'a1', title: 'Java OOP Assignment', subject: 'Java', due_date: '2026-06-15', status: 'assigned', batch_name: 'Batch A' },
          { id: 'a2', title: 'Python Loops', subject: 'Python', due_date: '2026-06-20', status: 'draft', batch_name: null },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const validate = () => {
    if (!form.title.trim()) { toast.error('Assignment title is required'); return false; }
    if (!form.subject.trim()) { toast.error('Subject is required'); return false; }
    if (!form.description.trim()) { toast.error('Description is required'); return false; }
    if (!form.due_date) { toast.error('Due date is required'); return false; }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('subject', form.subject);
      fd.append('description', form.description);
      fd.append('due_date', form.due_date);
      fd.append('status', 'draft');
      files.forEach(f => fd.append('files', f));
      await api.post('/api/faculty/assignments', fd);
      toast.success('Assignment saved as draft!');
      resetForm();
      refreshAssignments();
    } catch (e) {
      toast.error(e.message || 'Failed to save assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedBatch) { toast.error('Please select a batch'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('subject', form.subject);
      fd.append('description', form.description);
      fd.append('due_date', form.due_date);
      fd.append('status', 'assigned');
      fd.append('batch_id', selectedBatch);
      files.forEach(f => fd.append('files', f));
      await api.post('/api/faculty/assignments', fd);
      toast.success('Assignment assigned to batch!');
      setShowBatchModal(false);
      setSelectedBatch('');
      resetForm();
      refreshAssignments();
    } catch (e) {
      toast.error(e.message || 'Failed to assign assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({ title: '', subject: '', description: '', due_date: '' });
    setFiles([]);
  };

  const refreshAssignments = async () => {
    const res = await api.get('/api/faculty/assignments').catch(() => ({ assignments: [] }));
    setAssignments(Array.isArray(res) ? res : res?.assignments || []);
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Create Assignment</h1>
        <p>Create and assign assignments to your batches</p>
      </div>

      <div className="glass-card" style={{ padding: 32, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
            <label>Assignment Title *</label>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.subject}
              onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))} />
            <label>Subject *</label>
          </div>
        </div>
        <div className="floating-label-group" style={{ marginBottom: 20 }}>
          <textarea placeholder=" " rows={4} value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            style={{ resize: 'vertical' }} />
          <label>Description *</label>
        </div>
        <div className="floating-label-group" style={{ marginBottom: 20 }}>
          <input type="date" placeholder=" " value={form.due_date}
            onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))} />
          <label>Due Date *</label>
        </div>

        <div style={{ marginBottom: 24 }}>
          <FileUploadZone
            onFiles={(f) => setFiles(f)}
            accept=".pdf,.docx,.xlsx,.zip,.csv"
            multiple={true}
            label="Attach files (optional)"
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleSaveDraft} className="btn-grad" disabled={submitting}
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', flex: 1, opacity: submitting ? 0.6 : 1 }}>
            <Save size={16} /> Save as Draft
          </button>
          <button onClick={() => { if (validate()) setShowBatchModal(true); }} className="btn-grad" disabled={submitting}
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #059669)`, flex: 1, opacity: submitting ? 0.6 : 1 }}>
            <Send size={16} /> Assign to Batch
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color={ACCENT} /> Assignments
        </h3>
        {assignments.length === 0 ? (
          <EmptyState icon="📝" title="No assignments created yet" message="Create your first assignment above" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assignments.map((a, i) => (
              <div key={a.id || i} style={{
                padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{a.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {a.subject} • Due: {a.due_date}
                    {a.batch_name && ` • ${a.batch_name}`}
                  </p>
                </div>
                <span className={`badge ${a.status === 'assigned' ? 'badge-green' : 'badge-yellow'}`}>
                  {a.status === 'assigned' ? 'Assigned' : 'Draft'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBatchModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowBatchModal(false)}
        >
          <motion.div
            className="glass-card"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ padding: 32, maxWidth: 420, width: '90%', background: 'var(--bg-card)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color={ACCENT} /> Assign to Batch
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>Select a batch to assign "{form.title}"</p>
            <div className="floating-label-group" style={{ marginBottom: 24 }}>
              <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}>
                <option value="" disabled></option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <label>Select Batch</label>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBatchModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
                  fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13
                }}>
                Cancel
              </button>
              <button onClick={handleAssign} className="btn-grad" disabled={submitting}
                style={{ background: `linear-gradient(135deg, ${ACCENT}, #059669)`, opacity: submitting ? 0.6 : 1 }}>
                <Send size={14} /> Assign
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
