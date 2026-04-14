export type StageSemantic =
  | 'new'
  | 'contact'
  | 'waiting'
  | 'meeting'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'inspection'
  | 'won'
  | 'lost'
  | 'other';

export interface KanbanStage {
  id: string;
  name: string;
  color: string;
  order: number;
  semanticKey?: StageSemantic;
}

export type FunnelFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'currency'
  | 'select'
  | 'multiselect'
  | 'user'
  | 'cpf'
  | 'cnpj'
  | 'date';

export interface FunnelFieldOption {
  id: string;
  value: string;
  label: string;
}

export type FieldTemplateSource =
  | 'static-options'
  | 'areas-of-law'
  | 'services-by-area'
  | 'lead-sources'
  | 'campaigns'
  | 'users'
  | 'none';

export interface FieldTemplate {
  id: string;
  key: string;
  label: string;
  type: FunnelFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FunnelFieldOption[];
  order: number;
  operation: 'commercial' | 'prospecting' | 'shared';
  system?: boolean;
  source?: FieldTemplateSource;
}

export interface FunnelFieldConfig {
  id: string;
  templateId?: string;
  key: string;
  label: string;
  type: FunnelFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FunnelFieldOption[];
  order: number;
}

export interface FunnelConfig {
  id: string;
  name: string;
  description?: string;
  operation: 'commercial' | 'prospecting';
  areaOfLawId?: string;
  linkedCampaignId?: string;
  stages: KanbanStage[];
  fieldSchema?: FunnelFieldConfig[];
  objections?: string[];
  playbook?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus = string;

export interface AreaOfLaw {
  id: string;
  name: string;
  description?: string;
}

export interface Service {
  id: string;
  areaOfLawId: string;
  name: string;
  description?: string;
  price?: number;
}

export type LeadSourceKind = 'campaign' | 'referral' | 'partner' | 'organic' | 'other';

export interface LeadSource {
  id: string;
  name: string;
  kind: LeadSourceKind;
  description?: string;
  locked?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused';
  areaOfLawId?: string;
  serviceId?: string;
}

export interface CampaignSpendEntry {
  id: string;
  campaignId: string;
  amount: number;
  startDate: string;
  endDate: string;
  notes?: string;
  createdAt: string;
}

export interface AdGroup {
  id: string;
  campaignId: string;
  name: string;
}

export interface Ad {
  id: string;
  adGroupId: string;
  name: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

export interface LeadNote {
  id: string;
  type: 'message' | 'call' | 'meeting' | 'other';
  content: string;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  date: string;
  type: 'whatsapp' | 'ligacao' | 'email';
  status: 'pendente' | 'concluido';
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string;
  leadId?: string;
  status: 'pendente' | 'concluida';
  isStandard?: boolean;
  source?: 'manual' | 'system_inactivity';
}

export interface LeadLog {
  id: string;
  type: 'status_change' | 'note_added' | 'followup_scheduled' | 'followup_completed' | 'lead_created' | 'task_added' | 'task_completed';
  content: string;
  timestamp: string;
}

export interface LeadDocument {
  id: string;
  name: string;
  url?: string;
  fileData?: string;
  type: 'pdf' | 'image' | 'doc' | 'other';
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  status: LeadStatus;
  ownerUserId?: string;
  lossReasonCode?: string;
  lossReasonDetail?: string;
  campaignId?: string;
  adGroupId?: string;
  adId?: string;
  areaOfLawId?: string;
  serviceId?: string;
  serviceIds?: string[];
  sourceId?: string;
  sourceDetails?: string;
  funnelId?: string;
  notes: LeadNote[];
  followUps: FollowUp[];
  tasks: Task[];
  logs: LeadLog[];
  documents: LeadDocument[];
  createdAt: string;
  lastInteractionAt?: string;
  estimatedValue?: number;
  legalArea?: string;
  aiInsight?: string;
  customFields?: Record<string, string | string[]>;
}

export interface ProspectLead {
  id: string;
  clinicName: string;
  contactName: string;
  receptionistName?: string;
  phone: string;
  email?: string;
  cnpj?: string;
  city?: string;
  neighborhood?: string;
  status: LeadStatus;
  ownerUserId?: string;
  serviceId?: string;
  funnelId?: string;
  objectionReason?: string;
  notes: LeadNote[];
  followUps: FollowUp[];
  tasks: Task[];
  logs: LeadLog[];
  createdAt: string;
  lastInteractionAt?: string;
  customFields?: Record<string, string | string[]>;
}

export interface SystemNotification {
  id: string;
  key: string;
  title: string;
  description: string;
  category: 'idle' | 'followup' | 'recovery';
  leadId?: string;
  createdAt: string;
  read: boolean;
}

export interface WeeklyCampaignRow {
  id: string;
  name: string;
  entries: number;
  closed: number;
  conversionRate: number;
}

export interface WeeklyCreativeRow {
  adId: string;
  adName: string;
  campaignName: string;
  leads: number;
}

export interface WeeklySnapshot {
  id: string;
  weekKey: string;
  generatedAt: string;
  commercial: {
    total: number;
    won: number;
    lost: number;
    conversion: number;
    rows: WeeklyCampaignRow[];
  };
  traffic: {
    total: number;
    closed: number;
    lost: number;
    conversion: number;
    campaignRows: WeeklyCampaignRow[];
    topCreative: WeeklyCreativeRow[];
  };
}
