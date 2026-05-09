import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Logo from "../components/Logo";
import { authAPI, attendanceAI } from "../services/api";
import {
  Camera, CheckCircle, AlertCircle, Loader2,
  RefreshCw, Upload, ChevronRight, X, KeyRound
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Constants for face capture step
// ────────────────────────────────────────────────────────────────────────────
const TOTAL_CAPTURES = 5;
const CAPTURE_INTERVAL_MS = 1500;

// ────────────────────────────────────────────────────────────────────────────
// Main Login component  (step 1 = credentials, step 2 = face registration)
// ────────────────────────────────────────────────────────────────────────────
const Login = () => {
  const [role, setRole] = useState("student");
  const [message, setMessage] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = credentials, 2 = face registration
  const [pendingStudentId, setPendingStudentId] = useState(null);
  const navigate = useNavigate();

  // ── Face capture state ──────────────────────────────────────────────
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [captures, setCaptures] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [faceSubmitting, setFaceSubmitting] = useState(false);
  const [faceSuccess, setFaceSuccess] = useState(false);
  const [faceError, setFaceError] = useState("");

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // ── Forgot Password State ──────────────────────────────────────────────
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [fpStep, setFpStep] = useState(1);
  const [fpLoginId, setFpLoginId] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpMessage, setFpMessage] = useState({ type: "", text: "" });
  const [fpLoading, setFpLoading] = useState(false);

  const handleFpRequestOTP = async (e) => {
    e.preventDefault();
    setFpMessage({ type: "", text: "" });
    setFpLoading(true);
    try {
      const res = await authAPI.resetPasswordRequest(fpLoginId);
      setFpMessage({ type: "success", text: res.data.message });
      setFpStep(2);
    } catch (error) {
      setFpMessage({ type: "error", text: error.response?.data?.error || "Failed to request OTP" });
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpVerifyReset = async (e) => {
    e.preventDefault();
    setFpMessage({ type: "", text: "" });
    setFpLoading(true);
    try {
      const res = await authAPI.resetPasswordVerify(fpLoginId, fpOtp, fpNewPassword);
      setFpMessage({ type: "success", text: res.data.message });
      setTimeout(() => {
        setShowForgotPassword(false);
        setFpStep(1);
        setFpLoginId("");
        setFpOtp("");
        setFpNewPassword("");
        setFpMessage({ type: "", text: "" });
      }, 2000);
    } catch (error) {
      setFpMessage({ type: "error", text: error.response?.data?.error || "Invalid or expired OTP" });
    } finally {
      setFpLoading(false);
    }
  };

  // ── Social Login Handler ─────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("social_login") === "success") {
      try {
        const rawData = params.get("data");
        const authData = JSON.parse(rawData);
        const redirectPath = params.get("redirect") || "/student/dashboard";

        // Store tokens
        localStorage.setItem("access_token", authData.access);
        localStorage.setItem("refresh_token", authData.refresh);
        localStorage.setItem("user", JSON.stringify(authData.user));
        localStorage.setItem("profile", JSON.stringify(authData.profile));

        // Clear URL params and navigate
        navigate(redirectPath, { replace: true });
      } catch (err) {
        setMessage("Social login failed to process. Please try again.");
      }
    } else if (params.get("error")) {
      setMessage(params.get("error"));
      // Clean query params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate]);

  // ── STEP 1: Credential Login ─────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");
    localStorage.removeItem("face_registered");

    try {
      const response = await authAPI.login(enrollment, password);
      const { access, refresh, user, profile } = response.data;
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("profile", JSON.stringify(profile));

      if (user.role !== role) {
        setMessage(`Access denied. Please login through the ${user.role} portal.`);
        setLoading(false);
        return;
      }

      if (user.role === "student") {
        // Face registration requirement removed - skip directly to dashboard
        navigate("/student/dashboard", { replace: true });
      } else if (user.role === "faculty") {
        navigate("/faculty/dashboard", { replace: true });
      } else if (user.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      }
    } catch (error) {
      if (error.response?.data?.error) {
        setMessage(error.response.data.error);
      } else {
        setMessage("Authentication failed. Please check credentials or server connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Camera helpers ───────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      // small delay to let DOM render the video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      }, 300);
    } catch {
      setFaceError("Camera access denied. Please allow camera access and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = 640;
    canvas.height = 480;
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const startCapture = useCallback(() => {
    if (!cameraReady) return;
    setCaptures([]);
    setCaptureIndex(0);
    setCapturing(true);
    setFaceError("");
    let count = 0;
    intervalRef.current = setInterval(() => {
      const dataUrl = captureFrame();
      if (dataUrl) {
        setCaptures((prev) => [...prev, { dataUrl }]);
        count++;
        setCaptureIndex(count);
        if (count >= TOTAL_CAPTURES) {
          clearInterval(intervalRef.current);
          setCapturing(false);
        }
      }
    }, CAPTURE_INTERVAL_MS);
  }, [cameraReady, captureFrame]);

  const retakeCapture = (index) => {
    const dataUrl = captureFrame();
    if (dataUrl) {
      setCaptures((prev) => {
        const updated = [...prev];
        updated[index] = { dataUrl };
        return updated;
      });
    }
  };

  // ── STEP 2: Submit face registration ────────────────────────────────
  const handleFaceSubmit = async () => {
    if (captures.length < TOTAL_CAPTURES) {
      setFaceError("Please capture all 5 photos first.");
      return;
    }
    if (!pendingStudentId) {
      setFaceError("Student ID not found. Please log in again.");
      return;
    }
    setFaceSubmitting(true);
    setFaceError("");
    try {
      const images = captures.map((c) => c.dataUrl);
      const res = await attendanceAI.registerFace(pendingStudentId, images);
      if (res.data.success) {
        // ✅ CRITICAL: set BEFORE navigate
        localStorage.setItem("face_registered", "true");
        setFaceSuccess(true);
        stopCamera();
        setTimeout(() => navigate("/student/dashboard", { replace: true }), 2000);
      } else {
        setFaceError(res.data.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setFaceError(err?.response?.data?.message || "An error occurred. Please try again.");
    } finally {
      setFaceSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: Step 2 — Face Registration (full page takeover, login-page style)
  // ────────────────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center py-8 px-4 relative"
        style={{ background: "#1a0000" }}
      >
        {/* Background image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url(/maxresdefault.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.35,
          }}
        />

        {/* Card */}
        <div className="w-full max-w-2xl bg-white border border-[rgba(185,28,28,0.2)] rounded-2xl shadow-2xl shadow-black overflow-hidden relative z-10">
          {/* Card header */}
          <div className="flex justify-center bg-red-800 py-6 rounded-t-2xl">
            <Logo size="xl" />
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-4 py-4 bg-[rgba(185,28,28,0.06)] border-b border-[rgba(185,28,28,0.15)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--gu-red)] text-white flex items-center justify-center text-xs font-bold">✓</div>
              <span className="text-[var(--gu-red)] text-sm font-semibold">Login</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--gu-red)]" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--gu-red)] text-white flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-[var(--gu-red)] text-sm font-semibold">Face Registration</span>
            </div>
          </div>

          {faceSuccess ? (
            /* Success screen */
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center mb-5 animate-pulse">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-serif font-semibold text-[var(--gu-red-dark)] mb-2">
                Face Registered Successfully!
              </h2>
              <p className="text-gray-500 text-sm">Taking you to your dashboard...</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="text-center">
                <h2 className="font-serif text-xl font-semibold text-[var(--gu-red-dark)] mb-1">
                  Register Your Face
                </h2>
                <p className="text-gray-500 text-sm">
                  One-time setup for AI-powered attendance. Capture 5 clear photos of your face.
                </p>
              </div>

              {/* Two-column: camera + thumbnails */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Camera feed */}
                <div className="space-y-3">
                  <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden border border-[rgba(185,28,28,0.3)]">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Face oval overlay */}
                    {cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-32 h-40 border-2 border-[#D4AF37]/70 rounded-full" />
                        <div className="absolute top-2 left-0 right-0 text-center">
                          <span className="text-[#D4AF37] text-[10px] bg-black/60 px-2 py-0.5 rounded-full">
                            Keep face in oval
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Capturing spinner overlay */}
                    {capturing && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-white text-xs font-medium">
                            {captureIndex}/{TOTAL_CAPTURES}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Camera status badge */}
                    <div className="absolute bottom-2 left-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cameraReady ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {cameraReady ? "● Ready" : "● Starting..."}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {captures.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Photos captured</span>
                        <span>{captures.length}/{TOTAL_CAPTURES}</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--gu-red)] rounded-full transition-all duration-500"
                          style={{ width: `${(captures.length / TOTAL_CAPTURES) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Thumbnails grid */}
                <div className="grid grid-cols-3 gap-2 content-start">
                  {Array.from({ length: TOTAL_CAPTURES }).map((_, i) => {
                    const cap = captures[i];
                    return (
                      <div
                        key={i}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          cap
                            ? "border-green-400 bg-green-50"
                            : "border-dashed border-gray-300 bg-gray-50"
                        }`}
                      >
                        {cap ? (
                          <>
                            <img
                              src={cap.dataUrl}
                              alt={`Photo ${i + 1}`}
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                            {/* Retake button */}
                            {!capturing && !faceSubmitting && (
                              <button
                                onClick={() => retakeCapture(i)}
                                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                                title="Retake"
                              >
                                <RefreshCw className="w-2.5 h-2.5 text-white" />
                              </button>
                            )}
                            <div className="absolute bottom-0.5 left-0 right-0 text-center">
                              <span className="text-[9px] text-green-600 font-semibold">✓ Photo {i + 1}</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <Camera className="w-4 h-4 text-gray-300 mb-1" />
                            <span className="text-[9px] text-gray-400">{i + 1}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error */}
              {faceError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-red-600 text-sm">{faceError}</p>
                </div>
              )}

              {/* Instructions tip */}
              <div className="bg-[rgba(185,28,28,0.06)] border-l-4 border-[var(--gu-red)] p-3 rounded-r-lg text-xs text-gray-600">
                💡 <strong>Tips:</strong> Good lighting · Face the camera directly · Remove glasses · Stay still
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {captures.length < TOTAL_CAPTURES ? (
                  <button
                    id="btn-face-capture"
                    onClick={startCapture}
                    disabled={!cameraReady || capturing}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--gu-red)] text-white font-bold py-3 rounded-2xl hover:bg-[var(--gu-red-hover)] transition-colors disabled:opacity-50"
                  >
                    {capturing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Capturing {captureIndex}/{TOTAL_CAPTURES}...</>
                    ) : (
                      <><Camera className="w-4 h-4" /> Start Camera Capture</>
                    )}
                  </button>
                ) : (
                  <button
                    id="btn-face-submit"
                    onClick={handleFaceSubmit}
                    disabled={faceSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-2xl hover:bg-green-500 transition-colors disabled:opacity-50"
                  >
                    {faceSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Registering Face...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Register &amp; Go to Dashboard</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-white/70 relative z-10">
          Ganpat University AMPICS · Secure AI Attendance System
        </p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: Step 1 — Credentials (original login UI)
  // ────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        className="flex-grow flex flex-col items-center justify-center py-10 sm:py-20 px-3 sm:px-4 relative"
        style={{ background: "#1a0000" }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url(/maxresdefault.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: 0.4,
          }}
        />

        <div className="w-full max-w-md glass-card-light rounded-2xl shadow-2xl relative z-10 overflow-hidden transform transition-all duration-500 hover:scale-[1.01]">
          <div className="flex justify-center mb-0 bg-[var(--gu-red-dark)] py-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-white"></div>
            <Logo size="xl" />
          </div>

          <div className="grid grid-cols-2 p-1 bg-gray-100/50 backdrop-blur-sm">
            <button
              onClick={() => { setRole("student"); setMessage(""); }}
              className={`py-3 text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded-xl ${role === "student" ? "bg-white text-[var(--gu-red-dark)] shadow-sm" : "text-gray-500 hover:text-[var(--gu-red)]"}`}
            >
              Student Portal
            </button>
            <button
              onClick={() => { setRole("faculty"); setMessage(""); }}
              className={`py-3 text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded-xl ${role === "faculty" ? "bg-white text-[var(--gu-red-dark)] shadow-sm" : "text-gray-500 hover:text-[var(--gu-red)]"}`}
            >
              Faculty Portal
            </button>
          </div>

          <div className="p-5 sm:p-8">
            <h2 className="font-serif text-2xl font-semibold mb-6 text-center text-[var(--gu-red-dark)]">
              {role === "student" ? "Student Login" : "Faculty Login"}
            </h2>


            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-[var(--gu-red-dark)] uppercase tracking-wider mb-2">
                  {role === "student" ? "Email / Enrollment Number" : "Email / Faculty ID"}
                </label>
                <input
                  type="text"
                  value={enrollment}
                  onChange={(e) => { setEnrollment(e.target.value); setMessage(""); }}
                  placeholder={role === "student" ? "e.g. 23032432001@gnu.ac.in" : "e.g. pooja.pancholi@gnu.ac.in"}
                  className="w-full px-3 py-3 bg-white border border-[rgba(185,28,28,0.3)] text-[var(--gu-text)] rounded-2xl focus:outline-none focus:border-[var(--gu-red)] focus:ring-[3px] focus:ring-[rgba(185,28,28,0.1)] transition-colors box-border font-sans text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--gu-red-dark)] uppercase tracking-wider mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setMessage(""); }}
                  placeholder="Enter your password"
                  className="w-full px-3 py-3 bg-white border border-[rgba(185,28,28,0.3)] text-[var(--gu-text)] rounded-2xl focus:outline-none focus:border-[var(--gu-red)] focus:ring-[3px] focus:ring-[rgba(185,28,28,0.1)] transition-colors box-border font-sans text-sm"
                  required
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-[var(--gu-red)] font-semibold hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 px-6 text-sm font-bold uppercase tracking-widest transition-all duration-300 rounded-2xl shadow-lg hover:shadow-xl btn-shine ${
                  role === "student"
                    ? "bg-[var(--gu-red)] text-white hover:bg-[var(--gu-red-hover)]"
                    : "bg-[var(--gu-red-dark)] text-white hover:bg-[#5c0000]"
                } ${loading ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-0.5"}`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  `Sign In to ${role === "student" ? "Student" : "Faculty"} Portal`
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[rgba(185,28,28,0.2)]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500 font-medium">Or continue with</span>
                </div>
              </div>

              <a
                href="http://localhost:8000/accounts/google/login/"
                className={`w-full flex items-center justify-center gap-3 py-3.5 px-6 text-sm font-bold tracking-wide transition-all duration-300 rounded-2xl shadow border border-[rgba(185,28,28,0.2)] bg-white text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-md`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </a>
            </form>

            {message && (
              <p className="mt-4 text-center text-sm font-semibold bg-[rgba(220,38,38,0.1)] text-[var(--gu-error)] py-3 animate-fade-in border border-[var(--gu-error)] rounded-none leading-relaxed word-wrap">
                {message}
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-white leading-relaxed break-words relative z-10">
          Secure single sign-on portal for Ganpat University ERP.
        </p>
      </div>

      {/* ── Forgot Password Modal ────────────────────────────────────────────── */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-fade-in">
            <div className="bg-[var(--gu-red-dark)] p-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-semibold text-lg font-serif">Reset Password</h3>
              </div>
              <button onClick={() => setShowForgotPassword(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {fpMessage.text && (
                <div className={`mb-4 p-3 rounded-lg text-sm font-semibold border ${fpMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {fpMessage.text}
                </div>
              )}

              {fpStep === 1 ? (
                <form onSubmit={handleFpRequestOTP} className="space-y-4">
                  <p className="text-sm text-gray-600 mb-2">Enter your Login ID to receive a 6-digit OTP on your registered email.</p>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--gu-red-dark)] uppercase tracking-wider mb-2">Enrollment No / Employee ID / Email</label>
                    <input type="text" value={fpLoginId} onChange={(e) => setFpLoginId(e.target.value)} required className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:border-[var(--gu-red)] focus:ring-[2px] focus:ring-[var(--gu-red)]/20 text-sm" placeholder="e.g. 23032432001" />
                  </div>
                  <button type="submit" disabled={fpLoading} className="w-full bg-[var(--gu-red)] hover:bg-[var(--gu-red-hover)] text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-60">
                    {fpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Send OTP
                  </button>
                </form>
              ) : (
                <form onSubmit={handleFpVerifyReset} className="space-y-4">
                  <p className="text-sm text-gray-600 mb-2">An OTP has been sent to the registered email address for <strong>{fpLoginId}</strong>.</p>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--gu-red-dark)] uppercase tracking-wider mb-2">6-Digit OTP</label>
                    <input type="text" value={fpOtp} onChange={(e) => setFpOtp(e.target.value)} required maxLength={6} pattern="\d{6}" className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:border-[var(--gu-red)] focus:ring-[2px] focus:ring-[var(--gu-red)]/20 text-sm tracking-widest text-center text-lg font-bold" placeholder="• • • • • •" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--gu-red-dark)] uppercase tracking-wider mb-2">New Password</label>
                    <input type="password" value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)} required minLength={8} className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:border-[var(--gu-red)] focus:ring-[2px] focus:ring-[var(--gu-red)]/20 text-sm" placeholder="Enter new secure password" />
                  </div>
                  <button type="submit" disabled={fpLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-60">
                    {fpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Reset Password
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={() => {setFpStep(1); setFpMessage({type:"", text:""})}} className="text-xs text-gray-500 hover:underline">Change Login ID</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Login;
