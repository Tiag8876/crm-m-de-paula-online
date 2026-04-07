
import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Filter, LayoutGrid, List, ChevronRight, Phone, DollarSign, CheckCircle2, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { LOSS_REASON_OPTIONS, isValidLossReasonDetail, validateLeadStatusChange } from '@/lib/leadValidation';
import { getLeadServiceIds, leadMatchesService } from '@/lib/leadServices';
import { isAdminUser } from '@/lib/access';
import { buildEffectiveFieldSchema, getTemplatesForOperation } from '@/lib/funnelFieldSchema';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { FunnelConfig, Lead } from '@/types/crm';
import { AssigneeSelect } from '@/components/AssigneeSelect';
import { PremiumSelect } from '@/components/PremiumSelect';
import { PremiumMultiSelect } from '@/components/PremiumMultiSelect';

const sortFunnels = (items: FunnelConfig[]) =>
  [...items].sort((a, b) => {
    if (a.operation !== b.operation) {
      return a.operation === 'commercial' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'pt-BR');
  });

const buildFunnelGroups = (items: FunnelConfig[], areas: Array<{ id: string; name: string }>) => {
  const grouped = new Map<string, { label: string; funnels: FunnelConfig[] }>();
  for (const funnel of items) {
    const areaLabel = areas.find((area) => area.id === funnel.areaOfLawId)?.name;
    const key = areaLabel || (funnel.operation === 'prospecting' ? 'Funis de prospecção sem área' : 'Funis gerais');
    if (!grouped.has(key)) {
      grouped.set(key, { label: key, funnels: [] });
    }
    grouped.get(key)!.funnels.push(funnel);
  }

  return [...grouped.values()].map((group) => ({
    ...group,
    funnels: group.funnels.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  }));
};

