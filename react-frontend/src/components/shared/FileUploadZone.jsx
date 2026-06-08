import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FileUploadZone({ onFiles, accept = '.pdf,.xlsx,.csv,.docx,.mp4,.zip', multiple = false, label = 'Drag & drop files here' }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(dropped);
    onFiles?.(dropped);
  };

  const handleChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    onFiles?.(selected);
  };

  const fileIcons = {
    pdf: '📄', xlsx: '📊', csv: '📊', docx: '📝', mp4: '🎬', zip: '📦',
  };

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border)'}`,
          borderRadius: 16, padding: 40, textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(99,102,241,0.05)' : 'transparent',
          transition: 'all 0.2s ease', marginBottom: 16
        }}
      >
        <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 4 }}>{label}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, opacity: 0.6 }}>or click to browse • {accept}</p>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} style={{ display: 'none' }} />
      </div>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((f, i) => {
            const ext = f.name.split('.').pop()?.toLowerCase();
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="glass-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span style={{ fontSize: 22 }}>{fileIcons[ext] || '📎'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(f.size / 1024).toFixed(1)} KB</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
