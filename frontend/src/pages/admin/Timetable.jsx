import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Users,
  BookOpen,
  MapPin,
  Filter,
  Loader2,
  FileDown,
  Info,
  Download,
  UserX
} from "lucide-react";
import { academicsAPI, adminAPI } from "../../services/api";


// Helper: Convert 24h time string "HH:MM" to 12h format "H:MM AM/PM"
const formatTime12 = (time24) => {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

const normalizeCourseToken = (value) => (value || "").replace(/\s+/g, "").toUpperCase();

const formatCourseLabel = (course) => {
  const name = (course?.name || "").trim();
  const code = (course?.code || "").trim();

  if (!name) return code;
  if (!code) return name;

  const normalizedName = normalizeCourseToken(name);
  const normalizedCode = normalizeCourseToken(code);

  if (
    normalizedName === normalizedCode ||
    normalizedName.includes(`(${normalizedCode})`) ||
    normalizedName.endsWith(normalizedCode)
  ) {
    return name;
  }

  return `${name} (${code})`;
};

const Timetable = () => {
  const [courses, setCourses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("1");
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [courseShift, setCourseShift] = useState("NOON");
  const [courseSemesters, setCourseSemesters] = useState({});
  const [selectedSection, setSelectedSection] = useState("A");
  
  // GANPAT DCS Timetable Slots - Morning Shift (BTECH + Masters)
  const morningSlots = [
    { label: "Slot 1", start: "08:00", end: "08:55" },
    { label: "Slot 2", start: "08:55", end: "09:40" },
    { label: "BREAK", start: "09:40", end: "10:15" },
    { label: "Slot 3", start: "10:15", end: "11:10" },
    { label: "Slot 4", start: "11:10", end: "12:00" },
    { label: "Slot 5", start: "12:00", end: "12:55" },
  ];
  
  // GANPAT DCS Timetable Slots - Noon Shift (BCA + BSc)
  const noonSlots = [
    { label: "Slot 1", start: "12:00", end: "12:55" },
    { label: "BREAK", start: "12:55", end: "13:25" },
    { label: "Slot 2", start: "13:25", end: "14:20" },
    { label: "LUNCH", start: "14:20", end: "15:15" },
    { label: "Slot 3", start: "15:15", end: "16:10" },
    { label: "TEA", start: "16:10", end: "16:30" },
    { label: "Slot 4", start: "16:30", end: "17:20" },
    { label: "Slot 5", start: "17:20", end: "18:10" },
  ];
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pdfGenerating, setPDFGenerating] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Slot selection for adding
  const [activeSlot, setActiveSlot] = useState(null); // { day, slotIndex }
  const [formData, setFormData] = useState({
    subject: "",
    faculty: "",
    room: ""
  });

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cRes, fRes, roomsRes] = await Promise.all([
          academicsAPI.courses(),
          adminAPI.faculty(),
          academicsAPI.rooms()
        ]);
        setCourses(cRes.data);
        const semMap = {};
        cRes.data.forEach(c => {
          semMap[c.course_id] = c.total_semesters || 6;
        });
        setCourseSemesters(semMap);
        setFaculty(fRes.data);
        setRooms(roomsRes.data);
      } catch (err) {
        console.error("Error fetching initial data", err);
      }
    };
    fetchData();
  }, []);

  // Auto-load timetable when course or semester changes
  useEffect(() => {
    if (selectedCourse && selectedSemester) {
      fetchSubjects();
      fetchTimetable();
      // Set shift based on selected course
      const course = courses.find(c => c.course_id === selectedCourse);
      if (course) {
        setCourseShift(course.shift || "NOON");
      }
    }
  }, [selectedCourse, selectedSemester, selectedSection, courses.length]);

  const fetchSubjects = async () => {
    try {
      const res = await academicsAPI.subjects({
        course_id: selectedCourse,
        semester: selectedSemester
      });
      setSubjects(res.data);
    } catch (err) {
      console.error("Error fetching subjects", err);
    }
  };
  const [timetableGenerated, setTimetableGenerated] = useState(false);

  // Fetch semester config on mount to check timetable flag
  useEffect(() => {
    const fetchSemConfig = async () => {
      try {
        const res = await adminAPI.semesterConfig();
        setTimetableGenerated(res.data.timetable_generated || false);
      } catch (err) {
        console.warn("Could not fetch semester config", err);
      }
    };
    fetchSemConfig();
  }, []);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const res = await academicsAPI.timetable({
        course_id: selectedCourse,
        semester: selectedSemester,
        section: selectedSection === "All" ? null : selectedSection,
      });
      setTimetableSlots(res.data || []);
    } catch (err) {
      console.error("Error fetching timetable", err);
      setTimetableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTimetable = async () => {
    if (timetableGenerated) {
      alert("Timetable has already been generated for this semester. It will be re-enabled after the next Semester Config toggle.");
      return;
    }
    if (!window.confirm("Initialize AI Timetable Generator? This will clear unstructured slots and automatically allocate an optimal class schedule without clashes.")) return;
    setGeneratingAI(true);
    try {
      const res = await academicsAPI.generateTimetable("Ahmedabad", true);
      alert(res.data.message || "AI Timetable Generation Successful!");
      setTimetableGenerated(true);
      fetchTimetable();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Error generating AI timetable.");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAddSlot = (day, slot) => {
    setActiveSlot({ day, slot });
    setShowModal(true);
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm("Are you sure you want to remove this class from the timetable?")) return;
    try {
      await academicsAPI.deleteTimetableSlot(slotId);
      fetchTimetable();
    } catch (err) {
      alert("Error deleting slot");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.faculty || !formData.room) {
      alert("Please fill all fields");
      return;
    }

    const payload = {
      course: selectedCourse,
      semester: parseInt(selectedSemester),
      day_of_week: activeSlot.day,
      start_time: activeSlot.slot.start,
      end_time: activeSlot.slot.end,
      subject: formData.subject,
      faculty: formData.faculty,
      room_id: formData.room,
      section: selectedSection === "All" ? "A" : selectedSection
    };

    try {
      await academicsAPI.createTimetableSlot(payload);
      setShowModal(false);
      setFormData({ subject: "", faculty: "", room: "" });
      fetchTimetable();
    } catch (err) {
      alert(err.response?.data?.error || "Error creating slot. Check for clashing schedules.");
    }
  };

  const getSlotContent = (day, startTime) => {
    // Normalize time string from DB (e.g., "13:25:00" to "13:25")
    return timetableSlots.find(s =>
      s.day_of_week === day &&
      s.start_time.substring(0, 5) === startTime
    );
  };

  // ONE-CLICK PDF Download Handler
  const handleDownloadPDF = async () => {
    if (!selectedCourse || !selectedSemester) {
      alert("Please select a course and semester first.");
      return;
    }
    setPDFGenerating(true);
    try {
      const selectedCourseObj = courses.find(c => c.course_id === selectedCourse);
      const courseCode = selectedCourseObj?.code || null;
      const sem = selectedSemester ? parseInt(selectedSemester) : null;
      
      const response = await academicsAPI.generateTimetablePDF(courseCode, sem);
      
      // Check if response is actually a PDF
      const contentType = response.headers?.['content-type'];
      if (contentType && !contentType.includes('pdf')) {
        throw new Error(response.data?.error || "Server returned non-PDF response");
      }
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const filename = selectedCourseObj 
        ? `timetable_${selectedCourseObj.code}_S${sem}.pdf` 
        : `timetable_all_courses.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation error:", err);
      const errorMsg = err.response?.data?.error || err.message || "Unknown error";
      alert(`Failed to generate PDF: ${errorMsg}`);
    } finally {
      setPDFGenerating(false);
    }
  };

  // Get current time slots based on shift
  const currentSlots = courseShift === "MORNING" ? morningSlots : noonSlots;
  const shiftLabel = courseShift === "MORNING" 
    ? `Morning Shift (${formatTime12("08:00")} - ${formatTime12("13:00")})` 
    : `Noon Shift (${formatTime12("12:00")} - ${formatTime12("18:10")})`;
  const saturdayActiveLabels =
    courseShift === "MORNING"
      ? new Set(["Slot 1", "Slot 2", "BREAK", "Slot 3"])
      : new Set(["Slot 1", "BREAK", "Slot 2", "LUNCH", "Slot 3"]);
  const isSaturdayOpenSlot = (slotLabel) => saturdayActiveLabels.has(slotLabel);

  // Build subject legend from timetable data
  const subjectLegend = {};
  timetableSlots.forEach(slot => {
    if (slot.subject_code && slot.subject_name) {
      subjectLegend[slot.subject_code] = slot.subject_name;
    }
  });

  return (
    <AdminLayout>
      <div className="relative">
        <div className="fixed inset-0 z-0" style={{ backgroundImage: "url(/maxresdefault.jpg)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", opacity: 0.3 }}></div>
        <div className="animate-fade-in relative z-10">
          <div className="border-b border-[var(--gu-gold)] pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                  <h1 className="font-serif text-3xl text-white mb-2">Schedule Management</h1>
                  <p className="text-[var(--gu-gold)] text-sm uppercase tracking-wider font-semibold flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Manage Timetables — Ganpat University
                  </p>
              </div>
          </div>

          <div className="bg-black/40 p-5 border border-[var(--gu-gold)]/20 rounded-md mb-6 flex flex-wrap items-end gap-6 shadow-md backdrop-blur-sm">
            <div className="flex-1 min-w-[250px] space-y-2">
              <label className="block text-[var(--gu-gold)] text-xs font-bold uppercase tracking-wider">Program Selection</label>
              <select
                value={selectedCourse}
                onChange={(e) => { setSelectedCourse(e.target.value); setSelectedSemester("1"); }}
                className="w-full bg-[#2a0808] border border-[var(--gu-gold)]/30 text-white px-4 py-2.5 rounded text-sm focus:border-[var(--gu-gold)] outline-none transition-all cursor-pointer shadow-inner"
              >
                <option value="">Select Academic Track</option>
                {courses.map(c => (
                  <option key={c.course_id} value={c.course_id}>
                    {formatCourseLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-48 space-y-2">
              <label className="block text-[var(--gu-gold)] text-xs font-bold uppercase tracking-wider">Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="bg-[rgba(212,175,55,0.05)] text-white border border-[var(--gu-gold)]/40 px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gu-gold)]"
              >
                {[...Array(courseSemesters[selectedCourse] || 6)].map((_, i) => i + 1).map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-[rgba(212,175,55,0.05)] text-white border border-[var(--gu-gold)]/40 px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gu-gold)]"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="All">All Sections</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
              <div className="relative group">
                <button
                  onClick={handleGenerateTimetable}
                  disabled={generatingAI || timetableGenerated}
                  className={`px-6 py-2.5 rounded text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(212,175,55,0.2)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border ${
                    timetableGenerated
                      ? 'bg-white/5 border-white/10 text-white/30'
                      : 'bg-black border-[var(--gu-gold)] text-[var(--gu-gold)] hover:bg-[var(--gu-gold)] hover:text-black'
                  }`}
                >
                  {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : timetableGenerated ? '🔒' : '✨'}
                  {timetableGenerated ? 'Already Generated' : 'AI Auto-Generate'}
                </button>
                {timetableGenerated && (
                  <div className="absolute left-0 top-full mt-2 bg-[#2D0A0A] border border-amber-500/20 text-amber-300 text-[9px] uppercase tracking-widest font-bold px-4 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                    Re-enabled after Semester Config toggle
                  </div>
                )}
              </div>

              <button
                onClick={fetchTimetable}
                className="bg-[var(--gu-gold)] text-[var(--gu-red-deep)] px-6 py-2.5 rounded text-xs font-black uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-md flex items-center gap-2"
              >
                <Loader2 className={`w-4 h-4 ${loading && !generatingAI ? 'animate-spin inline-block' : 'hidden'}`} />
                Sync Matrix
              </button>
              
              <button
                onClick={handleDownloadPDF}
                disabled={pdfGenerating || !selectedCourse}
                className="bg-[rgba(212,175,55,0.1)] border border-[var(--gu-gold)] text-[var(--gu-gold)] px-6 py-2.5 rounded text-xs font-black uppercase tracking-widest hover:bg-[rgba(212,175,55,0.2)] transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export PDF
              </button>
            </div>
          </div>

          {!selectedCourse ? (
            <div className="flex flex-col items-center justify-center p-16 bg-black/30 border border-dashed border-[var(--gu-gold)]/30 rounded-md backdrop-blur-sm">
                <Calendar className="w-12 h-12 text-[var(--gu-gold)]/40 mb-4" />
                <h2 className="text-xl text-white font-serif mb-2">No Program Selected</h2>
                <p className="text-white/50 text-sm max-w-md text-center">
                    Please select a program and semester from the filters above to view and manage the timetable.
                </p>
            </div>
          ) : (
            <>
              <div className="bg-black/40 p-4 border-l-4 border-[var(--gu-gold)] mb-6 flex items-start gap-3 rounded-md backdrop-blur-sm">
                  <Info className="w-5 h-5 text-[var(--gu-gold)] flex-shrink-0 mt-0.5" />
                  <div>
                      <p className="text-white text-sm font-bold flex items-center gap-2">
                        {courseShift} Configuration
                        <span className="bg-[var(--gu-gold)]/20 text-[var(--gu-gold)] text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">{selectedSemester}</span>
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                          Program: {formatCourseLabel(courses.find(c => c.course_id === selectedCourse))} · {shiftLabel}
                      </p>
                  </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--gu-gold)]"></div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="overflow-x-auto bg-[var(--gu-red-card)] border border-[var(--gu-gold)]/40 shadow-xl rounded-md">
                      <table className="w-full border-collapse">
                          <thead>
                              <tr className="bg-gradient-to-b from-[#3D0F0F] to-[#2a0808] border-b-2 border-[var(--gu-gold)]/40">
                                  <th className="p-4 text-left font-serif border-r border-[var(--gu-gold)]/20 w-32">
                                      <div className="flex flex-col items-center gap-1">
                                          <Clock className="w-4 h-4 text-[var(--gu-gold)]" />
                                          <span className="text-[var(--gu-gold)] text-[10px] uppercase tracking-widest">Timing</span>
                                      </div>
                                  </th>
                                  {days.map(day => (
                                      <th key={day} className="p-3 text-center font-serif min-w-[150px] border-r border-[var(--gu-gold)]/20 last:border-0">
                                          <span className="text-white text-sm font-bold">{day}</span>
                                      </th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody>
                              {currentSlots.map((slot, idx) => {
                                  const isBreak = slot.label === "BREAK" || slot.label === "TEA" || slot.label === "LUNCH";
                                  
                                  if (isBreak) {
                                      return (
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
                                                  const isSatOff = day === "Saturday" && !isSaturdayOpenSlot(slot.label);
                                                  if (isSatOff) {
                                                      return <td key={day} className="p-3 text-center border-r border-[var(--gu-gold)]/10 last:border-0 bg-black/40"></td>;
                                                  }
                                                  return (
                                                      <td key={day} className="p-3 text-center bg-gradient-to-r from-[rgba(212,175,55,0.03)] to-transparent border-r border-[var(--gu-gold)]/10 last:border-0">
                                                          <div className="flex flex-col items-center">
                                                              <span className="text-[var(--gu-gold)]/40 text-[10px] uppercase font-black tracking-[0.3em] opacity-30">
                                                                  {slot.label === "LUNCH" ? "🍽️ LUNCH" : slot.label === "BREAK" ? "☕ BREAK" : "☕ TEA"}
                                                              </span>
                                                              <span className="text-white/20 text-[8px] mt-0.5">{formatTime12(slot.start)} – {formatTime12(slot.end)}</span>
                                                          </div>
                                                      </td>
                                                  );
                                              })}
                                          </tr>
                                      );
                                  }

                                  return (
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
                                              const isSatOff = day === "Saturday" && !isSaturdayOpenSlot(slot.label);
                                              if (isSatOff) {
                                                  return (
                                                    <td key={day} className="p-1.5 border-r border-[var(--gu-gold)]/10 last:border-0 bg-black/40">
                                                        <div className="h-[76px] w-full flex items-center justify-center opacity-20">
                                                            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Closed</span>
                                                        </div>
                                                    </td>
                                                  );
                                              }

                                              const data = getSlotContent(day, slot.start);
                                              const isProxy = data?.proxy_info && data.proxy_info.status === "Active";
                                              const proxyInfo = isProxy ? data.proxy_info : null;

                                              return (
                                                  <td key={day} className="p-1.5 border-r border-[var(--gu-gold)]/10 last:border-0">
                                                      {data ? (
                                                          <div className={`bg-gradient-to-br from-black/50 to-black/20 border-l-[3px] border-l-[var(--gu-gold)] border border-white/5 p-2.5 rounded-md transition-all duration-200 shadow-md relative group/card ${isProxy ? "opacity-70" : "hover:border-[var(--gu-gold)]/30"}`}>
                                                              {/* Proxy overlay */}
                                                              {isProxy && (
                                                                  <div className="absolute inset-0 bg-black/65 rounded-md z-10 flex flex-col items-center justify-center backdrop-blur-[1px] gap-0.5">
                                                                      <UserX className="w-5 h-5 text-white/70" />
                                                                      <span className="text-white/90 text-[9px] font-black uppercase tracking-widest">PROXY</span>
                                                                      {proxyInfo.proxy_faculty_name && (
                                                                          <span className="text-[var(--gu-gold)] text-[8px] font-bold">{proxyInfo.proxy_faculty_name}</span>
                                                                      )}
                                                                      {proxyInfo.reason && (
                                                                          <span className="text-white/40 text-[7px] text-center px-1 leading-tight">{proxyInfo.reason}</span>
                                                                      )}
                                                                  </div>
                                                              )}
                                                              <div className="text-white text-[11px] font-bold mb-1 leading-tight pr-6">{data.subject_name}</div>
                                                              {data.subject_code && (
                                                                  <div className="text-white/30 text-[8px] font-mono mb-1 bg-white/5 inline-block px-1.5 py-0.5 rounded">{data.subject_code}</div>
                                                              )}
                                                              <div className="text-white/55 text-[10px] flex items-center mb-0.5 mt-0.5">
                                                                  <Users className="w-3 h-3 mr-1 opacity-50 flex-shrink-0" /> <span className="truncate">{data.faculty_name}</span>
                                                              </div>
                                                              <div className="text-white/55 text-[10px] flex items-center">
                                                                  <MapPin className="w-3 h-3 mr-1 opacity-50 flex-shrink-0" /> {data.room}
                                                              </div>
                                                              
                                                              {/* Delete Action Overlay */}
                                                              {!isProxy && (
                                                                  <button
                                                                    onClick={() => handleDeleteSlot(data.slot_id)}
                                                                    className="absolute top-1 right-1 p-1 bg-red-500/10 text-red-500/60 rounded border border-red-500/20 opacity-0 group-hover/card:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                                                                    title="Remove Schedule"
                                                                  >
                                                                    <Trash2 className="w-3 h-3" />
                                                                  </button>
                                                              )}
                                                          </div>
                                                      ) : (
                                                          <button
                                                            onClick={() => handleAddSlot(day, slot)}
                                                            className="h-[76px] w-full border border-dashed border-[var(--gu-gold)]/20 rounded-md flex flex-col items-center justify-center gap-1 hover:bg-[var(--gu-gold)]/5 hover:border-[var(--gu-gold)]/50 transition-all group/add"
                                                          >
                                                              <Plus className="w-4 h-4 text-[var(--gu-gold)]/40 group-hover/add:text-[var(--gu-gold)] transition-colors" />
                                                              <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--gu-gold)]/40 group-hover/add:text-[var(--gu-gold)] transition-colors">Assign</span>
                                                          </button>
                                                      )}
                                                  </td>
                                              );
                                          })}
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>

                  {/* Subject Legend */}
                  {Object.keys(subjectLegend).length > 0 && (
                      <div className="bg-black/30 border border-[var(--gu-gold)]/20 rounded-md p-5 backdrop-blur-sm">
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
                </div>
              )}
            </>
          )}

          {/* Action Modals */}
          {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#1A0505] border border-[var(--gu-gold)]/30 w-full max-w-md rounded-lg shadow-2xl relative overflow-hidden">
                 <div className="bg-gradient-to-r from-[var(--gu-red-deep)] to-[#2a0808] p-5 border-b border-[var(--gu-gold)]/20 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-serif text-white tracking-wide">Assign Class Schedule</h3>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gu-gold)]/80 mt-1">
                          {activeSlot?.day} · {formatTime12(activeSlot?.slot?.start)} to {formatTime12(activeSlot?.slot?.end)}
                        </p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-md">
                      <Plus className="w-5 h-5 rotate-45" />
                    </button>
                 </div>

                 <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                          <label className="block text-white text-xs font-bold mb-1.5 uppercase tracking-wider">Subject</label>
                          <select
                            required
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full bg-black/50 border border-[var(--gu-gold)]/20 text-white px-3 py-2.5 rounded text-sm focus:border-[var(--gu-gold)]/60 outline-none transition-all"
                          >
                            <option value="">Select Subject</option>
                            {subjects.map(s => (
                              <option key={s.subject_id} value={s.subject_id}>{s.name} ({s.code})</option>
                            ))}
                          </select>
                      </div>

                      <div>
                          <label className="block text-white text-xs font-bold mb-1.5 uppercase tracking-wider">Faculty Member</label>
                          <select
                            required
                            value={formData.faculty}
                            onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                            className="w-full bg-black/50 border border-[var(--gu-gold)]/20 text-white px-3 py-2.5 rounded text-sm focus:border-[var(--gu-gold)]/60 outline-none transition-all"
                          >
                            <option value="">Select Faculty</option>
                            {faculty.map(f => (
                              <option key={f.faculty_id} value={f.faculty_id}>{f.name}</option>
                            ))}
                          </select>
                      </div>

                      <div>
                          <label className="block text-white text-xs font-bold mb-1.5 uppercase tracking-wider">Classroom Allocation</label>
                          <select
                            required
                            value={formData.room}
                            onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                            className="w-full bg-black/50 border border-[var(--gu-gold)]/20 text-white px-3 py-2.5 rounded text-sm focus:border-[var(--gu-gold)]/60 outline-none transition-all"
                          >
                            <option value="">Select Room</option>
                            {rooms
                              .filter(r => courseShift === "MORNING" ? (r.room_number.startsWith('C-') || r.room_number.includes('Lab')) : (r.room_number.startsWith('A-') || r.room_number.includes('Lab')))
                              .map(r => {
                                const isUsed = timetableSlots.some(s => s.room === r.room_number && s.day_of_week === activeSlot?.day && (s.start_time || "").substring(0, 5) === (activeSlot?.slot?.start || ""));
                                return (
                                  <option key={r.room_id} value={r.room_id} disabled={isUsed}>
                                    {r.room_number} {isUsed ? '(Occupied)' : ''}
                                  </option>
                                );
                              })
                            }
                          </select>
                      </div>

                      <div className="pt-4 flex gap-3">
                         <button
                           type="button"
                           onClick={() => setShowModal(false)}
                           className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-white border border-white/20 rounded hover:bg-white/5 transition-all"
                         >
                           Cancel
                         </button>
                         <button
                           type="submit"
                           className="flex-1 bg-[var(--gu-gold)] text-black py-2.5 rounded text-xs font-bold uppercase tracking-wider hover:bg-yellow-500 transition-all shadow-md"
                         >
                           Save Assignment
                         </button>
                      </div>
                    </form>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Timetable;
