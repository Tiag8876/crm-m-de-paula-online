import { useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileSpreadsheet, TrendingUp, CheckCircle2, AlertTriangle, Clock3, GitBranchPlus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import type { FunnelConfig } from '@/types/crm';

type PeriodFilter = '7' | '30' | '90' | 'all';
const ALL_SCOPE = '__all__';

const sortFunnels = (items: FunnelConfig[]) =>
  [...items].sort((a, b) => {
    if (a.operation !== b.operation) return a.operation === 'commercial' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

const getProspectIdleHours = (lead: { createdAt: string; lastInteractionAt?: string; followUps?: Array<{ date: string }>; tasks?: Array<{ date: string }>; notes?: Array<{ createdAt: string }> }, nowMs = Date.now()) => {
  const candidates = [Date.parse(lead.createdAt || ''), Date.parse(lead.lastInteractionAt || '')].filter((value) => !Number.isNaN(value));
  for (const followUp of lead.followUps || []) {
    const time = Date.parse(followUp.date || '');
    if (!Number.isNaN(time)) candidates.push(time);
  }
  for (const task of lead.tasks || []) {
    const time = Date.parse(task.date || '');
    if (!Number.isNaN(time)) candidates.push(time);
  }
  for (const note of lead.notes || []) {
    const time = Date.parse(note.createdAt || '');
    if (!Number.isNaN(time)) candidates.push(time);
  }
  const base = candidates.length > 0 ? Math.max(...candidates) : nowMs;
  return Math.max(0, (nowMs - base) / 36e5);
};

const escapeHtml = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function SalesReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, users, fetchUsers } = useAuthStore();
  const { funnels, leads, prospectLeads, campaigns, services } = useStore();
  const [selectedScope, setSelectedScope] = useState<string>(ALL_SCOPE);
  const [period, setPeriod] = useState<PeriodFilter>('30');

  const allFunnels = sortFunnels(funnels || []);

  useEffect(() => {
    fetchUsers().catch(() => null);
  }, [fetchUsers]);

  useEffect(() => {
    const funnelParam = searchParams.get('funnel');
    const operationParam = searchParams.get('operation');
    if (funnelParam && allFunnels.some((funnel) => funnel.id === funnelParam)) {
      setSelectedScope(funnelParam);
      return;
    }
    if (operationParam === 'prospecting') {
      setSelectedScope(allFunnels.find((funnel) => funnel.operation === 'prospecting')?.id || ALL_SCOPE);
      return;
    }
    setSelectedScope(ALL_SCOPE);
  }, [allFunnels, searchParams]);

  const activeFunnel = allFunnels.find((funnel) => funnel.id === selectedScope);
  const now = Date.now();

  const records = useMemo(() => {
    const start = period === 'all' ? null : (() => {
      const date = new Date();
      date.setDate(date.getDate() - Number(period));
      return date;
    })();

    const base = [
      ...(leads || []).map((lead) => ({
        id: lead.id,
        kind: 'commercial' as const,
        createdAt: lead.createdAt,
        funnelId: lead.funnelId,
        ownerUserId: lead.ownerUserId,
        status: lead.status,
        closed: lead.status === 'fechado',
        lost: lead.status === 'perdido',
        sourceName: campaigns.find((campaign) => campaign.id === lead.campaignId)?.name || 'Sem campanha',
        idleHours: getLeadIdleHours(lead, now),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
      })),
      ...(prospectLeads || []).map((lead) => ({
        id: lead.id,
        kind: 'prospecting' as const,
        createdAt: lead.createdAt,
        funnelId: lead.funnelId,
        ownerUserId: lead.ownerUserId,
        status: lead.status,
        closed: lead.status === 'p_fechada',
        lost: lead.status === 'p_perdida',
        sourceName: services.find((service) => service.id === lead.serviceId)?.name || 'Sem serviço',
        idleHours: getProspectIdleHours(lead, now),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
      })),
    ]
      .filter((item) => !item.ownerUserId || item.ownerUserId === user?.id || user?.role === 'admin')
      .filter((item) => !start || new Date(item.createdAt) >= start);

    if (selectedScope === ALL_SCOPE) return base;
    return base.filter((item) => item.funnelId === selectedScope);
  }, [campaigns, leads, now, period, prospectLeads, selectedScope, services, user?.id, user?.role]);

  const metrics = useMemo(() => {
    const total = records.length;
    const won = records.filter((item) => item.closed).length;
    const lost = records.filter((item) => item.lost).length;
    const stalled = records.filter((item) => !item.closed && !item.lost && item.idleHours >= 24).length;
    const overdue = records.reduce((acc, item) => acc + item.followUps.filter((followUp) => followUp.status === 'pendente' && new Date(followUp.date).getTime() < now).length, 0);
    return { total, won, lost, stalled, overdue, conversion: total > 0 ? (won / total) * 100 : 0 };
  }, [now, records]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, { name: string; total: number; won: number }>();
    for (const record of records) {
      const key = selectedScope === ALL_SCOPE ? (record.funnelId || 'sem_funil') : record.sourceName;
      const name = selectedScope === ALL_SCOPE
        ? (allFunnels.find((funnel) => funnel.id === record.funnelId)?.name || 'Sem funil')
        : record.sourceName;
      if (!map.has(key)) map.set(key, { name, total: 0, won: 0 });
      const row = map.get(key)!;
      row.total += 1;
      if (record.closed) row.won += 1;
    }
    return Array.from(map.values())
      .map((row) => ({ ...row, conversion: row.total > 0 ? (row.won / row.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [allFunnels, records, selectedScope]);

  const disciplineRows = useMemo(() => {
    const byUser = new Map<string, { name: string; total: number; won: number; stalled: number; overdue: number }>();
    for (const record of records) {
      const owner = users.find((item) => item.id === record.ownerUserId);
      const key = record.ownerUserId || 'unassigned';
      const name = owner?.name || (key === 'unassigned' ? 'Sem responsável' : 'Usuário');
      if (!byUser.has(key)) byUser.set(key, { name, total: 0, won: 0, stalled: 0, overdue: 0 });
      const row = byUser.get(key)!;
      row.total += 1;
      if (record.closed) row.won += 1;
      if (!record.closed && !record.lost && record.idleHours >= 24) row.stalled += 1;
      row.overdue += record.followUps.filter((followUp) => followUp.status === 'pendente' && new Date(followUp.date).getTime() < now).length;
    }
    return Array.from(byUser.values()).map((row) => ({ ...row, conversion: row.total > 0 ? (row.won / row.total) * 100 : 0 })).sort((a, b) => b.total - a.total);
  }, [now, records, users]);

  const exportReport = () => {
    const title = activeFunnel ? `Relatório do ${activeFunnel.name}` : 'Relatório Geral de Funis';
    const html = `
      <html><head><meta charset="utf-8" />
      <style>body{font-family:Segoe UI,Arial,sans-serif;padding:16px;color:#111827}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;font-size:12px}th{background:#111827;color:#fff;text-transform:uppercase;font-size:10px}h1{font-size:20px} .summary{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px;margin:12px 0} .card{border:1px solid #d1d5db;border-radius:8px;padding:8px} .label{font-size:10px;text-transform:uppercase;color:#6b7280} .value{font-size:18px;font-weight:700;margin-top:4px}</style>
      </head><body>
      <h1>${escapeHtml(title)}</h1>
      <p>Período: ${escapeHtml(period)} | Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
      <div class="summary">
        <div class="card"><div class="label">Entradas</div><div class="value">${escapeHtml(metrics.total)}</div></div>
        <div class="card"><div class="label">Fechados</div><div class="value">${escapeHtml(metrics.won)}</div></div>
        <div class="card"><div class="label">Perdidos</div><div class="value">${escapeHtml(metrics.lost)}</div></div>
        <div class="card"><div class="label">Conversão</div><div class="value">${escapeHtml(metrics.conversion.toFixed(1))}%</div></div>
        <div class="card"><div class="label">Follow-up atrasado</div><div class="value">${escapeHtml(metrics.overdue)}</div></div>
      </div>
      <table><thead><tr><th>${selectedScope === ALL_SCOPE ? 'Funil' : activeFunnel?.operation === 'prospecting' ? 'Serviço' : 'Campanha'}</th><th>Entradas</th><th>Fechados</th><th>Conversão</th></tr></thead><tbody>
      ${groupedRows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.total)}</td><td>${escapeHtml(row.won)}</td><td>${escapeHtml(row.conversion.toFixed(1))}%</td></tr>`).join('')}
      </tbody></table>
      </body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-funis-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleScopeChange = (value: string) => {
    setSelectedScope(value);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value === ALL_SCOPE) {
        params.delete('funnel');
        params.delete('operation');
        return params;
      }
      const nextFunnel = allFunnels.find((funnel) => funnel.id === value);
      if (nextFunnel) {
        params.set('funnel', nextFunnel.id);
        params.set('operation', nextFunnel.operation);
      }
      return params;
    }, { replace: true });
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold gold-text-gradient tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest">Uma única área de leitura, orientada por funil</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={selectedScope} onChange={(event) => handleScopeChange(event.target.value)} className="rounded-xl border border-border bg-card px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground min-w-[260px]">
            <option value={ALL_SCOPE}>Todos os Funis</option>
            <optgroup label="Funis Comerciais">{allFunnels.filter((funnel) => funnel.operation === 'commercial').map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}</optgroup>
            <optgroup label="Funis de Prospecção">{allFunnels.filter((funnel) => funnel.operation === 'prospecting').map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}</optgroup>
          </select>
          <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} className="rounded-xl border border-border bg-card px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Todo o período</option>
          </select>
          <button onClick={exportReport} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black inline-flex items-center gap-2"><Download className="w-4 h-4" />Exportar</button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={FileSpreadsheet} label="Entradas" value={metrics.total} />
        <MetricCard icon={CheckCircle2} label="Fechados" value={metrics.won} />
        <MetricCard icon={TrendingUp} label="Conversão" value={`${metrics.conversion.toFixed(1)}%`} />
        <MetricCard icon={Clock3} label="Follow-up atrasado" value={metrics.overdue} />
        <MetricCard icon={AlertTriangle} label="Sem ação 24h+" value={metrics.stalled} />
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
          <GitBranchPlus className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">{selectedScope === ALL_SCOPE ? 'Fechamento por Funil' : activeFunnel?.operation === 'prospecting' ? 'Fechamento por Serviço' : 'Fechamento por Campanha'}</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">{selectedScope === ALL_SCOPE ? 'Funil' : activeFunnel?.operation === 'prospecting' ? 'Serviço' : 'Campanha'}</th>
                <th className="px-4 py-3 text-left">Entradas</th>
                <th className="px-4 py-3 text-left">Fechados</th>
                <th className="px-4 py-3 text-left">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nenhum dado para este filtro.</td></tr> : groupedRows.map((row) => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{row.total}</td>
                  <td className="px-4 py-3">{row.won}</td>
                  <td className="px-4 py-3">{row.conversion.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">Disciplina por Responsável</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Responsável</th>
                <th className="px-4 py-3 text-left">Entradas</th>
                <th className="px-4 py-3 text-left">Fechados</th>
                <th className="px-4 py-3 text-left">Conversão</th>
                <th className="px-4 py-3 text-left">Sem ação 24h+</th>
                <th className="px-4 py-3 text-left">Follow-up atrasado</th>
              </tr>
            </thead>
            <tbody>
              {disciplineRows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum responsável encontrado para este filtro.</td></tr> : disciplineRows.map((row) => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{row.total}</td>
                  <td className="px-4 py-3">{row.won}</td>
                  <td className="px-4 py-3">{row.conversion.toFixed(1)}%</td>
                  <td className="px-4 py-3">{row.stalled}</td>
                  <td className="px-4 py-3">{row.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof FileSpreadsheet; label: string; value: string | number }) {
  return <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-xl"><div className="w-9 h-9 rounded-lg bg-accent border border-border flex items-center justify-center text-primary"><Icon className="w-4 h-4" /></div><div><p className="text-[10px] uppercase tracking-widest text-gold-500/60">{label}</p><p className="text-lg font-serif font-bold">{value}</p></div></div>;
}
