import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Lead,
  Campaign,
  CampaignSpendEntry,
  AdGroup,
  Ad,
  LeadNote,
  FollowUp,
  LeadLog,
  LeadDocument,
  AreaOfLaw,
  Service,
  Task,
  KanbanStage,
  FunnelConfig,
  FunnelFieldConfig,
  FieldTemplate,
  SystemNotification,
  WeeklySnapshot,
  ProspectLead,
  LeadSource,
  LeadSourceKind,
} from '../types/crm';
import { getLeadIdleHours } from '@/lib/leadMetrics';
import {
  ensureFunnelFieldSchema,
  getDefaultFieldTemplates,
  normalizeFieldSchema,
  normalizeFieldTemplates,
  templateToFieldConfig,
} from '@/lib/funnelFieldSchema';

const getSPTime = () => {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  });
};

const DEFAULT_STAGES: KanbanStage[] = [
  { id: 'novo', name: 'Novo Lead', color: '#D4AF37', order: 0 },
  { id: 'em_contato', name: 'Em Contato', color: '#3B82F6', order: 1 },
  { id: 'aguardando_resposta', name: 'Aguardando Resposta', color: '#F59E0B', order: 2 },
  { id: 'reuniao_agendada', name: 'Reunião Agendada', color: '#8B5CF6', order: 3 },
  { id: 'fechado', name: 'Contrato Fechado', color: '#10B981', order: 4 },
  { id: 'perdido', name: 'Perdido', color: '#EF4444', order: 5 },
];

const DEFAULT_PROSPECT_STAGES: KanbanStage[] = [
  { id: 'p_novo', name: 'Novo Cadastro', color: '#D4AF37', order: 0 },
  { id: 'p_primeira_ligacao', name: 'Primeira Ligação', color: '#3B82F6', order: 1 },
  { id: 'p_sem_contato', name: 'Sem Contato', color: '#F59E0B', order: 2 },
  { id: 'p_retorno', name: 'Retorno Agendado', color: '#8B5CF6', order: 3 },
  { id: 'p_qualificada', name: 'Qualificada', color: '#06B6D4', order: 4 },
  { id: 'p_proposta', name: 'Proposta Enviada', color: '#6366F1', order: 5 },
  { id: 'p_negociacao', name: 'Negociação', color: '#EC4899', order: 6 },
  { id: 'p_fechada', name: 'Fechada', color: '#10B981', order: 7 },
  { id: 'p_perdida', name: 'Perdida', color: '#EF4444', order: 8 },
  { id: 'p_inspecao', name: 'Inspeção', color: '#22C55E', order: 9 },
];

const DEFAULT_COMMERCIAL_FUNNEL_ID = 'funnel-commercial-default';
const DEFAULT_PROSPECTING_FUNNEL_ID = 'funnel-prospecting-default';
const DEFAULT_LEAD_SOURCE_CAMPAIGN_ID = 'lead-source-campaign';

const DEFAULT_LEAD_SOURCES: LeadSource[] = [
  { id: DEFAULT_LEAD_SOURCE_CAMPAIGN_ID, name: 'Campanha', kind: 'campaign', locked: true },
  { id: 'lead-source-referral', name: 'Indicacao', kind: 'referral' },
  { id: 'lead-source-partner', name: 'Parceria', kind: 'partner' },
  { id: 'lead-source-organic', name: 'Organico', kind: 'organic' },
  { id: 'lead-source-other', name: 'Outro', kind: 'other' },
];

const ensureLeadSources = (sources?: LeadSource[]): LeadSource[] => {
  const current = [...(sources || [])];
  for (const fallback of DEFAULT_LEAD_SOURCES) {
    if (!current.some((source) => source.id === fallback.id)) {
      current.push(fallback);
    }
  }
  return current;
};

const normalizeLeadServices = <T extends { serviceId?: string; serviceIds?: string[] }>(lead: T): T => {
  const normalizedIds = Array.from(new Set((lead.serviceIds || []).filter(Boolean)));
  const fallbackServiceId = lead.serviceId || normalizedIds[0];
  const serviceIds = fallbackServiceId
    ? Array.from(new Set([fallbackServiceId, ...normalizedIds]))
    : normalizedIds;

  return {
    ...lead,
    serviceId: serviceIds[0],
    serviceIds,
  };
};

