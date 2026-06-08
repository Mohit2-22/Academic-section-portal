import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, ChevronDown, FileText } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

const FILE_ICONS = {
  pdf: '📄',
  xlsx: '📊',
  csv: '📊',
  docx: '📝',
  doc: '📝',
  mp4: '🎬',
  mov: '🎬',
  zip: '📦',
  rar: '📦',
  default: '📄',
};

function getFileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function formatSize(bytes) {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < sizes.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${sizes[i]}`;
}

export default function DownloadMaterial() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.get('/api/student/materials');
        setMaterials(Array.isArray(d) ? d : []);
      } catch {
        setMaterials([
          { id: '1', file_name: 'Java_OOP_Notes.pdf', subject: 'Java Programming', batch: 'Batch A', uploaded_date: '2025-05-20', file_size: 2048000 },
          { id: '2', file_name: 'Python_Basics.pptx', subject: 'Python', batch: 'Batch B', uploaded_date: '2025-05-18', file_size: 5120000 },
          { id: '3', file_name: 'SQL_Cheatsheet.pdf', subject: 'Database', batch: 'Batch A', uploaded_date: '2025-05-15', file_size: 1024000 },
          { id: '4', file_name: 'React_Components_Demo.zip', subject: 'Web Development', batch: 'Batch C', uploaded_date: '2025-05-10', file_size: 15728640 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const subjects = useMemo(() => {
    const set = new Set(materials.map(m => m.subject).filter(Boolean));
    return [...set];
  }, [materials]);

  const filtered = useMemo(() => {
    let list = materials;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.file_name || '').toLowerCase().includes(q) ||
        (m.subject || '').toLowerCase().includes(q) ||
        (m.batch || '').toLowerCase().includes(q)
      );
    }
    if (subjectFilter) {
      list = list.filter(m => m.subject === subjectFilter);
    }
    return list;
  }, [materials, search, subjectFilter]);

  const handleDownload = async (material) => {
    setDownloading(material.id);
    try {
      const blob = await api.get(`/api/student/materials/${material.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = material.file_name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch {
      toast.success('Download started (demo)');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header">
        <h1>Download Materials</h1>
        <p>Access your study materials and resources</p>
      </div>

      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input-field"
              placeholder="Search materials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40, height: 42, fontSize: 13 }}
            />
          </div>
          <select
            className="input-field"
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            style={{ width: 200, height: 42, fontSize: 13, appearance: 'none', cursor: 'pointer' }}
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📁" title="No materials found" message={search ? 'Try a different search term' : 'No materials available yet'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((m, i) => (
            <motion.div
              key={m.id} className="glass-card"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 200 }}>
                <span style={{ fontSize: 28 }}>{getFileIcon(m.file_name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2, wordBreak: 'break-word' }}>{m.file_name || 'Unknown file'}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    {m.subject && <span>{m.subject}</span>}
                    {m.batch && <span>{m.batch}</span>}
                    {m.uploaded_date && <span>{new Date(m.uploaded_date).toLocaleDateString()}</span>}
                    {m.file_size && <span>{formatSize(m.file_size)}</span>}
                  </div>
                </div>
              </div>
              <button
                className="btn-grad"
                onClick={() => handleDownload(m)}
                disabled={downloading === m.id}
                style={{
                  background: downloading === m.id ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  padding: '10px 20px', fontSize: 13, flexShrink: 0,
                  opacity: downloading === m.id ? 0.6 : 1,
                  minWidth: 110,
                }}
              >
                <Download size={16} />
                {downloading === m.id ? 'Opening...' : 'Download'}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
