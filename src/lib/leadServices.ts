import type { Lead } from '@/types/crm';

export const getLeadServiceIds = (lead: Pick<Lead, 'serviceId' | 'serviceIds'>): string[] => {
  const ids = [...(lead.serviceIds || [])];
  if (lead.serviceId) {
    ids.unshift(lead.serviceId);
  }
  return Array.from(new Set(ids.filter(Boolean)));
};

export const leadMatchesService = (
  lead: Pick<Lead, 'serviceId' | 'serviceIds'>,
  serviceId: string,
): boolean => {
  if (!serviceId) return true;
  return getLeadServiceIds(lead).includes(serviceId);
};
