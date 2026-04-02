import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { CalendarRange, Download, TrendingUp, Users, CheckCircle2, AlertTriangle, Clock3, FileSpreadsheet } from 'lucide-react';
import { isAdminUser } from '@/lib/access';

type PeriodFilter = '7' | '30' | '90' | 'all';

const getCurrentWeekKey = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
};

const isInWeek = (dateValue: string, weekKey: string): boolean => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const monday = new Date(`${weekKey}T00:00:00`);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return date >= monday && date < nextMonday;
};

const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getProspectIdleHours = (lead: {
  createdAt: string;
  lastInteractionAt?: string;
  notes?: Array<{ createdAt: string }>;
  tasks?: Array<{ date: string }>;
  followUps?: Array<{ date: string }>;
}, nowMs = Date.now()): number => {
  const candidates: number[] = [];
  const createdAt = Date.parse(lead.createdAt || '');
  if (!Number.isNaN(createdAt)) candidates.push(createdAt);
  const lastInteractionAt = Date.parse(lead.lastInteractionAt || '');
  if (!Number.isNaN(lastInteractionAt)) candidates.push(lastInteractionAt);
  for (const note of lead.notes || []) {
    const noteTime = Date.parse(note.createdAt || '');
    if (!Number.isNaN(noteTime)) candidates.push(noteTime);
  }
  for (const task of lead.tasks || []) {
    const taskTime = Date.parse(task.date || '');
    if (!Number.isNaN(taskTime)) candidates.push(taskTime);
  }
  for (const followUp of lead.followUps || []) {
    const followTime = Date.parse(followUp.date || '');
    if (!Number.isNaN(followTime)) candidates.push(followTime);
  }
  const base = candidates.length > 0 ? Math.max(...candidates) : nowMs;
  return Math.max(0, (nowMs - base) / 36e5);
};

