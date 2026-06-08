import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import ScreensRouter from './pages/screens';
import { useAuthStore } from './store/authStore';

export default function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) bootstrap();
  }, [bootstrap, hydrated]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1E293B', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 },
          success: { iconTheme: { primary: '#10B981', secondary: '#F1F5F9' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#F1F5F9' } },
        }}
      />
      <ScreensRouter />
    </BrowserRouter>
  );
}
