import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Camera, CheckCircle, XCircle, AlertCircle, Loader2,
  User, BookOpen, Clock, LogIn, Video, VideoOff, MapPin, Smartphone
} from 'lucide-react';
import { attendanceAI, authAPI } from '../../services/api';
import { getDeviceId, collectGPS } from '../../utils/deviceFingerprint';

export default function QRAttendance() {
  const { qr_token } = useParams();
  const navigate = useNavigate();
  
  const [phase, setPhase] = useState('verifying');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [enrollment, setEnrollment] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [recognizedName, setRecognizedName] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    verifySession();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [qr_token]);

  const verifySession = async () => {
    setPhase('verifying');
    try {
      console.log('Verifying session with token:', qr_token);
      const res = await attendanceAI.verifySession(qr_token);
      console.log('Verify session response:', res.data);
      if (res.data.valid) {
        setSessionInfo(res.data);
        setPhase('login');
      } else {
        setErrorMsg(res.data.message || 'This QR code has expired or is invalid.');
        setPhase('error');
      }
    } catch (err) {
      console.error('Verify session error:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Unable to verify this session. Please check your connection.';
      setErrorMsg(errMsg);
      setPhase('error');
    }
  };

  const enumerateCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter(d => d.kind === 'videoinput');
      setCameras(vids);
      if (vids.length > 0 && !selectedCamera) {
        setSelectedCamera(vids[0].deviceId);
      }
    } catch {}
  };

  const startCamera = async () => {
    if (cameraLoading) return;
    setCameraLoading(true);
    setCameraError('');
    
    try {
      const constraints = selectedCamera
        ? { video: { deviceId: { exact: selectedCamera } }, audio: false }
        : { video: true, audio: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      await enumerateCameras();
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        
        await new Promise((resolve, reject) => {
          if (videoRef.current.readyState >= 2) {
            resolve();
          } else {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().then(resolve).catch(reject);
            };
            setTimeout(resolve, 2000);
          }
        });
      }
      
      setCameraActive(true);
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permission in browser settings.');
      } else if (name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a webcam.');
      } else if (name === 'NotReadableError') {
        setCameraError('Camera is in use by another app (Zoom, Meet, etc.). Close them and try again.');
      } else {
        setCameraError('Could not start camera. Please refresh and try again.');
      }
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return null;
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const video = videoRef.current;
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    
    try {
      const res = await authAPI.login(enrollment, password);
      const { access, refresh, user, profile } = res.data;
      
      if (user.role !== 'student') {
        setLoginError('Only students can mark attendance via this link.');
        return;
      }
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('profile', JSON.stringify(profile));
      
      setPhase('camera');
      setTimeout(() => startCamera(), 800);
    } catch (err) {
      setLoginError(err?.response?.data?.error || err?.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMarkAttendance = async () => {
    const frame = captureFrame();
    if (!frame) {
      setCameraError('Could not capture image. Make sure camera is working and try again.');
      return;
    }

    setSubmitting(true);
    setCameraError('');

    try {
      // ── Send frame + device ID instantly (no delays) ──
      const deviceId = getDeviceId();
      const gps = await collectGPS(5000); // 5s timeout

      const res = await attendanceAI.markAttendanceQR(
        qr_token,
        frame,
        [],      // no liveness frames needed
        gps.lat,
        gps.lng,
        deviceId,
      );

      if (res.data.success) {
        setSubmitSuccess(true);
        setRecognizedName(res.data.student_name || '');
        setPhase('success');
        stopCamera();
      } else {
        throw new Error(res.data.message);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to mark attendance.';
      if (msg.toLowerCase().includes('already')) {
        setSubmitSuccess(true);
        setPhase('already_marked');
      } else {
        setCameraError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getCameraIcon = () => {
    if (cameraLoading) return <Loader2 className="w-8 h-8 animate-spin text-white" />;
    if (cameraError) return <VideoOff className="w-8 h-8 text-red-300" />;
    if (cameraActive) return <Video className="w-8 h-8 text-green-400" />;
    return <Camera className="w-8 h-8 text-red-300" />;
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#1a0000" }}>
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url(/maxresdefault.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.35,
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Main Card */}
          <div className="bg-white rounded-sm shadow-2xl shadow-black overflow-hidden border border-[rgba(185,28,28,0.2)]">
            
            {/* Card Header - Centered Logo & Title */}
            <div className="bg-red-800 py-3 px-4 text-center">
              <img 
                src="/idZR0Cnb5m_1772794169518.png" 
                alt="Ganpat University" 
                className="h-10 mx-auto object-contain mb-1"
              />
              <p className="text-white font-bold text-base">AMPICS</p>
              <p className="text-amber-300 text-xs">AI Attendance System</p>
            </div>

            {/* Card Content - Compact padding */}
            <div className="p-5">
              {phase === 'verifying' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <h2 className="text-lg font-bold text-red-800 mb-1">Verifying Session</h2>
                  <p className="text-red-600 text-sm">Please wait...</p>
                </div>
              )}

              {phase === 'error' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-lg font-bold text-red-800 mb-2">Session Unavailable</h2>
                  <p className="text-red-600 text-sm mb-4">{errorMsg}</p>
                  <button onClick={() => navigate('/login')}
                    className="w-full bg-red-700 text-white font-bold py-3 rounded-sm hover:bg-red-800 transition-all">
                    Go to Login Page
                  </button>
                </div>
              )}

              {phase === 'success' && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-green-600 mb-1">Attendance Marked!</h2>
                  <p className="text-red-700 font-bold text-lg mb-2">{recognizedName}</p>
                  <p className="text-red-600 text-sm mb-4">Your attendance has been recorded successfully.</p>
                  
                  <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-sm p-4 mb-4 text-left border border-red-200">
                    <p className="text-sm text-red-700 mb-1"><BookOpen className="w-4 h-4 inline mr-2" />{sessionInfo?.subject_name}</p>
                    <p className="text-sm text-red-700"><Clock className="w-4 h-4 inline mr-2" />{new Date().toLocaleTimeString()}</p>
                  </div>
                  
                  <button onClick={() => navigate('/student/dashboard')}
                    className="w-full bg-red-700 text-white font-bold py-3 rounded-sm hover:bg-red-800 transition-all">
                    Go to Dashboard
                  </button>
                </div>
              )}

              {phase === 'already_marked' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-yellow-600" />
                  </div>
                  <h2 className="text-lg font-bold text-yellow-600 mb-2">Already Marked</h2>
                  <p className="text-red-600 text-sm mb-4">You have already marked your attendance for this session.</p>
                  <button onClick={() => navigate('/student/dashboard')}
                    className="w-full bg-gradient-to-r from-amber-400 to-amber-500 text-red-900 font-bold py-3 rounded-sm hover:from-amber-500 hover:to-amber-600 transition-all">
                    Go to Dashboard
                  </button>
                </div>
              )}

              {phase === 'login' && (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-sm">
                      <CheckCircle className="w-4 h-4" /> Verified
                    </span>
                    <span className="text-red-300">→</span>
                    <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 font-bold rounded-full text-sm">
                      Login
                    </span>
                  </div>

                  {sessionInfo && (
                    <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-sm p-3 mb-4 border border-red-200">
                      <p className="text-sm font-bold text-red-800"><BookOpen className="w-4 h-4 inline mr-2" />{sessionInfo.subject_name}</p>
                      <p className="text-xs text-red-600"><User className="w-3 h-3 inline mr-1" />{sessionInfo.faculty_name} · <Clock className="w-3 h-3 inline mr-1" />{sessionInfo.start_time} - {sessionInfo.end_time}</p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-3">
                    <div>
                      <input type="text" value={enrollment} onChange={e => setEnrollment(e.target.value)}
                        placeholder="Email / Enrollment"
                        className="w-full px-4 py-3 border-2 border-red-200 rounded-sm text-sm focus:outline-none focus:border-red-500 transition-colors"
                        required />
                    </div>
                    <div>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-3 border-2 border-red-200 rounded-sm text-sm focus:outline-none focus:border-red-500 transition-colors"
                        required />
                    </div>

                    {loginError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-red-600 text-sm">{loginError}</p>
                      </div>
                    )}

                    <button type="submit" disabled={loginLoading}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-700 to-red-800 text-white font-bold py-3 rounded-sm hover:from-red-800 hover:to-red-900 disabled:opacity-60 transition-all">
                      {loginLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</>
                      ) : (
                        <><LogIn className="w-4 h-4" /> Login & Continue</>
                      )}
                    </button>
                  </form>

                  <p className="text-center text-xs text-red-400 mt-4">
                    Only students can mark attendance via this link
                  </p>
                </div>
              )}

              {phase === 'camera' && (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </span>
                    <span className="text-red-300">→</span>
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" /> Logged In
                    </span>
                    <span className="text-red-300">→</span>
                    <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 font-bold rounded-full text-xs">
                      <Camera className="w-3 h-3" /> Capture
                    </span>
                  </div>

                  <div className="text-center mb-3">
                    <h2 className="text-lg font-bold text-red-800">Face Verification</h2>
                    <p className="text-red-600 text-xs">Look directly at the camera</p>
                  </div>

                  <div className="relative aspect-video bg-gradient-to-br from-red-900 to-red-950 rounded-sm overflow-hidden mb-4 border-2 border-red-200 shadow-inner">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? '' : 'hidden'}`} 
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {!cameraActive && !cameraLoading && !cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Camera className="w-10 h-10 text-red-300 mb-2" />
                        <p className="text-white text-sm font-medium">Camera is off</p>
                        <p className="text-red-200 text-xs">Tap "Start Camera" below</p>
                      </div>
                    )}

                    {cameraLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900">
                        <div className="w-12 h-12 border-4 border-red-200 border-t-red-400 rounded-full animate-spin mb-2"></div>
                        <p className="text-white text-sm">Starting camera...</p>
                      </div>
                    )}

                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900 p-4 text-center">
                        <AlertCircle className="w-8 h-8 text-red-300 mb-2" />
                        <p className="text-red-200 text-sm">{cameraError}</p>
                      </div>
                    )}

                    {cameraActive && (
                      <>
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-32 h-40 border-2 border-dashed border-white/30 rounded-full"></div>
                        </div>
                      </>
                    )}

                    {submitting && (
                      <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-white font-bold">Verifying...</p>
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-red-600 text-xs">{cameraError}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!cameraActive && !cameraLoading && (
                      <button 
                        onClick={startCamera}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-700 to-red-800 text-white font-bold py-3 rounded-sm hover:from-red-800 hover:to-red-900 transition-all"
                      >
                        <Camera className="w-4 h-4" /> Start Camera
                      </button>
                    )}
                    
                    {cameraActive && (
                      <>
                        <button 
                          onClick={handleMarkAttendance} 
                          disabled={submitting}
                          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3 rounded-sm hover:from-green-700 hover:to-green-800 disabled:opacity-60 transition-all"
                        >
                          {submitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                          ) : (
                            <><CheckCircle className="w-4 h-4" /> Mark Attendance</>
                          )}
                        </button>
                        <button 
                          onClick={stopCamera}
                          className="px-4 border border-red-200 text-red-700 font-semibold py-3 rounded-sm hover:bg-red-50 transition-all text-sm"
                        >
                          <VideoOff className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <p className="text-center text-xs text-red-400 mt-3">
                    Ensure good lighting and look directly at camera
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
