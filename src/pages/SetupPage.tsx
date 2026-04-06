import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { initializeSetup } from '@/lib/setup';
import { getApiBase } from '@/lib/apiConfig';

export function SetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [backendReachable, setBackendReachable] = useState(false);
  const [publicSetupAllowed, setPublicSetupAllowed] = useState(false);
  const [bootstrapConfigured, setBootstrapConfigured] = useState(false);
  const [missingBootstrapFields, setMissingBootstrapFields] = useState<string[]>([]);
  const [bootstrapNameFallbackApplied, setBootstrapNameFallbackApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('tiagogomesqueiroz@outlook.com');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const apiBase = getApiBase();
      try {
        const health = await fetch(`${apiBase}/api/health`);
        if (!health.ok) throw new Error('API indisponivel');
        if (!mounted) return;
        setBackendReachable(true);

        const statusResponse = await fetch(`${apiBase}/api/setup-status`);
        if (!statusResponse.ok) throw new Error('Falha ao consultar setup');
        const status = await statusResponse.json();
        if (!mounted) return;
        setNeedsSetup(Boolean(status?.needsSetup));
        setPublicSetupAllowed(Boolean(status?.publicSetupAllowed));
        setBootstrapConfigured(Boolean(status?.bootstrapConfigured));
        setMissingBootstrapFields(Array.isArray(status?.missingBootstrapFields) ? status.missingBootstrapFields : []);
        setBootstrapNameFallbackApplied(Boolean(status?.bootstrapNameFallbackApplied));
      } catch {
        if (!mounted) return;
        setBackendReachable(false);
      } finally {
        if (!mounted) return;
        setChecking(false);
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-gold-500/20 border-t-gold-500 animate-spin" />
      </div>
    );
  }

  if (!needsSetup) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await initializeSetup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar conta inicial');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl grid gap-6">
        <section className="rounded-2xl border border-primary/30 bg-card p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-primary mb-3">Provisionamento Inicial</p>
          <h1 className="text-4xl font-serif font-bold gold-text-gradient mb-4">CRM M de Paula</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta tela existe apenas para provisionamento controlado da instancia. Em ambiente profissional, o recomendado e criar o administrador inicial por variaveis seguras do servidor.
          </p>
        </section>

        {!publicSetupAllowed && (
          <section className="rounded-2xl border border-amber-500/30 bg-card p-8">
            <h2 className="text-xl font-serif font-bold mb-3">Provisionamento Publico Desabilitado</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta instancia nao permite criar administrador pela interface publica. Configure `ADMIN_BOOTSTRAP_NAME`,
              `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD` no ambiente do servidor e faca um novo deploy.
            </p>
            {missingBootstrapFields.length > 0 && (
              <p className="mt-4 text-sm text-red-300">
                Variaveis ausentes no runtime: {missingBootstrapFields.join(', ')}
              </p>
            )}
            {bootstrapNameFallbackApplied && (
              <p className="mt-4 text-sm text-amber-200">
                `ADMIN_BOOTSTRAP_NAME` pode ficar vazio. O sistema vai usar "Administrador do Sistema" como nome padrao.
              </p>
            )}
            {bootstrapConfigured && (
              <p className="mt-4 text-sm text-emerald-300">
                As credenciais de provisionamento ja estao configuradas no ambiente. Basta publicar o deploy atualizado para concluir a criacao do administrador.
              </p>
            )}
          </section>
        )}

        {publicSetupAllowed && (
        <section className="rounded-2xl border border-border bg-card p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-serif font-bold">Criar Administrador Inicial</h2>
          </div>

          {!backendReachable && (
            <div className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              Nao foi possivel acessar a API configurada para o sistema. Verifique a conexao e tente novamente.
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={!backendReachable}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!backendReachable}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Senha</label>
              <input
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!backendReachable}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary disabled:opacity-60"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !backendReachable}
              className="w-full rounded-lg bg-primary px-4 py-3 text-primary-foreground font-bold uppercase tracking-widest disabled:opacity-60"
            >
              {submitting ? 'Criando...' : 'Criar Conta Inicial'}
            </button>
          </form>
        </section>
        )}
      </div>
    </div>
  );
}

