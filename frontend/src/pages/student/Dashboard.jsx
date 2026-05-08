import { useState, useEffect } from "react";
import StudentLayout from "../../components/StudentLayout";
import { CheckCircle, Calendar, Award, Clock, Bell, BookOpen, AlertCircle, ArrowRight, Camera, FileText, Compass, MapPin } from "lucide-react";
import { studentAPI, attendanceAI, academicsAPI } from "../../services/api";
import { Link } from "react-router-dom";

const DUMMY_DASHBOARD = {
  student: { name: "Arjun Kumar", course_code: "MCA", current_semester: 2, enrollment_no: "23032432001" },
  attendance_percentage: 85,
  total_subjects: 6,
  latest_sgpa: 8.8,
  cgpa: 8.5,
  announcements: [
    { id: "1", title: "Library Timing Extended", message: "Library will remain open till 10 PM during exam period.", date: "2026-04-01", priority: "normal" },
    { id: "2", title: "Scholarship Application Open", message: "Apply for merit scholarship before April 15th.", date: "2026-03-28", priority: "important" },
  ],
  today_classes: [
    { id: 1, subject: "Machine Learning", time: "10:30 AM - 11:30 AM", room: "Lab 1", status: "completed" },
    { id: 2, subject: "Advanced Java", time: "11:30 AM - 12:30 PM", room: "Room 302", status: "ongoing" },
    { id: 3, subject: "Cloud Computing", time: "01:30 PM - 02:30 PM", room: "Room 305", status: "upcoming" },
  ]
};

