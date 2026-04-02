import { useEffect, useMemo, type ComponentType } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Users, CheckCircle2, AlertCircle, PhoneCall, MessageCircle, History, ArrowRight, ListTodo, Shield, AlertTriangle } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import { isAdminUser } from '@/lib/access';

export function Dashboard() {
  const { leads } = useStore();
  const { user, users, fetchUsers } = useAuthStore();
  const isAdmin = isAdminUser(user);

  useEffect(() => {
    if (isAdminUser(user)) {
      fetchUsers().catch(() => null);
    }
  }, [fetchUsers, user]);

  const totalLeads = leads.length;
  const myLeads = (leads || []).filter((lead) => lead.ownerUserId === user?.id).length;
  const closedLeads = leads.filter((l) => l.status === 'fechado').length;
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  const todayFollowUps = leads
    .flatMap((lead) =>
      (lead.followUps || [])
        .filter((fu) => isToday(new Date(fu.date)) && fu.status === 'pendente')
        .map((fu) => ({ ...fu, lead }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const todayTasks = leads
    .flatMap((lead) =>
      (lead.tasks || [])
        .filter((task) => isToday(new Date(task.date)) && task.status === 'pendente')
        .map((task) => ({ ...task, lead }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const recentActivities = leads
    .flatMap((lead) => (lead.logs || []).map((log) => ({ ...log, leadName: lead.name, leadId: lead.id })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  const now = Date.now();
  const staleLeads = leads.filter((lead) => lead.status !== 'fechado' && lead.status !== 'perdido' && getLeadIdleHours(lead, now) >= 24).length;
  const overdueFollowUps = leads.reduce((acc, lead) => {
    const count = (lead.followUps || []).filter((followUp) => followUp.status === 'pendente' && new Date(followUp.date).getTime() < now).length;
    return acc + count;
  }, 0);

  const adminPanel = useMemo(() => {
    if (!isAdminUser(user)) return null;

    const userMap = new Map((users || []).map((item) => [item.id, item]));
    const bySeller = new Map<string, { name: string; total: number; closed: number; idle24h: number; overdue: number }>();

    for (const lead of leads) {
      const ownerId = lead.ownerUserId || 'unassigned';
      const owner = userMap.get(ownerId);
      const name = owner?.name || (ownerId === 'unassigned' ? 'Sem responsavel' : ownerId);
      if (!bySeller.has(ownerId)) {
        bySeller.set(ownerId, { name, total: 0, closed: 0, idle24h: 0, overdue: 0 });
      }
      const row = bySeller.get(ownerId)!;
      row.total += 1;
      if (lead.status === 'fechado') row.closed += 1;
      if (lead.status !== 'fechado' && lead.status !== 'perdido' && getLeadIdleHours(lead, now) >= 24) row.idle24h += 1;
      row.overdue += (lead.followUps || []).filter((fu) => fu.status === 'pendente' && new Date(fu.date).getTime() < now).length;
    }

    const ranking = Array.from(bySeller.values())
      .map((row) => ({ ...row, conversion: row.total > 0 ? (row.closed / row.total) * 100 : 0 }))
      .sort((a, b) => b.closed - a.closed)
      .slice(0, 10);

    const criticalQueue = leads
      .filter((lead) => lead.status !== 'fechado' && lead.status !== 'perdido')
      .map((lead) => {
        const idleHours = Math.floor(getLeadIdleHours(lead, now));
        const overdue = (lead.followUps || []).filter((fu) => fu.status === 'pendente' && new Date(fu.date).getTime() < now).length;
        return {
          id: lead.id,
          name: lead.name,
          idleHours,
          overdue,
          riskScore: idleHours + overdue * 8,
        };
      })
      .filter((item) => item.idleHours >= 24 || item.overdue > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);

    return { ranking, criticalQueue };
  }, [leads, now, user?.role, users]);

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 md:space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold gold-text-gradient tracking-tight">Central de Comando</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-[0.1em] uppercase text-xs">
            Performance e Gestao de Elite | Escritorio de Advocacia
          </p>
        </div>
        <div className="flex gap-4">
          <div className="px-6 py-3 bg-card border border-border rounded-xl shadow-lg">
            <p className="text-[10px] text-gold-500/60 uppercase tracking-widest font-bold">Status do Sistema</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              <span className="text-foreground text-sm font-semibold">Operacional</span>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-card border border-gold-500/20 rounded-3xl p-7 md:p-9 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-gold-500/10 blur-3xl" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.25em] text-gold-500/70 font-black">Visao Geral</p>
              <h2 className="text-3xl md:text-5xl font-serif font-bold mt-2">{totalLeads}</h2>
              <p className="text-sm text-muted-foreground mt-2">Leads totais na operacao</p>
              {!isAdmin && (
                <p className="text-xs text-gold-500/80 mt-2 uppercase tracking-widest">
                  Seus leads atribuidos: {myLeads}
                </p>
              )}
            </div>
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-gold-500/30 bg-accent/70 flex items-center justify-center shrink-0">
              <Users className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
          </div>
          <div className="relative z-10 mt-4 h-2" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          <BentoStatCard icon={CheckCircle2} label="Contratos" value={closedLeads} tone="success" />
          <BentoStatCard icon={AlertCircle} label="Conversao" value={conversionRate + '%'} />
        </div>

        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <BentoStatCard icon={AlertCircle} label="Leads sem acao 24h+" value={staleLeads} tone="warning" />
          <BentoStatCard icon={PhoneCall} label="Follow-ups atrasados" value={overdueFollowUps} tone="warning" />
        </div>
      </section>

      {adminPanel && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-serif font-bold">Painel do Gestor | Ranking Comercial</h2>
            </div>
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-gold-500/60 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left">Vendedor</th>
                    <th className="px-4 py-3 text-left">Leads</th>
                    <th className="px-4 py-3 text-left">Fechados</th>
                    <th className="px-4 py-3 text-left">Conversao</th>
                    <th className="px-4 py-3 text-left">Leads 24h+</th>
                  </tr>
                </thead>
                <tbody>
                  {adminPanel.ranking.map((row) => (
                    <tr key={row.name} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="px-4 py-3 font-semibold">{row.name}</td>
                      <td className="px-4 py-3">{row.total}</td>
                      <td className="px-4 py-3">{row.closed}</td>
                      <td className="px-4 py-3">{row.conversion.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-amber-400">{row.idle24h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border bg-accent flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-serif font-bold">Fila Critica de Leads</h2>
            </div>
            <div className="p-4 space-y-3">
              {adminPanel.criticalQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem leads criticos no momento.</p>
              ) : (
                adminPanel.criticalQueue.map((item) => (
                  <Link key={item.id} to={`/leads/${item.id}`} className="block rounded-xl border border-border p-4 hover:border-gold-500/40 hover:bg-accent/40 transition-all">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Sem acao: {item.idleHours}h | Follow-ups atrasados: {item.overdue}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
          <div className="p-6 md:p-8 border-b border-border flex items-center justify-between bg-accent">
            <h2 className="text-lg md:text-xl font-serif font-bold text-gold-100 flex items-center gap-3">
              <PhoneCall className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              Follow-ups para Hoje
            </h2>
            <span className="bg-primary text-primary-foreground text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              {todayFollowUps.length} Pendentes
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto scrollbar-none">
            {todayFollowUps.length === 0 ? (
              <div className="p-10 md:p-16 text-center">
                <p className="text-muted-foreground font-serif italic text-lg">Nenhuma acao estrategica para hoje.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {todayFollowUps.map((fu) => (
                  <li key={fu.id} className="p-4 md:p-6 hover:bg-accent transition-all duration-300 group">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-accent border border-border flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          {fu.type === 'whatsapp' ? <MessageCircle className="w-6 h-6" /> : <PhoneCall className="w-6 h-6" />}
                        </div>
                        <div className="min-w-0">
                          <Link to={`/leads/${fu.lead.id}`} className="text-base md:text-lg font-serif font-bold text-foreground hover:text-primary transition-colors block truncate">
                            {fu.lead.name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-1 font-semibold tracking-widest uppercase truncate">
                            {format(new Date(fu.date), 'HH:mm')} | {fu.type === 'whatsapp' ? 'WhatsApp' : 'Ligacao Direta'}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/leads/${fu.lead.id}`}
                        className="px-4 md:px-6 py-2.5 bg-transparent border border-gold-500/30 text-primary text-[10px] font-black rounded-lg hover:bg-primary hover:text-primary-foreground transition-all uppercase tracking-widest text-center"
                      >
                        Assumir Lead
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 border-b border-border bg-accent">
            <h2 className="text-lg md:text-xl font-serif font-bold text-gold-100 flex items-center gap-3">
              <ListTodo className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              Acoes Rapidas
            </h2>
          </div>
          <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <p className="text-muted-foreground text-sm">Gerencie seus leads, campanhas e agenda a partir do menu lateral.</p>
            <Link to="/leads" className="px-8 py-3 bg-primary text-primary-foreground text-xs font-black rounded-xl hover:bg-gold-400 transition-all uppercase tracking-[0.2em] shadow-lg">
              Ver Todos os Leads
            </Link>
          </div>
        </div>
      </div>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border bg-accent flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-serif font-bold text-gold-100 flex items-center gap-3">
            <ListTodo className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            Tarefas de Hoje
          </h2>
          <span className="bg-primary text-primary-foreground text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
            {todayTasks.length} Pendentes
          </span>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {todayTasks.length === 0 ? (
              <p className="text-muted-foreground italic md:col-span-2 text-center py-10">Nenhuma tarefa pendente para hoje.</p>
            ) : (
              todayTasks.map((task, idx) => (
                <div key={idx} className="flex gap-4 group bg-background/40 p-4 rounded-2xl border border-border hover:border-gold-500/30 transition-all">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-accent border border-border flex items-center justify-center text-primary">
                      <ListTodo className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <Link to={`/leads/${task.lead.id}`} className="text-[10px] text-muted-foreground font-bold hover:text-primary transition-colors uppercase tracking-widest truncate">
                        {task.lead.name}
                      </Link>
                      {task.isStandard && (
                        <span className="text-[8px] bg-accent text-primary px-2 py-0.5 rounded uppercase tracking-widest">Padrao</span>
                      )}
                    </div>
                    <p className="text-foreground text-sm font-bold group-hover:text-gold-100 transition-colors">{task.title}</p>
                    {task.description && <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{task.description}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border bg-accent flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-serif font-bold text-gold-100 flex items-center gap-3">
            <History className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            Atividade Recente do Pipeline
          </h2>
          <Link to="/leads" className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-2">
            Ver Todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {recentActivities.length === 0 ? (
              <p className="text-muted-foreground italic md:col-span-2 text-center py-10">Nenhuma atividade registrada ainda.</p>
            ) : (
              recentActivities.map((activity, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,0.5)]"></div>
                    <div className="w-px flex-1 bg-border mt-2"></div>
                  </div>
                  <div className="pb-4 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-[10px] text-gold-500/60 font-black uppercase tracking-widest shrink-0">{activity.timestamp}</p>
                      <span className="text-muted-foreground">|</span>
                      <Link to={`/leads/${activity.leadId}`} className="text-[10px] text-muted-foreground font-bold hover:text-primary transition-colors uppercase tracking-widest truncate">
                        {activity.leadName}
                      </Link>
                    </div>
                    <p className="text-foreground text-sm mt-1 group-hover:text-gold-100 transition-colors">{activity.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function BentoStatCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'warning';
}) {
  const accentClass = tone === 'success'
    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
    : tone === 'warning'
      ? 'text-amber-300 border-amber-500/20 bg-amber-500/10'
      : 'text-primary border-border bg-accent/60';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl hover:border-gold-500/40 transition-all">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${accentClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold-500/70 font-black">{label}</p>
          <p className="text-2xl font-serif font-bold leading-none mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
}

