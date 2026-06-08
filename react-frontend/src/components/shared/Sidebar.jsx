import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, GraduationCap, CalendarDays, Bell, Award, Video, Download, PlayCircle,
  Code2, Star, LogOut, ChevronLeft, ChevronRight, Menu, Users, BookOpen, PlusCircle,
  Upload, FileText, ClipboardList, Send, BarChart3, Kanban, CreditCard, ShieldAlert,
  UserPlus, Settings, DollarSign, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const roleConfig = {
  student: {
    accent: '#6366F1', label: 'Student Portal',
    nav: [
      { to: '/dashboard/student/home', icon: LayoutDashboard, label: 'Home' },
      { to: '/dashboard/student/timetable', icon: CalendarDays, label: 'Timetable' },
      { to: '/dashboard/student/notifications', icon: Bell, label: 'Notifications' },
      { to: '/dashboard/student/certificates', icon: Award, label: 'Certificates' },
      { to: '/dashboard/student/online-class', icon: Video, label: 'Online Class' },
      { to: '/dashboard/student/materials', icon: Download, label: 'Materials' },
      { to: '/dashboard/student/videos', icon: PlayCircle, label: 'Video Tutorials' },
      { to: '/dashboard/student/ide', icon: Code2, label: 'Practice IDE' },
      { to: '/dashboard/student/feedback', icon: Star, label: 'Faculty Feedback' },
    ]
  },
  faculty: {
    accent: '#10B981', label: 'Faculty Portal',
    nav: [
      { to: '/dashboard/faculty/home', icon: LayoutDashboard, label: 'Home' },
      { to: '/dashboard/faculty/schedule', icon: PlusCircle, label: 'Schedule Lecture' },
      { to: '/dashboard/faculty/class', icon: Video, label: 'Start/End Class' },
      { to: '/dashboard/faculty/materials', icon: Upload, label: 'Upload Material' },
      { to: '/dashboard/faculty/videos', icon: PlayCircle, label: 'Upload Videos' },
      { to: '/dashboard/faculty/assignments', icon: ClipboardList, label: 'Assignments' },
      { to: '/dashboard/faculty/notification', icon: Send, label: 'Notifications' },
    ]
  },
  admin: {
    accent: '#8B5CF6', label: 'Admin Portal',
    nav: [
      { to: '/dashboard/admin/home', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/dashboard/admin/create-student', icon: UserPlus, label: 'Create Student' },
      { to: '/dashboard/admin/create-faculty', icon: Users, label: 'Create Faculty' },
      { to: '/dashboard/admin/create-batch', icon: Layers, label: 'Create Batch' },
      { to: '/dashboard/admin/add-students', icon: Users, label: 'Add to Batch' },
      { to: '/dashboard/admin/certificates', icon: Award, label: 'Certificates' },
      { to: '/dashboard/admin/notification', icon: Send, label: 'Notifications' },
    ]
  },
  admission_staff: {
    accent: '#F59E0B', label: 'Admission Portal',
    nav: [
      { to: '/dashboard/admission/home', icon: LayoutDashboard, label: 'Home' },
      { to: '/dashboard/admission/inquiries', icon: Kanban, label: 'Inquiry Tracker' },
      { to: '/dashboard/admission/reports', icon: BarChart3, label: 'Reports' },
      { to: '/dashboard/admission/fees', icon: CreditCard, label: 'Fees Status' },
      { to: '/dashboard/admission/revoke', icon: ShieldAlert, label: 'Revoke Access' },
      { to: '/dashboard/admission/notification', icon: Send, label: 'Notifications' },
    ]
  },
  super_admin: {
    accent: '#F43F5E', label: 'Super Admin',
    nav: [
      { to: '/dashboard/superadmin/home', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/dashboard/superadmin/create-admin', icon: UserPlus, label: 'Create Admin' },
      { to: '/dashboard/superadmin/create-admission', icon: UserPlus, label: 'Admission Staff' },
      { to: '/dashboard/superadmin/create-faculty', icon: Users, label: 'Create Faculty' },
      { to: '/dashboard/superadmin/users', icon: Settings, label: 'Manage Users' },
      { to: '/dashboard/superadmin/fees', icon: DollarSign, label: 'Fees Dashboard' },
      { to: '/dashboard/superadmin/batches', icon: Layers, label: 'Batches' },
    ]
  }
};

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const role = user?.role || 'student';
  const config = roleConfig[role] || roleConfig.student;

  return (
    <>
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
        width: collapsed ? 72 : 260, background: '#0B1121',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.3s ease', overflow: 'hidden'
      }}>
        <div style={{
          padding: collapsed ? '16px 0' : '20px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border)'
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${config.accent}, ${config.accent}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 14, color: '#fff'
              }}>TP</div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: '#fff' }}>TechPro</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Institute</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${config.accent}, ${config.accent}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 14, color: '#fff'
            }}>TP</div>
          )}
          {!collapsed && (
            <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: collapsed ? '12px 0' : '16px 12px', overflowY: 'auto' }}>
          {config.nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '12px 0' : '10px 14px',
                marginBottom: 2, borderRadius: 10,
                textDecoration: 'none', color: isActive ? '#fff' : 'var(--text-muted)',
                background: isActive ? `${config.accent}15` : 'transparent',
                borderLeft: isActive ? `3px solid ${config.accent}` : '3px solid transparent',
                justifyContent: collapsed ? 'center' : 'flex-start',
                fontWeight: isActive ? 600 : 400, fontSize: 13,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              })}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{
          padding: collapsed ? '12px 0' : '16px',
          borderTop: '1px solid var(--border)'
        }}>
          {!collapsed && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg, ${config.accent}, ${config.accent}66)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff'
              }}>{user.username?.[0]?.toUpperCase() || 'U'}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user.username}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{config.label}</div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start',
              width: '100%', padding: collapsed ? '12px 0' : '10px 14px', borderRadius: 10,
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13, transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#F87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      {collapsed && (
        <button onClick={onToggle} style={{
          position: 'fixed', left: 72, top: 12, zIndex: 101,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-muted)'
        }}>
          <ChevronRight size={16} />
        </button>
      )}
    </>
  );
}
