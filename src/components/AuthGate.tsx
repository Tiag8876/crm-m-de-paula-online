import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { canAccessPath, getDefaultRouteForUser, isAdminUser } from '@/lib/access';
import { fetchSetupStatus } from '@/lib/setup';
import { getApiBase } from '@/lib/apiConfig';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';

export function AuthGate() {
  const { user, fetchMe, logout } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const apiBase = getApiBase();

      try {
        const health = await fetch(`${apiBase}/api/health`);
        if (!health.ok) {
          throw new Error('API indisponivel');
          return;
        }
      } catch {
        throw new Error('API indisponivel');
      }

      try {
        const status = await fetchSetupStatus();
        if (!mounted) return;
        if (status.needsSetup) {
          setNeedsSetup(true);
          return;
        }
      } catch {
        if (!mounted) return;
        throw new Error('Falha ao validar setup');
      }

      await fetchMe().catch(() => {
        logout();
      });
    };

    run().finally(() => {
      if (mounted) {
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [fetchMe, logout]);

  if (checking) {
    return <AppLoadingScreen title="Inicializando sistema" subtitle="Validando conexao com o servidor e autenticacao..." />;
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function AdminGate() {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function AccessGate() {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <Outlet />;
}
