import type { Lead } from '@/types/crm';
import type { Receivable } from '@/types/receivable';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}

export interface LeadDetailsPayload {
  lead: Lead;
  activities: LeadActivity[];
  receivables: Receivable[];
}

export interface LeadDetailsResponse {
  lead: Lead;
  activities: LeadActivity[];
  receivables: Receivable[];
}

export interface LeadsResponse {
  leads: Lead[];
}
