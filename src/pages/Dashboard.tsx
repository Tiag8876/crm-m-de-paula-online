import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, FileText, KanbanSquare, LayoutDashboard, Megaphone, Settings } from 'lucide-react';
import { isToday, format } from 'date-fns';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import type { FunnelConfig } from '@/types/crm';

const sortFunnels = (items: FunnelConfig[]) =>
  [...items].sort((a, b) => {
    if (a.operation !== b.operation) return a.operation === 'commercial' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

const getProspectIdleHours = (
  lead: { createdAt: string; lastInteractionAt?: string; followUps?: Array<{ date: string }>; tasks?: Array<{ date: string }>; notes?: Array<{ createdAt: string }> },
  nowMs = Date.now(),
) => {
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
  const { user } = useAuthStore();
  const { funnels, leads, prospectLeads } = useStore();
  const now = Date.now();
  const allFunnels = sortFunnels(funnels || []);

  const records = useMemo(() => {
    const commercial = (leads || []).map((lead) => ({
      id: lead.id,
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

    return [...commercial, ...prospecting].filter((item) => !item.ownerUserId || item.ownerUserId === user?.id || user?.role === 'admin');
  }, [leads, prospectLeads, now, user?.id, user?.role]);

  const metrics = useMemo(() => {
    const total = records.length;
    const won = records.filter((item) => item.closed).length;
    const stalled = records.filter((item) => !item.closed && !item.lost && item.idleHours >= 24).length;
    const dueToday = records.reduce((acc, item) => acc + item.followUps.filter((followUp) => isToday(new Date(followUp.date)) && followUp.status === 'pendente').length, 0);
    return { total, won, stalled, dueToday, conversion: total > 0 ? (won / total) * 100 : 0 };
  }, [records]);

  const priorityQueue = useMemo(
    () =>
      records
        .filter((item) => !item.closed && !item.lost)
        .map((item) => {
          const nextFollowUp = item.followUps
            .filter((followUp) => followUp.status === 'pendente')
            .sort((a, b) => a.date.localeCompare(b.date))[0];
          const overdue = nextFollowUp ? Date.parse(nextFollowUp.date) < now : item.idleHours >= 48;
          return { ...item, nextFollowUp, overdue };
        })
        .sort((a, b) => {
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          if (Boolean(a.nextFollowUp) !== Boolean(b.nextFollowUp)) return a.nextFollowUp ? -1 : 1;
          return b.idleHours - a.idleHours;
        })
        .slice(0, 6),
    [now, records],
  );

  const agenda = useMemo(
    () =>
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
        .slice(0, 8),
    [records],
  );

  const recentActivity = useMemo(
    () =>
      records
        .flatMap((item) => item.logs.map((log) => ({
          id: `${item.id}-${log.id}`,
          path: item.detailPath,
          label: log.label,
          content: log.content,
          timestamp: log.timestamp,
        })))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 8),
    [records],
  );

  const funnelHighlights = useMemo(
    () =>
      allFunnels
        .map((funnel) => {
          const scoped = records.filter((item) => item.funnelId === funnel.id);
          return {
            id: funnel.id,
            name: funnel.name,
            operation: funnel.operation,
            total: scoped.length,
            stalled: scoped.filter((item) => !item.closed && !item.lost && item.idleHours >= 24).length,
            won: scoped.filter((item) => item.closed).length,
          };
        })
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
    [allFunnels, records],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight gold-text-gradient md:text-4xl">Painel de Controle</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            A visão geral da operação fica aqui. Atalhos, prioridades, agenda e saúde dos funis sem obrigar ninguém a trocar de contexto para entender o que fazer.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={LayoutDashboard} label="Registros na operação" value={metrics.total} />
          <StatCard icon={CheckCircle2} label="Fechados" value={metrics.won} />
          <StatCard icon={AlertTriangle} label="Parados 24h+" value={metrics.stalled} />
          <StatCard icon={CalendarClock} label="Ações para hoje" value={metrics.dueToday} />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <QuickLink to="/leads" icon={KanbanSquare} title="Gestão de leads" description="Entrar no Kanban unificado e trabalhar os funis." />
        <QuickLink to="/reports" icon={FileText} title="Relatórios" description="Analisar desempenho e conversão por funil." />
        <QuickLink to="/campaigns" icon={Megaphone} title="Campanhas" description="Ligar tráfego, origem e entrada de oportunidades." />
        <QuickLink to="/settings?tab=operations&section=funnels" icon={Settings} title="Operação do CRM" description="Ajustar funis, formulários e catálogo do sistema." />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-border bg-accent px-5 py-4">
              <h2 className="text-base font-serif font-bold">Fila de prioridades</h2>
              <span className="text-[10px] uppercase tracking-widest text-gold-500/70">{priorityQueue.length} item(ns)</span>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              {priorityQueue.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground md:col-span-2">Nenhum registro crítico agora. Ótimo momento para trabalhar oportunidades novas.</p>
              ) : priorityQueue.map((item) => (
                <Link key={item.id} to={item.detailPath} className="rounded-2xl border border-border bg-background/30 p-4 transition-all hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${item.overdue ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-300'}`}>
                      {item.overdue ? 'Urgente' : 'Monitorar'}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <p>{item.nextFollowUp ? `Próxima ação: ${format(new Date(item.nextFollowUp.date), 'dd/MM HH:mm')}` : 'Sem follow-up agendado'}</p>
                    <p>{item.idleHours >= 1 ? `${item.idleHours.toFixed(0)}h sem movimentação` : 'Movimentado recentemente'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-accent px-5 py-4">
              <h2 className="text-base font-serif font-bold">Atividade recente</h2>
              <Link to="/leads" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">Abrir operação <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {recentActivity.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground md:col-span-2">Nenhuma atividade recente encontrada.</p> : recentActivity.map((item) => (
                <Link key={item.id} to={item.path} className="rounded-xl border border-border p-4 transition-all hover:bg-accent/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold">{item.label}</p>
                    <span className="shrink-0 text-[10px] uppercase tracking-widest text-gold-500/70">{item.timestamp}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.content}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-accent px-5 py-4">
              <h2 className="text-base font-serif font-bold">Agenda de hoje</h2>
              <span className="text-[10px] uppercase tracking-widest text-gold-500/70">{metrics.dueToday} ações</span>
            </div>
            <div className="space-y-3 p-4">
              {agenda.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nada pendente para hoje.</p> : agenda.map((item) => (
                <Link key={item.id} to={item.path} className="block rounded-xl border border-border p-4 transition-all hover:bg-accent/40">
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-accent px-5 py-4">
              <h2 className="text-base font-serif font-bold">Funis em destaque</h2>
              <span className="text-[10px] uppercase tracking-widest text-gold-500/70">Conversão geral {metrics.conversion.toFixed(1)}%</span>
            </div>
            <div className="space-y-3 p-4">
              {funnelHighlights.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há dados suficientes para destacar funis.</p>
              ) : funnelHighlights.map((item) => (
                <Link key={item.id} to={`/leads?funnel=${item.id}&operation=${item.operation}`} className="block rounded-xl border border-border p-4 text-left transition-all hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-gold-500/70">{item.operation === 'prospecting' ? 'Prospecção' : 'Comercial'}</p>
                    </div>
                    <span className="text-lg font-serif font-bold">{item.total}</span>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>{item.won} ganhos</span>
                    <span>{item.stalled} parados</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof LayoutDashboard; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-accent text-primary"><Icon className="h-4 w-4" /></div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-gold-500/70">{label}</p>
      <p className="mt-2 text-2xl font-serif font-bold">{value}</p>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, description }: { to: string; icon: typeof LayoutDashboard; title: string; description: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-border bg-card p-4 shadow-xl transition-all hover:border-gold-500/40">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-accent text-primary"><Icon className="h-4 w-4" /></div>
      <p className="text-base font-serif font-bold">{title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </Link>
  );
}
