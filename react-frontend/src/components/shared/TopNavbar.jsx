import { useAuth } from '../../context/AuthContext';
import { Bell, Search, LogOut } from 'lucide-react';
import { useState } from 'react';

const roleAccents = {
  student: '#6366F1', faculty: '#10B981', admin: '#8B5CF6',
  admission_staff: '#F59E0B', super_admin: '#F43F5E'
};

export default function TopNavbar({ title }) {
  const { user, logout } = useAuth();
  const role = user?.role || 'student';
  const accent = roleAccents[role] || '#6366F1';

  return (
    <header style={{
      height: 64, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 50
    }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700 }}>{title || 'Dashboard'}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '8px 12px', color: 'var(--text-muted)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
        }}>
          <Search size={16} />
          <span style={{ color: 'var(--text-muted)' }}>Search...</span>
        </button>
        <div style={{ position: 'relative' }}>
          <button style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 8, color: 'var(--text-muted)', cursor: 'pointer'
          }}>
            <Bell size={18} />
          </button>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 12px 6px 6px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: `linear-gradient(135deg, ${accent}, ${accent}66)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff'
          }}>{user?.username?.[0]?.toUpperCase() || 'U'}</div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{user?.username || 'User'}</span>
        </div>
      </div>
    </header>
  );
}
