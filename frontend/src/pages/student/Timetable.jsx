import React, { useState, useEffect } from "react";
import StudentLayout from "../../components/StudentLayout";
import { Calendar, Clock, Users, MapPin, Download, Info, BookOpen, AlertCircle, UserX } from "lucide-react";
import { studentAPI } from "../../services/api";

const formatTime12 = (time24) => {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

// Distinct colors for subjects
const SUBJECT_COLORS = [
  { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-300", accent: "bg-blue-500" },
  { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-300", accent: "bg-purple-500" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", accent: "bg-emerald-500" },
  { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-300", accent: "bg-orange-500" },
  { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-300", accent: "bg-pink-500" },
  { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-300", accent: "bg-cyan-500" },
  { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-300", accent: "bg-indigo-500" },
  { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-300", accent: "bg-teal-500" },
];

const StudentTimetable = () => {
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(null);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const timeSlots = React.useMemo(() => {
    if (timetableSlots.length === 0) {
      return [];
    }
    const uniqueTimes = [...new Set(timetableSlots.map(s => s.start_time.substring(0, 5)))].sort();
    const slotLabels = ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5", "Slot 6", "Slot 7", "Slot 8"];
    let idx = 0;
    return uniqueTimes.map((time) => {
      const matchingSlots = timetableSlots.filter(s => s.start_time.substring(0, 5) === time);
      const firstEnd = matchingSlots[0]?.end_time?.substring(0, 5) || "";
      const startHour = parseInt(time.split(":")[0], 10);
      const endHour = parseInt(firstEnd.split(":")[0], 10);
      if (startHour >= 12 && startHour < 14 && endHour >= 13 && endHour <= 15) {
        const isLunch = matchingSlots.some(s => {
          const e = parseInt(s.end_time.substring(0, 5).split(":")[0], 10);
          const ss = parseInt(s.start_time.substring(0, 5).split(":")[0], 10);
          return (e - ss) >= 1 || s.start_time.substring(0, 5) === "14:20";
        });
        if (isLunch && time === "14:20") {
          return { label: "LUNCH", start: time, end: firstEnd };
        }
      }
      const label = slotLabels[idx] || `Slot ${idx + 1}`;
      idx++;
      return { label, start: time, end: firstEnd };
    });
  }, [timetableSlots]);

  useEffect(() => {
    fetchTimetable();
    const today = new Date().getDay();
    const dayMap = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };
    setActiveDay(dayMap[today] || "Monday");
  }, []);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const res = await studentAPI.timetable();
      setTimetableSlots(res.data);
    } catch (err) {
      console.error("Error fetching student timetable", err);
    } finally {
      setLoading(false);
    }
  };

  const getSlotContent = (day, startTime) =>
    timetableSlots.find(s => s.day_of_week === day && s.start_time?.substring(0, 5) === startTime);

  // Build unique subject-to-color map
  const subjectColorMap = {};
  const subjectLegend = {};
  let colorIdx = 0;
  timetableSlots.forEach(slot => {
    if (slot.subject_code && slot.subject_name) {
      if (!subjectColorMap[slot.subject_code]) {
        subjectColorMap[slot.subject_code] = SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length];
        colorIdx++;
      }
      subjectLegend[slot.subject_code] = slot.subject_name;
    }
  });

  const shiftInfo = React.useMemo(() => {
    if (timetableSlots.length === 0) return null;
    const times = timetableSlots.map(s => s.start_time.substring(0, 5)).sort();
    const endTime = timetableSlots.map(s => s.end_time.substring(0, 5)).sort();
    const start = times[0] || "00:00";
    const end = endTime[endTime.length - 1] || "00:00";
    const startHour = parseInt(start.split(":")[0], 10);
    const isMorning = startHour < 12;
    const lunchTimes = timetableSlots.filter(s => {
      const sh = parseInt(s.start_time.substring(0, 5).split(":")[0], 10);
      const eh = parseInt(s.end_time.substring(0, 5).split(":")[0], 10);
      return (sh >= 12 && sh <= 14 && (eh - sh) >= 1);
    });
    const lunchTime = lunchTimes.length > 0 ? formatTime12(lunchTimes[0].start_time.substring(0, 5)) : null;
    return { start: formatTime12(start), end: formatTime12(end), lunchTime, isMorning };
  }, [timetableSlots]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <StudentLayout>
      <div className="relative min-h-screen pb-12">
        {/* Background orbs */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -top-32 right-0 w-[450px] h-[450px] bg-blue-900/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 -left-20 w-[350px] h-[350px] bg-[var(--gu-gold)]/5 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-1">

          {/* ── Header ──────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pt-2">
            <div>
              <p className="text-[var(--gu-gold)] text-[10px] uppercase font-black tracking-[0.3em] mb-1 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Academic Calendar
              </p>
              <h1 className="font-serif text-3xl md:text-4xl text-white tracking-tight">Class Schedule</h1>
              <p className="text-white/35 text-xs mt-1">{today}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gu-gold)]/10 border border-[var(--gu-gold)]/30 text-[var(--gu-gold)] text-xs font-bold uppercase tracking-wider hover:bg-[var(--gu-gold)]/20 transition-all"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>

          {/* ── Info Banner ──────────────────────────────────── */}
          {shiftInfo && (
            <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border border-[var(--gu-gold)]/20 bg-[var(--gu-gold)]/5">
              <Info className="w-4 h-4 text-[var(--gu-gold)] flex-shrink-0" />
              <p className="text-white/50 text-xs">
                {shiftInfo.isMorning ? "Morning" : "Noon"} Shift: <span className="text-white/70 font-semibold">{shiftInfo.start} – {shiftInfo.end}</span>
                &nbsp;·&nbsp; 55-min sessions {shiftInfo.lunchTime && <>·&nbsp; Lunch at <span className="text-white/70 font-semibold">{shiftInfo.lunchTime}</span></>}
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-t-2 border-[var(--gu-gold)] animate-spin"></div>
                <div className="absolute inset-3 rounded-full border-r-2 border-blue-400/50 animate-spin" style={{animationDirection:'reverse'}}></div>
              </div>
            </div>
          ) : timetableSlots.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/2 p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-5">
                <AlertCircle className="w-8 h-8 text-white/20" />
              </div>
              <h2 className="text-xl font-serif text-white mb-2">No Schedule Found</h2>
              <p className="text-white/35 max-w-sm text-sm leading-relaxed">
                Your timetable is currently empty. This typically occurs because your admin hasn't generated the schedule yet, or you are in an internship semester.
              </p>
            </div>
          ) : (
            <>
              {/* ── Day Tabs (mobile-friendly) ─────────────── */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                {days.map(day => (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                      activeDay === day
                        ? 'bg-[var(--gu-gold)] border-[var(--gu-gold)] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                        : 'bg-white/4 border-white/8 text-white/50 hover:bg-white/8'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>

              {/* ── Main Table ──────────────────────────────── */}
              <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#1e0505]/80 to-[#130303]/80 backdrop-blur-xl overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[750px]">
                    <thead>
                      <tr className="border-b border-white/6">
                        <th className="p-4 w-28">
                          <div className="flex flex-col items-center gap-1">
                            <Clock className="w-4 h-4 text-white/30" />
                            <span className="text-white/40 text-[9px] uppercase tracking-widest font-black">Time</span>
                          </div>
                        </th>
                        {days.map(day => (
                          <th key={day} className={`p-3 text-center border-l border-white/5 transition-colors ${activeDay === day ? 'bg-[var(--gu-gold)]/5' : ''}`}>
                            <span className={`text-[10px] uppercase tracking-widest font-black ${activeDay === day ? 'text-[var(--gu-gold)]' : 'text-white/40'}`}>
                              {day.slice(0, 3)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {timeSlots.map((slot, idx) => (
                        <tr key={idx} className="hover:bg-white/2 transition-colors">
                          {/* Time Column */}
                          <td className="p-3 border-r border-white/5">
                            {slot.label === "LUNCH" ? (
                              <div className="text-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--gu-gold)]/60">🍽 Lunch</span>
                                <p className="text-white/25 text-[8px] mt-0.5">{formatTime12(slot.start)}</p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-1">{slot.label}</span>
                                <span className="text-white/70 text-[10px] font-bold">{formatTime12(slot.start)}</span>
                                <span className="text-white/20 text-[8px] block">to {formatTime12(slot.end)}</span>
                              </div>
                            )}
                          </td>

                            {days.map(day => {
                            const cellData = getSlotContent(day, slot.start);
                            const color = cellData ? (subjectColorMap[cellData.subject_code] || SUBJECT_COLORS[0]) : null;
                            const isActiveDay = activeDay === day;
                            const isProxy = cellData?.proxy_info && cellData.proxy_info.status === "Active";
                            const proxyFacultyName = isProxy ? cellData.proxy_info.proxy_faculty_name : null;

                            if (slot.label === "LUNCH") {
                              return (
                                <td key={day} className={`p-2 border-l border-white/5 ${isActiveDay ? 'bg-[var(--gu-gold)]/3' : ''}`}>
                                  <div className="h-10 flex items-center justify-center">
                                    <span className="text-white/10 text-[9px] uppercase tracking-widest">—</span>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={day} className={`p-2 border-l border-white/5 ${isActiveDay ? 'bg-[var(--gu-gold)]/3' : ''}`}>
                                {cellData && color ? (
                                  <div className={`${color.bg} ${color.border} border rounded-xl p-2.5 relative overflow-hidden group hover:scale-[1.02] transition-transform ${isProxy ? "opacity-60" : ""}`}>
                                    {isProxy && (
                                      <div className="absolute inset-0 bg-black/60 rounded-xl z-10 flex flex-col items-center justify-center backdrop-blur-[1px]">
                                        <UserX className="w-5 h-5 text-white/70 mb-1" />
                                        <span className="text-white/80 text-[8px] font-bold uppercase tracking-wider">PROXY</span>
                                        {proxyFacultyName && (
                                          <span className="text-[var(--gu-gold)] text-[7px] mt-0.5">{proxyFacultyName}</span>
                                        )}
                                      </div>
                                    )}
                                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${color.accent} rounded-r`}></div>
                                    <p className={`${color.text} text-[11px] font-bold leading-snug mb-1.5 pl-1.5`}>{cellData.subject_name}</p>
                                    {cellData.subject_code && (
                                      <span className="text-white/25 text-[8px] font-mono bg-white/5 px-1.5 py-0.5 rounded">{cellData.subject_code}</span>
                                    )}
                                    <div className="flex flex-col gap-0.5 mt-1.5 pl-0.5">
                                      {cellData.faculty_name && (
                                        <div className={`${color.text} opacity-60 text-[9px] flex items-center gap-1`}>
                                          <Users className="w-2.5 h-2.5" />
                                          <span className="truncate">{cellData.faculty_name}</span>
                                        </div>
                                      )}
                                      {cellData.room && (
                                        <div className={`${color.text} opacity-60 text-[9px] flex items-center gap-1`}>
                                          <MapPin className="w-2.5 h-2.5" />
                                          <span>{cellData.room}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-[80px] flex items-center justify-center">
                                    <div className="w-1 h-1 rounded-full bg-white/8"></div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Subject Legend ──────────────────────────── */}
              {Object.keys(subjectLegend).length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#1e0505]/80 to-[#130303]/80 backdrop-blur-xl p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <BookOpen className="w-5 h-5 text-[var(--gu-gold)]" />
                    <h3 className="text-white font-bold">Subject Legend</h3>
                    <span className="text-white/30 text-xs ml-1">({Object.keys(subjectLegend).length} subjects)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(subjectLegend).sort((a,b) => a[0].localeCompare(b[0])).map(([code, name]) => {
                      const c = subjectColorMap[code] || SUBJECT_COLORS[0];
                      return (
                        <div key={code} className={`flex items-center gap-3 ${c.bg} ${c.border} border rounded-xl px-4 py-3`}>
                          <span className={`text-[10px] font-mono font-black ${c.text} bg-white/5 px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0`}>{code}</span>
                          <span className="text-white/65 text-xs leading-snug">{name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentTimetable;
