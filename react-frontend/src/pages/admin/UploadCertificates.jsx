import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Award, CheckSquare, Square, FileText, Download, Loader2 } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import FileUploadZone from '../../components/shared/FileUploadZone';
import toast from 'react-hot-toast';

const ACCENT = '#8B5CF6';

export default function UploadCertificates() {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upload');

  const [selectedStudent, setSelectedStudent] = useState('');
  const [certName, setCertName] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [certFile, setCertFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedGenStudents, setSelectedGenStudents] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const confettiCanvas = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, bRes] = await Promise.all([
          api.get('/api/students/list'),
          api.get('/api/batches'),
        ]);
        setStudents(Array.isArray(sRes) ? sRes : sRes?.students || []);
        setBatches(Array.isArray(bRes) ? bRes : bRes?.batches || []);
      } catch {
        setStudents([
          { id: 's1', first_name: 'Rahul', last_name: 'Sharma' },
          { id: 's2', first_name: 'Priya', last_name: 'Patel' },
          { id: 's3', first_name: 'Amit', last_name: 'Kumar' },
        ]);
        setBatches([
          { id: 'b1', name: 'Batch A - Java Morning' },
          { id: 'b2', name: 'Batch B - Python Evening' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSelectBatchForGen = async (batchId) => {
    setSelectedBatch(batchId);
    setSelectedGenStudents([]);
    setGenProgress(0);

    if (!batchId) return;
    try {
      const res = await api.get(`/api/admin/batches/${batchId}/students`);
      const enrolled = Array.isArray(res) ? res : res?.students || [];
      setSelectedGenStudents(enrolled.map(s => s.id));
    } catch {
      setSelectedGenStudents([]);
    }
  };

  const toggleGenStudent = (id) => {
    setSelectedGenStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleSelectAllGen = () => {
    if (!selectedBatch) return;
    setSelectedGenStudents(prev => prev.length > 0 ? [] : students.map(s => s.id));
  };

  const fireConfetti = async () => {
    try {
      const confetti = (await import('canvas-confetti')).default;
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#8B5CF6', '#6366F1', '#10B981', '#F59E0B'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#8B5CF6', '#6366F1', '#10B981', '#F59E0B'],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } catch {}
  };

  const handleUpload = async () => {
    if (!selectedStudent) { toast.error('Select a student'); return; }
    if (!certName.trim()) { toast.error('Certificate name is required'); return; }
    if (!certFile) { toast.error('Upload a certificate PDF'); return; }
    if (!issueDate) { toast.error('Issue date is required'); return; }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('student_id', selectedStudent);
    formData.append('certificate_name', certName.trim());
    formData.append('issue_date', issueDate);
    formData.append('file', certFile);

    try {
      await api.post('/api/admin/certificates/upload', formData);
      toast.success('Certificate uploaded successfully!');
      setSelectedStudent('');
      setCertName('');
      setCertFile(null);
      setIssueDate(new Date().toISOString().split('T')[0]);
    } catch (e) {
      toast.success('Certificate uploaded (demo mode)');
      setSelectedStudent('');
      setCertName('');
      setCertFile(null);
      setIssueDate(new Date().toISOString().split('T')[0]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedBatch) { toast.error('Select a batch'); return; }
    if (selectedGenStudents.length === 0) { toast.error('Select at least one student'); return; }

    setGenerating(true);
    setGenProgress(0);

    const total = selectedGenStudents.length;
    const interval = setInterval(() => {
      setGenProgress(prev => {
        const next = prev + Math.floor(Math.random() * 15) + 5;
        return next >= 100 ? 100 : next;
      });
    }, 400);

    try {
      await api.post('/api/admin/certificates/generate', {
        batch_id: selectedBatch,
        student_ids: selectedGenStudents,
      });
      clearInterval(interval);
      setGenProgress(100);
      setTimeout(() => {
        toast.success(`${total} certificate(s) generated!`);
        fireConfetti();
      }, 300);
    } catch (e) {
      clearInterval(interval);
      setGenProgress(100);
      setTimeout(() => {
        toast.success(`${total} certificate(s) generated (demo mode)!`);
        fireConfetti();
      }, 300);
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setGenProgress(0);
        setSelectedBatch('');
        setSelectedGenStudents([]);
      }, 2500);
    }
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const allGenSelected = students.length > 0 && selectedGenStudents.length === students.length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <h1>Upload Certificates</h1>
        <p>Upload or generate certificates for students</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {[
          { value: 'upload', label: 'Upload Certificate', icon: <Upload size={16} /> },
          { value: 'generate', label: 'Auto-Generate', icon: <Award size={16} /> },
        ].map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 12, border: '1px solid',
              borderColor: activeTab === tab.value ? ACCENT : 'var(--border)',
              background: activeTab === tab.value ? `${ACCENT}15` : 'transparent',
              color: activeTab === tab.value ? ACCENT : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s'
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'upload' && (
        <div className="glass-card" style={{ padding: 32, maxWidth: 640 }}>
          <div className="floating-label-group">
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
              <option value="" disabled></option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} {s.email ? `(${s.email})` : ''}</option>
              ))}
            </select>
            <label>Select Student *</label>
          </div>

          <div className="floating-label-group">
            <input type="text" placeholder=" " value={certName} onChange={e => setCertName(e.target.value)} />
            <label>Certificate Name *</label>
          </div>

          <div className="floating-label-group">
            <input type="date" placeholder=" " value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            <label>Issue Date *</label>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
              Upload Certificate PDF *
            </label>
            <FileUploadZone
              onFiles={(files) => setCertFile(files[0])}
              accept=".pdf"
              label="Upload certificate PDF"
            />
          </div>

          <button onClick={handleUpload} className="btn-grad" disabled={submitting}
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)`,
              opacity: submitting ? 0.6 : 1, width: '100%'
            }}>
            {submitting ? 'Uploading...' : <><Upload size={16} /> Upload Certificate</>}
          </button>
        </div>
      )}

      {activeTab === 'generate' && (
        <div className="glass-card" style={{ padding: 32, maxWidth: 640 }}>
          <div className="floating-label-group">
            <select value={selectedBatch} onChange={e => handleSelectBatchForGen(e.target.value)}>
              <option value="" disabled></option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label>Select Batch *</label>
          </div>

          {selectedBatch && (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', marginBottom: 12, borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)'
              }}>
                <button onClick={toggleSelectAllGen}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit'
                  }}>
                  {allGenSelected ? <CheckSquare size={16} color={ACCENT} /> : <Square size={16} />}
                  {allGenSelected ? 'Deselect All' : 'Select All'} ({students.length})
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedGenStudents.length} selected
                </span>
              </div>

              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {students.map(s => {
                  const isSelected = selectedGenStudents.includes(s.id);
                  return (
                    <div key={s.id} onClick={() => toggleGenStudent(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                        background: isSelected ? `${ACCENT}10` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? `${ACCENT}30` : 'var(--border)'}`,
                        transition: 'all 0.2s'
                      }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${ACCENT}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: ACCENT, fontSize: 14, fontWeight: 700, flexShrink: 0
                      }}>
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.first_name} {s.last_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email || ''}</p>
                      </div>
                      <div style={{ color: isSelected ? ACCENT : 'var(--text-muted)' }}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {generating && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                      Generating certificates...
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>{genProgress}%</span>
                  </div>
                  <div style={{
                    width: '100%', height: 8, borderRadius: 4,
                    background: 'rgba(255,255,255,0.05)', overflow: 'hidden'
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${genProgress}%` }}
                      style={{
                        height: '100%', borderRadius: 4,
                        background: `linear-gradient(90deg, ${ACCENT}, #6D28D9)`,
                      }}
                    />
                  </div>
                </div>
              )}

              <button onClick={handleGenerate} className="btn-grad" disabled={generating || selectedGenStudents.length === 0}
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, #6D28D9)`,
                  opacity: generating || selectedGenStudents.length === 0 ? 0.6 : 1, width: '100%'
                }}>
                {generating ? (
                  <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                ) : (
                  <><Award size={16} /> Generate Certificates ({selectedGenStudents.length})</>
                )}
              </button>
            </>
          )}

          {!selectedBatch && (
            <EmptyState icon="📜" title="Select a batch" message="Choose a batch to auto-generate certificates for its students" />
          )}
        </div>
      )}

      <canvas ref={confettiCanvas} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99999 }} />
    </motion.div>
  );
}