export function ProspectingReports() {
  const { user, users, fetchUsers } = useAuthStore();
  const { prospectLeads, services } = useStore();
  const [period, setPeriod] = useState<PeriodFilter>('30');
  const isAdmin = isAdminUser(user);

  useEffect(() => {
    if (isAdminUser(user)) {
      fetchUsers().catch(() => null);
    }
  }, [fetchUsers, user]);

  const scopedLeads = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return prospectLeads || [];
    return (prospectLeads || []).filter((lead) => !lead.ownerUserId || lead.ownerUserId === user.id);
  }, [isAdmin, prospectLeads, user]);

  const filteredLeads = useMemo(() => {
    if (period === 'all') return scopedLeads;
    const days = Number(period);
    const start = new Date();
    start.setDate(start.getDate() - days);
    return scopedLeads.filter((lead) => new Date(lead.createdAt) >= start);
  }, [scopedLeads, period]);

  const generalFilteredLeads = useMemo(() => {
    if (period === 'all') return prospectLeads || [];
    const days = Number(period);
    const start = new Date();
    start.setDate(start.getDate() - days);
    return (prospectLeads || []).filter((lead) => new Date(lead.createdAt) >= start);
  }, [prospectLeads, period]);

  const serviceRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; entries: number; closed: number }>();
    for (const lead of filteredLeads) {
      const key = lead.serviceId || 'sem_servico';
      if (!map.has(key)) {
        const serviceName = services.find((service) => service.id === lead.serviceId)?.name || 'Sem servico';
        map.set(key, { id: key, name: serviceName, entries: 0, closed: 0 });
      }
      const row = map.get(key)!;
      row.entries += 1;
      if (lead.status === 'p_fechada') row.closed += 1;
    }
    return Array.from(map.values())
      .map((row) => ({ ...row, conversionRate: row.entries > 0 ? (row.closed / row.entries) * 100 : 0 }))
      .sort((a, b) => b.entries - a.entries);
  }, [filteredLeads, services]);

  const metrics = useMemo(() => {
    const total = filteredLeads.length;
    const won = filteredLeads.filter((lead) => lead.status === 'p_fechada').length;
    const lost = filteredLeads.filter((lead) => lead.status === 'p_perdida').length;
    const inProgress = total - won - lost;
    const conversion = total > 0 ? (won / total) * 100 : 0;
    const called = filteredLeads.filter((lead) => (lead.notes || []).some((note) => note.type === 'call')).length;
    return { total, won, lost, inProgress, conversion, called, rows: serviceRows };
  }, [filteredLeads, serviceRows]);

  const generalMetrics = useMemo(() => {
    const total = generalFilteredLeads.length;
    const won = generalFilteredLeads.filter((lead) => lead.status === 'p_fechada').length;
    const lost = generalFilteredLeads.filter((lead) => lead.status === 'p_perdida').length;
    const inProgress = total - won - lost;
    const conversion = total > 0 ? (won / total) * 100 : 0;
    const rowsByService = new Map<string, { name: string; entries: number; closed: number }>();
    for (const lead of generalFilteredLeads) {
      const key = lead.serviceId || 'sem_servico';
      if (!rowsByService.has(key)) {
        const serviceName = services.find((service) => service.id === lead.serviceId)?.name || 'Sem servico';
        rowsByService.set(key, { name: serviceName, entries: 0, closed: 0 });
      }
      const row = rowsByService.get(key)!;
      row.entries += 1;
      if (lead.status === 'p_fechada') row.closed += 1;
    }
    const rows = Array.from(rowsByService.entries())
      .map(([id, row]) => ({
        id,
        ...row,
        conversionRate: row.entries > 0 ? (row.closed / row.entries) * 100 : 0,
      }))
      .sort((a, b) => b.entries - a.entries);
    return { total, won, lost, inProgress, conversion, rows };
  }, [generalFilteredLeads, services]);

  const disciplineRows = useMemo(() => {
    const now = Date.now();
    const ownerMap = new Map<string, { name: string; sector: string }>();
    if (user) ownerMap.set(user.id, { name: user.name, sector: user.sector });
    for (const appUser of users || []) ownerMap.set(appUser.id, { name: appUser.name, sector: appUser.sector });

    const rows = new Map<string, {
      ownerId: string;
      ownerName: string;
      sector: string;
      total: number;
      closed: number;
      idle24h: number;
      overdueFollowUps: number;
      pendingTasks: number;
      calls: number;
    }>();

    const ensureRow = (ownerId: string, ownerName: string, sector: string) => {
      if (!rows.has(ownerId)) {
        rows.set(ownerId, {
          ownerId,
          ownerName,
          sector,
          total: 0,
          closed: 0,
          idle24h: 0,
          overdueFollowUps: 0,
          pendingTasks: 0,
          calls: 0,
        });
      }
      return rows.get(ownerId)!;
    };

    for (const lead of filteredLeads) {
      const ownerId = lead.ownerUserId || user?.id || 'unassigned';
      const ownerInfo = ownerMap.get(ownerId);
      const row = ensureRow(ownerId, ownerInfo?.name || 'Sem responsavel', ownerInfo?.sector || 'N/A');
      row.total += 1;
      if (lead.status === 'p_fechada') row.closed += 1;
      if (lead.status !== 'p_fechada' && lead.status !== 'p_perdida' && getProspectIdleHours(lead, now) >= 24) row.idle24h += 1;
      row.overdueFollowUps += (lead.followUps || []).filter((follow) => follow.status === 'pendente' && new Date(follow.date).getTime() < now).length;
      row.pendingTasks += (lead.tasks || []).filter((task) => task.status === 'pendente').length;
      row.calls += (lead.notes || []).filter((note) => note.type === 'call').length;
    }

    return Array.from(rows.values())
      .map((row) => ({ ...row, conversion: row.total > 0 ? (row.closed / row.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredLeads, user, users]);

  const sellerDiscipline = useMemo(() => {
    if (isAdmin) return null;
    const row = disciplineRows.find((item) => item.ownerId === user?.id);
    if (row) return row;
    return {
      ownerId: user?.id || 'self',
      ownerName: user?.name || 'Vendedor',
      sector: user?.sector || 'Comercial',
      total: 0,
      closed: 0,
      idle24h: 0,
      overdueFollowUps: 0,
      pendingTasks: 0,
      calls: 0,
      conversion: 0,
    };
  }, [disciplineRows, isAdmin, user]);

  const weeklyData = useMemo(() => {
    const weekKey = getCurrentWeekKey();
    const weekLeads = filteredLeads.filter((lead) => isInWeek(lead.createdAt, weekKey));
    const total = weekLeads.length;
    const won = weekLeads.filter((lead) => lead.status === 'p_fechada').length;
    const lost = weekLeads.filter((lead) => lead.status === 'p_perdida').length;
    const called = weekLeads.filter((lead) => (lead.notes || []).some((note) => note.type === 'call')).length;
    const rowsByService = new Map<string, { name: string; entries: number; closed: number }>();
    for (const lead of weekLeads) {
      const key = lead.serviceId || 'sem_servico';
      if (!rowsByService.has(key)) {
        const serviceName = services.find((service) => service.id === lead.serviceId)?.name || 'Sem servico';
        rowsByService.set(key, { name: serviceName, entries: 0, closed: 0 });
      }
      const row = rowsByService.get(key)!;
      row.entries += 1;
      if (lead.status === 'p_fechada') row.closed += 1;
    }
    const rows = Array.from(rowsByService.values())
      .map((row) => ({ ...row, conversionRate: row.entries > 0 ? (row.closed / row.entries) * 100 : 0 }))
      .sort((a, b) => b.entries - a.entries);
    return { weekKey, total, won, lost, called, conversion: total > 0 ? (won / total) * 100 : 0, rows };
  }, [filteredLeads, services]);

  const objectionRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of filteredLeads) {
      if (!lead.objectionReason) continue;
      map.set(lead.objectionReason, (map.get(lead.objectionReason) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([reason, total]) => ({ reason, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredLeads]);

  const exportMainReport = () => {
    const reportTitle = isAdmin ? 'Relatorio de Prospeccao - Geral' : `Relatorio de Prospeccao - ${user?.name || 'Vendedor'}`;
    const ownerName = isAdmin ? 'Equipe completa' : user?.name || 'Vendedor';
    const generatedAt = new Date().toLocaleString('pt-BR');
    const disciplineTableRows = isAdmin ? disciplineRows : sellerDiscipline ? [sellerDiscipline] : [];

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Segoe UI, Arial, sans-serif; padding: 16px; color: #1f2937; }
            h1 { margin: 0 0 8px 0; font-size: 20px; }
            .meta { margin-bottom: 16px; font-size: 12px; color: #4b5563; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 16px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #111827; color: #f9fafb; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; }
            .section { margin-top: 8px; font-size: 14px; font-weight: 700; color: #111827; }
            .summary { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; margin: 12px 0; }
            .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; }
            .card-label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: .04em; }
            .card-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(reportTitle)}</h1>
          <div class="meta">Responsavel: ${escapeHtml(ownerName)} | Periodo: ${escapeHtml(period)} | Gerado em: ${escapeHtml(generatedAt)}</div>

          <div class="summary">
            <div class="card"><div class="card-label">Clinicas na base</div><div class="card-value">${escapeHtml(metrics.total)}</div></div>
            <div class="card"><div class="card-label">Clinicas ligadas</div><div class="card-value">${escapeHtml(metrics.called)}</div></div>
            <div class="card"><div class="card-label">Fechadas</div><div class="card-value">${escapeHtml(metrics.won)}</div></div>
            <div class="card"><div class="card-label">Conversao</div><div class="card-value">${escapeHtml(metrics.conversion.toFixed(1))}%</div></div>
            <div class="card"><div class="card-label">Em pipeline</div><div class="card-value">${escapeHtml(metrics.inProgress)}</div></div>
          </div>

          <div class="section">Disciplina de Prospeccao</div>
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Clinicas</th>
                <th>Ligacoes</th>
                <th>Fechadas</th>
                <th>Conversao</th>
                <th>Sem acao 24h+</th>
                <th>Follow-up atrasado</th>
                <th>Tarefas pendentes</th>
              </tr>
            </thead>
            <tbody>
              ${disciplineTableRows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.ownerName)}</td>
                  <td>${escapeHtml(row.total)}</td>
                  <td>${escapeHtml(row.calls)}</td>
                  <td>${escapeHtml(row.closed)}</td>
                  <td>${escapeHtml(row.conversion.toFixed(1))}%</td>
                  <td>${escapeHtml(row.idle24h)}</td>
                  <td>${escapeHtml(row.overdueFollowUps)}</td>
                  <td>${escapeHtml(row.pendingTasks)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section">Fechamento por Servico</div>
          <table>
            <thead>
              <tr>
                <th>Servico</th>
                <th>Clinicas</th>
                <th>Fechadas</th>
                <th>Conversao</th>
                <th>Indice comercial</th>
              </tr>
            </thead>
            <tbody>
              ${metrics.rows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${escapeHtml(row.entries)}</td>
                  <td>${escapeHtml(row.closed)}</td>
                  <td>${escapeHtml(row.conversionRate.toFixed(1))}%</td>
                  <td>${escapeHtml(row.entries > 0 ? Math.round((row.closed / row.entries) * 100) : 0)} / 100</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section">Ranking de Objecoes</div>
          <table>
            <thead>
              <tr>
                <th>Objecao</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${objectionRows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.reason)}</td>
                  <td>${escapeHtml(row.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-prospeccao-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportWeeklyReport = () => {
    const generatedAt = new Date().toLocaleString('pt-BR');
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Segoe UI, Arial, sans-serif; padding: 16px; color: #1f2937; }
            h1 { margin: 0 0 8px 0; font-size: 20px; }
            .meta { margin-bottom: 16px; font-size: 12px; color: #4b5563; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 16px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #111827; color: #f9fafb; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; }
            .summary { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; margin: 12px 0; }
            .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; }
            .card-label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: .04em; }
            .card-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
          </style>
        </head>
        <body>
          <h1>Relatorio Semanal de Prospeccao</h1>
          <div class="meta">Semana: ${escapeHtml(weeklyData.weekKey)} | Gerado em: ${escapeHtml(generatedAt)}</div>
          <div class="summary">
            <div class="card"><div class="card-label">Clinicas</div><div class="card-value">${escapeHtml(weeklyData.total)}</div></div>
            <div class="card"><div class="card-label">Ligacoes</div><div class="card-value">${escapeHtml(weeklyData.called)}</div></div>
            <div class="card"><div class="card-label">Fechadas</div><div class="card-value">${escapeHtml(weeklyData.won)}</div></div>
            <div class="card"><div class="card-label">Perdidas</div><div class="card-value">${escapeHtml(weeklyData.lost)}</div></div>
            <div class="card"><div class="card-label">Conversao</div><div class="card-value">${escapeHtml(weeklyData.conversion.toFixed(1))}%</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Servico</th>
                <th>Clinicas</th>
                <th>Fechadas</th>
                <th>Conversao</th>
              </tr>
            </thead>
            <tbody>
              ${weeklyData.rows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${escapeHtml(row.entries)}</td>
                  <td>${escapeHtml(row.closed)}</td>
                  <td>${escapeHtml(row.conversionRate.toFixed(1))}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-semanal-prospeccao-${weeklyData.weekKey}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold gold-text-gradient tracking-tight">
            {isAdmin ? 'Relatorios de Prospeccao' : `Relatorios de Prospeccao de ${user?.name || 'Vendedor'}`}
          </h1>
          <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest">
            Configuracao no mesmo padrao do relatorio principal, focada em clinicas
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            className="px-3 py-2 rounded-lg bg-card border border-border text-sm"
          >
            <option value="7">Ultimos 7 dias</option>
            <option value="30">Ultimos 30 dias</option>
            <option value="90">Ultimos 90 dias</option>
            <option value="all">Todo periodo</option>
          </select>
          <button
            type="button"
            onClick={exportMainReport}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar Planilha
          </button>
        </div>
      </header>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarRange className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-serif font-bold">Relatorio Semanal Automatico</h2>
          </div>
          <button
            type="button"
            onClick={exportWeeklyReport}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar Semanal
          </button>
        </div>
        <div className="p-6 text-sm text-muted-foreground">
          <p>
            Semana {weeklyData.weekKey}: {weeklyData.total} clinicas, {weeklyData.called} ligacoes registradas, {weeklyData.won} fechadas, conversao {weeklyData.conversion.toFixed(1)}%.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={Users} label={isAdmin ? 'Clinicas na base' : 'Suas clinicas'} value={metrics.total} />
        <MetricCard icon={FileSpreadsheet} label={isAdmin ? 'Clinicas ligadas' : 'Suas ligacoes'} value={metrics.called} />
        <MetricCard icon={CheckCircle2} label={isAdmin ? 'Fechadas' : 'Seus fechamentos'} value={metrics.won} />
        <MetricCard icon={TrendingUp} label={isAdmin ? 'Conversao' : 'Sua conversao'} value={`${metrics.conversion.toFixed(1)}%`} />
        <MetricCard icon={FileSpreadsheet} label={isAdmin ? 'Em pipeline' : 'No seu pipeline'} value={metrics.inProgress} />
      </section>

      {!isAdmin && (
        <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-serif font-bold">Comparativo Geral da Prospeccao</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard icon={Users} label="Clinicas gerais" value={generalMetrics.total} />
            <MetricCard icon={CheckCircle2} label="Fechadas gerais" value={generalMetrics.won} />
            <MetricCard icon={TrendingUp} label="Conversao geral" value={`${generalMetrics.conversion.toFixed(1)}%`} />
            <MetricCard icon={FileSpreadsheet} label="Pipeline geral" value={generalMetrics.inProgress} />
          </div>
          <div className="px-6 pb-6 overflow-x-auto scrollbar-none">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
                <tr>
                  <th className="px-2 py-3 text-left">Servico</th>
                  <th className="px-2 py-3 text-left">Clinicas</th>
                  <th className="px-2 py-3 text-left">Fechadas</th>
                  <th className="px-2 py-3 text-left">Conversao</th>
                </tr>
              </thead>
              <tbody>
                {generalMetrics.rows.slice(0, 6).map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{row.entries}</td>
                    <td className="px-2 py-2">{row.closed}</td>
                    <td className="px-2 py-2">{row.conversionRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">{isAdmin ? 'Disciplina Comercial por Vendedor' : 'Sua Disciplina Comercial'}</h2>
        </div>
        {isAdmin ? (
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left">Vendedor</th>
                  <th className="px-4 py-3 text-left">Clinicas</th>
                  <th className="px-4 py-3 text-left">Ligacoes</th>
                  <th className="px-4 py-3 text-left">Fechadas</th>
                  <th className="px-4 py-3 text-left">Conversao</th>
                  <th className="px-4 py-3 text-left">Sem acao 24h+</th>
                  <th className="px-4 py-3 text-left">Follow-up atrasado</th>
                  <th className="px-4 py-3 text-left">Tarefas pendentes</th>
                </tr>
              </thead>
              <tbody>
                {disciplineRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum dado de disciplina para este periodo.</td>
                  </tr>
                ) : (
                  disciplineRows.map((row) => (
                    <tr key={row.ownerId} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{row.ownerName}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{row.sector}</p>
                      </td>
                      <td className="px-4 py-3">{row.total}</td>
                      <td className="px-4 py-3">{row.calls}</td>
                      <td className="px-4 py-3">{row.closed}</td>
                      <td className="px-4 py-3">{row.conversion.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-amber-400">{row.idle24h}</td>
                      <td className="px-4 py-3 text-amber-400">{row.overdueFollowUps}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="w-3 h-3" />
                          {row.pendingTasks}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-2 md:grid-cols-6 gap-4">
            <MetricCard icon={Users} label="Suas clinicas" value={sellerDiscipline?.total || 0} />
            <MetricCard icon={FileSpreadsheet} label="Suas ligacoes" value={sellerDiscipline?.calls || 0} />
            <MetricCard icon={CheckCircle2} label="Seus fechamentos" value={sellerDiscipline?.closed || 0} />
            <MetricCard icon={TrendingUp} label="Sua conversao" value={`${(sellerDiscipline?.conversion || 0).toFixed(1)}%`} />
            <MetricCard icon={AlertTriangle} label="Sem acao 24h+" value={sellerDiscipline?.idle24h || 0} />
            <MetricCard icon={Clock3} label="Pendencias" value={(sellerDiscipline?.overdueFollowUps || 0) + (sellerDiscipline?.pendingTasks || 0)} />
          </div>
        )}
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent">
          <h2 className="text-lg font-serif font-bold">{isAdmin ? 'Fechamento por Servico' : 'Fechamento dos Seus Servicos'}</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Servico</th>
                <th className="px-4 py-3 text-left">Clinicas</th>
                <th className="px-4 py-3 text-left">Fechadas</th>
                <th className="px-4 py-3 text-left">Conversao</th>
                <th className="px-4 py-3 text-left">Indice comercial</th>
              </tr>
            </thead>
            <tbody>
              {metrics.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum dado para este periodo.</td>
                </tr>
              ) : (
                metrics.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-accent/40">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3">{row.entries}</td>
                    <td className="px-4 py-3">{row.closed}</td>
                    <td className="px-4 py-3">{row.conversionRate.toFixed(1)}%</td>
                    <td className="px-4 py-3">{row.entries > 0 ? `${Math.round((row.closed / row.entries) * 100)} / 100` : '0 / 100'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent">
          <h2 className="text-lg font-serif font-bold">Ranking de Objecoes</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Objecao</th>
                <th className="px-4 py-3 text-left">Total</th>
              </tr>
            </thead>
            <tbody>
              {objectionRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Nenhuma objecao registrada no periodo.</td>
                </tr>
              ) : (
                objectionRows.map((row) => (
                  <tr key={row.reason} className="border-b border-border/50 hover:bg-accent/40">
                    <td className="px-4 py-3">{row.reason}</td>
                    <td className="px-4 py-3">{row.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-xl">
      <div className="w-9 h-9 rounded-lg bg-accent border border-border flex items-center justify-center text-primary">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gold-500/60">{label}</p>
        <p className="text-lg font-serif font-bold">{value}</p>
      </div>
    </div>
  );
}

