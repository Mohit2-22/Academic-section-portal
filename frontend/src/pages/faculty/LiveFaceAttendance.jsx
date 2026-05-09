import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Users, ChevronDown, Loader2, CheckCircle,
  XCircle, Clock, Square, AlertCircle, Wifi
} from 'lucide-react';
import { attendanceAI } from '../../services/api';

export default function LiveFaceAttendance() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [liveStatus, setLiveStatus] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { student_name, confidence_score, recognized, already_marked }
  const [scanLog, setScanLog] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSessions();
    return () => {
      stopCamera();
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchStatus();
      startPolling();
    } else {
      stopPolling();
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const res = await attendanceAI.getFacultySessions();
      setSessions(res.data || []);
      if (res.data?.length > 0) setSelectedSession(String(res.data[0].id));
    } catch { setSessions([]); }
  };

  const fetchStatus = async () => {
    if (!selectedSession) return;
    try {
      const res = await attendanceAI.getLectureStatus(selectedSession);
      setLiveStatus(res.data);
    } catch { /* ignore */ }
  };

  const startPolling = () => {
    stopPolling();
    pollIntervalRef.current = setInterval(fetchStatus, 4000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraActive(true);
      }
    } catch {
      setError('Camera access denied. Please allow camera access.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
    stopScanning();
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 480;
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  const startScanning = useCallback(() => {
    if (!selectedSession) {
      setError('Please select an active session first.');
      return;
    }
    setScanning(true);
    setError('');

    const scan = async () => {
      const frame = captureFrame();
      if (!frame) return;
      try {
        const res = await attendanceAI.markAttendanceFace(selectedSession, frame);
        const data = res.data;
        setLastResult(data);
        if (data.recognized && !data.already_marked) {
          setScanLog(prev => [{
            student_name: data.student_name,
            roll_no: data.roll_no,
            confidence: data.confidence_score,
            time: new Date().toLocaleTimeString(),
            recognized: true,
          }, ...prev.slice(0, 19)]);
          fetchStatus();
        }
      } catch { /* scan errors are silent */ }
    };

    scan();
    scanIntervalRef.current = setInterval(scan, 3000);
  }, [selectedSession, captureFrame]);

  const stopScanning = () => {
    setScanning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  };

  const total = liveStatus?.total_students ?? 0;
  const present = liveStatus?.present_count ?? 0;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-[var(--gu-red-dark)]">Live Face Attendance</h1>
          <p className="text-gray-500 text-sm mt-1">AI-powered face recognition for automatic attendance marking.</p>
        </div>

        {/* Session Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[var(--gu-red)] bg-white min-w-56">
              <option value="">— Select Session —</option>
              {sessions.map(s => (
                <option key={s.id} value={String(s.id)}>{s.subject_name} ({s.session_type})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {!cameraActive ? (
            <button id="btn-start-cam" onClick={startCamera}
              className="flex items-center gap-2 bg-[var(--gu-red)] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[var(--gu-red-hover)] transition-colors">
              <Camera className="w-4 h-4" /> Start Camera
            </button>
          ) : (
            <button id="btn-stop-cam" onClick={stopCamera}
              className="flex items-center gap-2 bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-300 transition-colors">
              <Square className="w-4 h-4" /> Stop Camera
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Camera feed */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="relative aspect-[4/3] bg-gray-900 rounded-xl overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scan overlay */}
              {scanning && (
                <div className="absolute inset-0 border-2 border-[#D4AF37]/70 rounded-xl pointer-events-none">
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full backdrop-blur-md border border-[#D4AF37]/30">
                    <div className="w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                    <span className="text-[#D4AF37] text-[10px] uppercase tracking-wider font-bold">Scanning Active</span>
                  </div>
                </div>
              )}

              {/* Recognition flash */}
              {lastResult?.recognized && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 bg-green-900/90 text-green-300 text-xs font-semibold px-3 py-2 rounded-lg">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {lastResult.already_marked
                    ? `${lastResult.student_name} — Already Marked`
                    : `✓ ${lastResult.student_name} marked Present (${lastResult.confidence_score}% confidence)`}
                </div>
              )}

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                  <Camera className="w-12 h-12 mb-3 text-gray-600" />
                  <p className="text-sm">Camera not started</p>
                </div>
              )}
            </div>

            {/* Scan controls */}
            <div className="flex gap-3 mt-4">
              {!scanning ? (
                <button id="btn-start-scan" onClick={startScanning} disabled={!cameraActive || !selectedSession}
                  className="flex-1 flex items-center justify-center gap-2 bg-[var(--gu-red)] text-white font-bold py-2.5 rounded-xl hover:bg-[var(--gu-red-hover)] disabled:opacity-50 transition-colors text-sm">
                  <Wifi className="w-4 h-4" /> Start Auto-Scan
                </button>
              ) : (
                <button id="btn-stop-scan" onClick={stopScanning}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white font-bold py-2.5 rounded-xl hover:bg-orange-400 transition-colors text-sm">
                  <Square className="w-4 h-4" /> Stop Scanning
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              {scanning ? 'Smart recognition system engaged.' : 'AI will automatically detect and mark faces.'}
            </p>
          </div>

          {/* Scan log */}
          {scanLog.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">Recognition Log</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {scanLog.map((log, i) => (
                  <div key={i} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{log.student_name}</p>
                        <p className="text-[10px] text-gray-400">{log.roll_no}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-green-600">{log.confidence}%</p>
                      <p className="text-[10px] text-gray-400">{log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Student list */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          {/* Counter badge */}
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-gray-800">Attendance Status</h2>
            <div className="flex items-center gap-1.5 bg-[rgba(185,28,28,0.08)] text-[var(--gu-red)] text-sm font-bold px-3 py-1.5 rounded-full">
              <Users className="w-4 h-4" />
              {present} / {total}
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Attendance</span><span>{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[var(--gu-red)] rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Student rows */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {!liveStatus?.students?.length ? (
              <p className="text-center text-gray-400 text-sm py-8">No students recorded yet.</p>
            ) : (
              liveStatus.students.map((s, i) => {
                const statusColors = {
                  present: 'bg-green-50 border-green-200',
                  late: 'bg-yellow-50 border-yellow-200',
                  absent: 'bg-red-50 border-red-200',
                };
                const textColors = {
                  present: 'text-green-700',
                  late: 'text-yellow-700',
                  absent: 'text-red-600',
                };
                return (
                  <div key={i} className={`flex items-center justify-between border rounded-xl px-3 py-2.5 ${statusColors[s.status] || 'bg-gray-50 border-gray-200'}`}>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">{s.roll_no}</p>
                        {s.marked_via && (
                          <span className="text-[10px] bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                            {s.marked_via === 'face_recognition' ? '🤖 AI' : s.marked_via === 'qr_link' ? '📱 QR' : '✏️ Manual'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold capitalize ${textColors[s.status] || 'text-gray-600'}`}>
                        {s.status}
                      </span>
                      {s.confidence_score && (
                        <p className="text-[10px] text-gray-400">{s.confidence_score}%</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
