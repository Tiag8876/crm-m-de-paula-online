import { Link, Navigate } from 'react-router-dom';
import { getOfflineSnapshot } from '@/lib/offlineSnapshot';
import type { Lead } from '@/types/crm';

export function OfflineSnapshotPage() {
  const snapshot = getOfflineSnapshot();
  if (!snapshot) {
    return <Navigate to="/connection" replace />;
  }

  const state = snapshot.state as {
    leads?: Lead[];
    campaigns?: { id: string; name: string }[];
    adGroups?: unknown[];
    ads?: unknown[];
    tasks?: unknown[];
  };

  const leads = state.leads || [];
  const campaigns = state.campaigns || [];
  const closed = leads.filter((lead) => lead.status === 'fechado').length;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="rounded-2xl border border-primary/30 bg-card p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-primary mb-2">Modo Offline (Somente Leitura)</p>
          <h1 className="text-3xl font-serif font-bold gold-text-gradient mb-3">Backup Local do Cliente</h1>
          <p className="text-sm text-muted-foreground">
            Ultima sincronizacao salva neste computador: {new Date(snapshot.capturedAt).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Servidor de origem: {snapshot.apiBase}</p>
          <div className="mt-4">
            <Link to="/connection" className="rounded-lg border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-accent inline-flex">
              Voltar para Conexao
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-primary">Leads</p>
            <p className="text-3xl font-serif font-bold mt-1">{leads.length}</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-primary">Campanhas</p>
            <p className="text-3xl font-serif font-bold mt-1">{campaigns.length}</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-primary">Fechados</p>
            <p className="text-3xl font-serif font-bold mt-1">{closed}</p>
          </article>
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Leads salvos offline</h2>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-accent/40">
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Telefone</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">CPF</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={4}>Nenhum lead salvo no backup offline.</td>
                  </tr>
                )}
                {leads.slice(0, 500).map((lead) => (
                  <tr key={lead.id} className="border-t border-border/60">
                    <td className="px-4 py-3">{lead.name}</td>
                    <td className="px-4 py-3">{lead.phone}</td>
                    <td className="px-4 py-3">{lead.status}</td>
                    <td className="px-4 py-3">{lead.cpf || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

