import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FacultyLayout from '../../components/FacultyLayout';
import {
    Clock, BookOpen, Users, FileText, Calendar,
    ChevronRight, BarChart3, Sparkles, AlertTriangle,
    Loader2, GraduationCap, Bell, Target
} from 'lucide-react';
import { facultyAPI } from '../../services/api';

const Dashboard = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [greeting, setGreeting] = useState('');

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 17) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const res = await facultyAPI.dashboard();
                setData(res.data);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
                setError('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    const getAttendanceColor = (pct) => {
        if (pct >= 75) return 'text-[#4ade80]';
        if (pct >= 50) return 'text-[var(--gu-gold)]';
        return 'text-[#f87171]';
    };

    const getAttendanceBg = (pct) => {
        if (pct >= 75) return 'bg-[#4ade80]';
        if (pct >= 50) return 'bg-[var(--gu-gold)]';
        return 'bg-[#f87171]';
    };

    if (loading) {
        return (
            <FacultyLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 text-[var(--gu-gold)] animate-spin mx-auto mb-4" />
                        <p className="text-white/60 text-sm">Loading dashboard...</p>
                    </div>
                </div>
            </FacultyLayout>
        );
    }

    if (error) {
        return (
            <FacultyLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <AlertTriangle className="w-10 h-10 text-[#f87171] mx-auto mb-4" />
                        <p className="text-white/60 text-sm">{error}</p>
                        <button onClick={() => window.location.reload()} className="mt-4 text-[var(--gu-gold)] underline text-sm">Retry</button>
                    </div>
                </div>
            </FacultyLayout>
        );
    }

    const faculty = data?.faculty || {};
    const subjects = data?.subjects || [];
    const todayClasses = data?.today_classes || [];
    const lowestAttendance = data?.lowest_attendance_per_course || [];

    return (
    <FacultyLayout>
        <div className="animate-fade-in max-w-7xl mx-auto space-y-10 relative z-10">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6 bg-[var(--gu-red-deep)]/40 p-4 sm:p-8 rounded-2xl border border-[var(--gu-gold)]/10 backdrop-blur-sm shadow-2xl">
                <div>
                    <h1 className="font-serif text-4xl md:text-5xl text-white mb-2 tracking-tight">
                        Aether Faculty Console
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-[var(--gu-gold)] text-[10px] uppercase font-black tracking-[0.3em] opacity-80">
                        <span>{faculty.name || 'Professor'}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gu-gold)]/30"></span>
                        <span>{faculty.department || 'Academic Dept'}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gu-gold)]/30"></span>
                        <span>ID: {faculty.employee_id || '—'}</span>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 py-3 px-6 rounded-full backdrop-blur-md flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{today}</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                {[
                    { label: "Assigned Modules", value: subjects.length, icon: BookOpen, color: "text-[var(--gu-gold)]" },
                    { label: "Curated Papers", value: data?.generated_papers_count || 0, icon: FileText, color: "text-[var(--gu-gold)]" },
                ].map((stat, i) => (
                    <div key={i} className="glass-panel group p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
                        <div className="flex justify-between items-start relative z-10">
                            <span className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</span>
                            <stat.icon className={`w-6 h-6 transition-all duration-500 group-hover:scale-110 ${stat.color} opacity-40 group-hover:opacity-100`} />
                        </div>
                        <div className={`font-serif text-4xl font-bold tracking-tighter relative z-10 ${stat.color}`}>{stat.value}</div>
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--gu-gold)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-700"></div>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000"></div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Today's Mission Panel */}
                <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden flex flex-col animate-slide-up animate-stagger-1">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <h2 className="text-white font-serif text-xl flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-[var(--gu-gold)]"/> Current Schedule
                        </h2>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30 italic">Real-time Feed</span>
                    </div>
                    <div className="p-8 space-y-4">
                        {todayClasses.length > 0 ? (
                            todayClasses.map((cls, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 group hover:bg-white/10 hover:border-[var(--gu-gold)]/20 transition-all">
                                    <div className="text-center w-20 flex-shrink-0">
                                        <div className="text-[var(--gu-gold)] font-black text-lg group-hover:scale-110 transition-transform">
                                            {cls.time ? new Date(`2000-01-01T${cls.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ')[0] : '—'}
                                        </div>
                                        <div className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
                                            {cls.time ? new Date(`2000-01-01T${cls.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ')[1] : ''}
                                        </div>
                                    </div>
                                    <div className="hidden sm:block w-px h-12 bg-white/10"></div>
                                    <div className="flex-1 text-center sm:text-left">
                                        <h4 className="text-white font-bold text-lg group-hover:text-[var(--gu-gold)] transition-colors">{cls.subject_name || cls.subject?.name || 'Academic Session'}</h4>
                                        <p className="text-white/40 text-xs mt-1 uppercase tracking-widest font-bold">{cls.section || 'General'} · Zone {cls.room || 'Digital'}</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                                        cls.attendance_marked 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                        : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                    }`}>
                                        {cls.attendance_marked ? '✓ Synchronized' : 'Attendance Target'}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center opacity-20 gap-4">
                                <Calendar className="w-16 h-16" />
                                <p className="font-serif text-2xl tracking-tighter">No Active Sessions Today</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Subject Domain Panel */}
                <div className="glass-panel rounded-2xl overflow-hidden flex flex-col animate-slide-up animate-stagger-2">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <h2 className="text-white font-serif text-xl flex items-center gap-3">
                            <BookOpen className="w-5 h-5 text-[var(--gu-gold)]"/> Academic Domain
                        </h2>
                    </div>
                    <div className="p-8 space-y-4">
                        {subjects.map((sub, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/5 p-5 rounded-2xl group hover:bg-white/10 transition-all">
                                <h4 className="text-white font-bold mb-2 group-hover:text-[var(--gu-gold)] transition-colors tracking-tight">{sub.name}</h4>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className="bg-white/5 text-white/50 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest border border-white/5">{sub.code}</span>
                                    <span className="text-white/20">·</span>
                                    <span className="text-[10px] font-bold text-[var(--gu-gold)] uppercase tracking-widest">Sem {sub.semester}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions Control Panel */}
            <div className="glass-panel p-8 rounded-2xl animate-slide-up animate-stagger-3">
                <h2 className="text-white font-serif text-2xl mb-8 flex items-center gap-4">
                    <Sparkles className="w-6 h-6 text-[var(--gu-gold)]" /> System Operations
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { to: '/faculty/attendance', icon: Users, label: 'Attendance Hub', desc: 'AI Sync Control', color: 'bg-[var(--gu-gold)] text-black' },
                        { to: '/faculty/exam-papers', icon: FileText, label: 'Paper Forge', desc: 'ML Exam Gen', color: 'bg-white/5 text-white hover:bg-white/10' },
                        { to: '/faculty/timetable', icon: Clock, label: 'Chronos Feed', desc: 'Time Matrix', color: 'bg-white/5 text-white hover:bg-white/10' },
                        { to: '/faculty/profile', icon: GraduationCap, label: 'Core Identity', desc: 'Faculty Profile', color: 'bg-white/5 text-white hover:bg-white/10' }
                    ].map((btn, i) => (
                        <button 
                            key={i}
                            onClick={() => navigate(btn.to)}
                            className={`group relative p-6 rounded-2xl flex flex-col items-center text-center gap-3 transition-all duration-300 border border-white/5 hover:border-[var(--gu-gold)]/30 ${btn.color}`}
                        >
                            <btn.icon className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                            <div>
                                <span className="text-xs font-black uppercase tracking-[0.2em] block">{btn.label}</span>
                                <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">{btn.desc}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </FacultyLayout>
    );
};

export default Dashboard;
