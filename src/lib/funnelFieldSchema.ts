import type { FunnelConfig, FunnelFieldConfig } from '@/types/crm';

const commercialBaseFields: FunnelFieldConfig[] = [
  { id: 'base-name', key: 'name', label: 'Nome completo', type: 'text', required: true, placeholder: 'Nome do cliente', helpText: '', order: 0 },
  { id: 'base-phone', key: 'phone', label: 'Telefone', type: 'phone', required: true, placeholder: 'Telefone ou WhatsApp', helpText: '', order: 1 },
  { id: 'base-email', key: 'email', label: 'E-mail', type: 'email', required: false, placeholder: 'E-mail', helpText: '', order: 2 },
  { id: 'base-cpf', key: 'cpf', label: 'CPF', type: 'cpf', required: false, placeholder: 'CPF', helpText: '', order: 3 },
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
