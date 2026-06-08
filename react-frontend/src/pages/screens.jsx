import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { saveAs } from 'file-saver';
import { format, formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Editor from '@monaco-editor/react';
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowRight,
  Check,
  CirclePlay,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  Filter,
  GraduationCap,
  LoaderCircle,
  Lock,
  Mail,
  MessageSquare,
  MonitorPlay,
  MoreVertical,
  PenSquare,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Star,
  TimerReset,
  Upload,
  X,
  Users,
  CalendarClock,
  BookOpen,
  BookMarked,
  BookA,
  ChartColumn,
  UserCircle2,
  ClipboardList,
  Building2,
  School2,
  Wallet,
  BadgeDollarSign,
  Link2,
  RefreshCw,
} from 'lucide-react';
import {
  CardScroller,
  ConfirmModal,
  DashboardLayout,
  DataTable,
  EmptyState,
  FloatingInput,
  FloatingSelect,
  FloatingTextarea,
  JitsiModal,
  NotificationBell,
  Pagination,
  PageLoader,
  RoleBadge,
  Section,
  StatCard,
  StatsGrid,
  StatusPill,
  cx,
} from '../components/common';
import { apiRequest } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { adminSeed, admissionSeed, dummyCredentials, facultySeed, inquirySources, quickRoleSwitcher, roleLoginFeatures, roleMeta, sidebarMenus, sortOptions, starterCode, studentSeed, superAdminSeed } from '../config/appConfig';
import useDebounce from '../hooks/useDebounce';
import usePWA from '../hooks/usePWA';

function PageMotion({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="page-transition">
      {children}
    </motion.div>
  );
}

function LoginDecor({ role }) {
  const features = roleLoginFeatures[role] || [];
  const meta = roleMeta[role] || roleMeta.student;
  return (
    <div className="relative flex h-full min-h-[360px] flex-col justify-between overflow-hidden p-8 text-white md:p-10" style={{ background: `linear-gradient(135deg, ${meta.accent} 0%, ${meta.accentDark} 100%)` }}>
      <div className="absolute -left-8 top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl animate-float-soft" />
      <div className="absolute bottom-10 right-12 h-32 w-32 rounded-full bg-white/10 blur-2xl animate-float-soft" />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md">
          <GraduationCap size={18} /> InstitutePulse
        </div>
        <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">EdTech Institute Management System</h1>
        <p className="mt-3 max-w-xl text-sm text-white/80 md:text-base">{meta.title} built for live learning, admissions, analytics, and offline-first student access.</p>
      </div>
      <div className="relative z-10 grid gap-4 md:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div key={feature.title} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1 text-xs text-white/75">{feature.description}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function LoginScreen({ role }) {
  const navigate = useNavigate();
  const meta = roleMeta[role];
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loginSuccess } = useAuthStore();
  const schema = z.object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(6, 'Password is required'),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: dummyCredentials[role],
  });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append('username', values.email);
      form.append('password', values.password);
      const loginRoute = role === 'student' ? '/login' : role === 'faculty' ? '/faculty' : role === 'admin' ? '/admin' : role === 'admission' ? '/admission' : '/superadmin';
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${loginRoute}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        credentials: 'include',
        redirect: 'manual',
      });

      if (!response.ok && response.status !== 302) {
        throw new Error('Invalid credentials');
      }

      const me = await apiRequest('/api/me');
      const session = {
        token: `cookie-${role}`,
        role: me.role || role,
        user: {
          id: me.user_id,
          name: me.username,
          username: me.username,
          email: values.email,
          role: me.role || role,
          profile_id: me.profile_id,
        },
      };
      await loginSuccess(session);
      toast.success(`Welcome back, ${me.username || meta.label}`);
      navigate(`/dashboard/${role === 'admission' ? 'admission' : role}/home`, { replace: true });
    } catch (error) {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      toast.error(error?.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <LoginDecor role={role} />
      <div className="flex items-center justify-center px-4 py-10 md:px-8">
        <div className={cx('portal-card w-full max-w-[440px] p-6 md:p-8', shake && 'animate-shake')}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-white">Welcome Back 👋</h2>
              <p className="mt-2 text-sm text-slate-300">Sign in to continue to the {meta.label} experience.</p>
            </div>
            <RoleBadge role={role} />
          </div>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <FloatingInput label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
            <div className="floating-label-group">
              <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder=" " {...register('password')} className={cx(errors.password?.message && 'border-rose-400/70')} />
              <label>Password</label>
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {errors.password?.message ? <p className="form-error">{errors.password.message}</p> : null}
            </div>
            <div className="flex justify-end">
              <button type="button" className="text-sm text-indigo-300 hover:text-white">Forgot Password?</button>
            </div>
            <button className="btn-primary w-full" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : null}
              {loading ? 'Signing In...' : 'Login'}
            </button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            Switch Role
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {quickRoleSwitcher.map((item) => {
              const Icon = item.icon;
              const isActive = item.role === role;
              return (
                <button key={item.role} type="button" title={item.label} className={cx('btn-secondary h-12 p-0', isActive && 'border-white/30 bg-white/12 text-white')} onClick={() => navigate(item.loginPath)}>
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-slate-400">
            Dummy login credentials are prefilled. Use {dummyCredentials[role].email} / {dummyCredentials[role].password} for testing.
          </p>
        </div>
      </div>
    </div>
  );
}

function InquiryFormPage() {
  const schema = z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().min(10, 'Phone number is required'),
    city: z.string().min(2, 'City is required'),
    course: z.string().min(2, 'Select a course'),
    message: z.string().max(300).optional(),
  });
  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = async (values) => {
    try {
      await apiRequest('/api/student/inquiry', { method: 'POST', data: values });
      toast.success('Inquiry submitted successfully');
      reset();
    } catch {
      toast.success('Inquiry saved locally for demo mode');
    }
  };

  return (
    <PageMotion>
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <Section title="Public Inquiry" subtitle="Submit a quick inquiry to get admission support.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
            <FloatingInput label="Full Name" {...register('name')} error={errors.name?.message} />
            <FloatingInput label="Email" type="email" {...register('email')} error={errors.email?.message} />
            <FloatingInput label="Phone" {...register('phone')} error={errors.phone?.message} />
            <FloatingInput label="City" {...register('city')} error={errors.city?.message} />
            <FloatingInput label="Course Interested In" {...register('course')} error={errors.course?.message} />
            <FloatingTextarea label="Message" rows={4} className="md:col-span-2" {...register('message')} error={errors.message?.message} />
            <div className="md:col-span-2">
              <button className="btn-primary" type="submit">Submit Inquiry</button>
            </div>
          </form>
        </Section>
      </div>
    </PageMotion>
  );
}

function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Section title="You're offline" subtitle="Timetable, downloads, certificates, and notification history stay available offline.">
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-slate-300">Reconnect to sync the latest classes, uploads, and announcements.</p>
          <Link className="btn-primary" to="/">
            Go to login
          </Link>
        </div>
      </Section>
    </div>
  );
}

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Section title="404 - Page not found" subtitle="The page you requested does not exist.">
        <button className="btn-primary" type="button" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </Section>
    </div>
  );
}