export function Leads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, users, assignableUsers, fetchAssignableUsers, fetchUsers } = useAuthStore();
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
    leadSources,
    fieldTemplates,
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
  const [createLeadSourceId, setCreateLeadSourceId] = useState('');
  const [createOwnerUserId, setCreateOwnerUserId] = useState('');
  const [createCampaignId, setCreateCampaignId] = useState('');
  const [createProspectServiceId, setCreateProspectServiceId] = useState('');
  const [createServiceIds, setCreateServiceIds] = useState<string[]>([]);
  const [createCustomFieldValues, setCreateCustomFieldValues] = useState<Record<string, string | string[]>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);
  const draggedRecordIdRef = useRef<string | null>(null);

  const allFunnels = sortFunnels(funnels || []);
  const activeAssignableUsers = Array.from(
    new Map(
      [...(assignableUsers || []), ...(users || []), ...(user ? [user] : [])]
        .filter((candidate) => candidate?.active)
        .map((candidate) => [candidate.id, candidate]),
    ).values(),
  );

  useEffect(() => {
    fetchAssignableUsers().catch(() => null);
    if (isAdmin) {
      fetchUsers().catch(() => null);
    }
  }, [fetchAssignableUsers, fetchUsers, isAdmin]);

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
  const commercialFunnels = allFunnels.filter((funnel) => funnel.operation === 'commercial');
  const prospectingFunnels = allFunnels.filter((funnel) => funnel.operation === 'prospecting');

  const isProspecting = activeFunnel?.operation === 'prospecting';
  const sortedStages = [...(activeFunnel?.stages || [])].sort((a, b) => a.order - b.order);
  const createIsProspecting = createFunnel?.operation === 'prospecting';
  const createSortedStages = [...(createFunnel?.stages || [])].sort((a, b) => a.order - b.order);
  const createEffectiveFieldSchema = buildEffectiveFieldSchema(createFunnel);
  const createFieldMap = new Map(createEffectiveFieldSchema.map((field) => [field.key, field]));
  const createTemplateLibrary = getTemplatesForOperation(fieldTemplates || [], createFunnel?.operation);
  const hasCreateField = (key: string) => createEffectiveFieldSchema.some((field) => field.key === key);
  const createCustomFieldSchema = createEffectiveFieldSchema.filter((field) => {
    const linkedTemplate = createTemplateLibrary.find((template) => template.id === field.templateId || template.key === field.key);
    return !linkedTemplate?.system;
  });
  const createFunnelArea = areasOfLaw.find((area) => area.id === createFunnel?.areaOfLawId);
  const createAreaScopedServices = services.filter((service) => !createFunnel?.areaOfLawId || service.areaOfLawId === createFunnel.areaOfLawId);
  const createAvailableServices = createAreaScopedServices;
  const createSelectedAreaId = selectedArea || createFunnel?.areaOfLawId || '';
  const createCommercialServices = createSelectedAreaId
    ? services.filter((service) => service.areaOfLawId === createSelectedAreaId)
    : [];
  const createLeadSource = (leadSources || []).find((source) => source.id === createLeadSourceId);
  const createAvailableCampaigns = campaigns.filter((campaign) => !createFunnel?.areaOfLawId || !campaign.areaOfLawId || campaign.areaOfLawId === createFunnel.areaOfLawId);
  const commercialFunnelGroups = buildFunnelGroups(commercialFunnels, areasOfLaw);
  const prospectingFunnelGroups = buildFunnelGroups(prospectingFunnels, areasOfLaw);
  const createFunnelGroups = [
    ...commercialFunnelGroups.map((group) => ({ label: `Comercial · ${group.label}`, funnels: group.funnels })),
    ...prospectingFunnelGroups.map((group) => ({ label: `Prospecção · ${group.label}`, funnels: group.funnels })),
  ];
  const funnelOptions = createFunnelGroups.flatMap((group) =>
    group.funnels.map((funnel) => ({
      value: funnel.id,
      label: funnel.name,
      description: funnel.operation === 'prospecting' ? 'Funil de prospecção' : 'Funil comercial',
      group: group.label,
    })),
  );
  const campaignOptions = campaigns.map((campaign) => ({
    value: campaign.id,
    label: campaign.name,
    description: areasOfLaw.find((area) => area.id === campaign.areaOfLawId)?.name || 'Campanha ativa',
    group: 'Campanhas',
  }));
  const areaOptions = areasOfLaw.map((area) => ({
    value: area.id,
    label: area.name,
    description: area.description || 'Área de atuação',
    group: 'Áreas',
  }));
  const serviceOptions = services
    .filter((service) => isProspecting || !filterAreaId || service.areaOfLawId === filterAreaId)
    .map((service) => ({
      value: service.id,
      label: service.name,
      description: areasOfLaw.find((area) => area.id === service.areaOfLawId)?.name || 'Serviço',
      group: 'Serviços',
    }));
  const statusOptions = sortedStages.map((stage) => ({
    value: stage.id,
    label: stage.name,
    description: activeFunnel?.name || 'Etapa do funil',
    group: 'Status',
  }));
  const createAreaOptions = areasOfLaw.map((area) => ({
    value: area.id,
    label: area.name,
    description: area.description || 'Área de atuação',
    group: 'Áreas',
  }));
  const createServiceOptions = createAvailableServices.map((service) => ({
    value: service.id,
    label: service.name,
    description: createFunnelArea?.name || areasOfLaw.find((area) => area.id === service.areaOfLawId)?.name || 'Serviço',
    group: 'Serviços',
  }));
  const leadSourceOptions = (leadSources || []).map((source) => ({
    value: source.id,
    label: source.name,
    description: source.kind === 'campaign' ? 'Origem por campanha' : 'Origem manual',
    group: source.kind === 'campaign' ? 'Campanhas' : 'Outras origens',
  }));
  const createCampaignOptions = createAvailableCampaigns.map((campaign) => ({
    value: campaign.id,
    label: campaign.name,
    description: areasOfLaw.find((area) => area.id === campaign.areaOfLawId)?.name || 'Campanha',
    group: 'Campanhas',
  }));

  const getBaseField = (key: string, fallbackLabel: string, fallbackPlaceholder = '', fallbackRequired = false) =>
    createFieldMap.get(key) || {
      key,
      label: fallbackLabel,
      placeholder: fallbackPlaceholder,
      required: fallbackRequired,
      type: 'text' as const,
      id: `fallback-${key}`,
      order: 0,
      helpText: '',
    };

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
    const byService = leadMatchesService(lead, filterServiceId);
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
    setCreateLeadSourceId('');
    setCreateOwnerUserId(isAdmin ? '' : user?.id || '');
    setCreateCampaignId('');
    setCreateProspectServiceId('');
    setCreateServiceIds([]);
    setCreateCustomFieldValues({});
  };

  const updateCreateCustomField = (key: string, value: string | string[]) => {
    setCreateCustomFieldValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const collectCustomFields = () =>
    createCustomFieldSchema.reduce<Record<string, string | string[]>>((acc, field) => {
      const rawValue = createCustomFieldValues[field.key];
      if (Array.isArray(rawValue)) {
        if (rawValue.length) {
          acc[field.key] = rawValue;
        }
        return acc;
      }
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
      const customFields = collectCustomFields();
      const selectedServiceIds = hasCreateField(createIsProspecting ? 'serviceId' : 'serviceIds')
        ? createServiceIds.filter(Boolean)
        : [];
      if (createIsProspecting) {
        addProspectLead({
          clinicName: hasCreateField('clinicName') ? String(formData.get('clinicName') || '') : '',
          contactName: hasCreateField('contactName') ? String(formData.get('contactName') || '') : '',
          receptionistName: hasCreateField('receptionistName') ? String(formData.get('receptionistName') || '') || undefined : undefined,
          phone: hasCreateField('phone') ? String(formData.get('phone') || '') : '',
          email: hasCreateField('email') ? String(formData.get('email') || '') : '',
          cnpj: hasCreateField('cnpj') ? String(formData.get('cnpj') || '') : '',
          city: hasCreateField('city') ? String(formData.get('city') || '') : '',
          neighborhood: hasCreateField('neighborhood') ? String(formData.get('neighborhood') || '') || undefined : undefined,
          serviceId: hasCreateField('serviceId') ? (createProspectServiceId || String(formData.get('serviceId') || '') || undefined) : undefined,
          funnelId: String(formData.get('funnelId') || '') || createFunnel?.id,
          status: createSortedStages[0]?.id || 'p_novo',
          ownerUserId: hasCreateField('ownerUserId') ? (createOwnerUserId || (isAdmin ? undefined : user?.id)) : undefined,
          customFields,
        });
      } else {
        const sourceId = hasCreateField('sourceId') ? (String(formData.get('sourceId') || '') || undefined) : undefined;
        const selectedSource = (leadSources || []).find((source) => source.id === sourceId);
        const campaignId = hasCreateField('campaignId') && selectedSource?.kind === 'campaign'
          ? createCampaignId || String(formData.get('campaignId') || '') || undefined
          : undefined;
        const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId);
        const mergedServiceIds = selectedCampaign?.serviceId
          ? Array.from(new Set([selectedCampaign.serviceId, ...selectedServiceIds]))
          : selectedServiceIds;
        addLead({
          name: hasCreateField('name') ? String(formData.get('name') || '') : '',
          phone: hasCreateField('phone') ? String(formData.get('phone') || '') : '',
          email: hasCreateField('email') ? String(formData.get('email') || '') : '',
          cpf: hasCreateField('cpf') ? String(formData.get('cpf') || '') : '',
          legalArea: String(formData.get('legalArea') || ''),
          areaOfLawId: hasCreateField('areaOfLawId')
            ? (selectedCampaign?.areaOfLawId || String(formData.get('areaOfLawId') || '') || createFunnel?.areaOfLawId || '')
            : (selectedCampaign?.areaOfLawId || createFunnel?.areaOfLawId || ''),
          serviceId: hasCreateField('serviceIds') ? mergedServiceIds[0] : undefined,
          serviceIds: hasCreateField('serviceIds') ? mergedServiceIds : [],
          sourceId,
          sourceDetails: !hasCreateField('sourceDetails') || selectedSource?.kind === 'campaign'
            ? undefined
            : String(formData.get('sourceDetails') || '') || undefined,
          campaignId,
          funnelId: String(formData.get('funnelId') || '') || createFunnel?.id,
          estimatedValue: hasCreateField('estimatedValue') ? Number(formData.get('estimatedValue')) || 0 : 0,
          status: createSortedStages[0]?.id || 'novo',
          ownerUserId: hasCreateField('ownerUserId') ? (createOwnerUserId || (isAdmin ? undefined : user?.id)) : undefined,
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
    draggedRecordIdRef.current = id;
    event.dataTransfer.setData('recordId', id);
  };

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current !== null) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const handleCardOpen = (path: string, id: string) => {
    if (draggedRecordIdRef.current === id) return;
    navigate(path);
  };

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

  const searchPlaceholder = isProspecting
      ? 'Buscar por clínica, contato, telefone ou CNPJ...'
    : 'Buscar por nome, telefone ou CPF...';

  return (
    <div className="p-4 md:p-6 xl:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold gold-text-gradient tracking-tight">Gestão de Leads</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-[0.1em] uppercase text-[11px]">
            Um único kanban para operar qualquer funil do escritório
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[300px] flex-1 max-w-[420px]">
            <PremiumSelect
              options={funnelOptions}
              value={selectedFunnelId}
              onChange={handleFunnelChange}
              placeholder="Buscar funil"
            />
          </div>
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
                setSelectedArea(activeFunnel?.areaOfLawId || '');
                setCreateLeadSourceId('');
                setCreateOwnerUserId(isAdmin ? '' : user?.id || '');
                setCreateCampaignId('');
                setCreateProspectServiceId('');
                setCreateServiceIds([]);
                setCreateCustomFieldValues({});
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
            <PremiumSelect
              options={campaignOptions}
              value={filterCampaignId}
              onChange={setFilterCampaignId}
              placeholder="Buscar campanha"
              emptyLabel="Todas as campanhas"
            />
          )}
          {!isProspecting && (
            <PremiumSelect
              options={areaOptions}
              value={filterAreaId}
              onChange={(nextValue) => {
                setFilterAreaId(nextValue);
                setFilterServiceId('');
              }}
              placeholder="Buscar área"
              emptyLabel="Todas as áreas"
            />
          )}
          <PremiumSelect
            options={serviceOptions}
            value={filterServiceId}
            onChange={setFilterServiceId}
            placeholder="Buscar serviço"
            emptyLabel="Todos os serviços"
          />
          <PremiumSelect
            options={statusOptions}
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="Buscar status"
            emptyLabel="Todos os status"
          />
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
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(event) => onDragStart(event, lead.id)}
                        onDragEnd={() => {
                          stopAutoScroll();
                          window.setTimeout(() => {
                            draggedRecordIdRef.current = null;
                          }, 0);
                        }}
                        onClick={() => handleCardOpen(`/prospecting/leads/${lead.id}`, lead.id)}
                        className="rounded-xl border border-border bg-card p-4 space-y-3 cursor-pointer hover:border-gold-500/40 active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-serif font-bold text-foreground">{lead.clinicName}</p>
                            <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                          </div>
                          <Link to={`/prospecting/leads/${lead.id}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
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
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-border hover:border-emerald-500 hover:text-emerald-500">
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </a>
                          )}
                            <select
                              value={lead.status}
                              onClick={(event) => event.stopPropagation()}
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
                      <tr
                        key={lead.id}
                        onClick={() => navigate(`/prospecting/leads/${lead.id}`)}
                        className="cursor-pointer border-t border-border hover:bg-accent/60">
                        <td className="px-6 py-4 font-semibold">{lead.clinicName}</td>
                        <td className="px-6 py-4">{lead.contactName}</td>
                        <td className="px-6 py-4">{lead.phone}</td>
                        <td className="px-6 py-4">{stage?.name || lead.status}</td>
                        <td className="px-6 py-4 text-right space-x-4">
                          {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">WhatsApp</a>}
                          <Link to={`/prospecting/leads/${lead.id}`} onClick={(event) => event.stopPropagation()} className="text-primary hover:underline">Editar</Link>
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
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(event) => onDragStart(event, lead.id)}
                      onDragEnd={() => {
                        stopAutoScroll();
                        window.setTimeout(() => {
                          draggedRecordIdRef.current = null;
                        }, 0);
                      }}
                      onClick={() => handleCardOpen(`/leads/${lead.id}`, lead.id)}
                      className="bg-muted p-5 rounded-xl border border-border shadow-lg cursor-pointer active:cursor-grabbing hover:border-gold-500/40 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-3 gap-3">
                        <h4 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors">{lead.name}</h4>
                        <Link to={`/leads/${lead.id}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gold-500/70 hover:text-primary">
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
                        {getLeadServiceIds(lead).length > 0 && (
                          <p className="text-[10px] uppercase tracking-widest text-gold-500/70">
                            {getLeadServiceIds(lead)
                              .map((serviceId) => services.find((service) => service.id === serviceId)?.name)
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
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
                      <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} className="cursor-pointer hover:bg-accent transition-all group">
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-serif font-bold text-foreground text-base group-hover:text-primary transition-colors">{lead.name}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 font-medium">{lead.phone}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{areasOfLaw.find((area) => area.id === lead.areaOfLawId)?.name || 'Não definido'}</span>
                            {getLeadServiceIds(lead).length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {getLeadServiceIds(lead)
                                  .map((serviceId) => services.find((service) => service.id === serviceId)?.name)
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            )}
                          </div>
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
                          <Link to={`/leads/${lead.id}`} onClick={(event) => event.stopPropagation()} className="text-primary font-black text-[10px] uppercase tracking-widest hover:text-gold-400 transition-colors">Editar Lead</Link>
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
          <div className="relative w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl scrollbar-none md:p-6 xl:max-w-5xl max-h-[92vh]">
            {showSaveSuccess && (
              <div className="absolute inset-0 z-50 bg-card flex flex-col items-center justify-center animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 animate-scale-in">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <p className="text-lg font-serif font-bold text-foreground">Registro salvo com sucesso!</p>
              </div>
            )}
            <div className="mb-5 flex items-start justify-between gap-4 md:mb-6">
              <div>
                <h2 className="text-xl font-serif font-bold gold-text-gradient md:text-2xl">{createIsProspecting ? 'Novo cadastro em prospecção' : 'Novo lead comercial'}</h2>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Funil de entrada: {createFunnel.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetModalState();
                }}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-primary"
                disabled={isSavingRecord}
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreateRecord} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
              <div className="md:col-span-2">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Funil</label>
                <PremiumSelect
                  name="funnelId"
                  options={funnelOptions}
                  value={createFunnel.id}
                  onChange={(nextValue) => {
                    setCreateFunnelId(nextValue);
                    const nextFunnel = allFunnels.find((funnel) => funnel.id === nextValue);
                    setSelectedArea(nextFunnel?.areaOfLawId || '');
                    setCreateLeadSourceId('');
                    setCreateCampaignId('');
                    setCreateProspectServiceId('');
                    setCreateServiceIds([]);
                    setCreateCustomFieldValues({});
                  }}
                  placeholder="Buscar funil"
                  emptyLabel="Selecione o funil"
                />
              </div>

              {createIsProspecting ? (
                <>
                  {hasCreateField('clinicName') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Conta ou clínica</label>
                      <input
                        name="clinicName"
                        required
                        placeholder="Nome da conta ou clínica"
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('contactName') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Responsável principal</label>
                      <input
                        name="contactName"
                        required
                        placeholder="Responsável principal"
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('phone') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('phone', 'Telefone ou WhatsApp', 'Telefone ou WhatsApp', true).label}</label>
                      <input
                        name="phone"
                        required={Boolean(getBaseField('phone', 'Telefone ou WhatsApp', 'Telefone ou WhatsApp', true).required)}
                        placeholder={getBaseField('phone', 'Telefone ou WhatsApp', 'Telefone ou WhatsApp', true).placeholder || 'Telefone ou WhatsApp'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('cnpj') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('cnpj', 'CNPJ', 'CNPJ').label}</label>
                      <input
                        name="cnpj"
                        placeholder={getBaseField('cnpj', 'CNPJ', 'CNPJ').placeholder || 'CNPJ'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('email') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('email', 'E-mail', 'E-mail').label}</label>
                      <input
                        name="email"
                        placeholder={getBaseField('email', 'E-mail', 'E-mail').placeholder || 'E-mail'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('city') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('city', 'Cidade', 'Cidade').label}</label>
                      <input
                        name="city"
                        placeholder={getBaseField('city', 'Cidade', 'Cidade').placeholder || 'Cidade'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('neighborhood') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('neighborhood', 'Bairro', 'Bairro').label}</label>
                      <input
                        name="neighborhood"
                        placeholder={getBaseField('neighborhood', 'Bairro', 'Bairro').placeholder || 'Bairro'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('receptionistName') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Recepção ou contato secundário</label>
                      <input
                        name="receptionistName"
                        placeholder="Recepção ou contato secundário"
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('serviceId') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('serviceId', 'Serviço ofertado', 'Selecione o serviço').label}</label>
                      <PremiumSelect
                        name="serviceId"
                        options={createServiceOptions}
                        value={createProspectServiceId}
                        onChange={setCreateProspectServiceId}
                        placeholder="Buscar serviço"
                        emptyLabel={createFunnel?.areaOfLawId ? (createServiceOptions.length > 0 ? (getBaseField('serviceId', 'Serviço ofertado', 'Selecione o serviço').placeholder || 'Selecione o serviço') : 'Nenhum serviço vinculado a esta área') : 'Selecione a área de atuação primeiro'}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {hasCreateField('name') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('name', 'Nome completo', 'Nome do cliente', true).label}</label>
                      <input
                        required={Boolean(getBaseField('name', 'Nome completo', 'Nome do cliente', true).required)}
                        name="name"
                        type="text"
                        placeholder={getBaseField('name', 'Nome completo', 'Nome do cliente', true).placeholder || 'Nome do cliente'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('areaOfLawId') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('areaOfLawId', 'Área de atuação', 'Selecione a área').label}</label>
                      <PremiumSelect
                        name="areaOfLawId"
                        options={createAreaOptions}
                        value={selectedArea}
                        onChange={(nextValue) => {
                          setSelectedArea(nextValue);
                          setCreateServiceIds([]);
                        }}
                        placeholder="Buscar área"
                        emptyLabel={getBaseField('areaOfLawId', 'Área de atuação', 'Selecione a área').placeholder || 'Selecione a área'}
                      />
                    </div>
                  )}
                  {hasCreateField('phone') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('phone', 'Telefone', 'Telefone', true).label}</label>
                      <input
                        required={Boolean(getBaseField('phone', 'Telefone', 'Telefone', true).required)}
                        name="phone"
                        type="tel"
                        placeholder={getBaseField('phone', 'Telefone', 'Telefone', true).placeholder || 'Telefone'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('serviceIds') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('serviceIds', 'Serviços', 'Selecione um ou mais serviços').label}</label>
                      <PremiumMultiSelect
                        options={createCommercialServices.map((service) => ({
                          value: service.id,
                          label: service.name,
                          description: areasOfLaw.find((area) => area.id === service.areaOfLawId)?.name || 'Serviço',
                          group: 'Serviços da área',
                        }))}
                        values={createServiceIds}
                        onChange={setCreateServiceIds}
                        placeholder="Buscar serviço"
                        emptyLabel={selectedArea ? (createCommercialServices.length > 0 ? (getBaseField('serviceIds', 'Serviços', 'Selecione um ou mais serviços').placeholder || 'Selecione um ou mais serviços') : 'Nenhum serviço vinculado a esta área') : 'Selecione a área de atuação primeiro'}
                        emptyDescription={selectedArea ? (createCommercialServices.length > 0 ? 'Nenhum serviço selecionado' : 'Cadastre serviços nesta área para usar neste funil') : 'Escolha a área de atuação para carregar os serviços'}
                      />
                    </div>
                  )}
                  {hasCreateField('email') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('email', 'E-mail', 'E-mail').label}</label>
                      <input
                        name="email"
                        type="email"
                        placeholder={getBaseField('email', 'E-mail', 'E-mail').placeholder || 'E-mail'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('sourceId') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('sourceId', 'Origem do lead', 'Selecione a origem').label}</label>
                      <PremiumSelect
                        name="sourceId"
                        options={leadSourceOptions}
                        value={createLeadSourceId}
                        onChange={(nextValue) => {
                          setCreateLeadSourceId(nextValue);
                          setCreateCampaignId('');
                        }}
                        placeholder="Buscar origem"
                        emptyLabel={getBaseField('sourceId', 'Origem do lead', 'Selecione a origem').placeholder || 'Selecione a origem'}
                      />
                    </div>
                  )}
                  {hasCreateField('estimatedValue') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('estimatedValue', 'Valor estimado', 'Valor estimado').label}</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-500/50" />
                        <input name="estimatedValue" type="number" className="w-full rounded-xl border border-border bg-background/40 py-2.5 pl-10 pr-3 text-sm" />
                      </div>
                    </div>
                  )}
                  {hasCreateField('cpf') && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('cpf', 'CPF', 'CPF').label}</label>
                      <input
                        name="cpf"
                        type="text"
                        placeholder={getBaseField('cpf', 'CPF', 'CPF').placeholder || 'CPF'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                  {hasCreateField('campaignId') && createLeadSource?.kind === 'campaign' && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('campaignId', 'Campanha', 'Selecione a campanha').label}</label>
                      <PremiumSelect
                        name="campaignId"
                        options={createCampaignOptions}
                        value={createCampaignId}
                        onChange={setCreateCampaignId}
                        placeholder="Buscar campanha"
                        emptyLabel={getBaseField('campaignId', 'Campanha', 'Selecione a campanha').placeholder || 'Selecione a campanha'}
                      />
                    </div>
                  )}
                  {hasCreateField('sourceDetails') && createLeadSourceId && createLeadSource?.kind !== 'campaign' && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{getBaseField('sourceDetails', 'Detalhe da origem', 'Descreva a origem').label}</label>
                      <input
                        name="sourceDetails"
                        type="text"
                        placeholder={getBaseField('sourceDetails', 'Detalhe da origem', 'Descreva a origem').placeholder || 'Descreva a origem'}
                        className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              {createCustomFieldSchema.map((field) => (
                <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      required={Boolean(field.required)}
                      value={typeof createCustomFieldValues[field.key] === 'string' ? String(createCustomFieldValues[field.key]) : ''}
                      onChange={(event) => updateCreateCustomField(field.key, event.target.value)}
                      placeholder={field.placeholder || field.helpText || ''}
                      className="min-h-[96px] w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                    />
                  ) : field.type === 'select' ? (
                    <PremiumSelect
                      options={(field.options || []).map((option) => ({
                        value: option.value,
                        label: option.label,
                        description: field.label,
                        group: 'Opções',
                      }))}
                      value={typeof createCustomFieldValues[field.key] === 'string' ? String(createCustomFieldValues[field.key]) : ''}
                      onChange={(nextValue) => updateCreateCustomField(field.key, nextValue)}
                      placeholder={`Buscar ${field.label.toLowerCase()}`}
                      emptyLabel={field.placeholder || `Selecione ${field.label.toLowerCase()}`}
                    />
                  ) : field.type === 'multiselect' ? (
                    <PremiumMultiSelect
                      options={(field.options || []).map((option) => ({
                        value: option.value,
                        label: option.label,
                        description: field.label,
                        group: 'Opções',
                      }))}
                      values={Array.isArray(createCustomFieldValues[field.key]) ? (createCustomFieldValues[field.key] as string[]) : []}
                      onChange={(nextValues) => updateCreateCustomField(field.key, nextValues)}
                      placeholder={`Buscar ${field.label.toLowerCase()}`}
                      emptyLabel={field.placeholder || `Selecione ${field.label.toLowerCase()}`}
                    />
                  ) : (
                    <input
                      required={Boolean(field.required)}
                      value={typeof createCustomFieldValues[field.key] === 'string' ? String(createCustomFieldValues[field.key]) : ''}
                      onChange={(event) => updateCreateCustomField(field.key, event.target.value)}
                      type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                      inputMode={field.type === 'number' || field.type === 'cpf' || field.type === 'cnpj' || field.type === 'phone' ? 'numeric' : undefined}
                      placeholder={field.placeholder || field.helpText || ''}
                      className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                    />
                  )}
                  {field.helpText && <p className="mt-2 text-xs text-muted-foreground">{field.helpText}</p>}
                </div>
              ))}

              {hasCreateField('ownerUserId') && (
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Atribuir responsável</label>
                  <AssigneeSelect
                    users={activeAssignableUsers}
                    value={createOwnerUserId}
                    onChange={(nextValue) => setCreateOwnerUserId(nextValue || '')}
                    placeholder="Selecione um vendedor"
                    unassignedLabel="Sem atribuição definida"
                    className="bg-background/40"
                  />
                </div>
              )}

              <div className="mt-5 flex justify-end gap-3 border-t border-border pt-4 md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetModalState();
                  }}
                  className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:text-foreground"
                  disabled={isSavingRecord}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-8 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl transition-all hover:bg-gold-400 disabled:opacity-70"
                  disabled={isSavingRecord}
                >
                  {isSavingRecord ? 'Salvando...' : 'Confirmar registro'}
                </button>
              </div>
              {saveError && <p className="text-xs text-red-400 md:col-span-2">{saveError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



