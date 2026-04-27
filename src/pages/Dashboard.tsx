import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, KanbanSquare, LayoutDashboard, Megaphone, Settings } from 'lucide-react';
import { isToday, format } from 'date-fns';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import { getStageSemantic, isClosedSemantic, isLostSemantic } from '@/lib/funnelStages';
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
      idleHours: getLeadIdleHours(lead, now),
      closed: isClosedSemantic(getStageSemantic(allFunnels.find((funnel) => funnel.id === lead.funnelId), lead.status, 'commercial')),
      lost: isLostSemantic(getStageSemantic(allFunnels.find((funnel) => funnel.id === lead.funnelId), lead.status, 'commercial')),
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
      idleHours: getProspectIdleHours(lead, now),
      closed: isClosedSemantic(getStageSemantic(allFunnels.find((funnel) => funnel.id === lead.funnelId), lead.status, 'prospecting')),
      lost: isLostSemantic(getStageSemantic(allFunnels.find((funnel) => funnel.id === lead.funnelId), lead.status, 'prospecting')),
    }));

    return [...commercial, ...prospecting].filter((item) => !item.ownerUserId || item.ownerUserId === user?.id || user?.role === 'admin');
  }, [allFunnels, leads, prospectLeads, now, user?.id, user?.role]);

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
        .slice(0, 8),
    [now, records],
  );

  const agenda = useMemo(
    () =>
      records
        .flatMap((item) => [
          ...item.followUps.filter((followUp) => isToday(new Date(followUp.date)) && followUp.status === 'pendente').map((followUp) => ({
            id: `${item.id}-${followUp.id}`,
            label: item.name,
            description: `Follow-up às ${format(new Date(followUp.date), 'HH:mm')}`,
            path: item.detailPath,
          })),
          ...item.tasks.filter((task) => isToday(new Date(task.date)) && task.status === 'pendente').map((task) => ({
            id: `${item.id}-${task.id}`,
            label: item.name,
            description: task.title,
            path: item.detailPath,
          })),
        ])
        .slice(0, 6),
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
        .slice(0, 4),
    [allFunnels, records],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <h1 className="text-2xl font-serif font-bold tracking-tight gold-text-gradient">Painel de Controle</h1>

        <div className="grid w-full grid-cols-2 gap-3 md:w-auto md:grid-cols-4">
          <StatCard icon={LayoutDashboard} label="Registros" value={metrics.total} />
          <StatCard icon={CheckCircle2} label="Fechados" value={metrics.won} />
          <StatCard icon={AlertTriangle} label="Parados" value={metrics.stalled} />
          <StatCard icon={CalendarClock} label="Ações Hoje" value={metrics.dueToday} />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickLink to="/leads" icon={KanbanSquare} title="Gestão de Leads" />
        <QuickLink to="/reports" icon={FileText} title="Relatórios" />
        <QuickLink to="/campaigns" icon={Megaphone} title="Campanhas" />
        <QuickLink to="/settings?tab=operations" icon={Settings} title="Configurações" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border bg-accent/40 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Fila de Prioridades</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{priorityQueue.length} itens</span>
          </div>
          <div className="divide-y divide-border/50">
            {priorityQueue.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Tudo limpo por aqui.</p>
            ) : priorityQueue.map((item) => (
              <Link key={item.id} to={item.detailPath} className="flex items-center justify-between p-3 transition-colors hover:bg-accent/20">
                <div>
                  <p className="text-sm font-medium leading-tight">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.nextFollowUp ? `Próxima: ${format(new Date(item.nextFollowUp.date), 'dd/MM HH:mm')}` : 'Sem ação'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{item.idleHours >= 1 ? `${item.idleHours.toFixed(0)}h parado` : 'Recente'}</span>
                  <span className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${item.overdue ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {item.overdue ? 'Urgente' : 'Monitorar'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
            <div className="flex items-center justify-between border-b border-border bg-accent/40 px-4 py-2.5">
              <h2 className="text-sm font-semibold">Agenda do Dia</h2>
            </div>
            <div className="divide-y divide-border/50">
              {agenda.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Sem ações pendentes hoje.</p> : agenda.map((item) => (
                <Link key={item.id} to={item.path} className="flex items-center justify-between p-3 transition-colors hover:bg-accent/20">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <span className="ml-2 whitespace-nowrap text-xs text-primary">{item.description}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
            <div className="flex items-center justify-between border-b border-border bg-accent/40 px-4 py-2.5">
              <h2 className="text-sm font-semibold">Conversão de Funis</h2>
            </div>
            <div className="divide-y divide-border/50">
              {funnelHighlights.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Sem dados.</p>
              ) : funnelHighlights.map((item) => (
                <Link key={item.id} to={`/leads?funnel=${item.id}&operation=${item.operation}`} className="flex items-center justify-between p-3 transition-colors hover:bg-accent/20">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.operation === 'prospecting' ? 'Prospecção' : 'Comercial'}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-bold">{item.total} leads</span>
                    <span className="text-[10px] text-muted-foreground">{item.won} ganhos</span>
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
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-serif font-bold leading-none">{value}</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title }: { to: string; icon: typeof LayoutDashboard; title: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-gold-500/40 hover:bg-accent/20">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
    </Link>
  );
}
