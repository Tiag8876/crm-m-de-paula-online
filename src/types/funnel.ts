import type { FunnelConfig } from '@/types/crm';

export interface FunnelListResponse {
  funnels: FunnelConfig[];
}

export interface FunnelResponse {
  funnel: FunnelConfig;
}
