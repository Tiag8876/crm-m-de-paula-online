import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileSpreadsheet, TrendingUp, CheckCircle2, AlertTriangle, Clock3, GitBranchPlus, WalletCards, BadgeDollarSign, Target } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import type { CampaignSpendEntry, FunnelConfig } from '@/types/crm';
import { PremiumSelect } from '@/components/PremiumSelect';

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
const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getPeriodRange = (period: PeriodFilter) => {
  if (period === 'all') return { start: null as Date | null, end: new Date() };
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(period) + 1);
  return { start, end };
};

const getOverlapAmount = (entry: CampaignSpendEntry, start: Date | null, end: Date) => {
  const amount = Number(entry.amount) || 0;
  if (!start) return amount;

  const entryStart = new Date(`${entry.startDate}T00:00:00`);
  const entryEnd = new Date(`${entry.endDate}T23:59:59.999`);
  if (Number.isNaN(entryStart.getTime()) || Number.isNaN(entryEnd.getTime())) return 0;
  if (entryEnd < start || entryStart > end) return 0;

  const overlapStart = entryStart > start ? entryStart : start;
  const overlapEnd = entryEnd < end ? entryEnd : end;
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((entryEnd.getTime() - entryStart.getTime() + 1) / dayMs));
  const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime() + 1) / dayMs));
  if (overlapDays <= 0) return 0;
  return amount * (overlapDays / totalDays);
};

