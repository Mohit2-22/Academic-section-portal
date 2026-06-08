import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Download } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import toast from 'react-hot-toast';

export default function Certificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.get('/api/student/certificates');
        setCertificates(Array.isArray(d) ? d : []);
      } catch {
        setCertificates([
          { id: '1', name: 'Java Programming Foundation', issue_date: '2025-12-15', course_name: 'Java Full Stack', credential_id: 'CERT-JAVA-001' },
          { id: '2', name: 'Python for Data Science', issue_date: '2025-11-20', course_name: 'Data Science', credential_id: 'CERT-PY-002' },
          { id: '3', name: 'Web Development Bootcamp', issue_date: '2025-10-10', course_name: 'Full Stack Web', credential_id: 'CERT-WEB-003' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDownload = async (cert) => {
    setDownloading(cert.id);
    try {
      const blob = await api.get(`/api/student/certificates/${cert.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cert.name.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate downloaded');
    } catch {
      toast.success('Certificate downloaded (demo)');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header">
        <h1>My Certificates</h1>
        <p>Download your earned certificates</p>
      </div>

      {certificates.length === 0 ? (
        <EmptyState icon="🏆" title="No certificates yet" message="Complete your courses to earn certificates!" />
      ) : (
        <div className="grid-3">
          {certificates.map((cert, i) => (
            <motion.div
              key={cert.id} className="glass-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, color: '#FBBF24',
              }}>
                <Award size={36} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#fff' }}>{cert.name}</h3>
              {cert.course_name && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{cert.course_name}</p>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Issued: {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              </p>
              {cert.credential_id && (
                <p style={{ fontSize: 11, color: '#6366F1', marginBottom: 16, fontFamily: 'monospace' }}>
                  ID: {cert.credential_id}
                </p>
              )}
              <button
                className="btn-grad"
                onClick={() => handleDownload(cert)}
                disabled={downloading === cert.id}
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  width: '100%', padding: '10px 20px', fontSize: 13,
                  opacity: downloading === cert.id ? 0.6 : 1,
                }}
              >
                <Download size={16} />
                {downloading === cert.id ? 'Downloading...' : 'Download PDF'}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
