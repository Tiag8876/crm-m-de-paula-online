import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, FileText, Settings, Megaphone, CheckCircle2, Clock3, AlertTriangle, GitBranchPlus, ArrowRight } from 'lucide-react';
import { isToday, format } from 'date-fns';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import type { FunnelConfig } from '@/types/crm';

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

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { funnels, leads, prospectLeads, campaigns, services } = useStore();
  const [selectedScope, setSelectedScope] = useState<string>(ALL_SCOPE);

  const allFunnels = sortFunnels(funnels || []);

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
    const commercial = (leads || []).map((lead) => ({
      id: lead.id,
      kind: 'commercial' as const,
      name: lead.name,
      subtitle: lead.phone,
      status: lead.status,
      createdAt: lead.createdAt,
      detailPath: `/leads/${lead.id}`,
      funnelId: lead.funnelId,
      ownerUserId: lead.ownerUserId,
      followUps: lead.followUps || [],
      tasks: lead.tasks || [],
      logs: (lead.logs || []).map((log) => ({ ...log, label: lead.name })),
      idleHours: getLeadIdleHours(lead, now),
      closed: lead.status === 'fechado',
      lost: lead.status === 'perdido',
    }));

    const prospecting = (prospectLeads || []).map((lead) => ({
      id: lead.id,
      kind: 'prospecting' as const,
      name: lead.clinicName,
      subtitle: lead.contactName,
      status: lead.status,
      createdAt: lead.createdAt,
      detailPath: `/prospecting/leads/${lead.id}`,
      funnelId: lead.funnelId,
      ownerUserId: lead.ownerUserId,
      followUps: lead.followUps || [],
      tasks: lead.tasks || [],
      logs: (lead.logs || []).map((log) => ({ ...log, label: lead.clinicName })),
      idleHours: getProspectIdleHours(lead, now),
      closed: lead.status === 'p_fechada',
      lost: lead.status === 'p_perdida',
    }));

    const base = [...commercial, ...prospecting].filter((item) => !item.ownerUserId || item.ownerUserId === user?.id || user?.role === 'admin');
    if (selectedScope === ALL_SCOPE) return base;
    return base.filter((item) => item.funnelId === selectedScope);
  }, [leads, prospectLeads, now, selectedScope, user?.id, user?.role]);

  const metrics = useMemo(() => {
    const total = records.length;
    const won = records.filter((item) => item.closed).length;
    const stalled = records.filter((item) => !item.closed && !item.lost && item.idleHours >= 24).length;
    const dueToday = records.reduce((acc, item) => acc + item.followUps.filter((followUp) => isToday(new Date(followUp.date)) && followUp.status === 'pendente').length, 0);
    return { total, won, stalled, dueToday, conversion: total > 0 ? (won / total) * 100 : 0 };
  }, [records]);

  const stageSummary = useMemo(() => {
    if (activeFunnel) {
      return activeFunnel.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        total: records.filter((item) => item.status === stage.id).length,
      }));
    }

    return allFunnels.map((funnel) => ({
      id: funnel.id,
      name: funnel.name,
      total: records.filter((item) => item.funnelId === funnel.id).length,
    }));
  }, [activeFunnel, allFunnels, records]);

  const agenda = useMemo(() => (
    records
      .flatMap((item) => [
        ...item.followUps.filter((followUp) => isToday(new Date(followUp.date)) && followUp.status === 'pendente').map((followUp) => ({
          id: `${item.id}-${followUp.id}`,
          label: item.name,
          description: `Follow-up ${format(new Date(followUp.date), 'HH:mm')}`,
          path: item.detailPath,
        })),
        ...item.tasks.filter((task) => isToday(new Date(task.date)) && task.status === 'pendente').map((task) => ({
          id: `${item.id}-${task.id}`,
          label: item.name,
          description: task.title,
          path: item.detailPath,
        })),
      ])
      .slice(0, 8)
  ), [records]);

  const recentActivity = useMemo(() => (
    records
      .flatMap((item) => item.logs.map((log) => ({
        id: `${item.id}-${log.id}`,
        path: item.detailPath,
        label: log.label,
        content: log.content,
        timestamp: log.timestamp,
      })))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10)
  ), [records]);

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

  const primaryKanbanLink = selectedScope === ALL_SCOPE ? '/leads' : `/leads?funnel=${selectedScope}&operation=${activeFunnel?.operation || 'commercial'}`;
  const primaryReportLink = selectedScope === ALL_SCOPE ? '/reports' : `/reports?funnel=${selectedScope}&operation=${activeFunnel?.operation || 'commercial'}`;

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold gold-text-gradient tracking-tight">Painel de Controle</h1>
          <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest">
            Operação unificada por funil, sem menus paralelos
          </p>
        </div>
        <select value={selectedScope} onChange={(event) => handleScopeChange(event.target.value)} className="rounded-xl border border-border bg-card px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground min-w-[280px]">
          <option value={ALL_SCOPE}>Operação completa</option>
          <optgroup label="Funis Comerciais">
            {allFunnels.filter((funnel) => funnel.operation === 'commercial').map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}
          </optgroup>
          <optgroup label="Funis de Prospecção">
            {allFunnels.filter((funnel) => funnel.operation === 'prospecting').map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}
          </optgroup>
        </select>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={LayoutDashboard} label="Registros no pipeline" value={metrics.total} />
        <StatCard icon={CheckCircle2} label="Fechados" value={metrics.won} />
        <StatCard icon={GitBranchPlus} label="Conversão" value={`${metrics.conversion.toFixed(1)}%`} />
        <StatCard icon={AlertTriangle} label="Sem ação 24h+" value={metrics.stalled} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <QuickLink to={primaryKanbanLink} icon={KanbanSquare} title="Abrir Kanban" description="Trabalhar o funil selecionado" />
        <QuickLink to={primaryReportLink} icon={FileText} title="Ver Relatórios" description="Analisar conversão por funil" />
        <QuickLink to="/settings?tab=operations&section=funnels" icon={Settings} title="Configurar Funis" description="Etapas, playbooks e objeções" />
        <QuickLink to="/campaigns" icon={Megaphone} title="Campanhas" description="Relacionar tráfego e origem" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-border bg-accent flex items-center justify-between gap-4">
            <h2 className="text-lg font-serif font-bold">{activeFunnel ? `Etapas do ${activeFunnel.name}` : 'Distribuição por Funil'}</h2>
            <span className="text-[10px] uppercase tracking-widest text-gold-500/70">{activeFunnel ? activeFunnel.operation : 'geral'}</span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {stageSummary.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold-500/70">{item.name}</p>
                <p className="text-3xl font-serif font-bold mt-2">{item.total}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-border bg-accent flex items-center justify-between">
            <h2 className="text-lg font-serif font-bold">Agenda de hoje</h2>
            <span className="text-[10px] uppercase tracking-widest text-gold-500/70">{metrics.dueToday} ações</span>
          </div>
          <div className="p-4 space-y-3">
            {agenda.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nada pendente para hoje.</p> : agenda.map((item) => (
              <Link key={item.id} to={item.path} className="block rounded-xl border border-border p-4 hover:bg-accent/40 transition-all">
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-accent flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold">Atividade Recente</h2>
          <Link to={primaryKanbanLink} className="text-primary text-[10px] uppercase tracking-widest font-black inline-flex items-center gap-2">Abrir funil <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentActivity.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8 md:col-span-2">Nenhuma atividade recente encontrada.</p> : recentActivity.map((item) => (
            <Link key={item.id} to={item.path} className="rounded-xl border border-border p-4 hover:bg-accent/40 transition-all">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold truncate">{item.label}</p>
                <span className="text-[10px] uppercase tracking-widest text-gold-500/70 shrink-0">{item.timestamp}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{item.content}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof LayoutDashboard; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-accent border border-border flex items-center justify-center text-primary"><Icon className="w-5 h-5" /></div>
      <div><p className="text-[10px] uppercase tracking-[0.2em] text-gold-500/70">{label}</p><p className="text-2xl font-serif font-bold mt-1">{value}</p></div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, description }: { to: string; icon: typeof LayoutDashboard; title: string; description: string }) {
  return (
    <Link to={to} className="bg-card border border-border rounded-2xl p-5 shadow-xl hover:border-gold-500/40 transition-all">
      <div className="w-11 h-11 rounded-xl bg-accent border border-border flex items-center justify-center text-primary mb-4"><Icon className="w-5 h-5" /></div>
      <p className="font-serif font-bold text-lg">{title}</p>
      <p className="text-sm text-muted-foreground mt-2">{description}</p>
    </Link>
  );
}