const Dashboard = () => {
  const [data, setData] = useState(DUMMY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [regStatus, setRegStatus] = useState({ profile_complete: true });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, regRes] = await Promise.all([
          studentAPI.dashboard(),
          attendanceAI.getRegistrationStatus().catch(() => ({ data: { profile_complete: true } }))
        ]);
        
        // Merge backend data with dummy defaults for UI robustness
        setData({ ...DUMMY_DASHBOARD, ...dashRes.data });
        setRegStatus(regRes.data);
      } catch {
        console.warn("Using dummy data - backend not available");
        setData(DUMMY_DASHBOARD);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-[var(--gu-gold)] animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-r-2 border-red-500 animate-spin-reverse"></div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Calculate greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const firstName = data.student?.name?.trim().split(" ")[0] || "Student";

  return (
    <StudentLayout>
      <div className="animate-fade-in max-w-7xl mx-auto space-y-8 relative z-10 pb-10">
        
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#2a0808] to-[#1a0505] border border-[var(--gu-gold)]/20 p-8 rounded-xl shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gu-gold)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-[var(--gu-gold)] font-medium tracking-widest uppercase text-xs mb-2 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> {today}
              </p>
              <h1 className="font-serif text-3xl md:text-5xl text-white mb-2 tracking-tight">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--gu-gold)] to-yellow-200">{firstName}</span>
              </h1>
              <p className="text-white/60 text-sm font-medium tracking-wide">
                {data.student?.course_code || "MCA"} &bull; Semester {data.student?.current_semester || 2} &bull; {data.student?.enrollment_no}
              </p>
            </div>
            
            {/* Quick Next Class indicator */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-lg flex items-center gap-4 min-w-[250px]">
              <div className="bg-blue-500/20 p-3 rounded-full border border-blue-500/30">
                <Clock className="w-6 h-6 text-blue-400 animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1">Next Up</p>
                <p className="text-white font-semibold text-sm">
                  {data.today_classes?.find(c => c.status === 'ongoing' || c.status === 'upcoming')?.subject || "No more classes"}
                </p>
                <p className="text-blue-300 text-xs">
                  {data.today_classes?.find(c => c.status === 'ongoing' || c.status === 'upcoming')?.time || "Enjoy your day!"} 
                  {data.today_classes?.find(c => c.status === 'ongoing' || c.status === 'upcoming')?.room ? ` • ${data.today_classes?.find(c => c.status === 'ongoing' || c.status === 'upcoming')?.room}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Attendance Setup Banner */}
        {!regStatus.profile_complete && (
          <Link to="/student/attendance-setup" className="block group animate-fade-in">
            <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/40 p-5 rounded-xl flex flex-col md:flex-row items-center justify-between transition-all gap-4 hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(250,204,21,0.15)] relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500"></div>
              <div className="flex items-start gap-4">
                <div className="bg-yellow-500/20 p-2 rounded-full">
                  <AlertCircle className="text-yellow-400 w-6 h-6 flex-shrink-0 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-yellow-400 font-bold text-base mb-1 tracking-tight">Biometric Profile Incomplete</h3>
                  <p className="text-yellow-400/80 text-sm">
                    {!regStatus.is_details_filled
                      ? "Establish your digital twin for AI attendance tracking."
                      : "Your face biometric signature is missing. Complete setup to begin marking attendance."}
                  </p>
                </div>
              </div>
              <div className="bg-yellow-400 text-black px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest group-hover:bg-yellow-300 transition-colors flex items-center gap-2 whitespace-nowrap shadow-lg">
                Initialize Setup <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            { label: "Attendance", val: `${data.attendance_percentage}%`, icon: CheckCircle, color: "from-green-500/20 to-emerald-500/5", textColor: "text-emerald-400", borderColor: "border-emerald-500/30" },
            { label: "Active Subjects", val: data.total_subjects || 6, icon: BookOpen, color: "from-blue-500/20 to-cyan-500/5", textColor: "text-blue-400", borderColor: "border-blue-500/30" },
            { label: "Semester SGPA", val: data.latest_sgpa || "—", icon: Award, color: "from-purple-500/20 to-fuchsia-500/5", textColor: "text-purple-400", borderColor: "border-purple-500/30" },
            { label: "Overall CGPA", val: data.cgpa || "—", icon: Award, color: "from-[var(--gu-gold)]/20 to-yellow-500/5", textColor: "text-[var(--gu-gold)]", borderColor: "border-[var(--gu-gold)]/30" }
          ].map((stat, i) => (
            <div key={i} className={`bg-gradient-to-br ${stat.color} border ${stat.borderColor} p-6 rounded-xl flex flex-col justify-between backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg relative overflow-hidden group`}>
              <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <stat.icon className="w-24 h-24" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg bg-black/30 border border-white/5`}>
                  <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
                </div>
                <span className="text-white/70 text-xs uppercase tracking-widest font-bold">
                  {stat.label}
                </span>
              </div>
              <div className={`font-serif text-3xl md:text-4xl font-bold ${stat.textColor} drop-shadow-md`}>
                {stat.val}
              </div>
            </div>
          ))}
        </div>

        {/* Essential Quick Actions - Visual & Premium */}
        <div>
          <h2 className="text-white font-serif text-xl mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[var(--gu-gold)] rounded-full block"></span> 
            Essential Tools
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { to: "/student/attendance-camera", icon: Camera, label: "Face Attendance", desc: "Mark via AI", color: "from-emerald-600/30 to-emerald-900/40", hoverColor: "group-hover:border-emerald-400/50", iconColor: "text-emerald-400" },
              { to: "/student/timetable", icon: Calendar, label: "Timetable", desc: "Class Schedule", color: "from-blue-600/30 to-blue-900/40", hoverColor: "group-hover:border-blue-400/50", iconColor: "text-blue-400" },
              { to: "/student/pyqs", icon: FileText, label: "PYQ Bank", desc: "Past Exam Papers", color: "from-purple-600/30 to-purple-900/40", hoverColor: "group-hover:border-purple-400/50", iconColor: "text-purple-400" },
              { to: "/student/career", icon: Compass, label: "Career AI", desc: "Roadmaps & Guidance", color: "from-amber-600/30 to-amber-900/40", hoverColor: "group-hover:border-amber-400/50", iconColor: "text-amber-400" }
            ].map((action, i) => (
              <div key={i} className={`group bg-gradient-to-b ${action.color} border border-white/10 p-6 rounded-xl transition-all duration-300 flex flex-col items-center text-center gap-4 ${action.hoverColor} hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 overflow-hidden relative cursor-default`}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
                <div className={`w-14 h-14 bg-black/40 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-300 shadow-inner z-10`}>
                  <action.icon className={`w-6 h-6 ${action.iconColor}`} />
                </div>
                <div className="z-10">
                  <span className="text-white text-sm font-bold uppercase tracking-widest block mb-1 drop-shadow-md">{action.label}</span>
                  <span className="text-white/60 text-xs font-semibold tracking-wide block">{action.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section: Today's Schedule & Announcements */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Today's Schedule Timeline (Takes up 2/3 space) */}
          <div className="lg:col-span-2 bg-[#1a0505]/80 backdrop-blur-xl border border-[var(--gu-border)] rounded-xl overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-5 border-b border-[var(--gu-gold)]/20 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-[var(--gu-gold)]/20 p-2 rounded-lg">
                  <Clock className="w-5 h-5 text-[var(--gu-gold)]" />
                </div>
                <h2 className="font-serif text-xl text-white">Today's Schedule</h2>
              </div>
              <Link to="/student/timetable" className="text-xs text-[var(--gu-gold)] uppercase font-bold tracking-widest hover:text-white transition-colors">Full Timetable &rarr;</Link>
            </div>
            
            <div className="p-6 relative">
              <div className="absolute left-9 top-10 bottom-10 w-0.5 bg-white/10"></div>
              
              <div className="space-y-6">
                {(data.today_classes || []).map((cls, idx) => (
                  <div key={cls.id} className="flex gap-6 relative group">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex flex-col items-center mt-1">
                      <div className={`w-4 h-4 rounded-full border-4 border-[#1a0505] ${
                        cls.status === 'completed' ? 'bg-emerald-500' : 
                        cls.status === 'ongoing' ? 'bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 
                        'bg-white/30'
                      }`}></div>
                    </div>
                    
                    {/* Content Card */}
                    <div className={`flex-1 p-4 rounded-xl border transition-all ${
                        cls.status === 'ongoing' 
                        ? 'bg-blue-900/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                        : 'bg-black/30 border-white/5 group-hover:border-white/10'
                      }`}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                        <h4 className="text-white font-bold text-base">{cls.subject}</h4>
                        <span className={`text-[10px] px-2.5 py-1 rounded-md uppercase font-bold tracking-widest border ${
                          cls.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                          cls.status === 'ongoing' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                          'bg-white/5 border-white/10 text-white/50'
                        }`}>
                          {cls.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs font-semibold text-white/60">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {cls.time}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {cls.room}</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(data.today_classes?.length === 0) && (
                  <div className="text-center py-10">
                    <p className="text-white/50 font-medium">No more classes scheduled for today.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Announcements Block (Takes up 1/3 space) */}
          <div className="bg-[#1a0505]/80 backdrop-blur-xl border border-[var(--gu-border)] rounded-xl overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-5 border-b border-[var(--gu-gold)]/20 bg-black/20 flex items-center gap-3">
              <div className="bg-red-500/20 p-2 rounded-lg">
                <Bell className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="font-serif text-xl text-white">Campus News</h2>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[400px] custom-scrollbar">
              {(data.announcements || []).map((ann) => (
                <div key={ann.id} className="group relative bg-black/30 border border-white/5 p-4 rounded-xl hover:border-white/10 transition-colors">
                  {ann.priority === "important" && (
                    <div className="absolute -left-[1px] top-[20%] bottom-[20%] w-1 bg-red-500 rounded-r-md"></div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${ann.priority === 'important' ? 'text-red-400' : 'text-[var(--gu-gold)]'}`}>
                      Notice
                    </span>
                    <span className="text-white/40 text-[10px] font-semibold">
                      {new Date(ann.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <h4 className="text-white font-semibold text-sm mb-1.5">{ann.title}</h4>
                  <p className="text-white/60 text-xs leading-relaxed line-clamp-3">{ann.message}</p>
                </div>
              ))}
              
              {(data.announcements?.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-white/50 text-sm">No new announcements.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </StudentLayout>
  );
};

export default Dashboard;

