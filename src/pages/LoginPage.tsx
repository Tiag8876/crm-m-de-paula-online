import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchSetupStatus } from '@/lib/setup';
import { getApiBase } from '@/lib/apiConfig';

export function LoginPage() {
  const { user, login, loading, error, setError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [provisioningMessage, setProvisioningMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const health = await fetch(`${getApiBase()}/api/health`);
        const contentType = health.headers.get('content-type') || '';
        const payload = contentType.toLowerCase().includes('application/json')
          ? await health.json().catch(() => null)
          : null;

        if (!health.ok || !payload?.ok) {
          if (mounted) {
            setConnectionError('Nao foi possivel conectar ao servidor do sistema.');
            setCheckingSetup(false);
          }
          return;
        }
      } catch {
        if (mounted) {
          setConnectionError('Nao foi possivel conectar ao servidor do sistema.');
          setCheckingSetup(false);
        }
        return;
      }

      fetchSetupStatus()
        .then((status) => {
          if (!mounted) return;
          setNeedsSetup(status.needsSetup);
          if (status.needsSetup) {
            setProvisioningMessage(
              status.publicSetupAllowed
                ? 'Esta instancia ainda nao foi provisionada. Utilize a rota protegida de setup apenas pela equipe responsavel.'
                : 'Esta instancia ainda nao foi provisionada. O administrador deve concluir o provisionamento interno antes do primeiro acesso.'
            );
          } else {
            setProvisioningMessage(null);
          }
        })
        .catch(() => {
          if (!mounted) return;
          setConnectionError('Falha ao validar o ambiente do sistema.');
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
        <p className="text-sm text-muted-foreground mb-8">Acesse com seu usuario e senha.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          {connectionError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {connectionError}
            </div>
          )}
          {provisioningMessage && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {provisioningMessage}
            </div>
          )}
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
            disabled={loading || needsSetup}
            className="w-full rounded-lg bg-primary px-4 py-3 text-primary-foreground font-bold uppercase tracking-widest disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
