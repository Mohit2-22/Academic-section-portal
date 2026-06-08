import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import api from '../../api/client';
import FileUploadZone from '../../components/shared/FileUploadZone';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#10B981';

export default function UploadMaterial() {
  const [batches, setBatches] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});

  const [form, setForm] = useState({
    batch_id: '',
    subject: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [bRes, mRes] = await Promise.all([
          api.get('/api/faculty/batches'),
          api.get('/api/faculty/materials')
        ]);
        setBatches(Array.isArray(bRes) ? bRes : bRes?.batches || []);
        setMaterials(Array.isArray(mRes) ? mRes : mRes?.materials || []);
      } catch {
        setBatches([{ id: 'b1', name: 'Batch A - Java Morning' }, { id: 'b2', name: 'Batch B - Python Evening' }]);
        setMaterials([
          { id: 'm1', file_name: 'Java_Notes.pdf', batch_name: 'Batch A', subject: 'Java', uploaded_at: '2026-06-01', file_size: '2.4 MB' },
          { id: 'm2', file_name: 'Python_Basics.pptx', batch_name: 'Batch B', subject: 'Python', uploaded_at: '2026-06-02', file_size: '1.8 MB' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUpload = async (files) => {
    if (!form.batch_id || !form.subject.trim()) {
      toast.error('Please select a batch and subject first');
      return;
    }
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      setProgress(prev => ({ ...prev, [file.name]: 0 }));
      const fakeProgress = (pct) => {
        setProgress(prev => ({ ...prev, [file.name]: pct }));
      };
      fakeProgress(10);
      await new Promise(r => setTimeout(r, 200));
      fakeProgress(30);
      await new Promise(r => setTimeout(r, 300));
      fakeProgress(60);

      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('batch_id', form.batch_id);
        fd.append('subject', form.subject);
        await api.post('/api/faculty/materials', fd);
        fakeProgress(100);
        toast.success(`${file.name} uploaded!`);
      } catch {
        fakeProgress(0);
        toast.error(`Failed to upload ${file.name}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    setUploading(false);
    setProgress({});
    const mRes = await api.get('/api/faculty/materials').catch(() => ({ materials: [] }));
    setMaterials(Array.isArray(mRes) ? mRes : mRes?.materials || []);
  };

  const fileExt = (name) => name?.split('.').pop()?.toLowerCase();

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Upload Material</h1>
        <p>Share study materials with your batches</p>
      </div>

      <div className="glass-card" style={{ padding: 32, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="floating-label-group">
            <select value={form.batch_id} onChange={e => setForm(prev => ({ ...prev, batch_id: e.target.value }))}>
              <option value="" disabled></option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label>Select Batch *</label>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.subject}
              onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))} />
            <label>Subject *</label>
          </div>
        </div>
        <FileUploadZone
          onFiles={handleUpload}
          accept=".pdf,.xlsx,.csv,.docx,.mp4,.zip"
          multiple={true}
          label="Drag & drop files (PDF, XLSX, CSV, DOCX, MP4, ZIP)"
        />
        {uploading && Object.keys(progress).length > 0 && (
          <div style={{ marginTop: 16 }}>
            {Object.entries(progress).map(([name, pct]) => (
              <div key={name} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{name}</span>
                  <span style={{ color: ACCENT }}>{pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${ACCENT}, #059669)` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color={ACCENT} /> Uploaded Materials
        </h3>
        {materials.length === 0 ? (
          <EmptyState icon="📂" title="No materials uploaded yet" message="Upload study materials for your batches" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {materials.map((m, i) => (
              <div key={m.id || i} style={{
                padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>
                    {fileExt(m.file_name) === 'pdf' ? '📄' : fileExt(m.file_name) === 'mp4' ? '🎬' : '📎'}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{m.file_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.batch_name} • {m.subject} • {m.file_size || '-'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-grad" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '6px 12px', fontSize: 11 }}
                    onClick={() => { try { api.get(`/api/faculty/materials/${m.id}/download`).then(blob => { const url = URL.createObjectURL(blob); window.open(url); }); } catch {} }}>
                    <Download size={12} />
                  </button>
                  <button className="btn-grad" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', padding: '6px 12px', fontSize: 11 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
