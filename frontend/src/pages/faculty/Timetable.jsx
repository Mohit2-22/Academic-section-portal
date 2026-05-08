import React, { useState, useEffect } from "react";
import FacultyLayout from "../../components/FacultyLayout";
import {
    Calendar,
    Clock,
    Users,
    BookOpen,
    MapPin,
    Download,
    AlertCircle,
    X,
    Plus,
    CheckCircle,
    UserX
} from "lucide-react";
import { facultyAPI } from "../../services/api";

const formatTime12 = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

const REASONS = [
    "Sick leave",
    "Weekend leave",
    "Conference",
    "Medical appointment",
    "Family emergency",
    "Official duty",
    "Other",
];

const FacultyTimetable = () => {
    const [timetableSlots, setTimetableSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [proxyModal, setProxyModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [proxyReason, setProxyReason] = useState("");
    const [customReason, setCustomReason] = useState("");
    const [proxySubmitting, setProxySubmitting] = useState(false);
    const [toast, setToast] = useState(null);

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
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchTimetable = async () => {
        setLoading(true);
        try {
            const res = await facultyAPI.timetable();
            setTimetableSlots(res.data);
        } catch (err) {
            console.error("Error fetching faculty timetable", err);
        } finally {
            setLoading(false);
        }
    };

    const getSlotContent = (day, startTime) => {
        return timetableSlots.find(s =>
            s.day_of_week === day &&
            s.start_time && s.start_time.substring(0, 5) === startTime
        );
    };

    const handleMarkProxy = async () => {
        if (!selectedSlot || (!proxyReason && !customReason)) return;
        setProxySubmitting(true);
        try {
            const reason = proxyReason === "Other" ? customReason : proxyReason;
            await facultyAPI.markProxy({
                slot_id: selectedSlot.slot_id,
                reason,
            });
            setToast({ type: "success", message: "Proxy marked successfully" });
            setProxyModal(false);
            setSelectedSlot(null);
            setProxyReason("");
            setCustomReason("");
            fetchTimetable();
        } catch (err) {
            setToast({ type: "error", message: err.response?.data?.error || "Failed to mark proxy" });
        } finally {
            setProxySubmitting(false);
        }
    };

    const handleCancelProxy = async (proxyId) => {
        try {
            await facultyAPI.cancelProxy(proxyId);
            setToast({ type: "success", message: "Proxy cancelled" });
            fetchTimetable();
        } catch (err) {
            setToast({ type: "error", message: err.response?.data?.error || "Failed to cancel proxy" });
        }
    };

    const subjectLegend = {};
    timetableSlots.forEach(slot => {
        if (slot.subject_code && slot.subject_name) {
            subjectLegend[slot.subject_code] = slot.subject_name;
        }
    });

    return (
        <FacultyLayout>
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border text-xs font-bold animate-fade-in ${
                    toast.type === "success"
                        ? "bg-emerald-900/90 border-emerald-500/30 text-emerald-200"
                        : "bg-red-900/90 border-red-500/30 text-red-200"
                }`}>
                    {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.message}
                </div>
            )}

            <div className="animate-fade-in">
                <div className="border-b border-[var(--gu-gold)] pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-serif text-3xl text-white mb-2">Personal Teaching Schedule</h1>
                        <p className="text-[var(--gu-gold)] text-sm flex items-center uppercase tracking-wider font-semibold">
                            <Calendar className="w-4 h-4 mr-2" />
                            Weekly recurring timetable for assigned subjects
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => window.print()}
                            className="bg-[rgba(212,175,55,0.1)] border border-[var(--gu-gold)] text-[var(--gu-gold)] px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[rgba(212,175,55,0.2)] transition-colors flex items-center gap-2 flex-shrink-0 rounded-md"
                        >
                            <Download className="w-4 h-4" /> Export Schedule
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--gu-gold)]"></div>
                    </div>
                ) : timetableSlots.length === 0 ? (
                    <div className="rounded-2xl border border-white/8 bg-white/2 p-16 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-5">
                            <Calendar className="w-8 h-8 text-white/20" />
                        </div>
                        <h2 className="text-xl font-serif text-white mb-2">No Schedule Assigned</h2>
                        <p className="text-white/35 max-w-sm text-sm leading-relaxed">
                            You don't have any classes scheduled yet. Contact your admin to get assigned to subjects.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto bg-[var(--gu-red-card)] border border-[var(--gu-gold)]/40 rounded-md shadow-xl">
                            <table className="w-full border-collapse" id="faculty-timetable-print">
                                <thead>
                                    <tr className="bg-gradient-to-b from-[#3D0F0F] to-[#2a0808] border-b-2 border-[var(--gu-gold)]/40">
                                        <th className="p-4 text-left font-serif border-r border-[var(--gu-gold)]/20 w-32">
                                            <div className="flex flex-col items-center gap-1">
                                                <Clock className="w-4 h-4 text-[var(--gu-gold)]" />
                                                <span className="text-[var(--gu-gold)] text-[10px] uppercase tracking-widest">Time</span>
                                            </div>
                                        </th>
                                        {days.map(day => (
                                            <th key={day} className="p-3 text-center font-serif min-w-[130px] border-r border-[var(--gu-gold)]/20 last:border-0">
                                                <span className="text-white text-sm font-bold">{day}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map((slot, idx) => (
                                        <tr key={idx} className="border-b border-[var(--gu-gold)]/10 last:border-0 hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                                            <td className="bg-gradient-to-b from-[#3D0F0F] to-[#2a0808] p-3 border-r border-[var(--gu-gold)]/20">
                                                <div className="text-white text-xs font-bold flex flex-col items-center gap-0.5">
                                                    <span className="text-[var(--gu-gold)] text-[10px] font-bold uppercase tracking-wider">{slot.label}</span>
                                                    <span className="text-white text-xs font-semibold">{formatTime12(slot.start)}</span>
                                                    <span className="text-white/20 text-[8px]">to</span>
                                                    <span className="text-white/45 text-[10px]">{formatTime12(slot.end)}</span>
                                                </div>
                                            </td>

                                            {days.map(day => {
                                                const data = getSlotContent(day, slot.start);
                                                if (slot.label === "LUNCH") {
                                                    return (
                                                        <td key={day} className="p-3 text-center bg-gradient-to-r from-[rgba(212,175,55,0.03)] to-transparent border-r border-[var(--gu-gold)]/10 last:border-0">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[var(--gu-gold)] text-[10px] uppercase font-bold tracking-[0.2em] opacity-30">BREAK</span>
                                                                <span className="text-white/20 text-[8px] mt-0.5">{formatTime12(slot.start)} – {formatTime12(slot.end)}</span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                const isProxy = data?.proxy_info && data.proxy_info.status === "Active";
                                                const proxyFacultyName = isProxy ? data.proxy_info.proxy_faculty_name : null;

                                                return (
                                                    <td key={day} className="p-1.5 border-r border-[var(--gu-gold)]/10 last:border-0 relative">
                                                        {data ? (
                                                            <div className={`relative bg-gradient-to-br from-black/50 to-black/20 border-l-[3px] border-l-[var(--gu-gold)] border border-white/5 p-2.5 rounded-md hover:border-[var(--gu-gold)]/30 transition-all duration-200 shadow-md ${isProxy ? "opacity-60" : ""}`}>
                                                                {isProxy && (
                                                                    <div className="absolute inset-0 bg-black/60 rounded-md z-10 flex flex-col items-center justify-center backdrop-blur-[1px]">
                                                                        <UserX className="w-6 h-6 text-white/70 mb-1" />
                                                                        <span className="text-white/80 text-[9px] font-bold uppercase tracking-wider">PROXY</span>
                                                                        {proxyFacultyName && (
                                                                            <span className="text-[var(--gu-gold)] text-[8px] mt-0.5">{proxyFacultyName}</span>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleCancelProxy(data.proxy_info.proxy_id)}
                                                                            className="mt-1.5 text-[7px] text-red-300 underline hover:text-red-200"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <div className="text-[var(--gu-gold)] text-[11px] font-bold mb-1 leading-tight">{data.subject_name}</div>
                                                                {data.subject_code && (
                                                                    <div className="text-white/30 text-[8px] font-mono mb-1 bg-white/5 inline-block px-1.5 py-0.5 rounded">{data.subject_code}</div>
                                                                )}
                                                                <div className="text-white/70 text-[10px] font-bold mb-0.5">
                                                                    {data.course_code} — Sem {data.semester}
                                                                </div>
                                                                <div className="text-white/45 text-[9px] mb-0.5">
                                                                    Section {data.section}
                                                                </div>
                                                                <div className="text-white/45 text-[9px] flex items-center">
                                                                    <MapPin className="w-3 h-3 mr-1 flex-shrink-0" /> Room {data.room}
                                                                </div>
                                                                {!isProxy && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedSlot(data);
                                                                            setProxyModal(true);
                                                                        }}
                                                                        className="mt-1.5 w-full flex items-center justify-center gap-1 text-[8px] text-[var(--gu-gold)]/70 bg-[var(--gu-gold)]/5 border border-[var(--gu-gold)]/20 rounded px-2 py-1 hover:bg-[var(--gu-gold)]/15 transition-colors"
                                                                    >
                                                                        <Plus className="w-2.5 h-2.5" /> Mark Proxy
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="h-[80px] w-full flex items-center justify-center">
                                                                <span className="text-white/8 text-[9px] uppercase tracking-widest font-bold">Free</span>
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

                        {Object.keys(subjectLegend).length > 0 && (
                            <div className="mt-6 bg-[var(--gu-red-card)] border border-[var(--gu-gold)]/30 rounded-md p-5 shadow-lg">
                                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--gu-gold)]/15">
                                    <BookOpen className="w-5 h-5 text-[var(--gu-gold)]" />
                                    <h3 className="text-white font-serif text-base">Subject Reference Guide</h3>
                                    <span className="text-white/30 text-xs ml-2">({Object.keys(subjectLegend).length} subjects)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    {Object.entries(subjectLegend)
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([code, fullName]) => (
                                            <div key={code} className="flex items-start gap-3 bg-black/30 border border-white/5 rounded-md px-3 py-2.5 hover:border-[var(--gu-gold)]/20 transition-colors">
                                                <span className="bg-[var(--gu-gold)]/10 text-[var(--gu-gold)] text-[10px] font-mono font-bold px-2 py-1 rounded whitespace-nowrap border border-[var(--gu-gold)]/15">
                                                    {code}
                                                </span>
                                                <span className="text-white/70 text-xs leading-snug">{fullName}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {proxyModal && selectedSlot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#1e0505] border border-[var(--gu-gold)]/30 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-[var(--gu-gold)]/15">
                            <h3 className="text-white font-serif text-lg">Mark Proxy Lecture</h3>
                            <button onClick={() => { setProxyModal(false); setSelectedSlot(null); setProxyReason(""); setCustomReason(""); }} className="text-white/40 hover:text-white/70 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/8">
                                <p className="text-white/80 text-xs font-bold">{selectedSlot.subject_name}</p>
                                <p className="text-white/40 text-[10px] mt-0.5">{selectedSlot.course_code} — Sem {selectedSlot.semester} · {selectedSlot.day_of_week} {formatTime12(selectedSlot.start_time)}</p>
                            </div>
                            <label className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2 block">Reason</label>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {REASONS.map(r => (
                                    <button
                                        key={r}
                                        onClick={() => { setProxyReason(r); if (r !== "Other") setCustomReason(""); }}
                                        className={`text-[10px] font-bold px-3 py-2 rounded-lg border transition-colors ${
                                            proxyReason === r
                                                ? "bg-[var(--gu-gold)]/20 border-[var(--gu-gold)]/40 text-[var(--gu-gold)]"
                                                : "bg-white/3 border-white/8 text-white/50 hover:bg-white/6"
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            {proxyReason === "Other" && (
                                <input
                                    type="text"
                                    placeholder="Enter custom reason..."
                                    value={customReason}
                                    onChange={e => setCustomReason(e.target.value)}
                                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-xs placeholder:text-white/25 focus:border-[var(--gu-gold)]/40 focus:outline-none mb-4"
                                />
                            )}
                            <button
                                onClick={handleMarkProxy}
                                disabled={proxySubmitting || (!proxyReason && !customReason)}
                                className="w-full bg-[var(--gu-gold)] text-black font-bold text-xs uppercase tracking-wider py-3 rounded-xl hover:bg-[var(--gu-gold)]/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {proxySubmitting ? "Submitting..." : "Confirm Proxy"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </FacultyLayout>
    );
};

export default FacultyTimetable;