const buildDefaultFunnels = (): FunnelConfig[] => {
  const timestamp = new Date().toISOString();
  return [
    {
      id: DEFAULT_COMMERCIAL_FUNNEL_ID,
      name: 'Funil Comercial Padrão',
      description: 'Fluxo principal de vendas do escritorio.',
      operation: 'commercial',
      stages: DEFAULT_STAGES,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: DEFAULT_PROSPECTING_FUNNEL_ID,
      name: 'Funil de Prospecção Padrão',
      description: 'Fluxo usado para contatos frios e qualificação inicial.',
      operation: 'prospecting',
      stages: DEFAULT_PROSPECT_STAGES,
      objections: [
        'Sem orçamento no momento',
        'Já possui assessoria',
        'Sem tempo para implementar agora',
        'Não viu valor na proposta',
      ],
      playbook:
        '1) Abertura: confirme nome da clínica e responsável.\n' +
        '2) Diagnóstico: pergunte sobre desafios jurídicos e sanitários atuais.\n' +
        '3) Valor: explique como a assessoria reduz risco e organiza a operação.\n' +
        '4) Objeções: registre motivo e avance para o próximo passo.\n' +
        '5) Fechamento: agende retorno com data e hora.',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
};

const normalizeStages = (stages: KanbanStage[] = []): KanbanStage[] =>
  [...stages]
    .sort((a, b) => a.order - b.order)
    .map((stage, index) => ({ ...stage, order: index }));

const ensureFunnels = (funnels?: FunnelConfig[], fieldTemplates: FieldTemplate[] = getDefaultFieldTemplates()): FunnelConfig[] => {
  const current = [...(funnels || [])];
  const defaults = buildDefaultFunnels();

  for (const fallback of defaults) {
    if (!current.some((funnel) => funnel.id === fallback.id)) {
      current.push(fallback);
    }
  }

  return current.map((funnel) => ({
    ...funnel,
    stages: normalizeStages(funnel.stages),
    fieldSchema: ensureFunnelFieldSchema(funnel, fieldTemplates, funnel.fieldSchema),
    objections: funnel.objections || [],
    playbook: funnel.playbook || '',
  }));
};

const getDefaultFunnel = (
  funnels: FunnelConfig[],
  operation: FunnelConfig['operation'],
  preferredId?: string,
): FunnelConfig => {
  const preferred = preferredId ? funnels.find((funnel) => funnel.id === preferredId) : undefined;
  if (preferred && preferred.operation === operation) {
    return preferred;
  }

  const fallback = funnels.find((funnel) => funnel.operation === operation);
  if (fallback) {
    return fallback;
  }

  return buildDefaultFunnels().find((funnel) => funnel.operation === operation)!;
};

const buildFunnelAliases = (
  funnelsInput?: FunnelConfig[],
  fieldTemplatesInput: FieldTemplate[] = getDefaultFieldTemplates(),
  commercialPreferredId?: string,
  prospectingPreferredId?: string,
) => {
  const fieldTemplates = normalizeFieldTemplates(fieldTemplatesInput);
  const funnels = ensureFunnels(funnelsInput, fieldTemplates);
  const commercial = getDefaultFunnel(funnels, 'commercial', commercialPreferredId);
  const prospecting = getDefaultFunnel(funnels, 'prospecting', prospectingPreferredId);

  return {
    fieldTemplates,
    funnels,
    commercialDefaultFunnelId: commercial.id,
    prospectingDefaultFunnelId: prospecting.id,
    kanbanStages: commercial.stages,
    prospectKanbanStages: prospecting.stages,
    prospectObjections: prospecting.objections || [],
    prospectPlaybook: prospecting.playbook || '',
  };
};

const getWeekKey = (date = new Date()): string => {
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
};

const isDateInWeek = (dateValue: string, weekKey: string): boolean => {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return false;
  const monday = new Date(`${weekKey}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  return value >= monday && value < sunday;
};

interface AppState {
  leads: Lead[];
  campaigns: Campaign[];
  campaignSpendEntries: CampaignSpendEntry[];
  adGroups: AdGroup[];
  ads: Ad[];
  areasOfLaw: AreaOfLaw[];
  services: Service[];
  leadSources: LeadSource[];
  standardTasks: Omit<Task, 'date' | 'leadId' | 'status' | 'isStandard'>[];
  fieldTemplates: FieldTemplate[];
  funnels: FunnelConfig[];
  commercialDefaultFunnelId: string;
  prospectingDefaultFunnelId: string;
  kanbanStages: KanbanStage[];
  notifications: SystemNotification[];
  weeklySnapshots: WeeklySnapshot[];
  prospectLeads: ProspectLead[];
  prospectKanbanStages: KanbanStage[];
  prospectObjections: string[];
  prospectPlaybook: string;

  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'notes' | 'followUps' | 'tasks' | 'logs' | 'documents'>) => void;
  updateLead: (id: string, data: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addNoteToLead: (leadId: string, type: LeadNote['type'], content: string) => void;
  updateNoteInLead: (leadId: string, noteId: string, data: Partial<LeadNote>) => void;
  deleteNoteFromLead: (leadId: string, noteId: string) => void;
  addDocumentToLead: (leadId: string, document: Omit<LeadDocument, 'id' | 'createdAt'>) => void;
  updateDocumentInLead: (leadId: string, documentId: string, data: Partial<LeadDocument>) => void;
  deleteDocumentFromLead: (leadId: string, documentId: string) => void;
  addFollowUpToLead: (leadId: string, followUp: Omit<FollowUp, 'id' | 'status'>) => void;
  updateFollowUpInLead: (leadId: string, followUpId: string, data: Partial<FollowUp>) => void;
  deleteFollowUpFromLead: (leadId: string, followUpId: string) => void;
  updateFollowUpStatus: (leadId: string, followUpId: string, status: 'pendente' | 'concluido') => void;
  addTaskToLead: (leadId: string, task: Omit<Task, 'id' | 'status' | 'leadId'>) => void;
  updateTaskInLead: (leadId: string, taskId: string, data: Partial<Task>) => void;
  deleteTaskFromLead: (leadId: string, taskId: string) => void;
  updateTaskStatus: (leadId: string, taskId: string, status: 'pendente' | 'concluida') => void;
  addLog: (leadId: string, type: LeadLog['type'], content: string) => void;
  runInactivityAutomation: (thresholdHours?: number) => number;
  syncOperationalNotifications: (thresholdHours?: number) => number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  ensureWeeklySnapshot: () => WeeklySnapshot | null;

  addCampaign: (name: string, areaOfLawId?: string, serviceId?: string) => string;
  updateCampaign: (id: string, data: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  addCampaignSpendEntry: (campaignId: string, entry: Omit<CampaignSpendEntry, 'id' | 'campaignId' | 'createdAt'>) => void;
  updateCampaignSpendEntry: (id: string, data: Partial<Omit<CampaignSpendEntry, 'id' | 'campaignId' | 'createdAt'>>) => void;
  deleteCampaignSpendEntry: (id: string) => void;
  addAdGroup: (campaignId: string, name: string) => void;
  updateAdGroup: (id: string, data: Partial<AdGroup>) => void;
  deleteAdGroup: (id: string) => void;
  addAd: (adGroupId: string, name: string, mediaUrl?: string, mediaType?: 'image' | 'video') => void;
  updateAd: (id: string, data: Partial<Ad>) => void;
  deleteAd: (id: string) => void;

  addAreaOfLaw: (name: string, description?: string) => void;
  updateAreaOfLaw: (id: string, data: Partial<AreaOfLaw>) => void;
  deleteAreaOfLaw: (id: string) => void;

  addService: (areaOfLawId: string, name: string, description?: string, price?: number) => void;
  updateService: (id: string, data: Partial<Service>) => void;
  deleteService: (id: string) => void;

  addLeadSource: (name: string, kind: LeadSourceKind, description?: string) => void;
  updateLeadSource: (id: string, data: Partial<Omit<LeadSource, 'id'>>) => void;
  deleteLeadSource: (id: string) => void;

  addStandardTask: (title: string, description?: string) => void;
  deleteStandardTask: (id: string) => void;

  addFieldTemplate: (template: Omit<FieldTemplate, 'id' | 'order'>) => string;
  updateFieldTemplate: (id: string, data: Partial<Omit<FieldTemplate, 'id' | 'order'>>) => void;
  deleteFieldTemplate: (id: string) => void;

  addKanbanStage: (name: string, color: string) => void;
  updateKanbanStage: (id: string, data: Partial<KanbanStage>) => void;
  deleteKanbanStage: (id: string) => void;
  reorderKanbanStages: (stages: KanbanStage[]) => void;
  addFunnel: (input: { name: string; operation: FunnelConfig['operation']; description?: string; areaOfLawId?: string }) => string;
  updateFunnel: (id: string, data: Partial<Pick<FunnelConfig, 'name' | 'description' | 'operation' | 'playbook' | 'areaOfLawId'>>) => void;
  duplicateFunnel: (id: string) => string | null;
  deleteFunnel: (id: string) => void;
  setDefaultFunnel: (operation: FunnelConfig['operation'], funnelId: string) => void;
  addFunnelStage: (funnelId: string, name: string, color: string) => void;
  updateFunnelStage: (funnelId: string, stageId: string, data: Partial<KanbanStage>) => void;
  deleteFunnelStage: (funnelId: string, stageId: string) => void;
  reorderFunnelStages: (funnelId: string, stages: KanbanStage[]) => void;
  addFieldTemplateToFunnel: (funnelId: string, templateId: string) => void;
  updateFunnelField: (funnelId: string, fieldId: string, data: Partial<Omit<FunnelFieldConfig, 'id' | 'order'>>) => void;
  deleteFunnelField: (funnelId: string, fieldId: string) => void;
  reorderFunnelFields: (funnelId: string, fields: FunnelFieldConfig[]) => void;
  addFunnelObjection: (funnelId: string, value: string) => void;
  removeFunnelObjection: (funnelId: string, value: string) => void;
  setFunnelPlaybook: (funnelId: string, value: string) => void;

  addProspectLead: (lead: Omit<ProspectLead, 'id' | 'createdAt' | 'notes' | 'followUps' | 'tasks' | 'logs'>) => void;
  updateProspectLead: (id: string, data: Partial<ProspectLead>) => void;
  deleteProspectLead: (id: string) => void;
  addNoteToProspectLead: (leadId: string, type: LeadNote['type'], content: string) => void;
  updateNoteInProspectLead: (leadId: string, noteId: string, data: Partial<LeadNote>) => void;
  deleteNoteFromProspectLead: (leadId: string, noteId: string) => void;
  addFollowUpToProspectLead: (leadId: string, followUp: Omit<FollowUp, 'id' | 'status'>) => void;
  updateFollowUpInProspectLead: (leadId: string, followUpId: string, data: Partial<FollowUp>) => void;
  deleteFollowUpFromProspectLead: (leadId: string, followUpId: string) => void;
  updateProspectFollowUpStatus: (leadId: string, followUpId: string, status: 'pendente' | 'concluido') => void;
  addTaskToProspectLead: (leadId: string, task: Omit<Task, 'id' | 'status' | 'leadId'>) => void;
  updateTaskInProspectLead: (leadId: string, taskId: string, data: Partial<Task>) => void;
  deleteTaskFromProspectLead: (leadId: string, taskId: string) => void;
  updateProspectTaskStatus: (leadId: string, taskId: string, status: 'pendente' | 'concluida') => void;
  addProspectKanbanStage: (name: string, color: string) => void;
  updateProspectKanbanStage: (id: string, data: Partial<KanbanStage>) => void;
  deleteProspectKanbanStage: (id: string) => void;
  reorderProspectKanbanStages: (stages: KanbanStage[]) => void;
  addProspectObjection: (value: string) => void;
  removeProspectObjection: (value: string) => void;
  setProspectPlaybook: (value: string) => void;

  dailyInsight: { date: string; content: string } | null;
  setDailyInsight: (insight: { date: string; content: string }) => void;
}

export const useStore = create<AppState>()(
  (set) => ({
      ...buildFunnelAliases(buildDefaultFunnels(), getDefaultFieldTemplates(), DEFAULT_COMMERCIAL_FUNNEL_ID, DEFAULT_PROSPECTING_FUNNEL_ID),
      leads: [],
      campaigns: [],
      campaignSpendEntries: [],
      adGroups: [],
      ads: [],
      areasOfLaw: [],
      services: [],
      leadSources: ensureLeadSources(),
      standardTasks: [],
      fieldTemplates: getDefaultFieldTemplates(),
      notifications: [],
      weeklySnapshots: [],
      prospectLeads: [],
      dailyInsight: null,

      addLead: (leadData) => set((state) => {
        const id = uuidv4();
        const timestamp = new Date().toISOString();
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const defaultFunnel = getDefaultFunnel(aliases.funnels, 'commercial', aliases.commercialDefaultFunnelId);
        const normalizedLead = normalizeLeadServices(leadData);
        return {
          leads: [...state.leads, {
            ...normalizedLead,
            id,
            createdAt: timestamp,
            lastInteractionAt: timestamp,
            funnelId: normalizedLead.funnelId || defaultFunnel.id,
            customFields: normalizedLead.customFields || {},
            notes: [],
            followUps: [],
            tasks: [],
            documents: [],
            logs: [{
              id: uuidv4(),
              type: 'lead_created',
              content: 'Lead registrado no sistema',
              timestamp: getSPTime()
            }]
          }]
        };
      }),

      updateLead: (id, data) => set((state) => ({
        leads: (state.leads || []).map(lead => {
          if (lead.id === id) {
            const normalizedData = normalizeLeadServices({ ...lead, ...data });
            const logs = [...(lead.logs || [])];
            if (normalizedData.status && normalizedData.status !== lead.status) {
              const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
              const resolvedFunnel = getDefaultFunnel(
                aliases.funnels,
                'commercial',
                normalizedData.funnelId || lead.funnelId || aliases.commercialDefaultFunnelId,
              );
              const oldStage = resolvedFunnel.stages.find(s => s.id === lead.status);
              const newStage = resolvedFunnel.stages.find(s => s.id === normalizedData.status);
              logs.push({
                id: uuidv4(),
                type: 'status_change',
                content: `Status alterado de ${oldStage?.name || lead.status} para ${newStage?.name || normalizedData.status}`,
                timestamp: getSPTime()
              });
            }
            return { ...lead, ...normalizedData, lastInteractionAt: new Date().toISOString(), logs };
          }
          return lead;
        })
      })),

      deleteLead: (id) => set((state) => ({
        leads: (state.leads || []).filter((lead) => lead.id !== id),
        notifications: (state.notifications || []).filter((item) => item.leadId !== id),
      })),

      addNoteToLead: (leadId, type, content) => set((state) => ({
        leads: (state.leads || []).map(lead => {
          if (lead.id === leadId) {
            return {
              ...lead,
              lastInteractionAt: new Date().toISOString(),
              notes: [...(lead.notes || []), { id: uuidv4(), type, content, createdAt: new Date().toISOString() }],
              logs: [...(lead.logs || []), {
                id: uuidv4(),
                type: 'note_added',
                content: `Nova observação adicionada (${type})`,
                timestamp: getSPTime()
              }]
            };
          }
          return lead;
        })
      })),

      updateNoteInLead: (leadId, noteId, data) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            notes: (lead.notes || []).map((note) => note.id === noteId ? { ...note, ...data } : note),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'note_added',
              content: 'Observação atualizada',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      deleteNoteFromLead: (leadId, noteId) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            notes: (lead.notes || []).filter((note) => note.id !== noteId),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'note_added',
              content: 'Observação removida',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      addDocumentToLead: (leadId, document) => set((state) => ({
        leads: (state.leads || []).map(lead => {
          if (lead.id === leadId) {
            return {
              ...lead,
              lastInteractionAt: new Date().toISOString(),
              documents: [...(lead.documents || []), { ...document, id: uuidv4(), createdAt: new Date().toISOString() }],
              logs: [...(lead.logs || []), {
                id: uuidv4(),
                type: 'note_added',
                content: `Documento adicionado: ${document.name}`,
                timestamp: getSPTime()
              }]
            };
          }
          return lead;
        })
      })),

      updateDocumentInLead: (leadId, documentId, data) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            documents: (lead.documents || []).map((document) => document.id === documentId ? { ...document, ...data } : document),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'note_added',
              content: 'Documento atualizado',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      deleteDocumentFromLead: (leadId, documentId) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            documents: (lead.documents || []).filter((document) => document.id !== documentId),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'note_added',
              content: 'Documento removido',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      addFollowUpToLead: (leadId, followUpData) => set((state) => ({
        leads: (state.leads || []).map(lead => {
          if (lead.id === leadId) {
            return {
              ...lead,
              lastInteractionAt: new Date().toISOString(),
              followUps: [...(lead.followUps || []), { ...followUpData, id: uuidv4(), status: 'pendente' }],
              logs: [...(lead.logs || []), {
                id: uuidv4(),
                type: 'followup_scheduled',
                content: `Follow-up agendado para ${new Date(followUpData.date).toLocaleDateString()}`,
                timestamp: getSPTime()
              }]
            };
          }
          return lead;
        })
      })),

      updateFollowUpInLead: (leadId, followUpId, data) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            followUps: (lead.followUps || []).map((followUp) => followUp.id === followUpId ? { ...followUp, ...data } : followUp),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'followup_scheduled',
              content: 'Follow-up atualizado',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      deleteFollowUpFromLead: (leadId, followUpId) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            followUps: (lead.followUps || []).filter((followUp) => followUp.id !== followUpId),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'followup_scheduled',
              content: 'Follow-up removido',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      updateFollowUpStatus: (leadId, followUpId, status) => set((state) => ({
        leads: (state.leads || []).map(lead => {
          if (lead.id === leadId) {
            const followUp = (lead.followUps || []).find(f => f.id === followUpId);
            return {
              ...lead,
              lastInteractionAt: new Date().toISOString(),
              followUps: (lead.followUps || []).map(fu => fu.id === followUpId ? { ...fu, status } : fu),
              logs: [...(lead.logs || []), {
                id: uuidv4(),
                type: 'followup_completed',
                content: `Follow-up ${followUp?.type} marcado como ${status}`,
                timestamp: getSPTime()
              }]
            };
          }
          return lead;
        })
      })),

      addTaskToLead: (leadId, taskData) => set((state) => ({
        leads: (state.leads || []).map(lead => {
          if (lead.id === leadId) {
            return {
              ...lead,
              lastInteractionAt: new Date().toISOString(),
              tasks: [...(lead.tasks || []), { ...taskData, id: uuidv4(), status: 'pendente', leadId }],
              logs: [...(lead.logs || []), {
                id: uuidv4(),
                type: 'task_added',
                content: `Tarefa adicionada: ${taskData.title}`,
                timestamp: getSPTime()
              }]
            };
          }
          return lead;
        })
      })),

      updateTaskInLead: (leadId, taskId, data) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            tasks: (lead.tasks || []).map((task) => task.id === taskId ? { ...task, ...data } : task),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'task_added',
              content: 'Tarefa atualizada',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      deleteTaskFromLead: (leadId, taskId) => set((state) => ({
        leads: (state.leads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            tasks: (lead.tasks || []).filter((task) => task.id !== taskId),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'task_added',
              content: 'Tarefa removida',
              timestamp: getSPTime()
            }]
          };
        })
      })),

      updateTaskStatus: (leadId, taskId, status) => set((state) => ({
        leads: (state.leads || []).map(lead => {
          if (lead.id === leadId) {
            const task = (lead.tasks || []).find(t => t.id === taskId);
            return {
              ...lead,
              lastInteractionAt: new Date().toISOString(),
              tasks: (lead.tasks || []).map(t => t.id === taskId ? { ...t, status } : t),
              logs: [...(lead.logs || []), {
                id: uuidv4(),
                type: 'task_completed',
                content: `Tarefa "${task?.title}" marcada como ${status}`,
                timestamp: getSPTime()
              }]
            };
          }
          return lead;
        })
      })),

      addLog: (leadId, type, content) => set((state) => ({
        leads: (state.leads || []).map(lead => lead.id === leadId ? {
          ...lead,
          lastInteractionAt: new Date().toISOString(),
          logs: [...(lead.logs || []), { id: uuidv4(), type, content, timestamp: getSPTime() }]
        } : lead)
      })),

      runInactivityAutomation: (thresholdHours = 24) => {
        let created = 0;
        set((state) => ({
          leads: (state.leads || []).map((lead) => {
            if (lead.status === 'fechado' || lead.status === 'perdido') {
              return lead;
            }

            const idleHours = getLeadIdleHours(lead);
            if (idleHours < thresholdHours) {
              return lead;
            }

            const hasOpenRecoveryTask = (lead.tasks || []).some(
              (task) => task.status === 'pendente' && task.source === 'system_inactivity'
            );
            if (hasOpenRecoveryTask) {
              return lead;
            }

            created += 1;
            return {
              ...lead,
              tasks: [
                ...(lead.tasks || []),
                {
                  id: uuidv4(),
                  title: 'Recuperação automática: lead sem ação',
                  description: `Lead sem atualização há mais de ${thresholdHours} horas. Fazer contato e registrar retorno.`,
                  date: new Date().toISOString(),
                  leadId: lead.id,
                  status: 'pendente',
                  source: 'system_inactivity',
                },
              ],
              logs: [
                ...(lead.logs || []),
                {
                  id: uuidv4(),
                  type: 'task_added',
                  content: `Tarefa automática criada por inatividade (> ${thresholdHours}h)`,
                  timestamp: getSPTime(),
                },
              ],
            };
          }),
        }));
        return created;
      },

      syncOperationalNotifications: (thresholdHours = 24) => {
        let unreadCount = 0;
        set((state) => {
          const now = Date.now();
          const candidates = new Map<
            string,
            Omit<SystemNotification, 'id' | 'createdAt' | 'read'>
          >();

          for (const lead of state.leads || []) {
            if (lead.status === 'fechado' || lead.status === 'perdido') continue;

            const idleHours = getLeadIdleHours(lead, now);
            if (idleHours >= thresholdHours) {
              const key = `idle:${lead.id}`;
              candidates.set(key, {
                key,
      title: 'Lead sem ação',
                description: `${lead.name} esta sem atualizacao ha ${Math.floor(idleHours)}h.`,
                category: 'idle',
                leadId: lead.id,
              });
            }

            const overdueFollowUps = (lead.followUps || []).filter(
              (followUp) =>
                followUp.status === 'pendente' && new Date(followUp.date).getTime() < now
            ).length;
            if (overdueFollowUps > 0) {
              const key = `followup:${lead.id}`;
              candidates.set(key, {
                key,
                title: 'Follow-up atrasado',
                description: `${lead.name} possui ${overdueFollowUps} follow-up(s) vencido(s).`,
                category: 'followup',
                leadId: lead.id,
              });
            }

            const recoveryTasks = (lead.tasks || []).filter(
              (task) => task.status === 'pendente' && task.source === 'system_inactivity'
            ).length;
            if (recoveryTasks > 0) {
              const key = `recovery:${lead.id}`;
              candidates.set(key, {
                key,
                title: 'Fila de recuperacao ativa',
                description: `${lead.name} tem ${recoveryTasks} tarefa(s) automatica(s) de recuperacao.`,
                category: 'recovery',
                leadId: lead.id,
              });
            }
          }

          const existingByKey = new Map((state.notifications || []).map((n) => [n.key, n]));
          const nextNotifications: SystemNotification[] = [];

          for (const [key, candidate] of candidates.entries()) {
            const existing = existingByKey.get(key);
            if (!existing) {
              nextNotifications.push({
                id: uuidv4(),
                createdAt: new Date().toISOString(),
                read: false,
                ...candidate,
              });
              unreadCount += 1;
              continue;
            }

            const changed = existing.description !== candidate.description || existing.title !== candidate.title;
            const read = changed ? false : existing.read;
            if (!read) unreadCount += 1;
            nextNotifications.push({
              ...existing,
              ...candidate,
              read,
            });
          }

          nextNotifications.sort((a, b) => {
            const priority = { idle: 3, followup: 2, recovery: 1 } as const;
            return priority[b.category] - priority[a.category];
          });

          return { notifications: nextNotifications };
        });

        return unreadCount;
      },

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: (state.notifications || []).map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: (state.notifications || []).map((n) => ({ ...n, read: true })),
        })),

      ensureWeeklySnapshot: () => {
        let snapshot: WeeklySnapshot | null = null;
        const weekKey = getWeekKey(new Date());

        set((state) => {
          const existing = (state.weeklySnapshots || []).find((item) => item.weekKey === weekKey);
          if (existing) {
            snapshot = existing;
            return state;
          }

          const weekLeads = (state.leads || []).filter((lead) => isDateInWeek(lead.createdAt, weekKey));

          const campaignRows = (state.campaigns || [])
            .map((campaign) => {
              const group = weekLeads.filter((lead) => lead.campaignId === campaign.id);
              const entries = group.length;
              const closed = group.filter((lead) => lead.status === 'fechado').length;
              return {
                id: campaign.id,
                name: campaign.name,
                entries,
                closed,
                conversionRate: entries > 0 ? (closed / entries) * 100 : 0,
              };
            })
            .sort((a, b) => b.entries - a.entries);

          const total = weekLeads.length;
          const won = weekLeads.filter((lead) => lead.status === 'fechado').length;
          const lost = weekLeads.filter((lead) => lead.status === 'perdido').length;

          const topCreative = (state.ads || [])
            .map((ad) => {
              const leadsCount = weekLeads.filter((lead) => lead.adId === ad.id).length;
              const adGroup = (state.adGroups || []).find((group) => group.id === ad.adGroupId);
              const campaign = (state.campaigns || []).find((item) => item.id === adGroup?.campaignId);
              return {
                adId: ad.id,
                adName: ad.name,
                campaignName: campaign?.name || 'Sem campanha',
                leads: leadsCount,
              };
            })
            .sort((a, b) => b.leads - a.leads)
            .slice(0, 5);

          snapshot = {
            id: uuidv4(),
            weekKey,
            generatedAt: new Date().toISOString(),
            commercial: {
              total,
              won,
              lost,
              conversion: total > 0 ? (won / total) * 100 : 0,
              rows: campaignRows,
            },
            traffic: {
              total,
              closed: won,
              lost,
              conversion: total > 0 ? (won / total) * 100 : 0,
              campaignRows,
              topCreative,
            },
          };

          return {
            weeklySnapshots: [...(state.weeklySnapshots || []), snapshot as WeeklySnapshot]
              .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
              .slice(0, 16),
          };
        });

        return snapshot;
      },

      addCampaign: (name, areaOfLawId, serviceId) => {
        const id = uuidv4();
        set((state) => ({
          campaigns: [...state.campaigns, { id, name, status: 'active', areaOfLawId, serviceId }]
        }));
        return id;
      },

      updateCampaign: (id, data) => set((state) => ({
        campaigns: state.campaigns.map(c => c.id === id ? { ...c, ...data } : c)
      })),

      deleteCampaign: (id) => set((state) => {
        const adGroupIds = state.adGroups.filter(ag => ag.campaignId === id).map(ag => ag.id);
        return {
          campaigns: state.campaigns.filter(c => c.id !== id),
          campaignSpendEntries: state.campaignSpendEntries.filter((entry) => entry.campaignId !== id),
          adGroups: state.adGroups.filter(ag => ag.campaignId !== id),
          ads: state.ads.filter(ad => !adGroupIds.includes(ad.adGroupId)),
          leads: state.leads.map((lead) => (
            lead.campaignId === id
              ? { ...lead, campaignId: undefined, adGroupId: undefined, adId: undefined }
              : lead
          )),
        };
      }),

      addCampaignSpendEntry: (campaignId, entry) => set((state) => ({
        campaignSpendEntries: [
          ...(state.campaignSpendEntries || []),
          {
            id: uuidv4(),
            campaignId,
            amount: Number(entry.amount) || 0,
            startDate: entry.startDate,
            endDate: entry.endDate,
            notes: entry.notes || '',
            createdAt: new Date().toISOString(),
          },
        ],
      })),

      updateCampaignSpendEntry: (id, data) => set((state) => ({
        campaignSpendEntries: (state.campaignSpendEntries || []).map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...data,
                amount: data.amount !== undefined ? Number(data.amount) || 0 : entry.amount,
              }
            : entry,
        ),
      })),

      deleteCampaignSpendEntry: (id) => set((state) => ({
        campaignSpendEntries: (state.campaignSpendEntries || []).filter((entry) => entry.id !== id),
      })),

      addAdGroup: (campaignId, name) => set((state) => ({
        adGroups: [...state.adGroups, { id: uuidv4(), campaignId, name }]
      })),

      updateAdGroup: (id, data) => set((state) => ({
        adGroups: state.adGroups.map(ag => ag.id === id ? { ...ag, ...data } : ag)
      })),

      deleteAdGroup: (id) => set((state) => ({
        adGroups: state.adGroups.filter(ag => ag.id !== id),
        ads: state.ads.filter(ad => ad.adGroupId !== id),
        leads: state.leads.map((lead) => (
          lead.adGroupId === id
            ? { ...lead, adGroupId: undefined, adId: undefined }
            : lead
        )),
      })),

      addAd: (adGroupId, name, mediaUrl, mediaType) => set((state) => ({
        ads: [...state.ads, { id: uuidv4(), adGroupId, name, mediaUrl, mediaType }]
      })),

      updateAd: (id, data) => set((state) => ({
        ads: state.ads.map(ad => ad.id === id ? { ...ad, ...data } : ad)
      })),

      deleteAd: (id) => set((state) => ({
        ads: state.ads.filter(ad => ad.id !== id),
        leads: state.leads.map((lead) => (
          lead.adId === id
            ? { ...lead, adId: undefined }
            : lead
        )),
      })),

      addAreaOfLaw: (name, description) => set((state) => ({
        areasOfLaw: [...(state.areasOfLaw || []), { id: uuidv4(), name, description }]
      })),

      updateAreaOfLaw: (id, data) => set((state) => ({
        areasOfLaw: (state.areasOfLaw || []).map(a => a.id === id ? { ...a, ...data } : a)
      })),

      deleteAreaOfLaw: (id) => set((state) => ({
        areasOfLaw: (state.areasOfLaw || []).filter(a => a.id !== id)
      })),

      addService: (areaOfLawId, name, description, price) => set((state) => ({
        services: [...(state.services || []), { id: uuidv4(), areaOfLawId, name, description, price }]
      })),

      updateService: (id, data) => set((state) => ({
        services: (state.services || []).map(s => s.id === id ? { ...s, ...data } : s)
      })),

      deleteService: (id) => set((state) => ({
        services: (state.services || []).filter(s => s.id !== id),
        leads: (state.leads || []).map((lead) => {
          const nextServiceIds = (lead.serviceIds || []).filter((serviceId) => serviceId !== id);
          if (lead.serviceId !== id && nextServiceIds.length === (lead.serviceIds || []).length) return lead;
          return {
            ...lead,
            serviceId: nextServiceIds[0],
            serviceIds: nextServiceIds,
          };
        }),
        prospectLeads: (state.prospectLeads || []).map((lead) => (
          lead.serviceId === id ? { ...lead, serviceId: undefined } : lead
        )),
      })),

      addLeadSource: (name, kind, description) => set((state) => ({
        leadSources: [...ensureLeadSources(state.leadSources), { id: uuidv4(), name, kind, description }]
      })),

      updateLeadSource: (id, data) => set((state) => ({
        leadSources: ensureLeadSources(state.leadSources).map((source) => (
          source.id === id ? { ...source, ...data, id: source.id } : source
        )),
      })),

      deleteLeadSource: (id) => set((state) => {
        const target = ensureLeadSources(state.leadSources).find((source) => source.id === id);
        if (!target || target.locked) return state;

        return {
          leadSources: ensureLeadSources(state.leadSources).filter((source) => source.id !== id),
          leads: (state.leads || []).map((lead) => (
            lead.sourceId === id
              ? { ...lead, sourceId: undefined, sourceDetails: undefined, campaignId: undefined, adGroupId: undefined, adId: undefined }
              : lead
          )),
        };
      }),

      addStandardTask: (title, description) => set((state) => ({
        standardTasks: [...(state.standardTasks || []), { id: uuidv4(), title, description }]
      })),

      deleteStandardTask: (id) => set((state) => ({
        standardTasks: (state.standardTasks || []).filter(t => t.id !== id)
      })),

      addFieldTemplate: (template) => {
        const id = uuidv4();
        set((state) => ({
          fieldTemplates: normalizeFieldTemplates([
            ...(state.fieldTemplates || getDefaultFieldTemplates()),
            {
              ...template,
              id,
              order: (state.fieldTemplates || []).length,
            },
          ]),
        }));
        return id;
      },

      updateFieldTemplate: (id, data) => set((state) => ({
        fieldTemplates: normalizeFieldTemplates(
          (state.fieldTemplates || []).map((template) =>
            template.id === id ? { ...template, ...data } : template,
          ),
        ),
      })),

      deleteFieldTemplate: (id) => set((state) => ({
        fieldTemplates: normalizeFieldTemplates(
          (state.fieldTemplates || []).filter((template) => template.id !== id || template.system),
        ),
        funnels: (state.funnels || []).map((funnel) => ({
          ...funnel,
          fieldSchema: normalizeFieldSchema((funnel.fieldSchema || []).filter((field) => field.templateId !== id)),
        })),
      })),

      addKanbanStage: (name, color) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.commercialDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: [...funnel.stages, { id: uuidv4(), name, color, order: funnel.stages.length }],
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      updateKanbanStage: (id, data) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.commercialDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: funnel.stages.map((stage) => (stage.id === id ? { ...stage, ...data } : stage)),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      deleteKanbanStage: (id) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.commercialDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: normalizeStages(funnel.stages.filter((stage) => stage.id !== id)),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      reorderKanbanStages: (stages) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.commercialDefaultFunnelId
            ? { ...funnel, updatedAt: new Date().toISOString(), stages: normalizeStages(stages) }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      addFunnel: ({ name, operation, description, areaOfLawId }) => {
        const id = uuidv4();
        set((state) => {
          const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
          const template = getDefaultFunnel(aliases.funnels, operation, operation === 'commercial' ? aliases.commercialDefaultFunnelId : aliases.prospectingDefaultFunnelId);
          const timestamp = new Date().toISOString();
          const nextFunnels = [
            ...aliases.funnels,
            {
              id,
              name,
              description,
              operation,
              areaOfLawId,
              stages: template.stages.map((stage) => ({ ...stage, id: uuidv4() })),
              fieldSchema: (template.fieldSchema || []).map((field, order) => ({ ...field, id: uuidv4(), order })),
              objections: template.objections || [],
              playbook: template.playbook || '',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ];
          return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
        });
        return id;
      },

      updateFunnel: (id, data) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === id
            ? {
                ...funnel,
                ...data,
                updatedAt: new Date().toISOString(),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      duplicateFunnel: (id) => {
        const nextId = uuidv4();
        let duplicated = false;
        set((state) => {
          const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
          const source = aliases.funnels.find((funnel) => funnel.id === id);
          if (!source) return state;
          duplicated = true;
          const timestamp = new Date().toISOString();
          const nextFunnels = [
            ...aliases.funnels,
            {
              ...source,
              id: nextId,
              name: `${source.name} (Copia)`,
              stages: source.stages.map((stage) => ({ ...stage, id: uuidv4() })),
              fieldSchema: (source.fieldSchema || []).map((field, order) => ({ ...field, id: uuidv4(), order })),
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ];
          return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
        });
        return duplicated ? nextId : null;
      },

      deleteFunnel: (id) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const target = aliases.funnels.find((funnel) => funnel.id === id);
        if (!target) return state;
        const sameOperationFunnels = aliases.funnels.filter((funnel) => funnel.operation === target.operation);
        if (sameOperationFunnels.length <= 1) return state;
        const nextFunnels = aliases.funnels.filter((funnel) => funnel.id !== id);
        const nextAliases = buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
        const replacementId = target.operation === 'commercial' ? nextAliases.commercialDefaultFunnelId : nextAliases.prospectingDefaultFunnelId;
        return {
          ...nextAliases,
          leads: (state.leads || []).map((lead) =>
            lead.funnelId === id ? { ...lead, funnelId: replacementId, status: nextAliases.kanbanStages[0]?.id || lead.status } : lead,
          ),
          prospectLeads: (state.prospectLeads || []).map((lead) =>
            lead.funnelId === id ? { ...lead, funnelId: replacementId, status: nextAliases.prospectKanbanStages[0]?.id || lead.status } : lead,
          ),
        };
      }),

      setDefaultFunnel: (operation, funnelId) => set((state) => {
        const aliases = buildFunnelAliases(
          state.funnels,
          state.fieldTemplates,
          operation === 'commercial' ? funnelId : state.commercialDefaultFunnelId,
          operation === 'prospecting' ? funnelId : state.prospectingDefaultFunnelId,
        );
        return aliases;
      }),

      addFunnelStage: (funnelId, name, color) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: [...funnel.stages, { id: uuidv4(), name, color, order: funnel.stages.length }],
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      updateFunnelStage: (funnelId, stageId, data) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: funnel.stages.map((stage) => (stage.id === stageId ? { ...stage, ...data } : stage)),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      deleteFunnelStage: (funnelId, stageId) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: normalizeStages(funnel.stages.filter((stage) => stage.id !== stageId)),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      reorderFunnelStages: (funnelId, stages) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: normalizeStages(stages),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      addFieldTemplateToFunnel: (funnelId, templateId) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const template = (state.fieldTemplates || []).find((item) => item.id === templateId);
        if (!template) return state;

        const nextFunnels = aliases.funnels.map((funnel) => {
          if (funnel.id !== funnelId) return funnel;
          const exists = (funnel.fieldSchema || []).some((field) => field.templateId === templateId || field.key === template.key);
          if (exists) return funnel;
          return {
            ...funnel,
            updatedAt: new Date().toISOString(),
            fieldSchema: normalizeFieldSchema([
              ...(funnel.fieldSchema || []),
              templateToFieldConfig(template, (funnel.fieldSchema || []).length),
            ]),
          };
        });

        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      updateFunnelField: (funnelId, fieldId, data) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                fieldSchema: normalizeFieldSchema((funnel.fieldSchema || []).map((field) => (
                  field.id === fieldId ? { ...field, ...data } : field
                ))),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      deleteFunnelField: (funnelId, fieldId) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                fieldSchema: normalizeFieldSchema((funnel.fieldSchema || []).filter((field) => field.id !== fieldId)),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      reorderFunnelFields: (funnelId, fields) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                fieldSchema: normalizeFieldSchema(fields),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      addFunnelObjection: (funnelId, value) => set((state) => {
        const trimmed = value.trim();
        if (!trimmed) return state;
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) => {
          if (funnel.id !== funnelId) return funnel;
          if ((funnel.objections || []).includes(trimmed)) return funnel;
          return {
            ...funnel,
            updatedAt: new Date().toISOString(),
            objections: [...(funnel.objections || []), trimmed],
          };
        });
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      removeFunnelObjection: (funnelId, value) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                objections: (funnel.objections || []).filter((item) => item !== value),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      setFunnelPlaybook: (funnelId, value) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                playbook: value,
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      addProspectLead: (leadData) => set((state) => {
        const id = uuidv4();
        const timestamp = new Date().toISOString();
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const defaultFunnel = getDefaultFunnel(aliases.funnels, 'prospecting', aliases.prospectingDefaultFunnelId);
        return {
          prospectLeads: [...(state.prospectLeads || []), {
            ...leadData,
            id,
            createdAt: timestamp,
            lastInteractionAt: timestamp,
            funnelId: leadData.funnelId || defaultFunnel.id,
            customFields: leadData.customFields || {},
            notes: [],
            followUps: [],
            tasks: [],
            logs: [{
              id: uuidv4(),
              type: 'lead_created',
      content: 'Clínica registrada na prospecção',
              timestamp: getSPTime(),
            }],
          }],
        };
      }),

      updateProspectLead: (id, data) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== id) return lead;
          const logs = [...(lead.logs || [])];
          if (data.status && data.status !== lead.status) {
            const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
            const resolvedFunnel = getDefaultFunnel(
              aliases.funnels,
              'prospecting',
              data.funnelId || lead.funnelId || aliases.prospectingDefaultFunnelId,
            );
            const oldStage = resolvedFunnel.stages.find((s) => s.id === lead.status);
            const newStage = resolvedFunnel.stages.find((s) => s.id === data.status);
            logs.push({
              id: uuidv4(),
              type: 'status_change',
              content: `Status alterado de ${oldStage?.name || lead.status} para ${newStage?.name || data.status}`,
              timestamp: getSPTime(),
            });
          }
          return {
            ...lead,
            ...data,
            lastInteractionAt: new Date().toISOString(),
            logs,
          };
        }),
      })),

      deleteProspectLead: (id) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).filter((lead) => lead.id !== id),
      })),

      addNoteToProspectLead: (leadId, type, content) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            notes: [...(lead.notes || []), { id: uuidv4(), type, content, createdAt: new Date().toISOString() }],
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'note_added',
              content: `Novo registro de contato (${type})`,
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      updateNoteInProspectLead: (leadId, noteId, data) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            notes: (lead.notes || []).map((note) => note.id === noteId ? { ...note, ...data } : note),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'note_added',
              content: 'Registro de contato atualizado',
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      deleteNoteFromProspectLead: (leadId, noteId) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            notes: (lead.notes || []).filter((note) => note.id !== noteId),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'note_added',
              content: 'Registro de contato removido',
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      addFollowUpToProspectLead: (leadId, followUpData) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            followUps: [...(lead.followUps || []), { ...followUpData, id: uuidv4(), status: 'pendente' }],
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'followup_scheduled',
              content: `Retorno agendado para ${new Date(followUpData.date).toLocaleDateString('pt-BR')}`,
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      updateFollowUpInProspectLead: (leadId, followUpId, data) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            followUps: (lead.followUps || []).map((item) => item.id === followUpId ? { ...item, ...data } : item),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'followup_scheduled',
              content: 'Retorno atualizado',
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      deleteFollowUpFromProspectLead: (leadId, followUpId) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            followUps: (lead.followUps || []).filter((item) => item.id !== followUpId),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'followup_scheduled',
              content: 'Retorno removido',
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      updateProspectFollowUpStatus: (leadId, followUpId, status) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            followUps: (lead.followUps || []).map((item) => item.id === followUpId ? { ...item, status } : item),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'followup_completed',
              content: `Retorno marcado como ${status}`,
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      addTaskToProspectLead: (leadId, taskData) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            tasks: [...(lead.tasks || []), { ...taskData, id: uuidv4(), status: 'pendente', leadId }],
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'task_added',
              content: `Tarefa adicionada: ${taskData.title}`,
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      updateTaskInProspectLead: (leadId, taskId, data) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            tasks: (lead.tasks || []).map((item) => item.id === taskId ? { ...item, ...data } : item),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'task_added',
              content: 'Tarefa atualizada',
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      deleteTaskFromProspectLead: (leadId, taskId) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            tasks: (lead.tasks || []).filter((item) => item.id !== taskId),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'task_added',
              content: 'Tarefa removida',
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      updateProspectTaskStatus: (leadId, taskId, status) => set((state) => ({
        prospectLeads: (state.prospectLeads || []).map((lead) => {
          if (lead.id !== leadId) return lead;
          const task = (lead.tasks || []).find((item) => item.id === taskId);
          return {
            ...lead,
            lastInteractionAt: new Date().toISOString(),
            tasks: (lead.tasks || []).map((item) => item.id === taskId ? { ...item, status } : item),
            logs: [...(lead.logs || []), {
              id: uuidv4(),
              type: 'task_completed',
              content: `Tarefa "${task?.title || 'Sem titulo'}" marcada como ${status}`,
              timestamp: getSPTime(),
            }],
          };
        }),
      })),

      addProspectKanbanStage: (name, color) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.prospectingDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: [...funnel.stages, { id: uuidv4(), name, color, order: funnel.stages.length }],
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      updateProspectKanbanStage: (id, data) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.prospectingDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: funnel.stages.map((stage) => (stage.id === id ? { ...stage, ...data } : stage)),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      deleteProspectKanbanStage: (id) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.prospectingDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                stages: normalizeStages(funnel.stages.filter((stage) => stage.id !== id)),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      reorderProspectKanbanStages: (stages) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.prospectingDefaultFunnelId
            ? { ...funnel, updatedAt: new Date().toISOString(), stages: normalizeStages(stages) }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      addProspectObjection: (value) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.prospectingDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                objections: (funnel.objections || []).includes(value.trim()) || !value.trim()
                  ? funnel.objections || []
                  : [...(funnel.objections || []), value.trim()],
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      removeProspectObjection: (value) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.prospectingDefaultFunnelId
            ? {
                ...funnel,
                updatedAt: new Date().toISOString(),
                objections: (funnel.objections || []).filter((item) => item !== value),
              }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      setProspectPlaybook: (value) => set((state) => {
        const aliases = buildFunnelAliases(state.funnels, state.fieldTemplates, state.commercialDefaultFunnelId, state.prospectingDefaultFunnelId);
        const nextFunnels = aliases.funnels.map((funnel) =>
          funnel.id === aliases.prospectingDefaultFunnelId
            ? { ...funnel, updatedAt: new Date().toISOString(), playbook: value }
            : funnel,
        );
        return buildFunnelAliases(nextFunnels, state.fieldTemplates, aliases.commercialDefaultFunnelId, aliases.prospectingDefaultFunnelId);
      }),

      setDailyInsight: (insight) => set({ dailyInsight: insight })
    })
);







