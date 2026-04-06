import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, LayoutGrid, List, ChevronRight, Phone, DollarSign, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { LOSS_REASON_OPTIONS, isValidLossReasonDetail, validateLeadStatusChange } from '@/lib/leadValidation';
import { isAdminUser } from '@/lib/access';

export function Leads() {
  const { user, assignableUsers, fetchAssignableUsers } = useAuthStore();
  const { leads, campaigns, addLead, updateLead, kanbanStages, areasOfLaw, services } = useStore();
  const isAdmin = isAdminUser(user);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [showLeadSaveSuccess, setShowLeadSaveSuccess] = useState(false);
  const [leadSaveError, setLeadSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterCampaignId, setFilterCampaignId] = useState('');
  const [filterAreaId, setFilterAreaId] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedArea, setSelectedArea] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  const sortedStages = [...kanbanStages].sort((a, b) => a.order - b.order);
  const activeAssignableUsers = (assignableUsers || []).filter((candidate) => candidate.active);

  useEffect(() => {
    fetchAssignableUsers().catch(() => null);
  }, [fetchAssignableUsers]);

  const scopedLeads = isAdmin
    ? (leads || [])
    : (leads || []).filter((lead) => !lead.ownerUserId || lead.ownerUserId === user?.id);

  const filteredLeads = scopedLeads.filter((lead) => {
    const bySearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.cpf || '').includes(searchTerm);

    const byCampaign = !filterCampaignId || lead.campaignId === filterCampaignId;
    const byArea = !filterAreaId || lead.areaOfLawId === filterAreaId;
    const byService = !filterServiceId || lead.serviceId === filterServiceId;
    const byStatus = !filterStatus || lead.status === filterStatus;

    return bySearch && byCampaign && byArea && byService && byStatus;
  });

  const handleAddLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSavingLead) return;

    setIsSavingLead(true);
    setLeadSaveError(null);
    try {
      const formData = new FormData(e.currentTarget);
      addLead({
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string,
        cpf: formData.get('cpf') as string,
        legalArea: formData.get('legalArea') as string,
        areaOfLawId: formData.get('areaOfLawId') as string,
        serviceId: formData.get('serviceId') as string,
        estimatedValue: Number(formData.get('estimatedValue')) || 0,
        status: sortedStages[0]?.id || 'novo',
        ownerUserId: String(formData.get('ownerUserId') || '') || (isAdmin ? undefined : user?.id),
      });
      setShowLeadSaveSuccess(true);
      window.setTimeout(() => {
        setShowLeadSaveSuccess(false);
        setIsSavingLead(false);
        setIsModalOpen(false);
      }, 850);
    } catch (error) {
      setIsSavingLead(false);
      setShowLeadSaveSuccess(false);
      setLeadSaveError(error instanceof Error ? error.message : 'Falha ao salvar lead');
    }
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('leadId', id);
  };

  const onDrop = (e: React.DragEvent, status: string) => {
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) {
      stopAutoScroll();
      return;
    }

    if (status === 'perdido') {
      const reasonLabel = prompt(`Motivo de perda:\n${LOSS_REASON_OPTIONS.map((o) => `- ${o.label}`).join('\n')}`);
      if (!reasonLabel) {
        stopAutoScroll();
        return;
      }
      const matched = LOSS_REASON_OPTIONS.find((o) => o.label.toLowerCase() === reasonLabel.trim().toLowerCase());
      if (!matched) {
        alert('Motivo inválido. Use um dos motivos listados.');
        stopAutoScroll();
        return;
      }
      const detail = prompt('Descreva o motivo da perda com clareza (mínimo 12 caracteres):') || '';
      if (!isValidLossReasonDetail(detail)) {
        alert('Motivo de perda inválido. Evite justificativa genérica como "não respondeu".');
        stopAutoScroll();
        return;
      }
      const nextLead = { ...lead, lossReasonCode: matched.value, lossReasonDetail: detail.trim() };
      const lockMessage = validateLeadStatusChange(nextLead as typeof lead, status);
      if (lockMessage) {
        alert(lockMessage);
        stopAutoScroll();
        return;
      }
      updateLead(leadId, { status, lossReasonCode: matched.value, lossReasonDetail: detail.trim() });
      stopAutoScroll();
      return;
    }

    const lockMessage = validateLeadStatusChange(lead, status);
    if (lockMessage) {
      alert(lockMessage);
      stopAutoScroll();
      return;
    }
    updateLead(leadId, { status });
    stopAutoScroll();
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollZone = 100;
    const scrollSpeed = 15;

    if (e.clientX < rect.left + scrollZone) {
      startAutoScroll(-scrollSpeed);
    } else if (e.clientX > rect.right - scrollZone) {
      startAutoScroll(scrollSpeed);
    } else {
      stopAutoScroll();
    }
  };

  const onDragEnd = () => {
    stopAutoScroll();
  };

  const startAutoScroll = useCallback((speed: number) => {
    if (scrollIntervalRef.current !== null) return;
    scrollIntervalRef.current = window.setInterval(() => {
      const container = scrollContainerRef.current;
      if (container) container.scrollLeft += speed;
    }, 16);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current !== null) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-serif font-bold gold-text-gradient tracking-tight">Gestão de Leads</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-[0.1em] uppercase text-xs">Pipeline de Vendas & Conversão</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-card p-1 rounded-xl border border-border">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-primary'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-primary'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => {
              setLeadSaveError(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-3 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold-400 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Novo Lead
          </button>
        </div>
      </header>

      <div className="bg-card p-4 rounded-2xl border border-border shadow-2xl flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gold-500/50 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters((prev) => !prev)}
          className="flex items-center gap-2 px-6 py-3 bg-background/40 border border-border rounded-xl text-muted-foreground font-bold text-xs uppercase tracking-widest hover:text-primary transition-all"
        >
          <Filter className="w-5 h-5" />
          Filtros Avançados
        </button>
      </div>

      {showAdvancedFilters && (
        <div className="bg-card p-4 rounded-2xl border border-border shadow-2xl grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={filterCampaignId} onChange={(e) => setFilterCampaignId(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
            <option value="">Todas as campanhas</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>
          <select
            value={filterAreaId}
            onChange={(e) => {
              setFilterAreaId(e.target.value);
              setFilterServiceId('');
            }}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
          >
            <option value="">Todas as áreas</option>
            {areasOfLaw.map((area) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
          <select value={filterServiceId} onChange={(e) => setFilterServiceId(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
            <option value="">Todos os serviços</option>
            {services
              .filter((service) => !filterAreaId || service.areaOfLawId === filterAreaId)
              .map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
            <option value="">Todos os status</option>
            {sortedStages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setFilterCampaignId('');
              setFilterAreaId('');
              setFilterServiceId('');
              setFilterStatus('');
            }}
            className="px-3 py-2 rounded-lg border border-border text-xs uppercase tracking-widest hover:bg-accent"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {viewMode === 'kanban' ? (
        <div
          ref={scrollContainerRef}
          data-scroll-rail-id="main-leads-kanban"
          className="scrollbar-visible flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[600px]"
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragLeave={stopAutoScroll}
        >
          {sortedStages.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-80 flex flex-col gap-4"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, column.id)}
            >
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ backgroundColor: column.color }}></div>
                  <h3 className="font-serif font-bold text-foreground tracking-wide">{column.name}</h3>
                </div>
                <span className="text-[10px] font-black text-gold-500/40 bg-accent px-2 py-0.5 rounded-full">
                  {filteredLeads.filter((l) => l.status === column.id).length}
                </span>
              </div>

              <div className="flex-1 space-y-4 bg-accent/50 rounded-2xl p-3 border border-border min-h-[500px]">
                {filteredLeads.filter((l) => l.status === column.id).map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    onDragEnd={onDragEnd}
                    className="bg-muted p-5 rounded-xl border border-border shadow-lg cursor-grab active:cursor-grabbing hover:border-gold-500/40 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors">{lead.name}</h4>
                      <Link to={`/leads/${lead.id}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gold-500/70 hover:text-primary">
                        Editar
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                        <Phone className="w-3 h-3 text-gold-500/50" />
                        {lead.phone}
                      </div>
                      {lead.areaOfLawId && (
                        <div className="inline-block px-2 py-0.5 bg-accent border border-border rounded text-[9px] font-bold text-gold-400 uppercase tracking-widest">
                          {areasOfLaw.find((a) => a.id === lead.areaOfLawId)?.name}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{format(new Date(lead.createdAt), 'dd MMM')}</span>
                      {lead.estimatedValue ? <span className="text-xs font-bold text-emerald-500">R$ {lead.estimatedValue.toLocaleString()}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-accent text-primary font-black text-[10px] uppercase tracking-[0.2em] border-b border-border">
              <tr>
                <th className="px-8 py-5">Nome do Cliente</th>
                <th className="px-8 py-5">Área Jurídica</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Valor Est.</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-muted-foreground italic font-serif text-lg">Nenhum lead encontrado no pipeline.</td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-accent transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-serif font-bold text-foreground text-base group-hover:text-primary transition-colors">{lead.name}</span>
                        <span className="text-[10px] text-muted-foreground mt-1 font-medium">{lead.phone}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{areasOfLaw.find((a) => a.id === lead.areaOfLawId)?.name || 'Não def.'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                        style={{
                          backgroundColor: `${kanbanStages.find((s) => s.id === lead.status)?.color}20`,
                          color: kanbanStages.find((s) => s.id === lead.status)?.color,
                          borderColor: `${kanbanStages.find((s) => s.id === lead.status)?.color}40`,
                        }}
                      >
                        {kanbanStages.find((s) => s.id === lead.status)?.name || lead.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-bold text-emerald-500">{lead.estimatedValue ? `R$ ${lead.estimatedValue.toLocaleString()}` : '-'}</td>
                    <td className="px-8 py-5 text-right">
                      <Link to={`/leads/${lead.id}`} className="text-primary font-black text-[10px] uppercase tracking-widest hover:text-gold-400 transition-colors">Editar Lead</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl p-8 w-full max-w-2xl shadow-2xl border border-border relative max-h-[90vh] overflow-y-auto scrollbar-none">
            {showLeadSaveSuccess && (
              <div className="absolute inset-0 z-50 bg-card flex flex-col items-center justify-center animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 animate-scale-in">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <p className="text-lg font-serif font-bold text-foreground">Lead salvo com sucesso!</p>
              </div>
            )}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-serif font-bold gold-text-gradient">Registrar Novo Lead</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-primary" disabled={isSavingLead}>
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Nome Completo</label>
                  <input required name="name" type="text" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Telefone (WhatsApp)</label>
                  <input required name="phone" type="tel" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">E-mail</label>
                  <input name="email" type="email" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Área de Atuação</label>
                  <select
                    name="areaOfLawId"
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  >
                    <option value="">Selecione a Área</option>
                    {areasOfLaw.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Serviço</label>
                  <select name="serviceId" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all">
                    <option value="">Selecione o Serviço</option>
                    {services.filter((s) => s.areaOfLawId === selectedArea).map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Valor Estimado do Contrato</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-gold-500/50 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input name="estimatedValue" type="number" className="w-full pl-10 pr-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">CPF</label>
                  <input name="cpf" type="text" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Respons?vel</label>
                  <select
                    name="ownerUserId"
                    defaultValue={isAdmin ? '' : user?.id || ''}
                    className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  >
                    <option value="">Sem atribui??o definida</option>
                    {activeAssignableUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-4 mt-8 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setLeadSaveError(null);
                  }}
                  className="px-8 py-3 text-muted-foreground font-black text-[10px] uppercase tracking-widest hover:text-foreground transition-all"
                  disabled={isSavingLead}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-10 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl disabled:opacity-70"
                  disabled={isSavingLead}
                >
                  {isSavingLead ? 'Salvando...' : 'Confirmar Registro'}
                </button>
              </div>
              {leadSaveError && <p className="md:col-span-2 text-xs text-red-400">{leadSaveError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
