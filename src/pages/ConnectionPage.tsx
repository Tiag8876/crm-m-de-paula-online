import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearApiBase,
  getApiBase,
  getApiBaseStorageKey,
  getLocalApiBase,
  setApiBase,
} from '@/lib/apiConfig';

type CheckStatus =
  | { type: 'idle'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const normalizeBase = (value: string): string => value.trim().replace(/\/+$/, '');

export function ConnectionPage() {
  const navigate = useNavigate();
  const localApiBase = getLocalApiBase();
  const currentApiBase = useMemo(() => getApiBase(), []);

  const [apiBaseInput, setApiBaseInput] = useState(currentApiBase);
  const [status, setStatus] = useState<CheckStatus>({
    type: 'idle',
    message: `API atual: ${currentApiBase}`,
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const testConnection = async (rawBase: string): Promise<boolean> => {
    const normalizedBase = normalizeBase(rawBase);
    if (!normalizedBase) {
      setStatus({
        type: 'error',
        message: 'Informe a URL base da API ou restaure o padrao automatico.',
      });
      return false;
    }

    setTesting(true);
    setStatus({
      type: 'idle',
      message: `Testando conexao com ${normalizedBase}...`,
    });

    try {
      const response = await fetch(`${normalizedBase}/api/health`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Servidor respondeu com status ${response.status}.`);
      }

      setStatus({
        type: 'success',
        message: `Conexao validada com sucesso em ${normalizedBase}.`,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao validar a conexao.';
      setStatus({
        type: 'error',
        message: `Nao foi possivel acessar ${normalizedBase}. ${message}`,
      });
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedBase = normalizeBase(apiBaseInput);
    if (!normalizedBase) {
      clearApiBase();
      const fallbackBase = getApiBase();
      setApiBaseInput(fallbackBase);
      setStatus({
        type: 'success',
        message: `Conexao redefinida para o padrao automatico: ${fallbackBase}`,
      });
      return;
    }

    setSaving(true);
    const ok = await testConnection(normalizedBase);
    if (ok) {
      setApiBase(normalizedBase);
      navigate('/login', { replace: true });
    }
    setSaving(false);
  };

  const handleUseLocal = () => {
    setApiBaseInput(localApiBase);
    setStatus({
      type: 'idle',
      message: `API local selecionada: ${localApiBase}`,
    });
  };

  const handleReset = () => {
    clearApiBase();
    const fallbackBase = getApiBase();
    setApiBaseInput(fallbackBase);
    setStatus({
      type: 'success',
      message: `Conexao restaurada para o padrao automatico: ${fallbackBase}`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl grid gap-6">
        <section className="rounded-2xl border border-primary/30 bg-card p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-primary mb-3">Conexao do Sistema</p>
          <h1 className="text-4xl font-serif font-bold gold-text-gradient mb-4">CRM M de Paula</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta tela permite alternar entre a API local e uma API online. Em um deploy web no mesmo dominio
            do frontend, voce tambem pode limpar o campo para usar o endereco automatico do ambiente.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-serif font-bold">Configurar API</h2>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Chave local: {getApiBaseStorageKey()}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
                URL base da API
              </label>
              <input
                value={apiBaseInput}
                onChange={(e) => setApiBaseInput(e.target.value)}
                placeholder="https://seu-backend.exemplo.com"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Exemplo online: `https://crm-api.seudominio.com` ou limpe o campo para usar o padrao automatico.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void testConnection(apiBaseInput)}
                disabled={testing}
                className="rounded-lg border border-border px-4 py-3 text-xs font-bold uppercase tracking-widest text-foreground hover:border-primary disabled:opacity-60"
              >
                {testing ? 'Testando...' : 'Testar conexao'}
              </button>
              <button
                type="button"
                onClick={handleUseLocal}
                className="rounded-lg border border-border px-4 py-3 text-xs font-bold uppercase tracking-widest text-foreground hover:border-primary"
              >
                Usar API local
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-border px-4 py-3 text-xs font-bold uppercase tracking-widest text-foreground hover:border-primary"
              >
                Restaurar padrao
              </button>
            </div>

            <div
              className={`rounded-lg border p-4 text-sm ${
                status.type === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : status.type === 'success'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-border bg-background text-muted-foreground'
              }`}
            >
              {status.message}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary px-4 py-3 text-primary-foreground font-bold uppercase tracking-widest disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar conexao'}
            </button>
          </form>

          <div className="mt-4 grid gap-2">
            <Link
              to="/login"
              className="block w-full rounded-lg border border-border px-4 py-3 text-center text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Voltar para login
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
