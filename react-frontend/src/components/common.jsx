import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Home,
  Menu,
  MoonStar,
  Search,
  ShieldCheck,
  UserCircle2,
  X,
  Eye,
  EyeOff,
  LoaderCircle,
  LogOut,
  Copy,
  Check,
  ArrowDown,
  ArrowUp,
  Smartphone,
  WifiOff,
  PanelLeftClose,
  PanelLeftOpen,
  Stars,
  Timer,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { roleMeta, sidebarMenus, notificationTypes } from '../config/appConfig';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function RoleBadge({ role, className = '' }) {
  const meta = roleMeta[role] || roleMeta.student;
  return (
    <span
      className={cx('badge', meta.accentClass, className)}
      style={{ background: `${meta.accent}22`, color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <ShieldCheck size={14} />
      {meta.label}
    </span>
  );
}

export function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-white/80" />
        <p className="text-sm text-slate-300">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, message, ctaLabel, onCta, icon: Icon = Stars }) {
  return (
    <div className="empty-state flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="rounded-2xl bg-white/5 p-4 text-white/90">
        <Icon size={28} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-slate-300">{message}</p>
      </div>
      {ctaLabel ? (
        <button className="btn-primary" type="button" onClick={onCta}>
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, tone = 'danger' }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="portal-card w-full max-w-md p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-300">{message}</p>
              </div>
              <button className="btn-ghost h-10 w-10 rounded-full p-0" type="button" onClick={onCancel} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex gap-3">
              <button className="btn-secondary flex-1" type="button" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button className={cx('btn-primary flex-1', tone === 'danger' && 'bg-gradient-to-r from-rose-500 to-red-500')} type="button" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Section({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={cx('portal-card p-5 md:p-6', className)}>
      {(title || subtitle || actions) ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-lg font-semibold text-white md:text-xl">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ icon: Icon, value, label, trend, color = 'var(--accent-student)' }) {
  return (
    <div className="portal-card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="rounded-2xl p-3" style={{ background: `${color}22`, color: 'white' }}>
          <Icon size={18} />
        </div>
        {trend ? <span className="badge badge-neutral">{trend}</span> : null}
      </div>
      <div>
        <div className="text-2xl font-semibold text-white">{value}</div>
        <div className="mt-1 text-sm text-slate-300">{label}</div>
      </div>
    </div>
  );
}

export function StatsGrid({ stats, color }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => (
        <StatCard key={item.label} {...item} color={color} />
      ))}
    </div>
  );
}

export function CardScroller({ items, renderItem, className = '' }) {
  return (
    <div className={cx('scrollbar-hide flex gap-4 overflow-x-auto pb-2', className)}>
      {items.map((item, index) => (
        <div key={item.id ?? index} className="min-w-[270px] max-w-[320px] flex-1">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

export function DataTable({ columns, data, onRowClick, sortable = false, sortState, onSort, className = '' }) {
  return (
    <div className={cx('overflow-hidden rounded-2xl border border-white/8', className)}>
      <div className="overflow-x-auto">
        <table className="table-shell min-w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap">
                  {sortable && col.sortable ? (
                    <button type="button" className="inline-flex items-center gap-2 text-left" onClick={() => onSort?.(col.key)}>
                      {col.label}
                      {sortState?.key === col.key ? sortState.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} /> : <Filter size={14} />}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={row.id ?? rowIndex} onClick={() => onRowClick?.(row)} className={cx(onRowClick && 'cursor-pointer')}>
                {columns.map((col) => (
                  <td key={col.key}>{typeof col.render === 'function' ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FileUploadZone({ accept, multiple = false, onUpload, title = 'Drop files here', subtitle = 'or click to browse', hint = '' }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);

  const handleFiles = (selected) => {
    const list = Array.from(selected || []);
    setFiles(list);
    onUpload?.(multiple ? list : list[0]);
  };

  return (
    <div
      className="portal-card flex flex-col gap-4 border-dashed p-5 text-center"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input ref={inputRef} type="file" className="hidden" accept={accept} multiple={multiple} onChange={(event) => handleFiles(event.target.files)} />
      <div className="mx-auto rounded-2xl bg-white/5 p-4 text-white">
        <FileSpreadsheet size={22} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-300">{subtitle}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button className="btn-primary" type="button" onClick={() => inputRef.current?.click()}>
          Browse Files
        </button>
        {files.length ? <span className="badge badge-info">{files.length} file(s) selected</span> : null}
      </div>
    </div>
  );
}

export function JitsiModal({ open, roomName, displayName, role, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open || !roomName || !containerRef.current) return;
    let api;
    const init = async () => {
      const { JitsiMeetExternalAPI } = window;
      if (!JitsiMeetExternalAPI) {
        containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-slate-300">Jitsi SDK unavailable in this environment.</div>';
        return;
      }
      containerRef.current.innerHTML = '';
      api = new JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: containerRef.current,
        userInfo: { displayName },
        configOverwrite: {
          startWithAudioMuted: role === 'student',
          startWithVideoMuted: true,
          disableScreensharingCombinedWithLocalRecordingFeature: true,
          disableRemoteMute: role === 'faculty',
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: role === 'faculty'
            ? ['microphone', 'camera', 'desktop', 'chat', 'recording', 'raisehand', 'tileview', 'participants-pane', 'hangup']
            : ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'hangup'],
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        },
      });
    };
    init();
    return () => {
      try {
        api?.dispose?.();
      } catch {
        // ignore cleanup failures
      }
    };
  }, [open, roomName, displayName, role]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-slate-950/95">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Jitsi Room</p>
                <h3 className="text-lg font-semibold text-white">{roomName}</h3>
              </div>
              <button className="btn-secondary" type="button" onClick={onClose}>
                Close
              </button>
            </div>
            <div ref={containerRef} id="jitsi-container" className="flex-1" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function NotificationBell({ items = [], onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const unreadCount = items.filter((item) => item.unread).length;

  return (
    <div className="relative">
      <button className="btn-secondary relative h-11 w-11 rounded-full p-0" type="button" aria-label="Notifications" onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {unreadCount ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">{unreadCount}</span> : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="portal-card absolute right-0 top-14 z-40 w-[320px] overflow-hidden p-0 shadow-2xl shadow-slate-950/50">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Notifications</p>
                <p className="text-xs text-slate-400">Last 5 updates</p>
              </div>
              <button className="btn-ghost text-xs" type="button" onClick={() => onMarkAllRead?.()}>
                Mark all as read
              </button>
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              {items.slice(0, 5).map((item) => {
                const type = notificationTypes[item.type] || notificationTypes.alert;
                const Icon = type.icon;
                return (
                  <button key={item.id} type="button" className="flex w-full items-start gap-3 border-b border-white/6 px-4 py-3 text-left hover:bg-white/5" onClick={() => setOpen(false)}>
                    <span className="rounded-xl bg-white/6 p-2 text-white"><Icon size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-xs text-slate-400">{item.message}</span>
                      <span className="mt-1 block text-[11px] text-slate-500">{item.time || formatDistanceToNowStrict(new Date(item.created_at || Date.now()), { addSuffix: true })}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/8 p-3">
              <Link to="/dashboard/student/notifications" className="btn-secondary w-full">
                View All
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function TopNavbar({ role, title, searchPlaceholder, onSearch, notifications = [], onInstall, canInstall }) {
  const { user, logout } = useAuthStore();
  const [query, setQuery] = useState('');
  const [openProfile, setOpenProfile] = useState(false);
  const meta = roleMeta[role] || roleMeta.student;

  useEffect(() => {
    const handler = window.setTimeout(() => onSearch?.(query), 250);
    return () => window.clearTimeout(handler);
  }, [query, onSearch]);

  return (
    <div className="topbar border-b border-white/8 bg-slate-950/40 px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{meta.shortTitle} Portal</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="truncate text-lg font-semibold text-white md:text-2xl">{title}</h1>
            <RoleBadge role={role} />
          </div>
        </div>
        {canInstall ? (
          <button className="btn-secondary hidden md:inline-flex" type="button" onClick={onInstall}>
            <Smartphone size={16} /> Add to Home Screen
          </button>
        ) : null}
        <NotificationBell items={notifications} onMarkAllRead={() => {}} />
        <div className="relative">
          <button className="btn-secondary flex items-center gap-2" type="button" onClick={() => setOpenProfile((value) => !value)}>
            <UserCircle2 size={18} />
            <span className="hidden sm:inline">{user?.name || user?.username || 'User'}</span>
            <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {openProfile ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="portal-card absolute right-0 top-14 z-40 w-56 p-2">
                <button className="btn-ghost w-full justify-start" type="button">
                  <UserCircle2 size={16} /> Profile
                </button>
                <button className="btn-ghost w-full justify-start" type="button">
                  <MoonStar size={16} /> Settings
                </button>
                <button className="btn-ghost w-full justify-start text-rose-300" type="button" onClick={logout}>
                  <LogOut size={16} /> Logout
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="floating-label-group min-w-[260px] flex-1">
          <input id="topbar-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder=" " className="pr-10" />
          <label htmlFor="topbar-search">{searchPlaceholder || 'Search...'}</label>
          <Search size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ role, mobileOpen, onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const menu = sidebarMenus[role] || [];
  const meta = roleMeta[role] || roleMeta.student;

  return (
    <aside className={cx('sidebar-shell flex flex-col', collapsed && 'collapsed', mobileOpen && 'mobile-open')} style={{ '--accent-student': meta.accent }}>
      <div className="flex items-center justify-between gap-3 border-b border-white/8 p-4">
        <div className={cx('flex min-w-0 items-center gap-3', collapsed && 'justify-center')}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
            <meta.icon size={20} />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-white">InstitutePulse</div>
              <div className="text-xs text-slate-400">{meta.title}</div>
            </div>
          ) : null}
        </div>
        <button className="btn-ghost hidden lg:inline-flex" type="button" onClick={() => setCollapsed((value) => !value)} aria-label="Collapse sidebar">
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button className="btn-ghost inline-flex lg:hidden" type="button" onClick={onCloseMobile} aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <nav className="space-y-2">
          {menu.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={cx('sidebar-nav-item', active && 'active', collapsed && 'justify-center')}>
                <Icon size={18} />
                {!collapsed ? <span>{item.label}</span> : null}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-white/8 p-3">
        <button className="btn-secondary w-full justify-center" type="button" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />} {!collapsed ? 'Collapse' : ''}
        </button>
      </div>
    </aside>
  );
}

export function DashboardLayout({ role, title, searchPlaceholder, notifications, children, onSearch, canInstall, onInstall, mobileBottomNav = true }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menu = sidebarMenus[role] || [];

  return (
    <div className="layout-grid page-shell">
      <Sidebar role={role} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="min-w-0">
        <TopNavbar role={role} title={title} searchPlaceholder={searchPlaceholder} onSearch={onSearch} notifications={notifications} canInstall={canInstall} onInstall={onInstall} />
        <div className="page-frame p-4 md:p-6">
          <button className="btn-secondary mb-4 inline-flex lg:hidden" type="button" onClick={() => setMobileOpen(true)}>
            <Menu size={16} /> Menu
          </button>
          {children}
        </div>
        {mobileBottomNav && role === 'student' ? (
          <nav className="mobile-bottom-nav">
            {menu.slice(0, 5).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.path} to={item.path} className={({ isActive }) => cx(isActive && 'active')}>
                  <Icon size={16} />
                  <span className="text-[11px]">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

export function FloatingInput({ label, error, ...props }) {
  return (
    <div className="floating-label-group">
      <input {...props} placeholder=" " className={cx(props.className, error && 'border-rose-400/70')} />
      <label>{label}</label>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export function FloatingTextarea({ label, error, ...props }) {
  return (
    <div className="floating-label-group">
      <textarea {...props} placeholder=" " className={cx(props.className, error && 'border-rose-400/70')} />
      <label>{label}</label>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export function FloatingSelect({ label, error, children, ...props }) {
  return (
    <div className="floating-label-group">
      <select {...props} className={cx(props.className, error && 'border-rose-400/70')}>
        {children}
      </select>
      <label>{label}</label>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export function Pagination({ page, totalPages, onPageChange }) {
  const pages = useMemo(() => {
    if (totalPages <= 6) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    const slice = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    return slice;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-between gap-3">
      <button className="btn-secondary" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft size={16} /> Prev
      </button>
      <div className="flex flex-wrap gap-2">
        {pages.map((value) => (
          <button key={value} className={cx('btn-secondary h-10 w-10 p-0', page === value && 'bg-white/15 text-white')} type="button" onClick={() => onPageChange(value)}>
            {value}
          </button>
        ))}
      </div>
      <button className="btn-secondary" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function StatusPill({ value }) {
  const map = {
    active: 'badge-success',
    live: 'badge-success',
    upcoming: 'badge-warning',
    completed: 'badge-neutral',
    pending: 'badge-warning',
    revoked: 'badge-danger',
    draft: 'badge-neutral',
    assigned: 'badge-info',
    closed: 'badge-danger',
    important: 'badge-warning',
    unread: 'badge-info',
  };
  const key = String(value || '').toLowerCase();
  return <span className={cx('badge', map[key] || 'badge-neutral')}>{value}</span>;
}
