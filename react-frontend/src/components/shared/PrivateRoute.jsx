import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to={role === 'faculty' ? '/faculty' : role === 'admin' ? '/admin' : role === 'admission_staff' ? '/admission' : role === 'super_admin' ? '/superadmin' : '/'} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
