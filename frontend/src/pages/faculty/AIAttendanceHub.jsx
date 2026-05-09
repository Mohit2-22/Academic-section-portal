import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FacultyLayout from '../../components/FacultyLayout';
import {
  QrCode, Clock, Users, ChevronDown, Loader2, AlertCircle,
  Copy, Download, CheckCircle, XCircle, RefreshCw, Calendar,
  Camera, Square, Wifi, Filter, MapPin, Navigation, Shield,
  BookOpen, Zap, FileDown,
  ScanFace, BarChart2, TrendingUp
} from 'lucide-react';
import { attendanceAI, facultyAPI } from '../../services/api';

export default function AIAttendanceHub() {
  const [activeTab, setActiveTab] = useState('create');

  const TABS = [
    { id: 'create', label: 'Create Lecture', icon: QrCode, color: 'from-amber-500 to-orange-600' },
    { id: 'report', label: 'Attendance Report', icon: BarChart2, color: 'from-blue-500 to-indigo-600' },
  ];

  return (
    <FacultyLayout>
      <div className="animate-fade-in max-w-6xl mx-auto">
        {/* â”€â”€ Page Header â”€â”€ */}
        <div className="border-b border-[var(--gu-gold)] pb-6 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--gu-gold)] to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/20">
              <Zap className="w-5 h-5 text-[var(--gu-red-deep)]" />
            </div>
            <div>
              <h1 className="font-serif text-2xl md:text-3xl text-white">AI Attendance Hub</h1>
              <p className="text-[var(--gu-gold)] text-xs uppercase tracking-widest font-semibold">
                Smart attendance management powered by AI
              </p>
            </div>
          </div>
        </div>

        {/* â”€â”€ Tab Navigation â”€â”€ */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap border ${
                  isActive
                    ? 'bg-gradient-to-r ' + tab.color + ' text-white border-transparent shadow-lg scale-[1.02]'
                    : 'bg-[var(--gu-red-card)] text-white/60 border-[var(--gu-border)] hover:border-[var(--gu-gold)]/50 hover:text-white/90'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                {tab.label}
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />}
              </button>
            );
          })}
        </div>

        {/* â”€â”€ Tab Content â”€â”€ */}
        <div className="animate-slide-up" key={activeTab}>
          {activeTab === 'create' && <CreateLectureTab />}
          {activeTab === 'report' && <AttendanceReportTab />}
        </div>
      </div>
    </FacultyLayout>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TAB 1: CREATE LECTURE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function CreateLectureTab() {
  const [allSubjects, setAllSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);

  // Get unique semesters for selected course
  const availableSemesters = useMemo(() => {
    if (!selectedCourse) return [];
    const sems = allSubjects
      .filter(s => String(s.course) === selectedCourse && s.semester)
      .map(s => String(s.semester));
    return [...new Set(sems)].sort((a, b) => Number(a) - Number(b));
  }, [selectedCourse, allSubjects]);

  // Auto-select first available semester when course changes
  useEffect(() => {
    if (availableSemesters.length > 0) {
      setSelectedSemester(availableSemesters[0]);
    } else {
      setSelectedSemester('');
    }
  }, [availableSemesters]);

  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [form, setForm] = useState({
    subject_id: '', date: new Date().toISOString().slice(0, 10),
    start_time: '', end_time: '', session_type: 'lecture',
  });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endResult, setEndResult] = useState(null);

  const [exportResult, setExportResult] = useState(null);
  const pollRef = useRef(null);

  // ——— Geofencing state ———
  const [gpsLocation, setGpsLocation] = useState(null); // { lat, lng }
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState(200); // default 200m

  // ——— Face scan from create-lecture ———
  const [faceScanMode, setFaceScanMode] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);           // capture canvas (hidden)
  const overlayCanvasRef = useRef(null);    // bounding-box overlay (visible)
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState([]);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [scanError, setScanError] = useState('');
  const [lastScanInfo, setLastScanInfo] = useState('');
  const scanSessionRef = useRef(null);  // track which session we're scanning for

  useEffect(() => { fetchSubjects(); return () => { stopPolling(); stopFaceScanning(); stopFaceCamera(); }; }, []);

  // When course or semester changes, filter subjects
  useEffect(() => {
    setFilteredSubjects(
      allSubjects.filter(s => {
        const matchCourse = !selectedCourse || String(s.course) === selectedCourse;
        const matchSem = !selectedSemester || String(s.semester) === selectedSemester;
        return matchCourse && matchSem;
      })
    );
  }, [selectedCourse, selectedSemester, allSubjects]);

  // Fetch students dynamically on course and semester change
  useEffect(() => {
    if (selectedCourse && selectedSemester) {
      fetchStudentsCount(selectedCourse, selectedSemester);
    } else {
      setStudents([]);
    }
  }, [selectedCourse, selectedSemester]);

  const fetchStudentsCount = async (courseId, sem) => {
    setStudentsLoading(true);
    try {
      const res = await facultyAPI.students({ course_id: courseId, semester: sem });
      setStudents(res.data || []);
    } catch (err) {
      console.error("Failed to fetch students", err);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  // When filtered subjects change, auto-select first
  useEffect(() => {
    if (filteredSubjects.length > 0) {
      const exists = filteredSubjects.some(s => String(s.subject_id) === String(form.subject_id));
      if (!exists) {
        setForm(f => ({ ...f, subject_id: String(filteredSubjects[0].subject_id) }));
      }
    } else {
      setForm(f => ({ ...f, subject_id: '' }));
    }
  }, [filteredSubjects, form.subject_id]);

  const fetchSubjects = async () => {
    try {
      const res = await attendanceAI.getFacultySubjects({ assigned_only: 'true' });
      const subs = res.data || [];
      setAllSubjects(subs);

      // Extract unique courses from assigned subjects
      const courseMap = {};
      subs.forEach(s => {
        if (s.course && !courseMap[String(s.course)]) {
          courseMap[String(s.course)] = { id: String(s.course), code: s.course_code, name: s.course_name };
        }
      });
      const uniqueCourses = Object.values(courseMap).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      setCourses(uniqueCourses);

      // Auto-select first course
      if (uniqueCourses.length > 0) {
        setSelectedCourse(uniqueCourses[0].id);
      }
    } catch { setAllSubjects([]); setCourses([]); } finally { setSubjectsLoading(false); }
  };

  const startPolling = (sid) => { stopPolling(); fetchLiveStatus(sid); pollRef.current = setInterval(() => fetchLiveStatus(sid), 5000); };
  const stopPolling = () => { if (pollRef.current) clearInterval(pollRef.current); };
  const fetchLiveStatus = async (sid) => { try { const res = await attendanceAI.getLectureStatus(sid); setLiveStatus(res.data); } catch {} };

  // ——— Capture Faculty GPS ———
  const captureGPS = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported by your browser.'); return; }
    setGpsLoading(true); setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(err.code === 1 ? 'Location access denied. Please allow GPS.' : 'Failed to get location. Try again.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.subject_id || !form.date || !form.start_time || !form.end_time) { setFormError('All fields are required.'); return; }
    if (!gpsLocation) { setFormError('📍 GPS location is mandatory. Please capture your current location.'); return; }
    setCreating(true); setFormError('');
    try {
      const payload = {
        ...form, total_students: students.length || 0,
        latitude: gpsLocation.lat, longitude: gpsLocation.lng,
        geofence_radius: geofenceRadius,
      };
      const res = await attendanceAI.createLecture(payload);
      setSession(res.data);
      startPolling(res.data.session_id);
    }
    catch (err) { setFormError(err?.response?.data?.error || 'Failed to create session.'); }
    finally { setCreating(false); }
  };

  // ——— Quick Face Scan: auto-create session + start scanning ———
  const handleQuickFaceScan = async () => {
    if (!form.subject_id || !form.date || !form.start_time || !form.end_time) {
      setFormError('Please fill Course, Subject, Date, and Time before starting face scan.');
      return;
    }
    if (!gpsLocation) { setFormError('📍 GPS location is mandatory. Please capture your current location.'); return; }
    setCreating(true); setFormError('');
    try {
      const payload = {
        ...form, total_students: students.length || 0,
        latitude: gpsLocation.lat, longitude: gpsLocation.lng,
        geofence_radius: geofenceRadius,
      };
      const res = await attendanceAI.createLecture(payload);
      setSession(res.data);
      scanSessionRef.current = res.data.session_id;
      startPolling(res.data.session_id);
      setFaceScanMode(true);
      // Camera will start after render via useEffect
      setTimeout(() => startFaceCamera(), 300);
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Failed to create session.');
    } finally { setCreating(false); }
  };

  const handleCopyLink = () => { navigator.clipboard.writeText(session?.attendance_link || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleDownloadQR = () => { if (!session?.qr_image_url) return; const a = document.createElement('a'); a.href = session.qr_image_url; a.download = `qr_session_${session.session_id}.png`; a.click(); };

  const handleEndSession = async () => {
    if (!session?.session_id) return;
    setEnding(true); stopPolling(); stopFaceScanning(); stopFaceCamera();
    setFaceScanMode(false);
    try { const res = await attendanceAI.endLecture(session.session_id); setEndResult(res.data); }
    catch (err) { setEndResult({ error: err?.response?.data?.error || 'Failed to end session.' }); }
    finally { setEnding(false); }
  };

  // ——— Face Camera + Auto-Scan (for Create Lecture tab) ———
  const startFaceCamera = async () => {
    try {
      // Use back camera (environment) for classroom scanning
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: { ideal: 'environment' } 
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true);
          // Auto-start scanning
          startFaceScanning();
        };
      }
    } catch { setFormError('Camera access denied.'); }
  };

  const stopFaceCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    stopFaceScanning();
  };

  const captureFaceFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    if (video.readyState < 2) return null; // not ready
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 480;
    ctx.drawImage(video, 0, 0, 640, 480);
    return canvas.toDataURL('image/jpeg', 0.80);
  }, []);

  // Draw bounding boxes on overlay canvas
  const drawBoundingBoxes = useCallback((boxes) => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;
    
    overlay.width = video.clientWidth || video.videoWidth || 640;
    overlay.height = video.clientHeight || video.videoHeight || 480;
    
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Match the capture canvas resolution (640x480)
    const scaleX = overlay.width / 640;
    const scaleY = overlay.height / 480;

    boxes.forEach(box => {
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.w * scaleX;
      const h = box.h * scaleY;

      const color = box.recognized ? '#22c55e' : '#ef4444';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeRect(x, y, w, h);

      const label = box.recognized ? `${box.label} ${box.confidence}%` : `Unknown`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const textW = ctx.measureText(label).width + 8;
      ctx.fillStyle = box.recognized ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)';
      ctx.fillRect(x, y - 20, textW, 20);
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.fillText(label, x + 4, y - 5);
    });
  }, []);

  const scanBusyRef = useRef(false);

  const startFaceScanning = useCallback(() => {
    const sid = scanSessionRef.current || session?.session_id;
    if (!sid) return;
    setScanning(true);

    const doScan = async () => {
      // Prevent overlapping requests — if the previous scan is still running, skip
      if (scanBusyRef.current) return;

      const frame = captureFaceFrame();
      if (!frame) {
        setLastScanInfo('Camera not ready...');
        return;
      }

      scanBusyRef.current = true;
      try {
        setScanError('');
        const res = await attendanceAI.markAttendanceMultiFace(sid, frame);
        const data = res.data;

        // Show scan info
        const faceCount = data.faces_detected || 0;
        const markedCount = data.newly_marked?.length || 0;
        const unknownCount = data.unknown_count || 0;
        setLastScanInfo(`Detected: ${faceCount} face(s) | Marked: ${markedCount} | Unknown: ${unknownCount}`);

        // Draw bounding boxes
        if (data.bounding_boxes?.length > 0) {
          setBoundingBoxes(data.bounding_boxes);
          drawBoundingBoxes(data.bounding_boxes);
        } else {
          setBoundingBoxes([]);
          const overlay = overlayCanvasRef.current;
          if (overlay) {
            const ctx2 = overlay.getContext('2d');
            ctx2.clearRect(0, 0, overlay.width, overlay.height);
          }
        }

        // Multi-face response — update log
        const logEntries = [];
        
        if (data.newly_marked?.length > 0) {
          data.newly_marked.forEach(s => logEntries.push({
            student_name: s.student_name,
            roll_no: s.roll_no,
            confidence: s.confidence_score,
            time: new Date().toLocaleTimeString(),
            status: s.status,
            type: 'success'
          }));
        }

        if (data.already_marked?.length > 0) {
          data.already_marked.forEach(s => logEntries.push({
            student_name: s.student_name,
            roll_no: s.roll_no,
            time: new Date().toLocaleTimeString(),
            status: 'Already Present',
            type: 'info'
          }));
        }

        if (data.not_in_course?.length > 0) {
          data.not_in_course.forEach(s => logEntries.push({
            student_name: s.student_name,
            roll_no: s.roll_no,
            time: new Date().toLocaleTimeString(),
            status: 'Not in Course',
            type: 'error'
          }));
        }

        if (logEntries.length > 0) {
          setScanLog(prev => [...logEntries, ...prev].slice(0, 30));
          fetchLiveStatus(sid);
        }
      } catch (err) {
        console.error('Scan error:', err);
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || '';
        setScanError(serverMsg || 'Connection error or server failure');
        setLastScanInfo(`Error: ${serverMsg || 'Server failed to process scan. Retrying...'}`);
      } finally {
        scanBusyRef.current = false;
      }
    };

    doScan();
    scanIntervalRef.current = setInterval(doScan, 3000);
  }, [session, captureFaceFrame]);

  const stopFaceScanning = () => {
    setScanning(false);
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
  };

  // â”€â”€ Export handlers â”€â”€


  const handleDownloadCSV = async () => {
    if (!session?.session_id) return;
    try {
      const res = await attendanceAI.downloadCSV(session.session_id);
      
      if (res.data && res.data.type === 'application/json') {
        const text = await res.data.text();
        const json = JSON.parse(text);
        setExportResult({ success: false, message: json.error || 'Failed to download CSV' });
        return;
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${session.subject_code || 'session'}_${session.date}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setExportResult({ success: true, message: 'CSV downloaded successfully.' });
    } catch (err) {
      if (err.response && err.response.data instanceof Blob && err.response.data.type === 'application/json') {
        err.response.data.text().then(text => {
          try {
            const errorData = JSON.parse(text);
            setExportResult({ success: false, message: errorData.error || 'Failed to download CSV' });
          } catch (e) {
            setExportResult({ success: false, message: 'Failed to download CSV' });
          }
        });
      } else {
        setExportResult({ success: false, message: 'Failed to download CSV' });
      }
    }
  };

  // â”€â”€ Session ACTIVE: Face Scan Mode â”€â”€
  if (session && !endResult && faceScanMode) {
    const present = liveStatus?.present_count ?? 0;
    const total = liveStatus?.total_students ?? 0;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-serif text-xl text-white flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-[var(--gu-gold)]" /> Live Face Scan
            </h2>
            <p className="text-white/50 text-sm">
              {session.course_code && `${session.course_code} | `}{session.subject_code && `${session.subject_code} â€“ `}{session.subject} Â· {session.date}
            </p>
          </div>
          <span className="flex items-center gap-1.5 bg-emerald-900/50 text-emerald-300 text-sm font-semibold px-3 py-1.5 rounded-full border border-emerald-500/30">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> AI Scanning
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Feed */}
          <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-5">
            <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {/* Bounding box overlay — sits on top of mirrored video */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ mixBlendMode: 'normal' }}
              />
              {scanning && (
                <div className="absolute inset-0 border-2 border-emerald-500/70 rounded-lg pointer-events-none">
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-full backdrop-blur-sm border border-emerald-500/30">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-emerald-400 text-[10px] uppercase tracking-wider font-bold">AI Active Scanning</span>
                  </div>
                  {boundingBoxes.length > 0 && (
                    <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded-full text-xs text-white">
                      {boundingBoxes.filter(b => b.recognized).length} / {boundingBoxes.length} recognized
                    </div>
                  )}
                </div>
              )}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30">
                  <Camera className="w-12 h-12 mb-3" /><p className="text-sm">Starting camera...</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              {!scanning ? (
                <button onClick={startFaceScanning}
                  disabled={!cameraActive}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors text-sm">
                  <Wifi className="w-4 h-4" /> Resume Scanning
                </button>
              ) : (
                <button onClick={stopFaceScanning}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-600 text-white font-bold py-2.5 rounded-lg hover:bg-orange-500 transition-colors text-sm">
                  <Square className="w-4 h-4" /> Pause Scanning
                </button>
              )}
              <button onClick={handleEndSession} disabled={ending}
                className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors text-sm">
                {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                End Session
              </button>
            </div>
          </div>

          {/* Right side: status + scan log */}
          <div className="space-y-4">
            <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-lg text-white">Live Count</h3>
                <div className="flex items-center gap-1.5 bg-[var(--gu-gold)]/10 text-[var(--gu-gold)] text-sm font-bold px-3 py-1.5 rounded-full">
                  <Users className="w-4 h-4" /> {present}
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                  style={{ width: present > 0 ? '100%' : '0%' }} />
              </div>
              <p className="text-xs text-white/40 mt-2">{present} student{present !== 1 ? 's' : ''} marked present via AI face recognition</p>
            </div>

            {/* Scan Status */}
            {lastScanInfo && (
              <div className={`border rounded-lg px-4 py-2.5 text-xs font-mono ${
                scanError ? 'bg-red-900/30 border-red-500/30 text-red-300' : 'bg-blue-900/20 border-blue-500/20 text-blue-300'
              }`}>
                <div className="flex items-center gap-2">
                  {scanError ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <Wifi className="w-3.5 h-3.5 shrink-0 animate-pulse" />}
                  {lastScanInfo}
                </div>
              </div>
            )}

            {/* Scan Log */}
            <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-5">
              <h3 className="font-semibold text-sm text-white/70 mb-3">Recognition Log</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scanLog.length === 0 ? (
                  <div className="text-center py-8 text-white/30">
                    <ScanFace className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{scanning ? 'Scanning for faces...' : 'Waiting for face detections...'}</p>
                  </div>
                ) : scanLog.map((log, i) => (
                  <div key={i} className={`flex items-center justify-between border rounded-lg px-3 py-2 ${
                    log.type === 'error' ? 'bg-red-900/20 border-red-500/20' : 'bg-green-900/20 border-green-500/20'
                  }`}>
                    <div className="flex items-center gap-2">
                      {log.type === 'error' ? (
                        <Smartphone className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-semibold text-white">{log.student_name}</p>
                        <p className="text-[10px] text-white/40">{log.roll_no}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${log.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                        {log.type === 'error' ? 'Not in Course' : `${log.confidence}%`}
                      </p>
                      <p className="text-[10px] text-white/40">{log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Present Students */}
            {liveStatus?.students?.length > 0 && (
              <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-5">
                <h3 className="font-semibold text-sm text-white/70 mb-3">Present Students ({liveStatus.students.filter(s => s.status === 'present' || s.status === 'late').length})</h3>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {liveStatus.students.filter(s => s.status === 'present' || s.status === 'late').map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-green-900/20 border border-green-500/20 rounded-lg px-3 py-2">
                      <div><p className="text-sm font-medium text-white">{s.name}</p><p className="text-xs text-white/40">{s.roll_no}</p></div>
                      <span className="text-xs bg-green-900/40 text-green-300 px-2 py-1 rounded-full font-semibold">
                        {s.marked_via === 'face_recognition' ? 'ðŸ¤– AI' : s.marked_via === 'qr_link' ? 'QR' : 'Manual'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ Session ACTIVE: QR view (default) â”€â”€
  if (session && !endResult) {
    const present = liveStatus?.present_count ?? 0;
    const total = liveStatus?.total_students ?? 0;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-serif text-xl text-white">Live Session</h2>
            <p className="text-white/50 text-sm">{session.course_code && `${session.course_code} | `}{session.subject_code && `${session.subject_code} â€“ `}{session.subject} Â· {session.date}</p>
          </div>
          <span className="flex items-center gap-1.5 bg-green-900/50 text-green-300 text-sm font-semibold px-3 py-1.5 rounded-full border border-green-500/30">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Session Active
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Code */}
          <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-6 text-center">
            <h3 className="font-serif text-lg text-white mb-4">Attendance QR Code</h3>
            {session.qr_image_url ? (
              <div className="bg-white/10 border border-[var(--gu-border)] rounded-lg p-4 inline-block mb-4">
                <img src={session.qr_image_url} alt="QR Code" className="w-48 h-48 mx-auto" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-white/5 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <QrCode className="w-16 h-16 text-white/20" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCopyLink} className="flex-1 flex items-center justify-center gap-1.5 border border-[var(--gu-gold)] text-[var(--gu-gold)] text-sm font-semibold py-2 rounded-lg hover:bg-[var(--gu-gold)]/10 transition-colors">
                {copied ? <><CheckCircle className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
              </button>
              <button onClick={handleDownloadQR} className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--gu-gold)] text-[var(--gu-red-deep)] text-sm font-semibold py-2 rounded-lg hover:bg-[#e6c949] transition-colors">
                <Download className="w-4 h-4" /> Download QR
              </button>
            </div>
            <div className="mt-3 p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-white/40 mb-1">Attendance Link</p>
              <p className="text-xs text-[var(--gu-gold)] font-mono break-all">{session.attendance_link}</p>
            </div>
            {/* Switch to Face Scan */}
            <button onClick={() => { setFaceScanMode(true); scanSessionRef.current = session.session_id; setTimeout(() => startFaceCamera(), 300); }}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-500 transition-colors text-sm">
              <ScanFace className="w-4 h-4" /> Switch to Live Face Scan
            </button>
          </div>

          {/* Live Counter & info */}
          <div className="space-y-4">
            <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-lg text-white">Live Count</h3>
                <div className="flex items-center gap-1 text-xs text-white/40"><RefreshCw className="w-3 h-3" /> Every 5s</div>
              </div>
              <div className="flex items-end gap-3 mb-4">
                <span className="text-5xl font-bold text-[var(--gu-gold)]">{present}</span>
                <span className="ml-auto text-lg font-bold text-white/40">Present</span>
              </div>
            </div>

            {/* Session details */}
            <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-5 space-y-2">
              {[
                ['Course', session.course_name || 'â€”'],
                ['Subject', `${session.subject_code || ''} â€“ ${session.subject}`],
                ['Date', session.date],
                ['Time', `${form.start_time} â€“ ${form.end_time}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-white/40">{k}</span>
                  <span className="font-medium text-white/80">{v}</span>
                </div>
              ))}
              {session.location_set && (
                <div className="flex justify-between text-sm pt-1 border-t border-[var(--gu-border)]">
                  <span className="text-white/40 flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-400" /> Geofence</span>
                  <span className="font-semibold text-emerald-400">{session.geofence_radius}m radius ✓</span>
                </div>
              )}
            </div>

            {liveStatus?.students?.length > 0 && (
              <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-5">
                <h3 className="font-semibold text-sm text-white/70 mb-3">Present Students</h3>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {liveStatus.students.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-green-900/20 border border-green-500/20 rounded-lg px-3 py-2">
                      <div><p className="text-sm font-medium text-white">{s.name}</p><p className="text-xs text-white/40">{s.roll_no}</p></div>
                      <span className="text-xs bg-green-900/40 text-green-300 px-2 py-1 rounded-full font-semibold">
                        {s.marked_via === 'qr_link' ? 'QR' : s.marked_via === 'face_recognition' ? 'Face' : 'Manual'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleEndSession} disabled={ending}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors">
              {ending ? <><Loader2 className="w-4 h-4 animate-spin" /> Ending...</> : <><XCircle className="w-4 h-4" /> End Session</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ Session ENDED summary â”€â”€
  if (endResult) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
        <div className="w-20 h-20 bg-[var(--gu-gold)]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-10 h-10 text-[var(--gu-gold)]" />
        </div>
        <h2 className="text-2xl font-serif text-white mb-2">Session Ended</h2>
        <p className="text-white/50 mb-6">Attendance has been processed.</p>
        {!endResult.error ? (
          <div className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-6 text-left space-y-3 mb-6">
            {[['Present', endResult.present_count, 'text-green-400'], ['Absent', endResult.absent_count, 'text-red-400'], ['Total', endResult.total_students, 'text-white'], ['Percentage', `${endResult.percentage}%`, 'text-[var(--gu-gold)]']].map(([k, v, cls]) => (
              <div key={k} className="flex justify-between text-sm"><span className="text-white/50">{k}</span><span className={`font-bold ${cls}`}>{v}</span></div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-lg mb-6 text-red-300 text-sm">{endResult.error}</div>
        )}

        {/* â”€â”€ Export Buttons â”€â”€ */}

        <div className="mb-4">
          <button onClick={handleDownloadCSV}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-500 transition-colors text-sm">
            <FileDown className="w-4 h-4" /> Download CSV
          </button>
        </div>

        {/* Export result feedback */}
        {exportResult && (
          <div className={`p-4 rounded-lg mb-4 text-sm text-left ${
            exportResult.success
              ? 'bg-emerald-900/30 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-900/30 border border-red-500/30 text-red-300'
          }`}>
            <p className="font-semibold mb-1">{exportResult.success ? 'âœ… Export Successful' : 'âŒ Export Failed'}</p>
            <p className="text-xs opacity-80">{exportResult.message}</p>

            {exportResult.fallback && exportResult.csv_path && (
              <p className="text-xs mt-1 text-yellow-300/70">âš ï¸ CSV file saved on server.</p>
            )}
          </div>
        )}

        <button onClick={() => { setSession(null); setEndResult(null); setExportResult(null); setFaceScanMode(false); setScanLog([]); setSelectedCourse(courses[0]?.id || ''); }}
          className="w-full bg-[var(--gu-gold)] text-[var(--gu-red-deep)] font-bold py-3 rounded-lg hover:bg-[#e6c949] transition-colors">
          Create Another Session
        </button>
      </div>
    );
  }

  // â”€â”€ Create FORM â”€â”€
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <form onSubmit={handleCreate} className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-lg p-7 space-y-5">

        {/* Course & Semester */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Course Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--gu-gold)] uppercase tracking-wider mb-1.5">
              <BookOpen className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Course
            </label>
            {subjectsLoading ? (
              <div className="flex items-center gap-2 h-11 px-3 border border-[var(--gu-border)] rounded-lg bg-[#3D0F0F]">
                <Loader2 className="w-4 h-4 animate-spin text-white/40" /><span className="text-white/40 text-sm">Loading...</span>
              </div>
            ) : courses.length === 0 ? (
              <div className="flex items-center gap-2 h-11 px-3 border border-red-500/30 rounded-lg bg-red-900/20">
                <AlertCircle className="w-4 h-4 text-red-400" /><span className="text-red-300 text-sm">No courses assigned to you</span>
              </div>
            ) : (
              <div className="relative">
                <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}
                  className="w-full appearance-none px-4 py-3 border border-[var(--gu-border)] rounded-lg text-sm text-white bg-[#3D0F0F] focus:outline-none focus:border-[var(--gu-gold)]">
                  <option value="">Select Course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Semester Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--gu-gold)] uppercase tracking-wider mb-1.5">
              <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Semester
            </label>
            <div className="relative">
              <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}
                className="w-full appearance-none px-4 py-3 border border-[var(--gu-border)] rounded-lg text-sm text-white bg-[#3D0F0F] focus:outline-none focus:border-[var(--gu-gold)]">
                <option value="">Select Semester</option>
                {availableSemesters.map(sem => (
                  <option key={sem} value={String(sem)}>Semester {sem}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Subject Selector (filtered by course) */}
        <div>
          <label className="block text-xs font-semibold text-[var(--gu-gold)] uppercase tracking-wider mb-1.5">
            <Filter className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Subject
          </label>
          {subjectsLoading ? (
            <div className="flex items-center gap-2 h-11 px-3 border border-[var(--gu-border)] rounded-lg bg-[#3D0F0F]">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" /><span className="text-white/40 text-sm">Loading subjects...</span>
            </div>
          ) : (
            <div className="relative">
              <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                className="w-full appearance-none px-4 py-3 border border-[var(--gu-border)] rounded-lg text-sm text-white bg-[#3D0F0F] focus:outline-none focus:border-[var(--gu-gold)]">
                {filteredSubjects.length === 0 && <option value="">No subjects matching selected criteria</option>}
                {filteredSubjects.map(s => (
                  <option key={s.subject_id} value={String(s.subject_id)}>
                    {s.code} – {s.name} (Sem {s.semester})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>
          )}
          {filteredSubjects.length > 0 && (
            <p className="text-[11px] text-white/30 mt-1">{filteredSubjects.length} subject{filteredSubjects.length > 1 ? 's' : ''} assigned to you matching criteria</p>
          )}
        </div>



        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full pl-10 pr-4 py-3 border border-[var(--gu-border)] rounded-lg text-sm text-white bg-[#3D0F0F] focus:outline-none focus:border-[var(--gu-gold)] color-scheme-dark" />
          </div>
        </div>

        {/* Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Start Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-[var(--gu-border)] rounded-lg text-sm text-white bg-[#3D0F0F] focus:outline-none focus:border-[var(--gu-gold)] color-scheme-dark" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">End Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-[var(--gu-border)] rounded-lg text-sm text-white bg-[#3D0F0F] focus:outline-none focus:border-[var(--gu-gold)] color-scheme-dark" />
            </div>
          </div>
        </div>

        {/* ── GPS Location & Geofence Radius (MANDATORY) ── */}
        <div className="border border-[var(--gu-gold)]/30 rounded-lg p-5 bg-gradient-to-br from-[var(--gu-gold)]/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[var(--gu-gold)]" />
            <h3 className="text-sm font-bold text-[var(--gu-gold)] uppercase tracking-wider">GPS Geofencing (Required)</h3>
          </div>
          <p className="text-xs text-white/40 mb-4">Students must be within the selected radius of your current location to mark attendance.</p>

          {/* GPS Capture */}
          <div className="flex items-center gap-3 mb-4">
            <button type="button" onClick={captureGPS} disabled={gpsLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                gpsLocation
                  ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-[var(--gu-gold)] text-[var(--gu-red-deep)] hover:bg-[#e6c949] shadow-lg'
              }`}>
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : gpsLocation ? <CheckCircle className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
              {gpsLoading ? 'Getting Location...' : gpsLocation ? 'Location Captured ✓' : 'Capture My Location'}
            </button>
            {gpsLocation && (
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>{gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}</span>
              </div>
            )}
          </div>
          {gpsError && (
            <div className="flex items-center gap-2 p-2 bg-red-900/30 border border-red-500/30 rounded-lg mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-red-300 text-xs">{gpsError}</p>
            </div>
          )}

          {/* Geofence Radius Selector */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Allowed Distance from You</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 100, label: '100m', desc: 'Small Room' },
                { value: 200, label: '200m', desc: 'Campus Block' },
                { value: 500, label: '500m', desc: 'Full Campus' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setGeofenceRadius(opt.value)}
                  className={`py-3 px-3 rounded-lg text-center transition-all border ${
                    geofenceRadius === opt.value
                      ? 'bg-[var(--gu-gold)] text-[var(--gu-red-deep)] border-[var(--gu-gold)] shadow-lg shadow-amber-900/30 scale-[1.02]'
                      : 'bg-[#3D0F0F] text-white/60 border-[var(--gu-border)] hover:border-[var(--gu-gold)]/50 hover:text-white/80'
                  }`}>
                  <span className="text-lg font-bold block">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {formError && (
          <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-red-300 text-sm">{formError}</p>
          </div>
        )}

        {/* Action Buttons: Create QR + Live Face Scan */}
        <div className="grid grid-cols-2 gap-3">
          <button type="submit" disabled={creating || !form.subject_id}
            className="flex items-center justify-center gap-2 bg-[var(--gu-gold)] text-[var(--gu-red-deep)] font-bold py-3.5 rounded-lg hover:bg-[#e6c949] disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-amber-900/20">
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><QrCode className="w-4 h-4" /> Create &amp; QR</>}
          </button>
          <button type="button" onClick={handleQuickFaceScan} disabled={creating || !form.subject_id}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 rounded-lg hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-emerald-900/20">
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><ScanFace className="w-4 h-4" /> Live Face Scan</>}
          </button>
        </div>
      </form>

      {/* Student Modal */}
      {showStudentsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--gu-red-card)] rounded-xl shadow-2xl w-full max-w-md border border-[var(--gu-border)] overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-200 text-white">
            <div className="p-4 border-b border-[var(--gu-border)] flex justify-between items-center bg-[#2A0A0A]">
              <div>
                <h3 className="font-serif text-base text-[var(--gu-gold)] flex items-center gap-2">
                  <Users className="w-4 h-4" /> Class Roster
                </h3>
                <p className="text-[10px] text-white/50 mt-0.5">{students.length} students enrolled</p>
              </div>
              <button onClick={() => setShowStudentsModal(false)}
                className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-4 bg-[#1A0303]/40">
              <div className="divide-y divide-[var(--gu-border)] border border-[var(--gu-border)] rounded-lg overflow-hidden bg-[#2A0A0A]/50">
                {students.length === 0 ? (
                  <div className="px-4 py-8 text-center text-white/40 text-xs">
                    No students mapped to this class roster.
                  </div>
                ) : students.map((s, i) => (
                  <div key={s.student_id || i} className="px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-white">{s.name}</p>
                      <p className="text-[10px] font-mono text-white/40">{s.enrollment_no || s.roll_no || 'N/A'}</p>
                    </div>
                    {s.email && <p className="text-[10px] text-white/50">{s.email}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--gu-border)] bg-[#2A0A0A] flex justify-end">
              <button onClick={() => setShowStudentsModal(false)}
                className="px-4 py-2 bg-[var(--gu-border)] hover:bg-[var(--gu-border)]/80 text-white rounded text-xs font-bold uppercase tracking-wide transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TAB 2: ATTENDANCE REPORT
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AttendanceReportTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [exportResults, setExportResults] = useState({});
  const [downloading, setDownloading] = useState({});

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await attendanceAI.getFacultySessions();
      setSessions(res.data || []);
    } catch { setSessions([]); }
    finally { setLoading(false); }
  };

  const filtered = sessions.filter(s =>
    !search ||
    (s.subject_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.subject_code || '').toLowerCase().includes(search.toLowerCase())
  );



  const handleDownloadCSV = async (sessionId, subjectCode, sessionDate) => {
    setDownloading(prev => ({ ...prev, [sessionId]: true }));
    try {
      const res = await attendanceAI.downloadCSV(sessionId);
      
      if (res.data && res.data.type === 'application/json') {
        const text = await res.data.text();
        const json = JSON.parse(text);
        setExportResults(prev => ({ ...prev, [sessionId]: { success: false, message: json.error || 'Failed to download CSV' } }));
        setDownloading(prev => ({ ...prev, [sessionId]: false }));
        return;
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${subjectCode || 'session'}_${sessionDate || sessionId}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response && err.response.data instanceof Blob && err.response.data.type === 'application/json') {
        err.response.data.text().then(text => {
          try {
            const errorData = JSON.parse(text);
            setExportResults(prev => ({ ...prev, [sessionId]: { success: false, message: errorData.error || 'Failed to download CSV' } }));
          } catch (e) {
            setExportResults(prev => ({ ...prev, [sessionId]: { success: false, message: 'Failed to download CSV' } }));
          }
        });
      } else {
        setExportResults(prev => ({ ...prev, [sessionId]: { success: false, message: 'Failed to download CSV' } }));
      }
    } finally { 
      setDownloading(prev => ({ ...prev, [sessionId]: false })); 
    }
  };

  const getPctColor = (pct) => {
    if (pct >= 75) return 'text-green-400';
    if (pct >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };
  const getPctBg = (pct) => {
    if (pct >= 75) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[var(--gu-gold)]" /> Attendance Reports
          </h2>
          <p className="text-white/40 text-sm mt-0.5">View session results or download CSV</p>
        </div>
        <button onClick={fetchSessions} disabled={loading}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 px-3 py-2 rounded-lg border border-[var(--gu-border)] hover:border-[var(--gu-gold)]/30 transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter by subject..."
          className="w-full pl-10 pr-4 py-2.5 border border-[var(--gu-border)] rounded-lg text-sm text-white bg-[#3D0F0F] focus:outline-none focus:border-[var(--gu-gold)] placeholder:text-white/25" />
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--gu-gold)] mx-auto mb-3" />
          <p className="text-white/40 text-sm">Loading sessions...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-xl">
          <BarChart2 className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No sessions found.</p>
          <p className="text-white/25 text-xs mt-1">Sessions will appear after you end a lecture.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => {
            const pct = s.percentage ?? (s.total_students > 0 ? Math.round((s.present_count / s.total_students) * 100) : 0);
            const exportRes = exportResults[s.id];
            const isDownloading = downloading[s.id];

            return (
              <div key={s.id} className="bg-[var(--gu-red-card)] border border-[var(--gu-border)] rounded-xl p-5 hover:border-[var(--gu-gold)]/30 transition-all">
                {/* Top row */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white text-base">{s.subject_name}</h3>
                      {s.subject_code && (
                        <span className="text-[10px] font-mono bg-white/10 text-white/50 px-2 py-0.5 rounded">{s.subject_code}</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-900/40 text-green-300' : 'bg-white/10 text-white/40'}`}>
                        {s.is_active ? 'â— Live' : 'â— Ended'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {s.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.start_time} â€“ {s.end_time}</span>
                      <span className="capitalize">{s.session_type}</span>
                    </div>
                  </div>

                  {/* Attendance stats */}
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Present</p>
                      <p className="text-2xl font-bold text-white">{s.present_count ?? 'â€”'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Total</p>
                      <p className="text-2xl font-bold text-white/60">{s.total_students ?? 'â€”'}</p>
                    </div>
                    <div className="text-center min-w-14">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Rate</p>
                      <p className={`text-2xl font-bold ${getPctColor(pct)}`}>{pct}%</p>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div className={`h-full rounded-full transition-all duration-700 ${getPctBg(pct)}`}
                    style={{ width: `${pct}%` }} />
                </div>

                {/* Export buttons */}
                <div className="flex flex-wrap items-center gap-3">

                  <button onClick={() => handleDownloadCSV(s.id, s.subject_code, s.date)} disabled={isDownloading}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                    {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    {isDownloading ? 'Downloading...' : 'Download CSV'}
                  </button>
                </div>

                {/* Export result feedback */}
                {exportRes && (
                  <div className={`mt-3 p-3 rounded-lg text-xs ${
                    exportRes.success
                      ? 'bg-emerald-900/30 border border-emerald-500/20 text-emerald-300'
                      : 'bg-red-900/30 border border-red-500/20 text-red-300'
                  }`}>
                    <p className="font-semibold">{exportRes.success ? 'âœ… Export Successful' : 'âŒ Export Failed'}</p>
                    <p className="opacity-70 mt-0.5">{exportRes.message}</p>

                    {exportRes.fallback && (
                      <p className="mt-1 text-yellow-300/60">âš ï¸ CSV saved to server.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

