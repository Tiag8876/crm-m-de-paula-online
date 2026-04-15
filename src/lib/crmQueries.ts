import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lead } from '@/types/crm';
import type { LeadDetailsResponse } from '@/types/lead';
import type { FunnelListResponse } from '@/types/funnel';
import type { Receivable, ReceivablesResponse, ReceivablesSummary } from '@/types/receivable';

const crmKeys = {
  funnels: ['crm', 'funnels'] as const,
  lead: (leadId: string) => ['crm', 'lead', leadId] as const,
  receivables: (leadId: string) => ['crm', 'lead', leadId, 'receivables'] as const,
  receivablesSummary: ['crm', 'receivables-summary'] as const,
};

export const useFunnelsQuery = () =>
  useQuery({
    queryKey: crmKeys.funnels,
    queryFn: async () => {
      const response = await api.get<FunnelListResponse>('/api/funnels');
      return response.funnels;
    },
  });

export const useLeadDetailsQuery = (leadId?: string) =>
  useQuery({
    queryKey: leadId ? crmKeys.lead(leadId) : ['crm', 'lead', 'empty'],
    enabled: Boolean(leadId),
    queryFn: async () => {
      const response = await api.get<LeadDetailsResponse>(`/api/leads/${leadId}`);
      return response;
    },
  });

export const useLeadReceivablesQuery = (leadId?: string) =>
  useQuery({
    queryKey: leadId ? crmKeys.receivables(leadId) : ['crm', 'lead', 'empty', 'receivables'],
    enabled: Boolean(leadId),
    queryFn: async () => {
      const response = await api.get<ReceivablesResponse>(`/api/leads/${leadId}/receivables`);
      return response.receivables;
    },
  });

export const useReceivablesSummaryQuery = () =>
  useQuery({
    queryKey: crmKeys.receivablesSummary,
    queryFn: () => api.get<ReceivablesSummary>('/api/receivables/summary'),
  });

export const useUpdateLeadMutation = (leadId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!leadId) {
        throw new Error('Lead inválido.');
      }
      return api.put<LeadDetailsResponse>(`/api/leads/${leadId}`, payload);
    },
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: crmKeys.lead(leadId) });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
  });
};

export const useMoveLeadMutation = (leadId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { funnel_id: string; stage_id: string }) => {
      if (!leadId) {
        throw new Error('Lead inválido.');
      }
      return api.patch<Lead>(`/api/leads/${leadId}`, payload);
    },
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: crmKeys.lead(leadId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.funnels });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
  });
};

export const useCreateReceivableMutation = (leadId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Receivable, 'id' | 'leadId' | 'status' | 'paidDate' | 'createdAt' | 'updatedAt'>) => {
      if (!leadId) {
        throw new Error('Lead inválido.');
      }
      return api.post<Receivable>(`/api/leads/${leadId}/receivables`, payload);
    },
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: crmKeys.lead(leadId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.receivables(leadId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.receivablesSummary });
    },
  });
};

export const useUpdateReceivableMutation = (leadId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ receivableId, payload }: { receivableId: string; payload: Partial<Receivable> }) =>
      api.put<Receivable>(`/api/receivables/${receivableId}`, payload),
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: crmKeys.lead(leadId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.receivables(leadId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.receivablesSummary });
    },
  });
};

export const useDeleteReceivableMutation = (leadId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (receivableId: string) => api.delete<{ ok: true }>(`/api/receivables/${receivableId}`),
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: crmKeys.lead(leadId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.receivables(leadId) });
      void queryClient.invalidateQueries({ queryKey: crmKeys.receivablesSummary });
    },
  });
};
