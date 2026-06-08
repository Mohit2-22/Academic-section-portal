import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function usePWA() {
  const [canInstall, setCanInstall] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const { user, role } = useAuthStore();

  useEffect(() => {
    const register = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch {
        // ignore SW registration failures in dev
      }
    };

    register();
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  useEffect(() => {
    const promptForNotifications = async () => {
      if (role !== 'student' || !user || !('Notification' in window)) return;
      const alreadyAsked = window.localStorage.getItem('student_notifications_prompted');
      if (alreadyAsked) return;
      window.localStorage.setItem('student_notifications_prompted', 'true');
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // ignore permission errors
        }
      }
    };

    promptForNotifications();
  }, [role, user]);

  const installApp = async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setCanInstall(false);
    return choice?.outcome === 'accepted';
  };

  return useMemo(
    () => ({ canInstall, installApp }),
    [canInstall, installApp],
  );
}
