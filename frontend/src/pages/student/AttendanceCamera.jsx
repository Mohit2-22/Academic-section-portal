import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, CheckCircle, XCircle, AlertCircle, Loader2,
  RefreshCw, Monitor, Smartphone, Shield, User, Clock
} from 'lucide-react';
import { attendanceAI, authAPI } from '../../services/api';

const CAMERA_START_DELAY = 800;
const MAX_RETRY_ATTEMPTS = 3;
const STREAM_TIMEOUT = 10000;

export default function AttendanceCamera() {
  const navigate = useNavigate();
  
  const [phase, setPhase] = useState('loading');
  const [cameraStatus, setCameraStatus] = useState('initializing');
  const [cameraError, setCameraError] = useState('');
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  const initTimeoutRef = useRef(null);
  const streamTimeoutRef = useRef(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');

  const getErrorMessage = (err) => {
    const name = err?.name || '';
    const msg = err?.message || '';
    
    if (msg.includes('Permission denied') || name === 'NotAllowedError') {
      return 'Camera access denied. Please allow camera permission in browser settings.';
    }
    if (msg.includes('Not found') || name === 'NotFoundError') {
      return 'No camera found. Please connect a webcam.';
    }
    if (msg.includes('Not readable') || name === 'NotReadableError') {
      return 'Camera is in use by another application. Close other apps using camera.';
    }
    if (msg.includes('Could not start') || name === 'TrackStartError') {
      return 'Could not start camera. Try selecting a different camera.';
    }
    if (name === 'OverconstrainedError') {
      return 'Camera does not support required settings. Try selecting a different camera.';
    }
    return 'Camera error occurred. Please try again.';
  };

  const enumerateCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      setCameraDevices(cameras);
      return cameras;
    } catch {
      return [];
    }
  };

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async (forceCameraId = null) => {
    if (!mountedRef.current) return;
    
    stopStream();
    setCameraStatus('requesting');
    setCameraError('');
    setCameraReady(false);

    const cameraId = forceCameraId || selectedCamera;

    try {
      const constraints = {
        video: cameraId 
          ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (primaryError) {
        const fallbackConstraints = cameraId
          ? { deviceId: { exact: cameraId } }
          : { facingMode: 'user' };
        stream = await navigator.mediaDevices.getUserMedia({ video: fallbackConstraints, audio: false });
      }

      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
      streamTimeoutRef.current = setTimeout(() => {
        if (!cameraReady && streamRef.current) {
          console.warn('Camera stream timeout - proceeding anyway');
        }
      }, STREAM_TIMEOUT);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        
        await new Promise((resolve) => {
          const onPlay = () => {
            video.removeEventListener('play', onPlay);
            resolve();
          };
          video.addEventListener('playing', onPlay);
          setTimeout(resolve, 3000);
        });

        if (video.readyState >= 2) {
          setCameraReady(true);
          setCameraStatus('active');
        } else {
          setCameraReady(true);
          setCameraStatus('active');
        }
      }

      await enumerateCameras();

    } catch (err) {
      if (!mountedRef.current) return;
      
      const errorMsg = getErrorMessage(err);
      setCameraError(errorMsg);
      setCameraStatus('error');
      
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        setRetryCount(prev => prev + 1);
      }
    }
  }, [selectedCamera, stopStream, retryCount, cameraReady]);

  const captureAndSubmit = async () => {
    if (!selectedSession || isSubmitting) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !cameraReady) {
      setCameraError('Camera is not ready. Please wait.');
      return;
    }

    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    
    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(video, 0, 0, vw, vh);
    
    const frame = canvas.toDataURL('image/jpeg', 0.9);
    
    setIsSubmitting(true);
    setCameraError('');

    try {
      const res = await attendanceAI.markAttendanceFace(selectedSession.session_id, frame);
      setSubmitResult({
        success: true,
        data: res.data,
        message: 'Attendance marked successfully!'
      });
      setPhase('success');
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to mark attendance';
      setCameraError(errorMsg);
      setSubmitResult({
        success: false,
        message: errorMsg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    const init = async () => {
      try {
        const cameras = await enumerateCameras();
        if (cameras.length > 0 && !selectedCamera) {
          setSelectedCamera(cameras[0].deviceId);
        }
        
        const sessionsRes = await attendanceAI.getActiveSessions();
        const sessions = sessionsRes.data?.sessions || [];
        setActiveSessions(sessions);
        
        if (sessions.length === 1) {
          setSelectedSession(sessions[0]);
        }
        
        setPhase('ready');
        
        if (cameras.length > 0) {
          setTimeout(() => {
            if (mountedRef.current) {
              startCamera(cameras[0].deviceId);
            }
          }, CAMERA_START_DELAY);
        } else {
          setCameraStatus('error');
          setCameraError('No camera detected. Please connect a webcam.');
        }
      } catch (err) {
        setCameraError('Failed to initialize. Please refresh the page.');
        setPhase('error');
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      stopStream();
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    };
  }, []);

  const handleRetry = () => {
    setRetryCount(0);
    setCameraError('');
    setCameraStatus('requesting');
    startCamera();
  };

  const handleCameraChange = (e) => {
    const newCameraId = e.target.value;
    setSelectedCamera(newCameraId);
    startCamera(newCameraId);
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Initializing camera...</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Initialization Error</h2>
          <p className="text-slate-400 mb-6">{cameraError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-emerald-500 text-white font-semibold py-3 rounded-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-sm p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Attendance Marked!</h2>
          <p className="text-slate-400 mb-6">{submitResult?.message}</p>
          
          <div className="bg-slate-700/50 rounded-sm p-4 mb-6 text-left">
            <div className="flex justify-between text-sm mb-2">
               <span className="text-slate-400">Student</span>
               <span className="text-white font-medium">{profile?.name || user?.name || 'Student'}</span>
            </div>
            {selectedSession && (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Subject</span>
                  <span className="text-white font-medium">{selectedSession.subject_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Time</span>
                  <span className="text-white font-medium">{new Date().toLocaleTimeString()}</span>
                </div>
              </>
            )}
          </div>
          
          <button
            onClick={() => navigate('/student/dashboard')}
            className="w-full bg-emerald-500 text-white font-semibold py-3 rounded-sm hover:bg-emerald-600 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-sm flex items-center justify-center">
              <Camera className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI Attendance</h1>
              <p className="text-slate-400 text-sm">Face Recognition Attendance</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {activeSessions.length > 1 && (
          <div className="bg-slate-800 rounded-sm p-4 mb-4">
            <label className="block text-sm text-slate-400 mb-2">Select Session</label>
            <select
              value={selectedSession?.session_id || ''}
              onChange={(e) => {
                const session = activeSessions.find(s => s.session_id === e.target.value);
                setSelectedSession(session);
              }}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select a session...</option>
              {activeSessions.map(session => (
                <option key={session.session_id} value={session.session_id}>
                  {session.subject_name} - {session.date}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedSession && (
          <div className="bg-slate-800 rounded-sm p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold">{selectedSession.subject_name}</p>
                <p className="text-slate-400 text-sm">{selectedSession.faculty_name}</p>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4" />
                {selectedSession.start_time}
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4" />
                {profile?.enrollment_no || user?.enrollment_no || 'Student'}
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-sm overflow-hidden mb-4">
          <div className="relative aspect-[4/3] bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraStatus === 'active' ? '' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {cameraStatus === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                <p className="text-slate-400">Starting camera...</p>
              </div>
            )}
            
            {cameraStatus === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-6 text-center">
                <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                  <Camera className="w-7 h-7 text-red-400" />
                </div>
                <p className="text-red-400 mb-4">{cameraError}</p>
                <button
                  onClick={handleRetry}
                  className="bg-emerald-500 text-white font-semibold py-2 px-6 rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
              </div>
            )}
            
            {cameraStatus === 'initializing' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                <p className="text-slate-400">Initializing...</p>
              </div>
            )}

            {cameraStatus === 'active' && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-emerald-500/90 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Camera Active
              </div>
            )}

            {isSubmitting && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                <p className="text-white font-semibold">Verifying your face...</p>
                <p className="text-slate-400 text-sm mt-1">Please wait</p>
              </div>
            )}
          </div>

          {cameraStatus === 'active' && (
            <div className="p-4 bg-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm">Camera</span>
                <select
                  value={selectedCamera}
                  onChange={handleCameraChange}
                  className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {cameraDevices.map((cam, idx) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              
              {cameraError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{cameraError}</p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-slate-700 text-white font-semibold py-3 rounded-sm hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Restart
                </button>
                <button
                  onClick={captureAndSubmit}
                  disabled={!selectedSession || isSubmitting}
                  className="flex-[2] bg-emerald-500 text-white font-bold py-3 rounded-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Mark Attendance
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-sm p-4">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-400" />
            Tips for best results
          </h3>
          <ul className="text-slate-400 text-sm space-y-1.5">
            <li>• Ensure good lighting on your face</li>
            <li>• Look directly at the camera</li>
            <li>• Remove glasses or face covering if possible</li>
            <li>• Stay still while the camera captures</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
