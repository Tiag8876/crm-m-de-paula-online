import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, KanbanSquare, LayoutDashboard, Megaphone, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { useDashboardQuery } from '@/lib/crmQueries';
import type { DashboardSummaryResponse } from '@/types/dashboard';

const EMPTY_DASHBOARD: DashboardSummaryResponse = {
  metrics: { total: 0, won: 0, stalled: 0, dueToday: 0, conversion: 0 },
  priorityQueue: [],
  agenda: [],
  funnelHighlights: [],
};

const formatDate = (value: string, pattern: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, pattern);
};

export function Dashboard() {
  const { data, isLoading, isError } = useDashboardQuery();
  const { metrics, priorityQueue, agenda, funnelHighlights } = data || EMPTY_DASHBOARD;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-3xl font-serif font-bold tracking-tight gold-text-gradient md:text-4xl">Painel de Controle</h1>
        {isError ? <p className="mt-2 text-sm text-red-400">Nao foi possivel carregar os indicadores do servidor.</p> : null}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={LayoutDashboard} label="Registros" value={metrics.total} />
        <StatCard icon={CheckCircle2} label="Fechados" value={metrics.won} />
        <StatCard icon={AlertTriangle} label="Parados" value={metrics.stalled} />
        <StatCard icon={CalendarClock} label="Acoes Hoje" value={metrics.dueToday} />
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QuickLink to="/leads" icon={KanbanSquare} title="Gestao de Leads" />
        <QuickLink to="/reports" icon={FileText} title="Relatorios" />
        <QuickLink to="/campaigns" icon={Megaphone} title="Campanhas" />
        <QuickLink to="/settings?tab=operations" icon={Settings} title="Configuracoes" />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border bg-accent/40 px-5 py-4">
            <h2 className="text-base font-serif font-bold">Fila de Prioridades</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {isLoading ? 'Atualizando' : `${priorityQueue.length} itens`}
            </span>
          </div>
          <div className="divide-y divide-border/50 p-2">
            {priorityQueue.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Tudo limpo por aqui. Otimo momento para prospectar.</p>
            ) : priorityQueue.map((item) => (
              <Link key={item.id} to={item.detailPath} className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-accent/30">
                <div>
                  <p className="text-base font-semibold leading-tight">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.nextFollowUp ? `Proxima acao: ${formatDate(item.nextFollowUp.date, 'dd/MM HH:mm')}` : 'Sem acao agendada'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="text-xs text-muted-foreground">{item.idleHours >= 1 ? `${item.idleHours.toFixed(0)}h parado` : 'Recente'}</span>
                  <span className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${item.overdue ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {item.overdue ? 'Urgente' : 'Monitorar'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-accent/40 px-5 py-4">
              <h2 className="text-base font-serif font-bold">Agenda do Dia</h2>
            </div>
            <div className="divide-y divide-border/50 p-2">
              {agenda.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem acoes pendentes hoje.</p> : agenda.map((item) => (
                <Link key={item.id} to={item.path} className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-accent/30">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <span className="ml-3 whitespace-nowrap text-xs text-primary">
                    {item.kind === 'followup' ? `Follow-up as ${formatDate(item.scheduledAt, 'HH:mm')}` : item.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-accent/40 px-5 py-4">
              <h2 className="text-base font-serif font-bold">Conversao de Funis</h2>
            </div>
            <div className="divide-y divide-border/50 p-2">
              {funnelHighlights.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem dados suficientes.</p>
              ) : funnelHighlights.map((item) => (
                <Link key={item.id} to={`/leads?funnel=${item.id}&operation=${item.operation}`} className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-accent/30">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{item.operation === 'prospecting' ? 'Prospeccao' : 'Comercial'}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-base font-serif font-bold">{item.total} leads</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">{item.won} ganhos</span>
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
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-2xl font-serif font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title }: { to: string; icon: typeof LayoutDashboard; title: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-gold-500/40 hover:bg-accent/20">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
    </Link>
  );
}