function usePortalSearch(items, searchKeys = []) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const filtered = useMemo(() => {
    if (!debounced) return items;
    const needle = debounced.toLowerCase();
    return items.filter((item) => searchKeys.some((key) => String(item[key] || '').toLowerCase().includes(needle)));
  }, [items, debounced, searchKeys]);
  return { query, setQuery, filtered };
}

function StudentHome() {
  const { stats, classes } = studentSeed;
  const [countdown, setCountdown] = useState('03:14:22:09');
  useEffect(() => {
    const timer = window.setInterval(() => setCountdown('03:14:22:09'), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <PageMotion>
      <div className="space-y-6">
        <Section title={`Good morning, ${studentSeed.me.name} 👋`} subtitle={format(new Date(), 'EEEE, dd MMMM yyyy')}>
          <CardScroller
            items={classes}
            renderItem={(item) => (
              <div className="portal-card h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">{item.time}</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">{item.subject}</h3>
                    <p className="mt-1 text-sm text-slate-300">{item.faculty}</p>
                  </div>
                  <StatusPill value={item.status} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="badge badge-info">Room {item.room}</span>
                  {item.status === 'Live' ? <button className="btn-primary text-sm" type="button">Join Now</button> : null}
                </div>
              </div>
            )}
          />
        </Section>
        <StatsGrid stats={stats.map((stat) => ({ ...stat, icon: stat.label.includes('Attendance') ? Users : stat.label.includes('Certificates') ? GraduationCap : stat.label.includes('Materials') ? FileDown : MessageSquare }))} />
        <Section title="Quick Actions" subtitle="One tap access to the most-used student workflows.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ['Join Class', MonitorPlay], ['Timetable', CalendarClock], ['Materials', FileDown], ['IDE', BookOpen], ['Certificates', GraduationCap], ['Feedback', MessageSquare],
            ].map(([label, Icon]) => (
              <button key={label} type="button" className="portal-card flex min-h-[118px] flex-col items-start justify-between p-5 text-left">
                <Icon size={22} />
                <span className="text-sm font-medium text-white">{label}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Next Class Countdown" subtitle="Your upcoming lecture starts soon.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-3xl bg-white/5 px-6 py-4 text-2xl font-semibold text-white">{countdown}</div>
            <p className="text-sm text-slate-300">Monitor the countdown for your next live class and join promptly.</p>
          </div>
        </Section>
      </div>
    </PageMotion>
  );
}

function StudentTimetable() {
  const days = studentSeed.timetable;
  return (
    <PageMotion>
      <Section title="Weekly Timetable" subtitle="Week view with live indicators and subject legend.">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {days.map((slot, index) => (
            <div key={slot.day} className={cx('portal-card p-4', index === 1 && 'ring-1 ring-indigo-400/40')}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">{slot.day}</h3>
                <span className="h-3 w-3 rounded-full" style={{ background: slot.color }} />
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-white">{slot.subject}</p>
                <p className="text-sm text-slate-300">{slot.faculty}</p>
                <p className="text-xs text-slate-400">{slot.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </PageMotion>
  );
}

function StudentOnlineClass() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  return (
    <PageMotion>
      <div className="space-y-6">
        <Section title="Today's Classes" subtitle="Join live classes in a full-screen Jitsi modal.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {studentSeed.classes.map((lecture) => (
              <div key={lecture.id} className="portal-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{lecture.subject}</h3>
                    <p className="mt-1 text-sm text-slate-300">{lecture.faculty}</p>
                    <p className="mt-1 text-xs text-slate-400">{lecture.time}</p>
                  </div>
                  <StatusPill value={lecture.status} />
                </div>
                <button className={cx('btn-primary mt-5 w-full', lecture.status !== 'Live' && 'opacity-80')} type="button" disabled={lecture.status === 'Upcoming'} onClick={() => { setSelected(lecture); setOpen(true); }}>
                  {lecture.status === 'Live' ? 'Join Class' : 'Opening Soon'}
                </button>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <JitsiModal open={open} roomName={selected?.room} displayName={studentSeed.me.name} role="student" onClose={() => setOpen(false)} />
    </PageMotion>
  );
}

function StudentMaterials() {
  const [layout, setLayout] = useState('cards');
  const { query, setQuery, filtered } = usePortalSearch(studentSeed.materials, ['name', 'subject', 'type']);
  return (
    <PageMotion>
      <Section title="Study Materials" subtitle="Search, filter, sort, and download materials while keeping an offline cache.">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="floating-label-group">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder=" " />
            <label>Search materials</label>
            <Search size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="flex gap-2">
            <button className={cx('btn-secondary', layout === 'cards' && 'bg-white/12')} onClick={() => setLayout('cards')} type="button">Cards</button>
            <button className={cx('btn-secondary', layout === 'table' && 'bg-white/12')} onClick={() => setLayout('table')} type="button">Table</button>
          </div>
        </div>
        {filtered.length ? (
          layout === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <div key={item.id} className="portal-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="badge badge-info">{item.type.toUpperCase()}</p>
                      <h3 className="mt-3 text-lg font-semibold text-white">{item.name}</h3>
                      <p className="mt-1 text-sm text-slate-300">{item.subject}</p>
                    </div>
                    <FileDown size={18} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>{item.date}</span>
                    <span>{item.size}</span>
                  </div>
                  <button className="btn-primary mt-5 w-full" type="button">Download</button>
                </div>
              ))}
            </div>
          ) : (
            <DataTable columns={[{ key: 'name', label: 'Name' }, { key: 'subject', label: 'Subject' }, { key: 'type', label: 'Type' }, { key: 'date', label: 'Uploaded' }, { key: 'size', label: 'Size' }]} data={filtered} />
          )
        ) : (
          <EmptyState title="No materials uploaded yet" message="When your faculty uploads files, they will appear here for offline access." />
        )}
      </Section>
    </PageMotion>
  );
}

function StudentVideos() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  return (
    <PageMotion>
      <Section title="Video Tutorials" subtitle="Browse uploads by subject and watch them in a modal player.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {studentSeed.videos.map((video) => (
            <button key={video.id} className="portal-card overflow-hidden p-0 text-left" type="button" onClick={() => { setCurrent(video); setOpen(true); }}>
              <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-indigo-500/30 to-cyan-500/20">
                <CirclePlay size={48} />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-white">{video.title}</h3>
                  <span className="badge badge-neutral">{video.duration}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{video.subject}</p>
                <p className="mt-1 text-xs text-slate-400">{video.date}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>
      {open ? (
        <ConfirmModal open={open} title={current?.title || 'Video'} message="Demo playback modal placeholder. Hook it to HTML5 video or YouTube embeds when source URLs are available." confirmLabel="Close" tone="neutral" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
      ) : null}
    </PageMotion>
  );
}

function StudentCertificates() {
  return (
    <PageMotion>
      <Section title="Certificates" subtitle="Downloaded certificates stay available offline after first load.">
        {studentSeed.certificates.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {studentSeed.certificates.map((cert) => (
              <div key={cert.id} className="portal-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{cert.name}</h3>
                    <p className="mt-1 text-sm text-slate-300">Issued on {cert.date}</p>
                  </div>
                  <GraduationCap />
                </div>
                <button className="btn-primary mt-5 w-full" type="button">Download PDF</button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No certificates yet" message="Certificates generated by Admin will appear here." />
        )}
      </Section>
    </PageMotion>
  );
}

function StudentIDE() {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(starterCode.python);
  const [output, setOutput] = useState('');
  useEffect(() => setCode(starterCode[language]), [language]);
  const runCode = () => {
    if (language === 'sql') {
      setOutput('Mock output:\nid | name | grade\n1  | Aarav | A\n2  | Meera | A\n');
      return;
    }
    setOutput(`Execution result for ${language}...\n${code.split('\n').slice(0, 3).join('\n')}`);
    toast.success('Code executed in demo mode');
  };
  return (
    <PageMotion>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Section title="Practice IDE" subtitle="Use starter templates and run code directly in the browser.">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <FloatingSelect label="Language" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="sql">SQL</option>
            </FloatingSelect>
            <button className="btn-primary" type="button" onClick={runCode}>Run Code</button>
            <button className="btn-secondary" type="button" onClick={() => setOutput('')}>Clear Output</button>
          </div>
          <div className="portal-card overflow-hidden">
            <Editor height="420px" theme="vs-dark" language={language === 'javascript' ? 'javascript' : language === 'cpp' ? 'cpp' : language} value={code} onChange={(value) => setCode(value || '')} options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }} />
          </div>
          <div className="mt-4 portal-card code-console p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.24em] text-emerald-300/80">Output</div>
            <pre className="whitespace-pre-wrap text-sm text-emerald-200">{output || 'Run code to see output here...'}</pre>
          </div>
        </Section>
        <Section title="SQL Reference" subtitle="Schema and sample queries are available here.">
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/5 p-4">students(id, name, grade)</div>
            <div className="rounded-2xl bg-white/5 p-4">courses(id, title)</div>
            <div className="rounded-2xl bg-white/5 p-4">enrollments(student_id, course_id)</div>
          </div>
        </Section>
      </div>
    </PageMotion>
  );
}

function StudentNotifications() {
  const notifications = studentSeed.notifications;
  const [filter, setFilter] = useState('all');
  const filtered = notifications.filter((item) => filter === 'all' || (filter === 'unread' && item.unread) || (filter === 'important' && item.type === 'feedback'));
  return (
    <PageMotion>
      <Section title="Notifications" subtitle="View your latest alerts, materials, and class updates.">
        <div className="mb-4 flex flex-wrap gap-2">
          {['all', 'unread', 'important'].map((item) => (
            <button key={item} className={cx('btn-secondary', filter === item && 'bg-white/12')} type="button" onClick={() => setFilter(item)}>
              {item.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((item) => (
            <button key={item.id} type="button" className={cx('portal-card flex w-full items-start gap-4 p-5 text-left', item.unread && 'border-l-4 border-l-indigo-400')}>
              <div className={cx('mt-1 rounded-2xl p-3', item.unread ? 'bg-indigo-500/20' : 'bg-white/5')}><MessageSquare size={16} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate text-base font-semibold text-white">{item.title}</h3>
                  <span className="text-xs text-slate-400">{item.time}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.message}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>
    </PageMotion>
  );
}

function StudentFeedback() {
  const [submittedAt, setSubmittedAt] = useState(() => window.localStorage.getItem('weekly_feedback_submitted_at'));
  const [active, setActive] = useState(null);
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState('');
  const promptDue = !submittedAt || Date.now() - new Date(submittedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
  const complete = Object.keys(ratings).length === 5;

  const submitFeedback = () => {
    window.localStorage.setItem('weekly_feedback_submitted_at', new Date().toISOString());
    setSubmittedAt(new Date().toISOString());
    confetti({ particleCount: 110, spread: 70, origin: { y: 0.65 } });
    toast.success('Feedback submitted successfully');
    setActive(null);
    setRatings({});
    setComment('');
  };

  return (
    <PageMotion>
      <div className="space-y-6">
        {promptDue ? (
          <div className="portal-card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-indigo-400 p-5">
            <div>
              <h3 className="text-lg font-semibold text-white">Weekly feedback is due!</h3>
              <p className="mt-1 text-sm text-slate-300">Help faculty improve by submitting your feedback this week.</p>
            </div>
            <button className="btn-primary" type="button" onClick={() => setActive(studentSeed.faculty[0])}>Give Feedback</button>
          </div>
        ) : (
          <div className="portal-card flex items-center gap-3 p-5 text-emerald-300"><Check size={18} /> Already submitted this week on {submittedAt ? format(new Date(submittedAt), 'dd MMM yyyy') : 'recently'}</div>
        )}
        <Section title="Faculty Feedback" subtitle="Rate each teaching parameter and leave an optional note.">
          <div className="grid gap-4 md:grid-cols-3">
            {studentSeed.faculty.map((faculty) => (
              <button key={faculty.id} type="button" className="portal-card p-5 text-left" onClick={() => setActive(faculty)}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5"><UserCircle2 /></div>
                <h3 className="mt-4 text-base font-semibold text-white">{faculty.name}</h3>
                <p className="mt-1 text-sm text-slate-300">{faculty.subject}</p>
                <div className="mt-4 text-xs text-indigo-300">Rate Faculty</div>
              </button>
            ))}
          </div>
        </Section>
      </div>
      <ConfirmModal
        open={Boolean(active)}
        title={active ? `${active.name} - ${active.subject}` : 'Faculty Feedback'}
        message="Rate the following parameters out of 5 stars."
        confirmLabel={complete ? 'Submit' : 'Complete Ratings'}
        onConfirm={complete ? submitFeedback : () => toast.error('Please rate all 5 parameters')}
        onCancel={() => setActive(null)}
        tone="neutral"
      />
    </PageMotion>
  );
}

function StudentPortal() {
  const { canInstall, installApp } = usePWA();
  const notifications = studentSeed.notifications;
  return (
    <DashboardLayout role="student" title="Student Dashboard" searchPlaceholder={roleMeta.student.searchPlaceholder} notifications={notifications} canInstall={canInstall} onInstall={installApp}>
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<StudentHome />} />
        <Route path="timetable" element={<StudentTimetable />} />
        <Route path="online-class" element={<StudentOnlineClass />} />
        <Route path="materials" element={<StudentMaterials />} />
        <Route path="videos" element={<StudentVideos />} />
        <Route path="certificates" element={<StudentCertificates />} />
        <Route path="ide" element={<StudentIDE />} />
        <Route path="notifications" element={<StudentNotifications />} />
        <Route path="feedback" element={<StudentFeedback />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function FacultyHome() {
  return (
    <PageMotion>
      <div className="space-y-6">
        <StatsGrid stats={facultySeed.stats.map((stat) => ({ ...stat, icon: stat.label === 'Avg Feedback Rating' ? Star : stat.label.includes('Students') ? Users : stat.label.includes('Assignments') ? ClipboardList : FileDown }))} color="var(--accent-faculty)" />
        <Section title="Today's Lectures" subtitle="Track live, upcoming, and completed lectures.">
          <div className="grid gap-4 md:grid-cols-3">
            {facultySeed.lectures.map((lecture) => (
              <div key={lecture.id} className="portal-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{lecture.topic}</h3>
                    <p className="mt-1 text-sm text-slate-300">{lecture.batch}</p>
                    <p className="mt-1 text-xs text-slate-400">{lecture.time}</p>
                  </div>
                  <StatusPill value={lecture.status} />
                </div>
                <button className="btn-primary mt-5 w-full" type="button">Start Class</button>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PageMotion>
  );
}

function FacultyScheduleLecture() {
  const schema = z.object({ batch: z.string().min(1), topic: z.string().min(2), date: z.string().min(1), start: z.string().min(1), end: z.string().min(1) });
  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = async (values) => {
    toast.success(`Lecture scheduled with room ${values.batch}-${Date.now()}`);
    reset();
  };
  return (
    <PageMotion>
      <Section title="Schedule Lecture" subtitle="Generate instant Jitsi rooms and notify students.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <FloatingSelect label="Select Batch" {...register('batch')} error={errors.batch?.message}><option value="">Select batch</option><option value="CSE-101">CSE-101</option><option value="CSE-102">CSE-102</option></FloatingSelect>
          <FloatingInput label="Topic Name" {...register('topic')} error={errors.topic?.message} />
          <FloatingInput label="Date" type="date" {...register('date')} error={errors.date?.message} />
          <FloatingInput label="Start Time" type="time" {...register('start')} error={errors.start?.message} />
          <FloatingInput label="End Time" type="time" {...register('end')} error={errors.end?.message} />
          <FloatingTextarea label="Description" className="md:col-span-2" rows={4} />
          <div className="md:col-span-2 flex gap-3">
            <button className="btn-primary" type="submit">Save Lecture</button>
            <button className="btn-secondary" type="button">Copy Room Link</button>
          </div>
        </form>
      </Section>
    </PageMotion>
  );
}

function FacultyPortal() {
  return (
    <DashboardLayout role="faculty" title="Faculty Dashboard" searchPlaceholder={roleMeta.faculty.searchPlaceholder} notifications={studentSeed.notifications}>
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<FacultyHome />} />
        <Route path="schedule-lecture" element={<FacultyScheduleLecture />} />
        <Route path="start-class" element={<FacultyHome />} />
        <Route path="upload-material" element={<FacultyHome />} />
        <Route path="video-tutorials" element={<FacultyHome />} />
        <Route path="assignments" element={<FacultyHome />} />
        <Route path="notifications" element={<FacultyHome />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function AdminDashboard() {
  return (
    <PageMotion>
      <div className="space-y-6">
        <StatsGrid stats={adminSeed.dashboard.stats.map((stat) => ({ ...stat, icon: stat.label.includes('Students') ? Users : stat.label.includes('Faculty') ? Building2 : stat.label.includes('Batches') ? ClipboardList : GraduationCap }))} color="var(--accent-admin)" />
        <Section title="Today's Active Lectures" subtitle="Current live or upcoming classes.">
          <DataTable columns={[{ key: 'subject', label: 'Subject' }, { key: 'faculty', label: 'Faculty' }, { key: 'time', label: 'Time' }, { key: 'status', label: 'Status' }]} data={studentSeed.classes.map((item) => ({ subject: item.subject, faculty: item.faculty, time: item.time, status: item.status }))} />
        </Section>
      </div>
    </PageMotion>
  );
}

function AdminStudentsCreate() {
  const schema = z.object({ firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email(), phone: z.string().min(10), password: z.string().min(6) });
  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema) });
  return (
    <PageMotion>
      <Section title="Create Student" subtitle="Add a new student profile and assign a batch.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(() => { toast.success('Student created'); reset(); })}>
          <FloatingInput label="First Name" {...register('firstName')} error={errors.firstName?.message} />
          <FloatingInput label="Last Name" {...register('lastName')} error={errors.lastName?.message} />
          <FloatingInput label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <FloatingInput label="Phone" {...register('phone')} error={errors.phone?.message} />
          <FloatingInput label="Password" type="password" className="md:col-span-2" {...register('password')} error={errors.password?.message} />
          <div className="md:col-span-2 flex gap-3"><button className="btn-primary" type="submit">Create Student</button></div>
        </form>
      </Section>
    </PageMotion>
  );
}

function AdminFacultyCreate() {
  return <AdminStudentsCreate />;
}

function AdminBatchesCreate() {
  return (
    <PageMotion>
      <Section title="Create Batch" subtitle="Build batches, assign subjects, and preview a summary before submit.">
        <div className="grid gap-4 md:grid-cols-2">
          <FloatingInput label="Batch Name" />
          <FloatingInput label="Max Students" type="number" />
          <FloatingInput label="Start Date" type="date" />
          <FloatingInput label="End Date" type="date" />
        </div>
      </Section>
    </PageMotion>
  );
}

function AdminBatchesList() {
  return (
    <PageMotion>
      <Section title="Batches" subtitle="Review batch occupancy, timings, and assigned subjects.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminSeed.batches.map((batch) => (
            <div key={batch.id} className="portal-card p-5">
              <h3 className="text-lg font-semibold text-white">{batch.name}</h3>
              <p className="mt-1 text-sm text-slate-300">{batch.students}</p>
              <p className="mt-1 text-xs text-slate-400">{batch.days}</p>
              <div className="mt-4 flex flex-wrap gap-2">{batch.subjects.split(',').map((subject) => <span key={subject} className="badge badge-info">{subject.trim()}</span>)}</div>
            </div>
          ))}
        </div>
      </Section>
    </PageMotion>
  );
}

function AdminPortal() {
  return (
    <DashboardLayout role="admin" title="Admin Dashboard" searchPlaceholder={roleMeta.admin.searchPlaceholder} notifications={studentSeed.notifications}>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="students/create" element={<AdminStudentsCreate />} />
        <Route path="students/list" element={<AdminStudentsCreate />} />
        <Route path="faculty/create" element={<AdminFacultyCreate />} />
        <Route path="faculty/list" element={<AdminFacultyCreate />} />
        <Route path="batches/create" element={<AdminBatchesCreate />} />
        <Route path="batches/list" element={<AdminBatchesList />} />
        <Route path="batches/add-students" element={<AdminBatchesList />} />
        <Route path="certificates" element={<AdminBatchesList />} />
        <Route path="notifications" element={<AdminBatchesList />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function AdmissionDashboard() {
  return (
    <PageMotion>
      <Section title="Admission Funnel" subtitle="Ten-stage funnel summary with today's follow-ups.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {admissionSeed.stages.map((stage) => (
            <div key={stage} className="portal-card p-4"><p className="text-sm text-slate-300">{stage}</p><div className="mt-2 text-2xl font-semibold text-white">{Math.floor(Math.random() * 90) + 10}</div></div>
          ))}
        </div>
      </Section>
    </PageMotion>
  );
}

function AdmissionTracker() {
  const [items, setItems] = useState(admissionSeed.inquiries);
  const sensors = useSensors(useSensor(PointerSensor));
  const columns = admissionSeed.stages;
  return (
    <PageMotion>
      <Section title="Inquiry Tracker" subtitle="Drag and drop leads across funnel stages.">
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1400px] grid-cols-10 gap-4">
            {columns.map((stage) => (
              <div key={stage} className="portal-card p-4">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-white">{stage}</h3><span className="badge badge-info">{items.filter((entry) => entry.stage === stage).length}</span></div>
                <div className="mt-4 space-y-3">
                  {items.filter((entry) => entry.stage === stage).map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{entry.name}</p>
                          <p className="text-xs text-slate-400">{entry.city} • {entry.phone}</p>
                        </div>
                        <span className={cx('badge', inquirySources[entry.source].badge)}>{inquirySources[entry.source].label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </PageMotion>
  );
}

function AdmissionReports() {
  const data = columnsFromStages(admissionSeed.stages).map((stage, index) => ({ stage, count: Math.floor(20 + index * 5) }));
  const sourceData = Object.entries(inquirySources).map(([key, value], index) => ({ name: value.label, value: [42, 28, 18, 12][index], key }));
  return (
    <PageMotion>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Stage-wise Inquiry Count" subtitle="Bar chart and other summary charts for admissions."><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" /><XAxis dataKey="stage" tick={{ fill: '#94A3B8', fontSize: 11 }} /><YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#F59E0B" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></Section>
        <Section title="Lead Source Breakdown" subtitle="Pie chart summary for inquiry sources."><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sourceData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={48}>{sourceData.map((entry, index) => <Cell key={entry.name} fill={['#F59E0B', '#8B5CF6', '#10B981', '#64748B'][index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></Section>
      </div>
    </PageMotion>
  );
}

function AdmissionFeesStatus() {
  return (
    <PageMotion>
      <Section title="Fees Status" subtitle="Search by name or phone and review payment history."><DataTable columns={[{ key: 'name', label: 'Name' }, { key: 'batch', label: 'Batch' }, { key: 'status', label: 'Status' }]} data={[{ id: 1, name: 'Rahul Kumar', batch: 'CSE-101', status: 'Paid' }, { id: 2, name: 'Sneha Verma', batch: 'CSE-102', status: 'Partial' }]} /></Section>
    </PageMotion>
  );
}

function AdmissionAccess() {
  return (
    <PageMotion>
      <Section title="Manage Access" subtitle="Revoke or restore student login access."><DataTable columns={[{ key: 'name', label: 'Name' }, { key: 'batch', label: 'Batch' }, { key: 'status', label: 'Status' }]} data={adminSeed.students} /></Section>
    </PageMotion>
  );
}

function AdmissionPortal() {
  return (
    <DashboardLayout role="admission" title="Admission Dashboard" searchPlaceholder={roleMeta.admission.searchPlaceholder} notifications={studentSeed.notifications}>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdmissionDashboard />} />
        <Route path="tracker" element={<AdmissionTracker />} />
        <Route path="reports" element={<AdmissionReports />} />
        <Route path="fees-status" element={<AdmissionFeesStatus />} />
        <Route path="access" element={<AdmissionAccess />} />
        <Route path="notifications" element={<AdmissionAccess />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function SuperAdminDashboard() {
  return (
    <PageMotion>
      <div className="space-y-6">
        <StatsGrid stats={superAdminSeed.dashboard.stats.map((stat) => ({ ...stat, icon: stat.label.includes('Revenue') ? Wallet : stat.label.includes('Students') ? Users : stat.label.includes('Faculty') ? Building2 : stat.label.includes('Batches') ? ClipboardList : stat.label.includes('Admins') ? ShieldCheck : Users }))} color="var(--accent-superadmin)" />
        <Section title="Recent Activity" subtitle="Operational events across the institute.">
          <div className="space-y-3">
            {['Created new batch CSE-104', 'Activated admission staff account', 'Generated 32 certificates', 'Recorded fee payment of ₹24,000'].map((item) => <div key={item} className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">{item}</div>)}
          </div>
        </Section>
      </div>
    </PageMotion>
  );
}

function SuperAdminLists({ title, data, columns }) {
  return <Section title={title} subtitle="Manage records and activate/deactivate users."><DataTable columns={columns} data={data} /></Section>;
}

function SuperAdminFees() {
  return (
    <PageMotion>
      <Section title="Fees Dashboard" subtitle="Monitor revenue, pending dues, and batch-wise collections."><DataTable columns={[{ key: 'name', label: 'Name' }, { key: 'batch', label: 'Batch' }, { key: 'status', label: 'Status' }]} data={[{ id: 1, name: 'Aarav Sharma', batch: 'CSE-101', status: 'Paid' }, { id: 2, name: 'Meera Shah', batch: 'CSE-102', status: 'Overdue' }]} /></Section>
    </PageMotion>
  );
}

function SuperAdminBatches() {
  return (
    <PageMotion>
      <Section title="Batches Overview" subtitle="Review batches, students, dates, and assigned faculty."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{superAdminSeed.batches.map((batch) => <div key={batch.id} className="portal-card p-5"><h3 className="text-lg font-semibold text-white">{batch.name}</h3><p className="mt-1 text-sm text-slate-300">{batch.students}</p><p className="mt-1 text-xs text-slate-400">{batch.days}</p></div>)}</div></Section>
    </PageMotion>
  );
}

function SuperAdminPortal() {
  return (
    <DashboardLayout role="superadmin" title="Super Admin Dashboard" searchPlaceholder={roleMeta.superadmin.searchPlaceholder} notifications={studentSeed.notifications}>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SuperAdminDashboard />} />
        <Route path="admins" element={<SuperAdminLists title="Manage Admins" data={superAdminSeed.admins} columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'created', label: 'Created Date' }]} />} />
        <Route path="admission-staff" element={<SuperAdminLists title="Manage Admission Staff" data={superAdminSeed.staff} columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'created', label: 'Created Date' }]} />} />
        <Route path="faculty" element={<SuperAdminLists title="Manage Faculty" data={adminSeed.faculty} columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'subjects', label: 'Subjects' }, { key: 'status', label: 'Status' }]} />} />
        <Route path="fees" element={<SuperAdminFees />} />
        <Route path="batches" element={<SuperAdminBatches />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function columnsFromStages(stages) {
  return stages;
}

function PublicModule() {
  const location = useLocation();
  const { hydrated, bootstrap } = useAuthStore();
  const pathname = location.pathname;

  useEffect(() => {
    if (!hydrated) bootstrap();
  }, [hydrated, bootstrap]);

  if (!hydrated) return <PageLoader />;

  if (pathname === '/' || pathname === '/login') return <LoginScreen role="student" />;
  if (pathname === '/faculty') return <LoginScreen role="faculty" />;
  if (pathname === '/admin') return <LoginScreen role="admin" />;
  if (pathname === '/admission') return <LoginScreen role="admission" />;
  if (pathname === '/superadmin' || pathname === '/supera') return <LoginScreen role="superadmin" />;
  if (pathname === '/inquiry') return <InquiryFormPage />;
  if (pathname === '/offline') return <OfflinePage />;
  return <NotFoundPage />;
}

export default function ScreensRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<PublicModule />} />
        <Route path="/login" element={<PublicModule />} />
        <Route path="/faculty" element={<PublicModule />} />
        <Route path="/admin" element={<PublicModule />} />
        <Route path="/admission" element={<PublicModule />} />
        <Route path="/superadmin" element={<PublicModule />} />
        <Route path="/supera" element={<PublicModule />} />
        <Route path="/inquiry" element={<PublicModule />} />
        <Route path="/offline" element={<PublicModule />} />
        <Route path="/dashboard/student/*" element={<StudentPortal />} />
        <Route path="/dashboard/faculty/*" element={<FacultyPortal />} />
        <Route path="/dashboard/admin/*" element={<AdminPortal />} />
        <Route path="/dashboard/admission/*" element={<AdmissionPortal />} />
        <Route path="/dashboard/superadmin/*" element={<SuperAdminPortal />} />
        <Route path="*" element={<PublicModule />} />
      </Routes>
    </Suspense>
  );
}
