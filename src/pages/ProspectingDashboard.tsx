import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { isAdminUser } from '@/lib/access';

export function ProspectingDashboard() {
  const { user } = useAuthStore();
  const { prospectLeads, prospectKanbanStages } = useStore();
  const isAdmin = isAdminUser(user);

  const scopedLeads = isAdmin
    ? (prospectLeads || [])
    : (prospectLeads || []).filter((lead) => !lead.ownerUserId || lead.ownerUserId === user?.id);

  const total = scopedLeads.length;
  const won = scopedLeads.filter((lead) => lead.status === 'p_fechada').length;
  const lost = scopedLeads.filter((lead) => lead.status === 'p_perdida').length;
  const conversion = total > 0 ? (won / total) * 100 : 0;

  const statusCards = [...(prospectKanbanStages || [])]
    .sort((a, b) => a.order - b.order)
    .map((stage) => ({
      ...stage,
      value: scopedLeads.filter((lead) => lead.status === stage.id).length,
    }));

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-serif font-bold gold-text-gradient tracking-tight">Prospecção Odontológica</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-[0.1em] uppercase text-xs">
            Visão inicial da operação de clínicas
          </p>
        </div>
        <Link
          to="/prospecting/leads"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:bg-gold-400 transition-all"
        >
          Ir para Kanban
        </Link>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Clínicas na base" value={total} />
        <Card title="Fechadas" value={won} />
        <Card title="Perdidas" value={lost} />
        <Card title="Conversão" value={`${conversion.toFixed(1)}%`} />
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-accent">
          <h2 className="font-serif font-bold text-xl text-foreground">Etapas do Funil de Prospecção</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {statusCards.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-background/40 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.name}</p>
              <p className="text-3xl font-serif font-bold text-foreground mt-2">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-500/70">{title}</p>
      <p className="text-4xl font-serif font-bold text-foreground mt-2">{value}</p>
    </div>
  );
}
