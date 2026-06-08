import { create } from 'zustand';

const STORAGE_KEY = 'institute_auth_session';

function readSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function mapLoginPath(role) {
  if (role === 'faculty') return '/faculty';
  if (role === 'admin') return '/admin';
  if (role === 'admission') return '/admission';
  if (role === 'superadmin') return '/superadmin';
  return '/';
}

export const useAuthStore = create((set, get) => ({
  hydrated: false,
  token: null,
  role: null,
  user: null,
  setHydrated: () => set({ hydrated: true }),
  setSession: (session) => {
    const nextSession = {
      token: session?.token || null,
      role: session?.role || null,
      user: session?.user || null,
    };
    writeSession(nextSession);
    set(nextSession);
  },
  clearSession: () => {
    writeSession(null);
    set({ token: null, role: null, user: null });
  },
  bootstrap: () => {
    const session = readSession();
    if (session) set(session);
    set({ hydrated: true });
  },
  loginSuccess: async (session) => {
    get().setSession(session);
    return session;
  },
  logout: async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/logout`, {
        credentials: 'include',
      });
    } catch {
      // ignore network failures during logout
    }
    get().clearSession();
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  },
  roleLoginPath: mapLoginPath,
}));

if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuthStore.getState().clearSession();
  });
}
