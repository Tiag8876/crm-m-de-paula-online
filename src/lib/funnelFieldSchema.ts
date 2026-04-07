import type { FunnelConfig, FunnelFieldConfig } from '@/types/crm';

const commercialBaseFields: FunnelFieldConfig[] = [
  { id: 'base-name', key: 'name', label: 'Nome completo', type: 'text', required: true, placeholder: 'Nome do cliente', helpText: '', order: 0 },
  { id: 'base-phone', key: 'phone', label: 'Telefone', type: 'phone', required: true, placeholder: 'Telefone ou WhatsApp', helpText: '', order: 1 },
  { id: 'base-email', key: 'email', label: 'E-mail', type: 'email', required: false, placeholder: 'E-mail', helpText: '', order: 2 },
  { id: 'base-areaOfLawId', key: 'areaOfLawId', label: 'Área de atuação', type: 'select', required: false, placeholder: 'Selecione a área', helpText: '', order: 3 },
  { id: 'base-serviceIds', key: 'serviceIds', label: 'Serviços', type: 'multiselect', required: false, placeholder: 'Selecione um ou mais serviços', helpText: '', order: 4 },
  { id: 'base-sourceId', key: 'sourceId', label: 'Origem do lead', type: 'select', required: false, placeholder: 'Selecione a origem', helpText: '', order: 5 },
  { id: 'base-campaignId', key: 'campaignId', label: 'Campanha', type: 'select', required: false, placeholder: 'Selecione a campanha', helpText: '', order: 6 },
  { id: 'base-sourceDetails', key: 'sourceDetails', label: 'Detalhe da origem', type: 'textarea', required: false, placeholder: 'Descreva a origem', helpText: '', order: 7 },
  { id: 'base-estimatedValue', key: 'estimatedValue', label: 'Valor estimado', type: 'currency', required: false, placeholder: 'Valor estimado', helpText: '', order: 8 },
  { id: 'base-cpf', key: 'cpf', label: 'CPF', type: 'cpf', required: false, placeholder: 'CPF', helpText: '', order: 9 },
  { id: 'base-ownerUserId', key: 'ownerUserId', label: 'Responsável', type: 'user', required: false, placeholder: 'Selecione um vendedor', helpText: '', order: 10 },
];

const prospectingBaseFields: FunnelFieldConfig[] = [
  { id: 'base-clinicName', key: 'clinicName', label: 'Conta ou clínica', type: 'text', required: true, placeholder: 'Nome da conta ou clínica', helpText: '', order: 0 },
  { id: 'base-contactName', key: 'contactName', label: 'Responsável principal', type: 'text', required: true, placeholder: 'Responsável principal', helpText: '', order: 1 },
  { id: 'base-phone', key: 'phone', label: 'Telefone ou WhatsApp', type: 'phone', required: true, placeholder: 'Telefone ou WhatsApp', helpText: '', order: 2 },
  { id: 'base-email', key: 'email', label: 'E-mail', type: 'email', required: false, placeholder: 'E-mail', helpText: '', order: 3 },
  { id: 'base-cnpj', key: 'cnpj', label: 'CNPJ', type: 'cnpj', required: false, placeholder: 'CNPJ', helpText: '', order: 4 },
  { id: 'base-city', key: 'city', label: 'Cidade', type: 'text', required: false, placeholder: 'Cidade', helpText: '', order: 5 },
  { id: 'base-neighborhood', key: 'neighborhood', label: 'Bairro', type: 'text', required: false, placeholder: 'Bairro', helpText: '', order: 6 },
  { id: 'base-receptionistName', key: 'receptionistName', label: 'Recepção ou contato secundário', type: 'text', required: false, placeholder: 'Recepção ou contato secundário', helpText: '', order: 7 },
  { id: 'base-serviceId', key: 'serviceId', label: 'Serviço ofertado', type: 'select', required: false, placeholder: 'Selecione o serviço', helpText: '', order: 8 },
  { id: 'base-ownerUserId', key: 'ownerUserId', label: 'Responsável', type: 'user', required: false, placeholder: 'Selecione um vendedor', helpText: '', order: 9 },
];

export const getBaseFieldSchema = (operation?: FunnelConfig['operation']): FunnelFieldConfig[] => {
  if (operation === 'prospecting') return prospectingBaseFields;
  return commercialBaseFields;
};

export const buildEffectiveFieldSchema = (funnel?: FunnelConfig): FunnelFieldConfig[] => {
  const baseFields = getBaseFieldSchema(funnel?.operation);
  const existing = [...(funnel?.fieldSchema || [])].sort((a, b) => a.order - b.order);
  const baseKeys = new Set(baseFields.map((field) => field.key));
  const overridesByKey = new Map(existing.filter((field) => baseKeys.has(field.key)).map((field) => [field.key, field]));

  const mergedBase = baseFields.map((field, index) => {
    const override = overridesByKey.get(field.key);
    return {
      ...field,
      ...override,
      key: field.key,
      id: override?.id || field.id,
      order: index,
    };
  });

  const customFields = existing
    .filter((field) => !baseKeys.has(field.key))
    .map((field, index) => ({ ...field, order: mergedBase.length + index }));

  return [...mergedBase, ...customFields];
};

export const getBaseFieldKeys = (operation?: FunnelConfig['operation']) =>
  new Set(getBaseFieldSchema(operation).map((field) => field.key));
