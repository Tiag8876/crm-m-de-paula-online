import type { FollowUp, FunnelConfig } from '@/types/crm';

export interface DashboardMetrics {
  total: number;
  won: number;
  stalled: number;
  dueToday: number;
  conversion: number;
}

export interface DashboardPriorityItem {
  id: string;
  name: string;
  subtitle: string;
  status: string;
  createdAt: string;
  detailPath: string;
  funnelId?: string;
  ownerUserId?: string;
  idleHours: number;
  nextFollowUp: FollowUp | null;
  overdue: boolean;
}

export interface DashboardAgendaItem {
  id: string;
  label: string;
  kind: 'followup' | 'task';
  title: string;
  scheduledAt: string;
  path: string;
}

export interface DashboardFunnelHighlight {
  id: string;
  name: string;
  operation: FunnelConfig['operation'];
  total: number;
  stalled: number;
  won: number;
}

export interface DashboardSummaryResponse {
  metrics: DashboardMetrics;
  priorityQueue: DashboardPriorityItem[];
  agenda: DashboardAgendaItem[];
  funnelHighlights: DashboardFunnelHighlight[];
}
