import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Plus, Search, Phone, MessageCircle, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { isAdminUser } from '@/lib/access';
import { HorizontalScrollRail } from '@/components/HorizontalScrollRail';

export function ProspectingLeads() {
  const { user, assignableUsers, fetchAssignableUsers } = useAuthStore();
  const { prospectLeads, prospectKanbanStages, addProspectLead, services } = useStore();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [openModal, setOpenModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isAdmin = isAdminUser(user);
  const activeAssignableUsers = (assignableUsers || []).filter((candidate) => candidate.active);
  const scopedLeads = isAdmin
    ? (prospectLeads || [])
    : (prospectLeads || []).filter((lead) => !lead.ownerUserId || lead.ownerUserId === user?.id);

  useEffect(() => {
    fetchAssignableUsers().catch(() => null);
  }, [fetchAssignableUsers]);

  const sortedStages = [...(prospectKanbanStages || [])].sort((a, b) => a.order - b.order);
  const filteredLeads = scopedLeads.filter((lead) => {
    const term = search.toLowerCase();
    return (
      lead.clinicName.toLowerCase().includes(term) ||
      lead.contactName.toLowerCase().includes(term) ||
      lead.phone.includes(search) ||
      (lead.cnpj || '').includes(search)
    );
  });

  const onCreateLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addProspectLead({
      clinicName: String(form.get('clinicName') || ''),
      contactName: String(form.get('contactName') || ''),
      receptionistName: String(form.get('receptionistName') || '') || undefined,
      phone: String(form.get('phone') || ''),
      email: String(form.get('email') || ''),
      cnpj: String(form.get('cnpj') || ''),
      city: String(form.get('city') || ''),
      neighborhood: String(form.get('neighborhood') || '') || undefined,
      serviceId: String(form.get('serviceId') || '') || undefined,
      status: sortedStages[0]?.id || 'p_novo',
      ownerUserId: String(form.get('ownerUserId') || '') || (isAdmin ? undefined : user?.id),
    });
    setOpenModal(false);
  };

  const moveToStage = (leadId: string, status: string) => {
    useStore.getState().updateProspectLead(leadId, { status });
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-serif font-bold gold-text-gradient tracking-tight">Kanban de Prospecção</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-[0.1em] uppercase text-xs">
            Clínicas, contatos e próximos passos
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-card p-1 rounded-xl border border-border">
            <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <List className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setOpenModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:bg-gold-400 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Clínica
          </button>
        </div>
      </header>

      <div className="bg-card p-4 rounded-2xl border border-border shadow-2xl">
        <div className="relative">
          <Search className="w-5 h-5 text-gold-500/50 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por clínica, contato, telefone ou CNPJ..."
            className="w-full pl-12 pr-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <>
          <div ref={scrollContainerRef} data-scroll-rail-id="prospecting-kanban" className="scrollbar-visible flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[560px]">
            {sortedStages.map((stage) => (
              <div key={stage.id} className="flex-shrink-0 w-80 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-serif font-bold">{stage.name}</h3>
                  <span className="text-[10px] bg-accent px-2 py-1 rounded-full">
                    {filteredLeads.filter((lead) => lead.status === stage.id).length}
                  </span>
                </div>
                <div className="min-h-[500px] rounded-2xl border border-border bg-accent/40 p-3 space-y-3">
                  {filteredLeads.filter((lead) => lead.status === stage.id).map((lead) => {
                    const whatsappUrl = buildWhatsAppUrl(lead.phone);
                    return (
                      <div key={lead.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-serif font-bold text-foreground">{lead.clinicName}</p>
                            <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                          </div>
                          <Link to={`/prospecting/leads/${lead.id}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
                            Editar
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" /> {lead.phone}
                        </div>
                        <div className="flex gap-2">
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-border hover:border-emerald-500 hover:text-emerald-500"
                            >
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </a>
                          )}
                          <select
                            value={lead.status}
                            onChange={(e) => moveToStage(lead.id, e.target.value)}
                            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-border bg-background"
                          >
                            {sortedStages.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <HorizontalScrollRail containerRef={scrollContainerRef} className="sticky bottom-0 z-10" />
        </>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent text-xs uppercase tracking-[0.2em]">
              <tr>
                <th className="px-6 py-4">Clínica</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Telefone</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const stage = sortedStages.find((item) => item.id === lead.status);
                const whatsappUrl = buildWhatsAppUrl(lead.phone);
                return (
                  <tr key={lead.id} className="border-t border-border">
                    <td className="px-6 py-4 font-semibold">{lead.clinicName}</td>
                    <td className="px-6 py-4">{lead.contactName}</td>
                    <td className="px-6 py-4">{lead.phone}</td>
                    <td className="px-6 py-4">{stage?.name || lead.status}</td>
                    <td className="px-6 py-4 text-right space-x-4">
                      {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">WhatsApp</a>}
                      <Link to={`/prospecting/leads/${lead.id}`} className="text-primary hover:underline">Editar</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6">
            <h2 className="text-2xl font-serif font-bold gold-text-gradient mb-4">Nova Clínica em Prospecção</h2>
            <form onSubmit={onCreateLead} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="clinicName" required placeholder="Nome da clínica" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <input name="contactName" required placeholder="Responsável" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <input name="phone" required placeholder="Telefone/WhatsApp" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <input name="cnpj" placeholder="CNPJ" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <input name="email" placeholder="E-mail" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <input name="city" placeholder="Cidade" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <input name="neighborhood" placeholder="Bairro (opcional)" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <input name="receptionistName" placeholder="Recepcionista (opcional)" className="px-3 py-2 rounded-lg bg-background border border-border" />
              <select name="serviceId" className="px-3 py-2 rounded-lg bg-background border border-border md:col-span-2">
                <option value="">Serviço ofertado (opcional)</option>
                {(services || []).map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
              <select name="ownerUserId" defaultValue={isAdmin ? '' : user?.id || ''} className="px-3 py-2 rounded-lg bg-background border border-border md:col-span-2">
                <option value="">Sem atribuição (visível para vendedores)</option>
                {activeAssignableUsers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setOpenModal(false)} className="px-4 py-2 rounded-lg border border-border">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
