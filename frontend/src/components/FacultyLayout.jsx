import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  FileText,
  Calendar,
  User,
  LogOut,
  Camera,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import Logo from "./Logo";
import { authAPI } from "../services/api";

const FacultyLayout = ({ children }) => {
  const [lang, setLang] = useState("EN");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const userProfileStr = localStorage.getItem("profile");
  const userStr = localStorage.getItem("user");
  const profile = userProfileStr ? JSON.parse(userProfileStr) : null;
  const user = userStr ? JSON.parse(userStr) : null;
  const userName = profile?.name || user?.name || user?.email || "Faculty";
  const getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'F';
  const initials = getInitials(userName);
  const avatarUrl = profile?.avatar || user?.avatar 
    ? (profile?.avatar || user?.avatar) 
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=D4AF37&color=8B0000&size=128&font-size=0.4&bold=true`;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await authAPI.getNotifications();
        setNotifications(res.data);
      } catch (e) {
        console.warn("Could not fetch notifications");
      }
    };
    fetchNotifs();
  }, []);

  // Route guard: redirect to login if no valid token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userCheck = localStorage.getItem('user');
    if (!token || !userCheck) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
    navigate('/login', { replace: true });
  };

  const isClassTeacher = profile?.is_class_teacher === true;

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/faculty/dashboard" },
    { name: "AI Attendance", icon: Camera, path: "/faculty/attendance" },
    { name: "Timetable", icon: Calendar, path: "/faculty/timetable" },
    { name: "Exam Paper Generator", icon: FileText, path: "/faculty/pyqs" },
    ...(isClassTeacher ? [{ name: "Grading", icon: ShieldCheck, path: "/faculty/grading" }] : []),
    { name: "Profile", icon: User, path: "/faculty/profile" },
  ];

  return (
    <div className="min-h-screen bg-[#1F0808] flex flex-col font-sans selection:bg-[var(--gu-gold)]/30 selection:text-white">
      {/* Top Navbar */}
      <header className="h-[72px] bg-[var(--gu-red-deep)]/80 backdrop-blur-2xl border-b border-white/5 fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 shadow-[0_10px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center space-x-3 overflow-hidden group min-w-0">
          {/* Hamburger - mobile only */}
          <button
            className="hamburger-btn md:!hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-white/70" /> : <Menu className="w-5 h-5 text-white/70" />}
          </button>
          <div className="hover:scale-105 transition-transform duration-500 flex-shrink-0">
            <Logo size="md" />
          </div>
          <div className="w-[1px] h-6 bg-white/10 mx-4 hidden md:block"></div>
          <div className="hidden md:flex flex-col min-w-0">
            <span className="text-white text-xs font-serif tracking-widest opacity-80 truncate">GANPAT FACULTY</span>
            <span className="text-[var(--gu-gold)] text-[8px] font-black tracking-[0.4em] uppercase opacity-40 truncate">Academic Portal v4.0</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <div className="px-5 py-2.5 bg-[#450A0A]/40 rounded-full border border-white/5 hidden lg:flex items-center text-white/60 tracking-[0.2em] text-[10px] uppercase font-black shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-3 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            Node Active: Gujarat_Main
          </div>

          <div className="flex items-center bg-white/5 rounded-full p-1 md:p-1.5 border border-white/5">
            <div className="relative" ref={notifRef}>
                <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 md:p-2.5 rounded-full transition-all relative ${showNotifications ? 'bg-[var(--gu-gold)] text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                >
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                <span className={`absolute top-2 right-2 md:top-2.5 md:right-2.5 w-2 h-2 rounded-full border-2 border-[#1A1A1A] ${notifications.length > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                </button>

                {showNotifications && (
                <div className="absolute right-0 sm:right-0 mt-4 w-[calc(100vw-32px)] sm:w-96 max-w-96 bg-[#220808] border border-white/10 shadow-2xl z-50 overflow-hidden animate-reveal-down origin-top-right" style={{ right: window.innerWidth < 640 ? `-${Math.min(60, window.innerWidth - 200)}px` : '0' }}>
                    <div className="px-4 sm:px-6 py-5 border-b border-white/5 flex justify-between items-center">
                    <h3 className="font-serif text-white text-lg sm:text-xl">Faculty Alerts</h3>
                    <span className="text-[9px] font-black text-[var(--gu-gold)] uppercase tracking-widest">Recent Activity</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? notifications.map((notif, i) => (
                        <div
                        key={i}
                        className="px-4 sm:px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-[var(--gu-gold)] flex-shrink-0"></div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors break-words">{notif.message || notif.title}</p>
                                    <p className="text-white/20 text-[9px] mt-1 font-black uppercase tracking-widest">
                                        {new Date(notif.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="px-8 py-12 text-center text-white/20 text-[10px] font-black uppercase tracking-widest">
                            No New Activity
                        </div>
                    )}
                    </div>
                </div>
                )}
            </div>

            <button
                onClick={() => setLang(lang === "EN" ? "HI" : "EN")}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-white/40 hover:text-white text-[10px] font-black transition-all"
            >
                {lang}
            </button>

            <div className="w-[1px] h-6 bg-white/5 mx-0.5 md:mx-1 hidden sm:block"></div>

            <div className="relative" ref={profileRef}>
                <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 md:gap-3 pl-1 md:pl-2 pr-1 md:pr-1.5 py-0.5 group"
                >
                    <span className="text-white/40 group-hover:text-white text-[10px] font-black uppercase tracking-widest transition-all hidden sm:block truncate max-w-[80px]">
                    {userName.split(' ')[0]}
                    </span>
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-[var(--gu-gold)]/40 transition-all p-0.5 shadow-lg flex-shrink-0">
                        <img 
                        src={avatarUrl} 
                        alt={userName} 
                        className="w-full h-full object-cover rounded-full"
                        />
                    </div>
                </button>
                {showProfileMenu && (
                    <div className="absolute right-0 mt-4 w-56 sm:w-64 bg-[#220808] border border-white/10 shadow-2xl z-50 overflow-hidden animate-reveal-down origin-top-right">
                        <div className="p-4 sm:p-6 bg-white/5 border-b border-white/5">
                            <p className="text-white font-serif text-base sm:text-lg truncate">{userName}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--gu-gold)] mt-1">Authenticated Faculty</p>
                        </div>
                        <div className="p-2 space-y-1">
                            <Link
                                to="/faculty/profile"
                                className="w-full text-left flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/5 rounded-xl transition-all"
                            >
                                <User className="w-4 h-4 flex-shrink-0" />
                                Account Details
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="w-full text-left flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 text-red-400 hover:text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 rounded-xl transition-all group"
                            >
                                <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
                                End Session
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-[72px]">
        {/* Mobile sidebar overlay */}
        <div
          className={`sidebar-overlay md:!hidden ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Left Sidebar */}
        <aside className={`
          w-72 bg-[#220808]/90 backdrop-blur-3xl border-r border-white/5 
          fixed bottom-0 top-[72px] left-0 flex flex-col justify-between z-40 
          shadow-[20px_0_50px_rgba(0,0,0,0.3)]
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-8 md:py-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--gu-gold)] opacity-40 mb-8 md:mb-10 pl-4">Navigation Resources</h2>
            <nav className="space-y-3">
              {navItems.map((item, i) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center px-4 md:px-5 py-3.5 md:py-4 rounded-2xl transition-all duration-500 relative overflow-hidden ${
                        isActive
                          ? "bg-[var(--gu-gold)]/5 text-[var(--gu-gold)] border border-[var(--gu-gold)]/20 shadow-[0_0_20px_rgba(212,175,55,0.05)]"
                          : "text-white/30 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    {/* Active Indicator Glow */}
                    {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--gu-gold)] rounded-r-full shadow-[0_0_15px_rgba(212,175,55,0.8)]"></div>
                    )}
                    
                    <Icon
                      className={`w-4 h-4 mr-3 md:mr-4 flex-shrink-0 transition-all duration-500 ${isActive ? "text-[var(--gu-gold)] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" : "group-hover:text-white"}`}
                    />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-x-auto scrollbar-none">
                      {item.name}
                    </span>
                    
                    {/* Background hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--gu-gold)]/0 to-[var(--gu-gold)]/10 translate-x-full group-hover:translate-x-0 transition-transform duration-700 pointer-events-none"></div>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 md:p-8 border-t border-white/5">
             <div className="glass-panel p-4 md:p-5 bg-gradient-to-br from-[#450A0A]/40 to-transparent border-white/5">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-3">Academic Terminal</p>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-white font-bold truncate">GANPAT_CORE</span>
                        <span className="text-[8px] text-[var(--gu-gold)] tracking-widest truncate">SECURE_LINK</span>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--gu-gold)]/5 border border-[var(--gu-gold)]/10 flex-shrink-0">
                        <ShieldCheck className="w-3 h-3 text-[var(--gu-gold)]" />
                    </div>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 md:ml-72 p-4 sm:p-6 md:p-10 min-h-[calc(100vh-72px)] relative w-full overflow-x-hidden">
            <div
                className="fixed inset-0 z-0 md:ml-72 mt-[72px] pointer-events-none"
                style={{
                    backgroundImage: "url(/maxresdefault.jpg)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: 0.25,
                }}
            ></div>
            {/* Overlay Glows */}
            <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-[var(--gu-gold)]/5 rounded-full blur-[180px] -mr-80 -mt-80 pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-[var(--gu-red-deep)]/10 rounded-full blur-[180px] ml-80 -mb-80 pointer-events-none"></div>

            <div className="relative z-10 overflow-x-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default FacultyLayout;
