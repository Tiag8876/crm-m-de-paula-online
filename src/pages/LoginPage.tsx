import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchSetupStatus } from '@/lib/setup';
import { getApiBase } from '@/lib/apiConfig';

export function LoginPage() {
  const { user, login, loading, error, setError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const health = await fetch(`${getApiBase()}/api/health`);
        if (!health.ok) {
          if (mounted) {
            setNeedsConnection(true);
            setCheckingSetup(false);
          }
          return;
        }
      } catch {
        if (mounted) {
          setNeedsConnection(true);
          setCheckingSetup(false);
        }
        return;
      }

      fetchSetupStatus()
        .then((status) => {
          if (!mounted) return;
          setNeedsSetup(status.needsSetup);
        })
        .catch(() => {
          if (!mounted) return;
          setNeedsConnection(true);
        })
        .finally(() => {
          if (!mounted) return;
          setCheckingSetup(false);
        });
    };

    check();

    return () => {
      mounted = false;
    };
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-gold-500/20 border-t-gold-500 animate-spin" />
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (needsConnection) {
    return <Navigate to="/connection" replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch {
      // handled by store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <h1 className="text-3xl font-serif font-bold gold-text-gradient mb-2">CRM M de Paula</h1>
        <p className="text-sm text-muted-foreground mb-8">Acesse com seu usuário e senha.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-primary-foreground font-bold uppercase tracking-widest disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="mt-4 grid gap-2">
          <Link
            to="/setup"
            className="block w-full rounded-lg border border-border px-4 py-3 text-center text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            Primeiro acesso
          </Link>
          <Link
            to="/connection"
            className="block w-full rounded-lg border border-border px-4 py-3 text-center text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            Configurar conexão
          </Link>
        </div>
      </div>
    </div>
  );
}
