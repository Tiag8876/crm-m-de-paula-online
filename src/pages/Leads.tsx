
import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Filter, LayoutGrid, List, ChevronRight, Phone, DollarSign, CheckCircle2, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { LOSS_REASON_OPTIONS, isValidLossReasonDetail, validateLeadStatusChange } from '@/lib/leadValidation';
import { isAdminUser } from '@/lib/access';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { FunnelConfig, Lead } from '@/types/crm';

const sortFunnels = (items: FunnelConfig[]) =>
  [...items].sort((a, b) => {
    if (a.operation !== b.operation) {
      return a.operation === 'commercial' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'pt-BR');
  });

export function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, assignableUsers, fetchAssignableUsers } = useAuthStore();
  const {
    leads,
    prospectLeads,
    campaigns,
    addLead,
    updateLead,
    addProspectLead,
    updateProspectLead,
    funnels,
    commercialDefaultFunnelId,
    prospectingDefaultFunnelId,
    areasOfLaw,
    services,
  } = useStore();
  const isAdmin = isAdminUser(user);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterCampaignId, setFilterCampaignId] = useState('');
  const [filterAreaId, setFilterAreaId] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [createFunnelId, setCreateFunnelId] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  const allFunnels = sortFunnels(funnels || []);
  const activeAssignableUsers = (assignableUsers || []).filter((candidate) => candidate.active);

  useEffect(() => {
    fetchAssignableUsers().catch(() => null);
  }, [fetchAssignableUsers]);

  useEffect(() => {
    const funnelParam = searchParams.get('funnel');
    const operationParam = searchParams.get('operation');

    const preferredByOperation = operationParam === 'prospecting'
      ? allFunnels.find((funnel) => funnel.id === prospectingDefaultFunnelId)
      : operationParam === 'commercial'
        ? allFunnels.find((funnel) => funnel.id === commercialDefaultFunnelId)
        : undefined;

    const fallback = preferredByOperation
      || allFunnels.find((funnel) => funnel.id === commercialDefaultFunnelId)
      || allFunnels.find((funnel) => funnel.id === prospectingDefaultFunnelId)
      || allFunnels[0];

    const nextFunnel = allFunnels.find((funnel) => funnel.id === funnelParam) || fallback;
    if (nextFunnel?.id && nextFunnel.id !== selectedFunnelId) {
      setSelectedFunnelId(nextFunnel.id);
    }
  }, [allFunnels, commercialDefaultFunnelId, prospectingDefaultFunnelId, searchParams, selectedFunnelId]);

  const activeFunnel = allFunnels.find((funnel) => funnel.id === selectedFunnelId)
    || allFunnels.find((funnel) => funnel.id === commercialDefaultFunnelId)
    || allFunnels.find((funnel) => funnel.id === prospectingDefaultFunnelId)
    || allFunnels[0];
  const createFunnel = allFunnels.find((funnel) => funnel.id === createFunnelId) || activeFunnel;

  const isProspecting = activeFunnel?.operation === 'prospecting';
  const sortedStages = [...(activeFunnel?.stages || [])].sort((a, b) => a.order - b.order);
  const createIsProspecting = createFunnel?.operation === 'prospecting';
  const createSortedStages = [...(createFunnel?.stages || [])].sort((a, b) => a.order - b.order);
  const createFieldSchema = [...(createFunnel?.fieldSchema || [])].sort((a, b) => a.order - b.order);

  const scopedCommercialLeads = isAdmin
    ? (leads || [])
    : (leads || []).filter((lead) => !lead.ownerUserId || lead.ownerUserId === user?.id);

  const scopedProspectLeads = isAdmin
    ? (prospectLeads || [])
    : (prospectLeads || []).filter((lead) => !lead.ownerUserId || lead.ownerUserId === user?.id);

  const filteredCommercialLeads = scopedCommercialLeads.filter((lead) => {
    const funnelId = lead.funnelId || commercialDefaultFunnelId;
    const bySearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.cpf || '').includes(searchTerm);

    const byCampaign = !filterCampaignId || lead.campaignId === filterCampaignId;
    const byArea = !filterAreaId || lead.areaOfLawId === filterAreaId;
    const byService = !filterServiceId || lead.serviceId === filterServiceId;
    const byStatus = !filterStatus || lead.status === filterStatus;
    const byFunnel = funnelId === activeFunnel?.id;

    return bySearch && byCampaign && byArea && byService && byStatus && byFunnel;
  });

  const filteredProspectLeads = scopedProspectLeads.filter((lead) => {
    const funnelId = lead.funnelId || prospectingDefaultFunnelId;
    const term = searchTerm.toLowerCase();
    const bySearch =
      lead.clinicName.toLowerCase().includes(term) ||
      lead.contactName.toLowerCase().includes(term) ||
      lead.phone.includes(searchTerm) ||
      (lead.cnpj || '').includes(searchTerm);
    const byService = !filterServiceId || lead.serviceId === filterServiceId;
    const byStatus = !filterStatus || lead.status === filterStatus;
    const byFunnel = funnelId === activeFunnel?.id;

    return bySearch && byService && byStatus && byFunnel;
  });

  const syncFunnelSearchParams = useCallback((funnelId: string) => {
    const nextFunnel = allFunnels.find((funnel) => funnel.id === funnelId);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (!nextFunnel) {
        params.delete('funnel');
        params.delete('operation');
        return params;
      }
      params.set('funnel', nextFunnel.id);
      params.set('operation', nextFunnel.operation);
      return params;
    }, { replace: true });
  }, [allFunnels, setSearchParams]);

  const handleFunnelChange = (value: string) => {
    setSelectedFunnelId(value);
    syncFunnelSearchParams(value);
    setFilterCampaignId('');
    setFilterAreaId('');
    setFilterServiceId('');
    setFilterStatus('');
    setSearchTerm('');
  };

  const resetModalState = () => {
    setSaveError(null);
    setIsSavingRecord(false);
    setShowSaveSuccess(false);
    setSelectedArea('');
  };

  const collectCustomFields = (formData: FormData) =>
    createFieldSchema.reduce<Record<string, string>>((acc, field) => {
      const rawValue = formData.get(`customField:${field.key}`);
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (value) {
        acc[field.key] = value;
      }
      return acc;
    }, {});

  const handleCreateRecord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingRecord) return;

    setIsSavingRecord(true);
    setSaveError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const customFields = collectCustomFields(formData);
      if (createIsProspecting) {
        addProspectLead({
          clinicName: String(formData.get('clinicName') || ''),
          contactName: String(formData.get('contactName') || ''),
          receptionistName: String(formData.get('receptionistName') || '') || undefined,
          phone: String(formData.get('phone') || ''),
          email: String(formData.get('email') || ''),
          cnpj: String(formData.get('cnpj') || ''),
          city: String(formData.get('city') || ''),
          neighborhood: String(formData.get('neighborhood') || '') || undefined,
          serviceId: String(formData.get('serviceId') || '') || undefined,
          funnelId: String(formData.get('funnelId') || '') || createFunnel?.id,
          status: createSortedStages[0]?.id || 'p_novo',
          ownerUserId: String(formData.get('ownerUserId') || '') || (isAdmin ? undefined : user?.id),
          customFields,
        });
      } else {
        addLead({
          name: String(formData.get('name') || ''),
          phone: String(formData.get('phone') || ''),
          email: String(formData.get('email') || ''),
          cpf: String(formData.get('cpf') || ''),
          legalArea: String(formData.get('legalArea') || ''),
          areaOfLawId: String(formData.get('areaOfLawId') || ''),
          serviceId: String(formData.get('serviceId') || ''),
          funnelId: String(formData.get('funnelId') || '') || createFunnel?.id,
          estimatedValue: Number(formData.get('estimatedValue')) || 0,
          status: createSortedStages[0]?.id || 'novo',
          ownerUserId: String(formData.get('ownerUserId') || '') || (isAdmin ? undefined : user?.id),
          customFields,
        });
      }

      setShowSaveSuccess(true);
      window.setTimeout(() => {
        setShowSaveSuccess(false);
        setIsSavingRecord(false);
        setIsModalOpen(false);
      }, 800);
    } catch (error) {
      setIsSavingRecord(false);
      setShowSaveSuccess(false);
      setSaveError(error instanceof Error ? error.message : 'Falha ao salvar registro');
    }
  };

  const onDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.setData('recordId', id);
  };

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current !== null) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback((speed: number) => {
    if (scrollIntervalRef.current !== null) return;
    scrollIntervalRef.current = window.setInterval(() => {
      const container = scrollContainerRef.current;
      if (container) container.scrollLeft += speed;
    }, 16);
  }, []);

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollZone = 100;
    const scrollSpeed = 15;

    if (event.clientX < rect.left + scrollZone) {
      startAutoScroll(-scrollSpeed);
    } else if (event.clientX > rect.right - scrollZone) {
      startAutoScroll(scrollSpeed);
    } else {
      stopAutoScroll();
    }
  };

  const handleCommercialDrop = (lead: Lead, status: string) => {
    if (status === 'perdido') {
      const reasonLabel = prompt(`Motivo de perda:\n${LOSS_REASON_OPTIONS.map((option) => `- ${option.label}`).join('\n')}`);
      if (!reasonLabel) return;
      const matched = LOSS_REASON_OPTIONS.find((option) => option.label.toLowerCase() === reasonLabel.trim().toLowerCase());
      if (!matched) {
        alert('Motivo inválido. Use um dos motivos listados.');
        return;
      }
      const detail = prompt('Descreva o motivo da perda com clareza (mínimo 12 caracteres):') || '';
      if (!isValidLossReasonDetail(detail)) {
        alert('Motivo de perda inválido. Evite justificativa genérica como "não respondeu".');
        return;
      }
      const nextLead = { ...lead, lossReasonCode: matched.value, lossReasonDetail: detail.trim() };
      const lockMessage = validateLeadStatusChange(nextLead, status);
      if (lockMessage) {
        alert(lockMessage);
        return;
      }
      updateLead(lead.id, { status, lossReasonCode: matched.value, lossReasonDetail: detail.trim() });
      return;
    }

    const lockMessage = validateLeadStatusChange(lead, status);
    if (lockMessage) {
      alert(lockMessage);
      return;
    }
    updateLead(lead.id, { status });
  };

  const onDrop = (event: React.DragEvent, status: string) => {
    const recordId = event.dataTransfer.getData('recordId');
    if (!recordId) {
      stopAutoScroll();
      return;
    }

    if (isProspecting) {
      const lead = prospectLeads.find((item) => item.id === recordId);
      if (lead) updateProspectLead(lead.id, { status });
      stopAutoScroll();
      return;
    }

    const lead = leads.find((item) => item.id === recordId);
    if (lead) handleCommercialDrop(lead, status);
    stopAutoScroll();
  };

  const commercialFunnels = allFunnels.filter((funnel) => funnel.operation === 'commercial');
  const prospectingFunnels = allFunnels.filter((funnel) => funnel.operation === 'prospecting');

  const searchPlaceholder = isProspecting
    ? 'Buscar por clínica, contato, telefone ou CNPJ...'
    : 'Buscar por nome, telefone ou CPF...';

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-serif font-bold gold-text-gradient tracking-tight">Gestão de Leads</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-[0.1em] uppercase text-xs">
            Um único kanban para operar qualquer funil do escritório
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <select
            value={selectedFunnelId}
            onChange={(event) => handleFunnelChange(event.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground min-w-[260px]"
          >
            <optgroup label="Funis Comerciais">
              {commercialFunnels.map((funnel) => (
                <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
              ))}
            </optgroup>
            <optgroup label="Funis de Prospecção">
              {prospectingFunnels.map((funnel) => (
                <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
              ))}
            </optgroup>
          </select>
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
              resetModalState();
              setCreateFunnelId(activeFunnel?.id || '');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-3 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold-400 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Novo cadastro
          </button>
        </div>
      </header>

      <div className="bg-card p-4 rounded-2xl border border-border shadow-2xl flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gold-500/50 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters((prev) => !prev)}
          className="flex items-center gap-2 px-6 py-3 bg-background/40 border border-border rounded-xl text-muted-foreground font-bold text-xs uppercase tracking-widest hover:text-primary transition-all"
        >
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {showAdvancedFilters && (
        <div className="bg-card p-4 rounded-2xl border border-border shadow-2xl grid grid-cols-1 md:grid-cols-5 gap-3">
          {!isProspecting && (
            <select value={filterCampaignId} onChange={(event) => setFilterCampaignId(event.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
              <option value="">Todas as campanhas</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          )}
          {!isProspecting && (
            <select
              value={filterAreaId}
              onChange={(event) => {
                setFilterAreaId(event.target.value);
                setFilterServiceId('');
              }}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
            >
              <option value="">Todas as áreas</option>
              {areasOfLaw.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          )}
          <select value={filterServiceId} onChange={(event) => setFilterServiceId(event.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
            <option value="">Todos os serviços</option>
            {services
              .filter((service) => isProspecting || !filterAreaId || service.areaOfLawId === filterAreaId)
              .map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
          </select>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
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
      {isProspecting ? (
        viewMode === 'kanban' ? (
          <div
            ref={scrollContainerRef}
            data-scroll-rail-id="unified-leads-kanban"
            className="scrollbar-visible flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[560px]"
            onDragOver={onDragOver}
            onDragEnd={stopAutoScroll}
            onDragLeave={stopAutoScroll}
          >
            {sortedStages.map((stage) => (
              <div key={stage.id} className="flex-shrink-0 w-80 space-y-4" onDrop={(event) => onDrop(event, stage.id)} onDragOver={onDragOver}>
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-serif font-bold">{stage.name}</h3>
                  <span className="text-[10px] bg-accent px-2 py-1 rounded-full">
                    {filteredProspectLeads.filter((lead) => lead.status === stage.id).length}
                  </span>
                </div>
                <div className="min-h-[500px] rounded-2xl border border-border bg-accent/40 p-3 space-y-3">
                  {filteredProspectLeads.filter((lead) => lead.status === stage.id).map((lead) => {
                    const whatsappUrl = buildWhatsAppUrl(lead.phone);
                    return (
                      <div key={lead.id} draggable onDragStart={(event) => onDragStart(event, lead.id)} onDragEnd={stopAutoScroll} className="rounded-xl border border-border bg-card p-4 space-y-3 cursor-grab active:cursor-grabbing">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-serif font-bold text-foreground">{lead.clinicName}</p>
                            <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                          </div>
                          <Link to={`/prospecting/leads/${lead.id}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
                            Editar
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </div>
                          {lead.cnpj && <p>CNPJ: {lead.cnpj}</p>}
                          {lead.serviceId && (
                            <p className="text-[10px] uppercase tracking-widest text-gold-500/70">
                              {services.find((service) => service.id === lead.serviceId)?.name}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {whatsappUrl && (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-border hover:border-emerald-500 hover:text-emerald-500">
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </a>
                          )}
                          <select
                            value={lead.status}
                            onChange={(event) => updateProspectLead(lead.id, { status: event.target.value })}
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
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-accent text-xs uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-6 py-4">Conta</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Telefone</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProspectLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground italic font-serif text-lg">Nenhum registro encontrado neste funil.</td>
                  </tr>
                ) : (
                  filteredProspectLeads.map((lead) => {
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
                  })
                )}
              </tbody>
            </table>
          </div>
        )
      ) : (
        viewMode === 'kanban' ? (
          <div
            ref={scrollContainerRef}
            data-scroll-rail-id="unified-leads-kanban"
            className="scrollbar-visible flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[600px]"
            onDragOver={onDragOver}
            onDragEnd={stopAutoScroll}
            onDragLeave={stopAutoScroll}
          >
            {sortedStages.map((column) => (
              <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4" onDragOver={onDragOver} onDrop={(event) => onDrop(event, column.id)}>
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ backgroundColor: column.color }}></div>
                    <h3 className="font-serif font-bold text-foreground tracking-wide">{column.name}</h3>
                  </div>
                  <span className="text-[10px] font-black text-gold-500/40 bg-accent px-2 py-0.5 rounded-full">
                    {filteredCommercialLeads.filter((lead) => lead.status === column.id).length}
                  </span>
                </div>
                <div className="flex-1 space-y-4 bg-accent/50 rounded-2xl p-3 border border-border min-h-[500px]">
                  {filteredCommercialLeads.filter((lead) => lead.status === column.id).map((lead) => (
                    <div key={lead.id} draggable onDragStart={(event) => onDragStart(event, lead.id)} onDragEnd={stopAutoScroll} className="bg-muted p-5 rounded-xl border border-border shadow-lg cursor-grab active:cursor-grabbing hover:border-gold-500/40 transition-all group">
                      <div className="flex justify-between items-start mb-3 gap-3">
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
                            {areasOfLaw.find((area) => area.id === lead.areaOfLawId)?.name}
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
                {filteredCommercialLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-16 text-center text-muted-foreground italic font-serif text-lg">Nenhum lead encontrado neste funil.</td>
                  </tr>
                ) : (
                  filteredCommercialLeads.map((lead) => {
                    const stage = sortedStages.find((item) => item.id === lead.status);
                    return (
                      <tr key={lead.id} className="hover:bg-accent transition-all group">
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-serif font-bold text-foreground text-base group-hover:text-primary transition-colors">{lead.name}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 font-medium">{lead.phone}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{areasOfLaw.find((area) => area.id === lead.areaOfLawId)?.name || 'Não definido'}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span
                            className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                            style={{
                              backgroundColor: `${stage?.color || '#D4AF37'}20`,
                              color: stage?.color || '#D4AF37',
                              borderColor: `${stage?.color || '#D4AF37'}40`,
                            }}
                          >
                            {stage?.name || lead.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 font-bold text-emerald-500">{lead.estimatedValue ? `R$ ${lead.estimatedValue.toLocaleString()}` : '-'}</td>
                        <td className="px-8 py-5 text-right">
                          <Link to={`/leads/${lead.id}`} className="text-primary font-black text-[10px] uppercase tracking-widest hover:text-gold-400 transition-colors">Editar Lead</Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {isModalOpen && createFunnel && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl p-8 w-full max-w-2xl shadow-2xl border border-border relative max-h-[90vh] overflow-y-auto scrollbar-none">
            {showSaveSuccess && (
              <div className="absolute inset-0 z-50 bg-card flex flex-col items-center justify-center animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 animate-scale-in">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <p className="text-lg font-serif font-bold text-foreground">Registro salvo com sucesso!</p>
              </div>
            )}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-serif font-bold gold-text-gradient">{createIsProspecting ? 'Novo cadastro em prospecção' : 'Novo lead comercial'}</h2>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">Funil de entrada: {createFunnel.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetModalState();
                }}
                className="text-muted-foreground hover:text-primary"
                disabled={isSavingRecord}
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreateRecord} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Funil</label>
                <select
                  name="funnelId"
                  value={createFunnel.id}
                  onChange={(event) => {
                    setCreateFunnelId(event.target.value);
                    setSelectedArea('');
                  }}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  {allFunnels.map((funnel) => (
                    <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
                  ))}
                </select>
              </div>
              {createIsProspecting ? (
                <>
                  <input name="clinicName" required placeholder="Nome da conta ou clínica" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <input name="contactName" required placeholder="Responsável principal" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <input name="phone" required placeholder="Telefone ou WhatsApp" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <input name="cnpj" placeholder="CNPJ" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <input name="email" placeholder="E-mail" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <input name="city" placeholder="Cidade" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <input name="neighborhood" placeholder="Bairro" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <input name="receptionistName" placeholder="Recepção ou contato secundário" className="px-4 py-3 bg-background/40 border border-border rounded-xl" />
                  <select name="serviceId" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl md:col-span-2">
                    <option value="">Serviço ofertado</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                  {createFieldSchema.length > 0 && (
                    <div className="md:col-span-2 space-y-4 rounded-2xl border border-border bg-background/30 p-5">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/70">Campos específicos do funil</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Este funil pede informações extras no momento do cadastro para manter a operação consistente.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {createFieldSchema.map((field) => (
                          <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">
                              {field.label}
                              {field.required ? ' *' : ''}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                name={`customField:${field.key}`}
                                required={Boolean(field.required)}
                                placeholder={field.placeholder || field.helpText || ''}
                                className="min-h-[110px] w-full rounded-xl border border-border bg-background/40 px-4 py-3"
                              />
                            ) : (
                              <input
                                name={`customField:${field.key}`}
                                required={Boolean(field.required)}
                                type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                                inputMode={field.type === 'number' || field.type === 'cpf' || field.type === 'cnpj' || field.type === 'phone' ? 'numeric' : undefined}
                                placeholder={field.placeholder || field.helpText || ''}
                                className="w-full rounded-xl border border-border bg-background/40 px-4 py-3"
                              />
                            )}
                            {field.helpText && <p className="mt-2 text-xs text-muted-foreground">{field.helpText}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Nome Completo</label>
                      <input required name="name" type="text" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Telefone</label>
                      <input required name="phone" type="tel" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">E-mail</label>
                      <input name="email" type="email" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Área de Atuação</label>
                      <select name="areaOfLawId" onChange={(event) => setSelectedArea(event.target.value)} className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl">
                        <option value="">Selecione a Área</option>
                        {areasOfLaw.map((area) => (
                          <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Serviço</label>
                      <select name="serviceId" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl">
                        <option value="">Selecione o Serviço</option>
                        {services.filter((service) => service.areaOfLawId === selectedArea).map((service) => (
                          <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Valor Estimado</label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-gold-500/50 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input name="estimatedValue" type="number" className="w-full pl-10 pr-4 py-3 bg-background/40 border border-border rounded-xl" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">CPF</label>
                      <input name="cpf" type="text" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl" />
                    </div>
                  </div>
                  {createFieldSchema.length > 0 && (
                    <div className="md:col-span-2 space-y-4 rounded-2xl border border-border bg-background/30 p-5">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/70">Campos específicos do funil</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Este funil usa informações próprias. O cadastro muda aqui sem obrigar todos os outros funis a seguirem o mesmo formulário.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {createFieldSchema.map((field) => (
                          <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">
                              {field.label}
                              {field.required ? ' *' : ''}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                name={`customField:${field.key}`}
                                required={Boolean(field.required)}
                                placeholder={field.placeholder || field.helpText || ''}
                                className="min-h-[110px] w-full rounded-xl border border-border bg-background/40 px-4 py-3"
                              />
                            ) : (
                              <input
                                name={`customField:${field.key}`}
                                required={Boolean(field.required)}
                                type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                                inputMode={field.type === 'number' || field.type === 'cpf' || field.type === 'cnpj' || field.type === 'phone' ? 'numeric' : undefined}
                                placeholder={field.placeholder || field.helpText || ''}
                                className="w-full rounded-xl border border-border bg-background/40 px-4 py-3"
                              />
                            )}
                            {field.helpText && <p className="mt-2 text-xs text-muted-foreground">{field.helpText}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <select name="ownerUserId" defaultValue={isAdmin ? '' : user?.id || ''} className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl md:col-span-2">
                <option value="">Sem atribuição definida</option>
                {activeAssignableUsers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
              <div className="md:col-span-2 flex justify-end gap-4 mt-8 pt-6 border-t border-border">
                <button type="button" onClick={() => { setIsModalOpen(false); resetModalState(); }} className="px-8 py-3 text-muted-foreground font-black text-[10px] uppercase tracking-widest hover:text-foreground transition-all" disabled={isSavingRecord}>
                  Cancelar
                </button>
                <button type="submit" className="px-10 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl disabled:opacity-70" disabled={isSavingRecord}>
                  {isSavingRecord ? 'Salvando...' : 'Confirmar Registro'}
                </button>
              </div>
              {saveError && <p className="md:col-span-2 text-xs text-red-400">{saveError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

