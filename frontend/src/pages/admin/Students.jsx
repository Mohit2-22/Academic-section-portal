import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Users, Search, Filter, Plus, Loader, X, AlertTriangle, ChevronRight } from 'lucide-react';
import { adminAPI, academicsAPI } from '../../services/api';

const Students = () => {
    const [students, setStudents] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [courses, setCourses] = useState([]);
    const [courseFilter, setCourseFilter] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('');
    const [rollSearch, setRollSearch] = useState('');

    // Get selected course details
    const selectedCourse = courses.find(c => c.course_id === courseFilter);
    const maxSemesters = selectedCourse?.total_semesters || 8;
    
    // Debug - log filter changes
    useEffect(() => {
        console.log('=== FILTER DEBUG ===');
        console.log('Course filter:', courseFilter);
        console.log('Semester filter:', semesterFilter, 'Type:', typeof semesterFilter);
        console.log('Total students:', allStudents.length);
        
        if (allStudents.length > 0) {
            // Show sample by semester
            const bySem = {};
            allStudents.forEach(s => {
                const sem = s.current_semester || s.semester || 'unknown';
                bySem[sem] = (bySem[sem] || 0) + 1;
            });
            console.log('Students by semester:', bySem);
            
            // Show sample student
            const sample = allStudents[0];
            console.log('Sample student:', {
                enrollment_no: sample.enrollment_no,
                current_semester: sample.current_semester,
                semester: sample.semester,
                course_id: sample.course_id
            });
        }
    }, [courseFilter, semesterFilter, allStudents.length]);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                setLoading(true);
                setError(null);
                try {
                    const coursesRes = await academicsAPI.courses();
                    setCourses(coursesRes.data);
                } catch(err) {
                    console.warn("Failed to fetch courses", err);
                }

                // Fetch all students - no params needed, filtering done on frontend
                const response = await adminAPI.students();
                setAllStudents(response.data || []);
                setStudents(response.data || []);
            } catch (error) {
                console.error("API Connection Failed.", error);
                setError("System failed to sync student directory from the central database.");
                setStudents([]);
                setAllStudents([]);
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, []);

    // Clear semester when course changes
    const handleCourseChange = (courseId) => {
        setCourseFilter(courseId);
        setSemesterFilter(''); // Reset semester when course changes
    };

    // Filter students based on course, semester and roll search
    useEffect(() => {
        const filtered = allStudents.filter(s => {
            // Course filter - strict match
            if (courseFilter) {
                const studentCourseId = s.course_id || (s.course && s.course.course_id);
                if (studentCourseId !== courseFilter) return false;
            }
            
            // Semester filter - convert both to Number for comparison
            if (semesterFilter) {
                const targetSem = Number(semesterFilter);
                const studentCurrentSem = Number(s.current_semester || s.semester);
                if (studentCurrentSem !== targetSem) return false;
            }
            
            // Roll search - exact or partial match
            if (rollSearch) {
                const search = rollSearch.toLowerCase().trim();
                const rollMatch = s.enrollment_no?.toLowerCase().includes(search);
                const nameMatch = s.name?.toLowerCase().includes(search);
                if (!rollMatch && !nameMatch) return false;
            }
            
            return true;
        });
        
        // Sort by roll number - proper numeric sort
        filtered.sort((a, b) => {
            const rollA = a.enrollment_no || '';
            const rollB = b.enrollment_no || '';
            return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        setStudents(filtered);
    }, [allStudents, courseFilter, semesterFilter, rollSearch]);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            role: 'student',
            name: `${formData.get('firstName')} ${formData.get('lastName')}`,
            course_id: formData.get('course'),
            email: formData.get('email'),
            phone: formData.get('phone')
        };
        try {
            await adminAPI.createUser(data);
            alert("Student Successfully Enrolled into System. Credentials sent via Email.");
            setShowAddModal(false);
            // Refresh List
            setLoading(true);
            const response = await adminAPI.students(courseFilter ? { course_id: courseFilter } : {});
            setStudents(response.data);
            setLoading(false);
        } catch(error) {
            alert("Error creating student: " + (error.response?.data?.error || error.message));
        }
    };

    const handleSuspend = async (enrollment_no, userId) => {
        if(window.confirm("Are you sure you want to suspend this student account? All portal access will be revoked immediately.")) {
            try {
                await adminAPI.updateUser(userId, { status: 'Suspended' });
                setStudents(students.map(s => s.enrollment_no === enrollment_no ? { ...s, status: 'Suspended' } : s));
                setSelectedStudent({ ...selectedStudent, status: 'Suspended' });
                alert("Account Suspended.");
            } catch (err) {
                alert("Failed to suspend account");
            }
        }
    };

    const handleActivate = async (enrollment_no, userId) => {
        try {
            await adminAPI.updateUser(userId, { status: 'Active' });
            setStudents(students.map(s => s.enrollment_no === enrollment_no ? { ...s, status: 'Active' } : s));
            setSelectedStudent({ ...selectedStudent, status: 'Active' });
            alert("Account Reactivated.");
        } catch (err) {
            alert("Failed to reactivate account");
        }
    };

    const handleDelete = async (enrollment_no, userId) => {
        if(window.confirm("Are you sure you want to permanently delete this student account? This action cannot be undone.")) {
            try {
                await adminAPI.deleteUser(userId);
                setStudents(students.filter(s => s.enrollment_no !== enrollment_no));
                setAllStudents(allStudents.filter(s => s.enrollment_no !== enrollment_no));
                setSelectedStudent(null);
                alert("Account Deleted.");
            } catch (err) {
                alert("Failed to delete account");
            }
        }
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in max-w-7xl mx-auto space-y-8 relative z-10 px-4">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-[var(--gu-red-deep)]/40 p-8 rounded-2xl border border-[var(--gu-gold)]/10 backdrop-blur-sm shadow-2xl">
                    <div>
                        <h1 className="font-serif text-4xl md:text-5xl text-white mb-2 tracking-tight">
                            Student Lifecycle
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 text-[var(--gu-gold)] text-[10px] uppercase font-black tracking-[0.3em] opacity-80">
                            <span>Admissions</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gu-gold)]/30"></span>
                            <span>Enrollments</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gu-gold)]/30"></span>
                            <span>Global Directory</span>
                        </div>
                    </div>
                    {(() => {
                        const currentMonth = new Date().getMonth() + 1; // 1-indexed
                        const isAdmissionOpen = currentMonth >= 4 && currentMonth <= 6;
                        return (
                            <div className="relative group">
                                <button 
                                    onClick={() => isAdmissionOpen && setShowAddModal(true)}
                                    disabled={!isAdmissionOpen}
                                    className={`relative px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 overflow-hidden ${
                                        isAdmissionOpen
                                            ? 'bg-[var(--gu-gold)] text-black hover:bg-white cursor-pointer'
                                            : 'bg-white/10 text-white/30 cursor-not-allowed border border-white/10'
                                    }`}
                                >
                                    <Plus className="w-4 h-4" /> 
                                    <span className="relative z-10">{isAdmissionOpen ? 'Add Student' : 'Admissions Closed'}</span>
                                    {isAdmissionOpen && <div className="absolute inset-0 bg-white/40 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>}
                                </button>
                                {!isAdmissionOpen && (
                                    <div className="absolute right-0 top-full mt-2 bg-[#2D0A0A] border border-amber-500/20 text-amber-300 text-[9px] uppercase tracking-widest font-bold px-4 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                                        Admission Window: April 1 - June 1
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Intelligent Filters Console */}
                <div className="glass-panel p-8 rounded-2xl animate-reveal-down">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        {/* Search Input */}
                        <div className="md:col-span-6 relative">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-3 ml-1">Search Registry</label>
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[var(--gu-gold)] transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Search by Roll No or Name..."
                                    value={rollSearch}
                                    onChange={(e) => setRollSearch(e.target.value)}
                                    className="w-full bg-white/5 border border-white/5 text-white pl-12 pr-6 py-4 rounded-xl text-xs focus:border-[var(--gu-gold)]/50 focus:bg-white/10 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Course Selector */}
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-3 ml-1">Program</label>
                            <select 
                                className="w-full bg-white/5 border border-white/5 text-white px-6 py-4 rounded-xl text-xs focus:border-[var(--gu-gold)]/50 focus:bg-white/10 outline-none appearance-none transition-all"
                                value={courseFilter}
                                onChange={(e) => handleCourseChange(e.target.value)}
                            >
                                <option value="" className="bg-[var(--gu-red-deep)]">All Programs</option>
                                {courses.map(c => (
                                    <option key={c.course_id} value={c.course_id} className="bg-[var(--gu-red-deep)]">
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Semester Selector */}
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-3 ml-1">Phase</label>
                            <select 
                                className="w-full bg-white/5 border border-white/5 text-white px-6 py-4 rounded-xl text-xs focus:border-[var(--gu-gold)]/50 focus:bg-white/10 outline-none appearance-none disabled:opacity-20 transition-all"
                                value={semesterFilter}
                                onChange={(e) => setSemesterFilter(e.target.value)}
                                disabled={!courseFilter}
                            >
                                <option value="" className="bg-[var(--gu-red-deep)]">Core Stage</option>
                                {Array.from({ length: maxSemesters }, (_, i) => i + 1).map(sem => (
                                    <option key={sem} value={sem} className="bg-[var(--gu-red-deep)]">Sem {sem}</option>
                                ))}
                            </select>
                        </div>

                        {/* Clear Action */}
                        {(courseFilter || semesterFilter || rollSearch) && (
                            <div className="md:col-span-1">
                                <button 
                                    onClick={() => { setCourseFilter(''); setSemesterFilter(''); setRollSearch(''); }}
                                    className="w-full h-[52px] flex items-center justify-center text-white/40 hover:text-white transition-colors"
                                    title="Reset Filters"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dashboard Metrics Bar */}
                <div className="flex justify-between items-center px-2 animate-fade-in">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                        Synchronized Records: <span className="text-[var(--gu-gold)]">{students.length}</span> <span className="mx-2">/</span> Total Capacity: {allStudents.length}
                    </p>
                </div>

                {/* Registry Table */}
                <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 shadow-2xl animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5">
                                    {['Roll ID', 'Identity', 'Contact Phase', 'Module Mapping', 'Status', 'Operations'].map((head, i) => (
                                        <th key={i} className={`py-6 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ${head === 'Operations' ? 'text-right' : ''}`}>
                                            {head}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="py-20 text-center">
                                            <div className="inline-flex flex-col items-center gap-4">
                                                <Loader className="w-8 h-8 animate-spin text-[var(--gu-gold)]" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Accessing Vault...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : students.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-20 text-center text-white/20 italic font-serif text-xl">No entities matched the search criteria.</td>
                                    </tr>
                                ) : (
                                    students.map((student, i) => (
                                        <tr key={i} className="group hover:bg-white/5 transition-all duration-300">
                                            <td className="py-6 px-8">
                                                <span className="font-mono text-xs text-[var(--gu-gold)] opacity-60 group-hover:opacity-100 transition-opacity">{student.enrollment_no}</span>
                                            </td>
                                            <td className="py-6 px-8">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-sm tracking-tight group-hover:text-[var(--gu-gold)] transition-colors">{student.name}</span>
                                                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">{student.father_name || 'Guardian Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-white/40 text-[10px] font-bold">{student.email || 'No Primary Mail'}</span>
                                                    <span className="text-white/20 text-[9px] font-black uppercase tracking-widest">{student.phone || 'Silent Mode'}</span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-8">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-white font-bold text-xs">{student.course_name?.split(' ')[0] || '-'}</span>
                                                    <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                                    <span className="bg-white/5 text-white/40 text-[9px] font-black px-2 py-1 rounded-full border border-white/5">SEM {student.current_semester || student.semester || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-8">
                                                <span className={`inline-flex items-center px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                                                    student.status === 'Active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 
                                                    student.status === 'Suspended' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                                    'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                                }`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="py-6 px-8 text-right">
                                                <button 
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="inline-flex items-center gap-2 text-[var(--gu-gold)] text-[9px] font-black uppercase tracking-widest hover:text-white border border-[var(--gu-gold)]/20 px-4 py-2 rounded-full transition-all hover:bg-[var(--gu-gold)]/10"
                                                >
                                                    Access Profile <ChevronRight className="w-3 h-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Enrollment Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in">
                    <div className="glass-panel border-white/10 rounded-3xl w-full max-w-4xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-white font-serif text-3xl tracking-tight flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--gu-gold)]/10 flex items-center justify-center">
                                        <Plus className="w-5 h-5 text-[var(--gu-gold)]" />
                                    </div>
                                    Portal Enrollment
                                </h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--gu-gold)] mt-1 opacity-60">System Identity Creation</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:border-white/20 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* Program Context */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-1 h-4 bg-[var(--gu-gold)]"></div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Academic Context</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">Degree Mapping</label>
                                            <select name="course" required className="w-full bg-white/5 border border-white/5 text-white px-5 py-3 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none appearance-none">
                                                <option value="" className="bg-[var(--gu-red-deep)]">Program Selector...</option>
                                                {courses.map(c => (
                                                    <option key={c.course_id} value={c.course_id} className="bg-[var(--gu-red-deep)]">{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">Commencement Date</label>
                                            <input name="admissionDate" required type="date" className="w-full bg-white/5 border border-white/5 text-white px-5 py-3 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Identity Block */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-1 h-4 bg-[var(--gu-gold)]"></div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Primary Identity</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-1">
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">Given Name</label>
                                            <input name="firstName" required type="text" className="w-full bg-white/5 border border-white/5 text-white px-5 py-3 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none" placeholder="First" />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">Surname</label>
                                            <input name="lastName" required type="text" className="w-full bg-white/5 border border-white/5 text-white px-5 py-3 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none" placeholder="Last" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">Guardian Sequence</label>
                                            <input name="parent" required type="text" className="w-full bg-white/5 border border-white/5 text-white px-5 py-3 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none" placeholder="Father/Mother Full Name" />
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Matrix */}
                                <div className="md:col-span-2 space-y-6 pt-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-1 h-4 bg-[var(--gu-gold)]"></div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Neural Reach (Contact)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">System Endpoint (Email)</label>
                                            <input name="email" required type="email" className="w-full bg-white/5 border border-white/5 text-white px-5 py-3 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none" placeholder="student@university.edu" />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">Signal Link (Phone)</label>
                                            <input name="phone" required type="tel" className="w-full bg-white/5 border border-white/5 text-white px-5 py-3 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none" placeholder="+91 XXXX" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">Spatial coordinates (Residential Address)</label>
                                            <textarea name="address" required rows="2" className="w-full bg-white/5 border border-white/5 text-white p-5 rounded-xl text-xs focus:border-[var(--gu-gold)]/30 outline-none resize-none" placeholder="Registered residence details..."></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                        <div className="p-8 border-t border-white/5 bg-white/5 flex gap-4 justify-end">
                             <button type="button" onClick={() => setShowAddModal(false)} className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">Abort Enrollment</button>
                             <button type="submit" onClick={() => document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))} className="bg-[var(--gu-gold)] text-black px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all shadow-[0_0_30px_rgba(212,175,55,0.2)]">Finalize Identity Record</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Management Console */}
            {selectedStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-fade-in">
                    <div className="glass-panel border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative">
                        <div className="h-32 bg-gradient-to-r from-[var(--gu-red-deep)] via-[#7B0D0D] to-[var(--gu-red-dark)] relative overflow-hidden">
                             <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(212,175,55,1) 1px, transparent 0)', backgroundSize: '24px 24px'}}></div>
                             <button onClick={() => setSelectedStudent(null)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all backdrop-blur-md">
                                <X className="w-5 h-5" />
                             </button>
                        </div>
                        <div className="px-10 pb-10">
                            <div className="relative -mt-16 mb-8 flex items-end gap-6">
                                <div className="w-32 h-32 rounded-3xl bg-[var(--gu-red-deep)] border-4 border-[#1A0505] shadow-2xl flex items-center justify-center text-white font-serif text-5xl font-black relative overflow-hidden">
                                     {selectedStudent.name.charAt(0)}
                                     <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--gu-gold)]"></div>
                                </div>
                                <div className="pb-2">
                                    <h2 className="text-white font-serif text-3xl tracking-tight">{selectedStudent.name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--gu-gold)]">{selectedStudent.enrollment_no}</span>
                                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${selectedStudent.status === 'Active' ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'}`}>
                                            {selectedStudent.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                {[
                                    { label: 'Academic Path', val: selectedStudent.course_name || 'General Stream' },
                                    { label: 'Current Phase', val: `Semester ${selectedStudent.current_semester || student.semester}` },
                                    { label: 'Neural Link', val: selectedStudent.email || 'No Sync' },
                                    { label: 'Signal Hub', val: selectedStudent.phone || 'Silent' }
                                ].map((info, i) => (
                                    <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl group hover:bg-white/10 transition-all">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">{info.label}</p>
                                        <p className="text-white text-xs font-bold truncate">{info.val}</p>
                                    </div>
                                ))}
                                <div className="col-span-2 bg-white/5 border border-white/5 p-4 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">Last Traced Origin</p>
                                    <p className="text-white text-xs leading-relaxed italic opacity-80">{selectedStudent.address || 'Location Hidden'}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                {selectedStudent.status === 'Active' ? (
                                    <button 
                                        onClick={() => handleSuspend(selectedStudent.enrollment_no, selectedStudent.user_id)}
                                        className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        Revoke Core Access
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleActivate(selectedStudent.enrollment_no, selectedStudent.user_id)}
                                        className="flex-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
                                    >
                                        Restore Phase Link
                                    </button>
                                )}
                                <button className="flex-1 bg-white/5 text-white/40 border border-white/10 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all">
                                    Modify Core Metadata
                                </button>
                                <button 
                                    onClick={() => handleDelete(selectedStudent.enrollment_no, selectedStudent.user_id)}
                                    className="flex-1 bg-red-900/40 text-red-400 border border-red-500/20 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                                >
                                    Eradicate Entity
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>

    );
};

export default Students;
