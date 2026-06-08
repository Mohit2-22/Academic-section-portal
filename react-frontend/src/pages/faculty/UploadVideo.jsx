import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Video, Play, Globe, Eye, EyeOff } from 'lucide-react';
import api from '../../api/client';
import FileUploadZone from '../../components/shared/FileUploadZone';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const ACCENT = '#10B981';

export default function UploadVideo() {
  const [tab, setTab] = useState('file');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    subject: '',
    description: '',
    url: '',
    published: true
  });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/faculty/videos');
        setVideos(Array.isArray(res) ? res : res?.videos || []);
      } catch {
        setVideos([
          { id: 'v1', title: 'Java OOP Tutorial', subject: 'Java', url: 'https://youtube.com/watch?v=abc', published: true, created_at: '2026-06-01' },
          { id: 'v2', title: 'Python Generators', subject: 'Python', url: 'https://vimeo.com/123', published: false, created_at: '2026-06-02' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.subject.trim()) { toast.error('Subject is required'); return; }
    if (tab === 'url' && !form.url.trim()) { toast.error('Video URL is required'); return; }
    if (tab === 'file' && !selectedFile) { toast.error('Please select a video file'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('subject', form.subject);
      fd.append('description', form.description);
      fd.append('published', form.published);

      if (tab === 'url') {
        fd.append('url', form.url);
      } else if (selectedFile) {
        fd.append('video', selectedFile);
      }

      await api.post('/api/faculty/videos', fd);
      toast.success('Video uploaded successfully!');
      setForm({ title: '', subject: '', description: '', url: '', published: true });
      setSelectedFile(null);

      const res = await api.get('/api/faculty/videos').catch(() => ({ videos: [] }));
      setVideos(Array.isArray(res) ? res : res?.videos || []);
    } catch (e) {
      toast.error(e.message || 'Failed to upload video');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Upload Video</h1>
        <p>Share video tutorials with your students</p>
      </div>

      <div className="glass-card" style={{ padding: 32, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button onClick={() => setTab('file')} style={{
            flex: 1, padding: '12px 20px', border: 'none',
            background: tab === 'file' ? `${ACCENT}25` : 'transparent',
            color: tab === 'file' ? ACCENT : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s'
          }}>
            <Upload size={16} /> Upload File
          </button>
          <button onClick={() => setTab('url')} style={{
            flex: 1, padding: '12px 20px', border: 'none',
            background: tab === 'url' ? `${ACCENT}25` : 'transparent',
            color: tab === 'url' ? ACCENT : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s'
          }}>
            <Globe size={16} /> YouTube / Vimeo URL
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
            <label>Video Title *</label>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={form.subject}
              onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))} />
            <label>Subject *</label>
          </div>
        </div>

        <div className="floating-label-group" style={{ marginBottom: 20 }}>
          <textarea placeholder=" " rows={3} value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            style={{ resize: 'vertical' }} />
          <label>Description (optional)</label>
        </div>

        {tab === 'url' ? (
          <div className="floating-label-group" style={{ marginBottom: 20 }}>
            <input type="url" placeholder=" " value={form.url}
              onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))} />
            <label>Video URL (YouTube / Vimeo) *</label>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <FileUploadZone
              onFiles={(files) => setSelectedFile(files[0] || null)}
              accept=".mp4,.webm,.avi,.mov"
              multiple={false}
              label="Drag & drop a video file or click to browse"
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div
              onClick={() => setForm(prev => ({ ...prev, published: !prev.published }))}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: form.published ? ACCENT : 'rgba(255,255,255,0.15)',
                position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.published ? 23 : 3, transition: 'all 0.2s'
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              {form.published ? <Eye size={14} color={ACCENT} /> : <EyeOff size={14} />}
              {form.published ? 'Published' : 'Draft'}
            </span>
          </label>
        </div>

        <button onClick={handleSubmit} className="btn-grad" disabled={submitting}
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #059669)`, opacity: submitting ? 0.6 : 1, width: '100%' }}>
          {submitting ? 'Uploading...' : <><Video size={16} /> {tab === 'url' ? 'Save Video Link' : 'Upload Video'}</>}
        </button>
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Video size={18} color={ACCENT} /> Uploaded Videos
        </h3>
        {videos.length === 0 ? (
          <EmptyState icon="🎬" title="No videos uploaded yet" message="Share your first video tutorial" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {videos.map((v, i) => (
              <div key={v.id || i} style={{
                padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>🎬</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{v.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.subject} • {v.created_at}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`badge ${v.published ? 'badge-green' : 'badge-yellow'}`}>
                    {v.published ? 'Published' : 'Draft'}
                  </span>
                  {v.url && (
                    <a href={v.url} target="_blank" rel="noopener noreferrer"
                      className="btn-grad"
                      style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '6px 12px', fontSize: 11, textDecoration: 'none' }}>
                      <Play size={12} /> Watch
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
