import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (username, password, role) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);

    const roleRoute = role === 'student' ? '/login' :
      role === 'faculty' ? '/faculty' :
      role === 'admin' ? '/admin' :
      role === 'admission_staff' ? '/admission' : '/superadmin';

    const res = await fetch(`http://localhost:5000${roleRoute}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      credentials: 'include',
      redirect: 'manual',
    });

    if (res.status === 302) {
      const meRes = await api.get('/api/me');
      const userData = { ...meRes, role };
      setUser(userData);
      localStorage.setItem('auth_user', JSON.stringify(userData));
      return userData;
    }

    let errText = 'Invalid credentials';
    try {
      const html = await res.text();
      const match = html.match(/class="error-box">\s*<span>([^<]+)<\/span>/);
      if (match) errText = match[1];
    } catch {}
    throw new Error(errText);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