export function SalesReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, users, fetchUsers } = useAuthStore();
  const { funnels, leads, prospectLeads, campaigns, campaignSpendEntries, services } = useStore();
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
  const { start: rangeStart, end: rangeEnd } = getPeriodRange(period);

  const scopeOptions = allFunnels.map((funnel) => ({
    value: funnel.id,
    label: funnel.name,
    description: funnel.operation === 'prospecting' ? 'Funil de prospecção' : 'Funil comercial',
    group: funnel.operation === 'prospecting' ? 'Prospecção' : 'Comercial',
  }));
  const periodOptions = [
    { value: '7', label: 'Últimos 7 dias', description: 'Janela curta de leitura', group: 'Período' },
    { value: '30', label: 'Últimos 30 dias', description: 'Visão mensal padrão', group: 'Período' },
    { value: '90', label: 'Últimos 90 dias', description: 'Comparativo trimestral', group: 'Período' },
    { value: 'all', label: 'Todo o período', description: 'Histórico completo', group: 'Período' },
  ];

  const records = useMemo(() => {
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
        sourceId: lead.campaignId,
        idleHours: getLeadIdleHours(lead, now),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
        estimatedValue: Number(lead.estimatedValue) || 0,
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
        sourceId: lead.serviceId,
        idleHours: getProspectIdleHours(lead, now),
        followUps: lead.followUps || [],
        tasks: lead.tasks || [],
        estimatedValue: 0,
      })),
    ]
      .filter((item) => !item.ownerUserId || item.ownerUserId === user?.id || user?.role === 'admin')
      .filter((item) => !rangeStart || new Date(item.createdAt) >= rangeStart);

    if (selectedScope === ALL_SCOPE) return base;
    return base.filter((item) => item.funnelId === selectedScope);
  }, [campaigns, leads, now, prospectLeads, rangeStart, selectedScope, services, user?.id, user?.role]);

  const spendByCampaign = useMemo(() => {
    const trackedIds = new Set(records.filter((record) => record.kind === 'commercial' && record.sourceId).map((record) => record.sourceId as string));
    const map = new Map<string, number>();
    for (const entry of campaignSpendEntries || []) {
      if (trackedIds.size > 0 && !trackedIds.has(entry.campaignId)) continue;
      const allocated = getOverlapAmount(entry, rangeStart, rangeEnd);
      if (allocated <= 0) continue;
      map.set(entry.campaignId, (map.get(entry.campaignId) || 0) + allocated);
    }
    return map;
  }, [campaignSpendEntries, rangeEnd, rangeStart, records]);

  const metrics = useMemo(() => {
    const total = records.length;
    const won = records.filter((item) => item.closed).length;
    const lost = records.filter((item) => item.lost).length;
    const stalled = records.filter((item) => !item.closed && !item.lost && item.idleHours >= 24).length;
    const overdue = records.reduce((acc, item) => acc + item.followUps.filter((followUp) => followUp.status === 'pendente' && new Date(followUp.date).getTime() < now).length, 0);
    const totalSpend = Array.from(spendByCampaign.values()).reduce((sum, value) => sum + value, 0);
    const wonRevenue = records.reduce((sum, record) => sum + (record.closed ? record.estimatedValue : 0), 0);
    const pipelineValue = records.reduce((sum, record) => sum + record.estimatedValue, 0);
    const cpl = total > 0 ? totalSpend / total : 0;
    const cac = won > 0 ? totalSpend / won : 0;
    const roi = totalSpend > 0 ? ((wonRevenue - totalSpend) / totalSpend) * 100 : 0;
    return { total, won, lost, stalled, overdue, conversion: total > 0 ? (won / total) * 100 : 0, totalSpend, wonRevenue, pipelineValue, cpl, cac, roi };
  }, [now, records, spendByCampaign]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, { name: string; total: number; won: number; revenue: number; spend: number }>();
    for (const record of records) {
      const key = selectedScope === ALL_SCOPE ? (record.funnelId || 'sem_funil') : (record.sourceId || record.sourceName);
      const name = selectedScope === ALL_SCOPE
        ? (allFunnels.find((funnel) => funnel.id === record.funnelId)?.name || 'Sem funil')
        : record.sourceName;
      if (!map.has(key)) map.set(key, { name, total: 0, won: 0, revenue: 0, spend: 0 });
      const row = map.get(key)!;
      row.total += 1;
      if (record.closed) row.won += 1;
      row.revenue += record.closed ? record.estimatedValue : 0;
      if (selectedScope === ALL_SCOPE) {
        if (record.kind === 'commercial' && record.sourceId) {
          row.spend += spendByCampaign.get(record.sourceId) || 0;
        }
      } else if (activeFunnel?.operation === 'commercial' && record.kind === 'commercial' && record.sourceId) {
        row.spend = spendByCampaign.get(record.sourceId) || 0;
      }
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        conversion: row.total > 0 ? (row.won / row.total) * 100 : 0,
        roi: row.spend > 0 ? ((row.revenue - row.spend) / row.spend) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [activeFunnel?.operation, allFunnels, records, selectedScope, spendByCampaign]);

  const disciplineRows = useMemo(() => {
    const byUser = new Map<string, { name: string; total: number; won: number; stalled: number; overdue: number; revenue: number }>();
    for (const record of records) {
      const owner = users.find((item) => item.id === record.ownerUserId);
      const key = record.ownerUserId || 'unassigned';
      const name = owner?.name || (key === 'unassigned' ? 'Sem responsável' : 'Usuário');
      if (!byUser.has(key)) byUser.set(key, { name, total: 0, won: 0, stalled: 0, overdue: 0, revenue: 0 });
      const row = byUser.get(key)!;
      row.total += 1;
      if (record.closed) row.won += 1;
      if (!record.closed && !record.lost && record.idleHours >= 24) row.stalled += 1;
      row.overdue += record.followUps.filter((followUp) => followUp.status === 'pendente' && new Date(followUp.date).getTime() < now).length;
      row.revenue += record.closed ? record.estimatedValue : 0;
    }
    return Array.from(byUser.values()).map((row) => ({ ...row, conversion: row.total > 0 ? (row.won / row.total) * 100 : 0 })).sort((a, b) => b.total - a.total);
  }, [now, records, users]);

  const exportReport = () => {
    const title = activeFunnel ? `Relatório do ${activeFunnel.name}` : 'Relatório Geral de Funis';
    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111827;background:#fffaf0}
        table{border-collapse:collapse;width:100%;margin-top:16px;background:#fff;border-top:4px solid #d4af37}
        th,td{border:1px solid #e5e7eb;padding:10px 12px;text-align:left;font-size:12px}
        th{background:#f8f0d0;color:#5b4310;text-transform:uppercase;font-size:10px;letter-spacing:.12em}
        .summary{width:100%;border-collapse:separate;border-spacing:12px 0;margin:18px 0}
        .card{border:1px solid #ead9ac;border-radius:14px;padding:12px;background:#fffdf7;min-width:120px}
        .label{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#8a6a15}
        .value{font-size:20px;font-weight:700;margin-top:6px;color:#111827}
        .brand{border:1px solid #e5d3a1;border-radius:16px;background:linear-gradient(180deg,#111111 0%,#171717 100%);padding:20px 24px;color:#f5d06f}
        .brand-top{height:4px;background:#d4af37;border-radius:999px;margin-bottom:16px}
        .brand-kicker{font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#f3d98a}
        .brand-title{font-size:28px;font-family:Georgia,serif;font-weight:700;margin-top:10px;color:#f5d06f}
        .brand-sub{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#d7bf7a;margin-top:8px}
        .meta{margin-top:16px;color:#6b7280;font-size:12px}
      </style>
      </head><body>
      <div class="brand"><div class="brand-top"></div><div class="brand-kicker">Relatório Premium</div><div class="brand-title">CRM M DE PAULA</div><div class="brand-sub">${escapeHtml(title)}</div></div>
      <p class="meta">Período: ${escapeHtml(period)} | Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
      <table class="summary"><tr>
        <td class="card"><div class="label">Entradas</div><div class="value">${escapeHtml(metrics.total)}</div></td>
        <td class="card"><div class="label">Fechados</div><div class="value">${escapeHtml(metrics.won)}</div></td>
        <td class="card"><div class="label">Conversão</div><div class="value">${escapeHtml(metrics.conversion.toFixed(1))}%</div></td>
        <td class="card"><div class="label">Investimento</div><div class="value">${escapeHtml(formatCurrency(metrics.totalSpend))}</div></td>
        <td class="card"><div class="label">Receita</div><div class="value">${escapeHtml(formatCurrency(metrics.wonRevenue))}</div></td>
        <td class="card"><div class="label">ROI</div><div class="value">${escapeHtml(formatPercent(metrics.roi))}</div></td>
      </tr></table>
      <table><thead><tr><th>${selectedScope === ALL_SCOPE ? 'Funil' : activeFunnel?.operation === 'prospecting' ? 'Serviço' : 'Campanha'}</th><th>Entradas</th><th>Fechados</th><th>Conversão</th><th>Investimento</th><th>Receita</th><th>ROI</th></tr></thead><tbody>
      ${groupedRows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.total)}</td><td>${escapeHtml(row.won)}</td><td>${escapeHtml(row.conversion.toFixed(1))}%</td><td>${escapeHtml(formatCurrency(row.spend))}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td><td>${escapeHtml(formatPercent(row.roi))}</td></tr>`).join('')}
      </tbody></table>
      </body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm-m-de-paula-relatorio-premium-${new Date().toISOString().slice(0, 10)}.xls`;
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold gold-text-gradient tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-2 text-[11px] uppercase tracking-widest">Leitura premium por período, funil, investimento e retorno</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <PremiumSelect
            options={scopeOptions}
            value={selectedScope === ALL_SCOPE ? '' : selectedScope}
            onChange={(nextValue) => handleScopeChange(nextValue || ALL_SCOPE)}
            placeholder="Buscar funil"
            emptyLabel="Todos os funis"
            emptyDescription="Visão consolidada"
          />
          <PremiumSelect
            options={periodOptions}
            value={period}
            onChange={(nextValue) => setPeriod(nextValue as PeriodFilter)}
            placeholder="Selecionar período"
          />
          <button onClick={exportReport} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black inline-flex items-center gap-2"><Download className="w-4 h-4" />Exportar</button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <MetricCard icon={FileSpreadsheet} label="Entradas" value={metrics.total} />
        <MetricCard icon={CheckCircle2} label="Fechados" value={metrics.won} />
        <MetricCard icon={TrendingUp} label="Conversão" value={formatPercent(metrics.conversion)} />
        <MetricCard icon={WalletCards} label="Investimento" value={formatCurrency(metrics.totalSpend)} />
        <MetricCard icon={BadgeDollarSign} label="Receita fechada" value={formatCurrency(metrics.wonRevenue)} />
        <MetricCard icon={Target} label="ROI" value={formatPercent(metrics.roi)} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MetricCard icon={BadgeDollarSign} label="Valor em pipeline" value={formatCurrency(metrics.pipelineValue)} />
        <MetricCard icon={WalletCards} label="Custo por lead" value={formatCurrency(metrics.cpl)} />
        <MetricCard icon={CheckCircle2} label="CAC" value={formatCurrency(metrics.cac)} />
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-accent flex items-center gap-3">
          <GitBranchPlus className="w-5 h-5 text-primary" />
          <h2 className="text-base font-serif font-bold">{selectedScope === ALL_SCOPE ? 'Fechamento por Funil' : activeFunnel?.operation === 'prospecting' ? 'Fechamento por Serviço' : 'Fechamento por Campanha'}</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm border-t-4 border-t-gold-500/70">
            <thead className="bg-gold-500/10 text-[10px] uppercase tracking-widest text-gold-500/80 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">{selectedScope === ALL_SCOPE ? 'Funil' : activeFunnel?.operation === 'prospecting' ? 'Serviço' : 'Campanha'}</th>
                <th className="px-4 py-3 text-left">Entradas</th>
                <th className="px-4 py-3 text-left">Fechados</th>
                <th className="px-4 py-3 text-left">Conversão</th>
                <th className="px-4 py-3 text-left">Investimento</th>
                <th className="px-4 py-3 text-left">Receita</th>
                <th className="px-4 py-3 text-left">ROI</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum dado para este filtro.</td></tr> : groupedRows.map((row) => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{row.total}</td>
                  <td className="px-4 py-3">{row.won}</td>
                  <td className="px-4 py-3">{formatPercent(row.conversion)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.spend)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-3">{formatPercent(row.roi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-accent flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h2 className="text-base font-serif font-bold">Disciplina por Responsável</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm border-t-4 border-t-gold-500/70">
            <thead className="bg-gold-500/10 text-[10px] uppercase tracking-widest text-gold-500/80 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Responsável</th>
                <th className="px-4 py-3 text-left">Entradas</th>
                <th className="px-4 py-3 text-left">Fechados</th>
                <th className="px-4 py-3 text-left">Conversão</th>
                <th className="px-4 py-3 text-left">Sem ação 24h+</th>
                <th className="px-4 py-3 text-left">Follow-up atrasado</th>
                <th className="px-4 py-3 text-left">Receita</th>
              </tr>
            </thead>
            <tbody>
              {disciplineRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum responsável encontrado para este filtro.</td></tr> : disciplineRows.map((row) => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{row.total}</td>
                  <td className="px-4 py-3">{row.won}</td>
                  <td className="px-4 py-3">{formatPercent(row.conversion)}</td>
                  <td className="px-4 py-3">{row.stalled}</td>
                  <td className="px-4 py-3">{row.overdue}</td>
                  <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
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
  return <div className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-xl"><div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center text-primary"><Icon className="w-4 h-4" /></div><div><p className="text-[10px] uppercase tracking-widest text-gold-500/60">{label}</p><p className="text-base font-serif font-bold">{value}</p></div></div>;
}
