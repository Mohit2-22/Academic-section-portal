import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, ChevronRight, Clock, X } from 'lucide-react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4'];

function getColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function VideoTutorials() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);
  const scrollRefs = useRef({});

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.get('/api/student/videos');
        setVideos(Array.isArray(d) ? d : []);
      } catch {
        setVideos([
          { id: '1', title: 'Java OOP Concepts', course_name: 'Java Programming', duration: 720, subject: 'Java', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
          { id: '2', title: 'Polymorphism Explained', course_name: 'Java Programming', duration: 540, subject: 'Java', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
          { id: '3', title: 'Exception Handling', course_name: 'Java Programming', duration: 480, subject: 'Java', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
          { id: '4', title: 'Python Basics', course_name: 'Python for Data Science', duration: 960, subject: 'Python', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
          { id: '5', title: 'Data Structures in Python', course_name: 'Python for Data Science', duration: 840, subject: 'Python', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = {};
    (videos || []).forEach(v => {
      const key = v.course_name || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(v);
    });
    return Object.entries(map);
  }, [videos]);

  const scroll = (key, dir) => {
    const el = scrollRefs.current[key];
    if (el) el.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  if (loading) return <LoadingSpinner accent="#6366F1" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header">
        <h1>Video Tutorials</h1>
        <p>Watch recorded lectures and tutorials</p>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon="🎬" title="No videos available" message="Check back later for new tutorials" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {grouped.map(([course, courseVideos]) => (
            <div key={course}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{course}</h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => scroll(course, -1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <button onClick={() => scroll(course, 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div ref={el => scrollRefs.current[course] = el} style={{
                display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollBehavior: 'smooth',
                scrollbarWidth: 'none', msOverflowStyle: 'none',
              }}>
                {courseVideos.map((v, i) => (
                  <motion.div
                    key={v.id || i}
                    className="glass-card"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setActiveVideo(v)}
                    whileHover={{ scale: 1.03, y: -4 }}
                    style={{
                      minWidth: 240, maxWidth: 240, cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      height: 140, position: 'relative',
                      background: `linear-gradient(135deg, ${getColor(v.course_name)}, ${getColor(v.subject)})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', transition: 'transform 0.2s',
                      }}>
                        <Play size={24} fill="#fff" />
                      </div>
                      {v.duration && (
                        <span style={{
                          position: 'absolute', bottom: 8, right: 8,
                          background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: 6,
                          fontSize: 11, color: '#fff', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <Clock size={11} /> {formatDuration(v.duration)}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{v.title}</p>
                      {v.subject && <span className="badge badge-blue" style={{ fontSize: 10 }}>{v.subject}</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeVideo && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setActiveVideo(null)}
        >
          <div style={{
            maxWidth: 900, width: '100%', borderRadius: 16, overflow: 'hidden',
            background: '#000',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', background: '#0F172A',
            }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{activeVideo.title}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeVideo.course_name}</p>
              </div>
              <button onClick={() => setActiveVideo(null)} style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10,
                padding: '8px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13,
              }}>
                <X size={18} /> Close
              </button>
            </div>
            <video
              controls autoPlay
              style={{ width: '100%', maxHeight: '70vh', display: 'block' }}
              src={activeVideo.video_url}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </motion.div>
  );
}
