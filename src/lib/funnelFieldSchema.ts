import { v4 as uuidv4 } from 'uuid';
import type { FieldTemplate, FunnelConfig, FunnelFieldConfig, FunnelFieldOption } from '@/types/crm';

const createOptions = (items: string[]): FunnelFieldOption[] =>
  items.map((item) => ({
    id: uuidv4(),
    value: item,
    label: item,
  }));

const commercialTemplates: FieldTemplate[] = [
  { id: 'template-name', key: 'name', label: 'Nome completo', type: 'text', required: true, placeholder: 'Nome do cliente', order: 0, operation: 'commercial', system: true, source: 'none' },
  { id: 'template-phone', key: 'phone', label: 'Telefone', type: 'phone', required: true, placeholder: 'Telefone ou WhatsApp', order: 1, operation: 'commercial', system: true, source: 'none' },
  { id: 'template-email', key: 'email', label: 'E-mail', type: 'email', placeholder: 'E-mail', order: 2, operation: 'commercial', system: true, source: 'none' },
  { id: 'template-area-of-law', key: 'areaOfLawId', label: 'Área de atuação', type: 'select', placeholder: 'Selecione a área', order: 3, operation: 'commercial', system: true, source: 'areas-of-law' },
  { id: 'template-service-ids', key: 'serviceIds', label: 'Serviços', type: 'multiselect', placeholder: 'Selecione um ou mais serviços', order: 4, operation: 'commercial', system: true, source: 'services-by-area' },
  { id: 'template-source-id', key: 'sourceId', label: 'Origem do lead', type: 'select', placeholder: 'Selecione a origem', order: 5, operation: 'commercial', system: true, source: 'lead-sources' },
  { id: 'template-campaign-id', key: 'campaignId', label: 'Campanha', type: 'select', placeholder: 'Selecione a campanha', order: 6, operation: 'commercial', system: true, source: 'campaigns' },
  { id: 'template-source-details', key: 'sourceDetails', label: 'Detalhe da origem', type: 'textarea', placeholder: 'Descreva a origem', order: 7, operation: 'commercial', system: true, source: 'none' },
  { id: 'template-estimated-value', key: 'estimatedValue', label: 'Valor estimado', type: 'currency', placeholder: 'Valor estimado', order: 8, operation: 'commercial', system: true, source: 'none' },
  { id: 'template-cpf', key: 'cpf', label: 'CPF', type: 'cpf', placeholder: 'CPF', order: 9, operation: 'commercial', system: true, source: 'none' },
  { id: 'template-owner-user-id', key: 'ownerUserId', label: 'Responsável', type: 'user', placeholder: 'Selecione um vendedor', order: 10, operation: 'commercial', system: true, source: 'users' },
];

const prospectingTemplates: FieldTemplate[] = [
  { id: 'template-clinic-name', key: 'clinicName', label: 'Conta ou clínica', type: 'text', required: true, placeholder: 'Nome da conta ou clínica', order: 0, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-contact-name', key: 'contactName', label: 'Responsável principal', type: 'text', required: true, placeholder: 'Responsável principal', order: 1, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-prospect-phone', key: 'phone', label: 'Telefone ou WhatsApp', type: 'phone', required: true, placeholder: 'Telefone ou WhatsApp', order: 2, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-prospect-email', key: 'email', label: 'E-mail', type: 'email', placeholder: 'E-mail', order: 3, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-cnpj', key: 'cnpj', label: 'CNPJ', type: 'cnpj', placeholder: 'CNPJ', order: 4, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-city', key: 'city', label: 'Cidade', type: 'text', placeholder: 'Cidade', order: 5, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-neighborhood', key: 'neighborhood', label: 'Bairro', type: 'text', placeholder: 'Bairro', order: 6, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-receptionist-name', key: 'receptionistName', label: 'Recepção ou contato secundário', type: 'text', placeholder: 'Recepção ou contato secundário', order: 7, operation: 'prospecting', system: true, source: 'none' },
  { id: 'template-service-id', key: 'serviceId', label: 'Serviço ofertado', type: 'select', placeholder: 'Selecione o serviço', order: 8, operation: 'prospecting', system: true, source: 'services-by-area' },
  { id: 'template-prospect-owner-user-id', key: 'ownerUserId', label: 'Responsável', type: 'user', placeholder: 'Selecione um vendedor', order: 9, operation: 'prospecting', system: true, source: 'users' },
];

export const DEFAULT_FIELD_TEMPLATES: FieldTemplate[] = [...commercialTemplates, ...prospectingTemplates];

export const getDefaultFieldTemplates = (): FieldTemplate[] =>
  DEFAULT_FIELD_TEMPLATES.map((template) => ({
    ...template,
    options: template.options ? template.options.map((option) => ({ ...option })) : undefined,
  }));

export const normalizeFieldTemplates = (templates: FieldTemplate[] = []): FieldTemplate[] =>
  [...templates]
    .sort((a, b) => a.order - b.order)
    .map((template, index) => ({
      ...template,
      order: index,
      required: Boolean(template.required),
      placeholder: template.placeholder || '',
      helpText: template.helpText || '',
      source: template.source || (template.options?.length ? 'static-options' : 'none'),
      options: (template.options || []).map((option, optionIndex) => ({
        id: option.id || `${template.id}-option-${optionIndex}`,
        value: option.value || option.label,
        label: option.label || option.value,
      })),
    }));

export const getTemplatesForOperation = (
  templates: FieldTemplate[],
  operation?: FunnelConfig['operation'],
): FieldTemplate[] =>
  normalizeFieldTemplates(templates).filter((template) => template.operation === 'shared' || template.operation === operation);

export const templateToFieldConfig = (template: FieldTemplate, order: number): FunnelFieldConfig => ({
  id: uuidv4(),
  templateId: template.id,
  key: template.key,
  label: template.label,
  type: template.type,
  required: template.required,
  placeholder: template.placeholder,
  helpText: template.helpText,
  options: template.options ? template.options.map((option) => ({ ...option })) : undefined,
  order,
});

export const getDefaultFieldSchema = (
  operation: FunnelConfig['operation'],
  templates: FieldTemplate[],
): FunnelFieldConfig[] =>
  getTemplatesForOperation(templates, operation)
    .filter((template) => template.system)
    .map((template, index) => templateToFieldConfig(template, index));

export const normalizeFieldSchema = (fields: FunnelFieldConfig[] = []): FunnelFieldConfig[] =>
  [...fields]
    .sort((a, b) => a.order - b.order)
    .map((field, index) => ({
      ...field,
      order: index,
      required: Boolean(field.required),
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      options: (field.options || []).map((option, optionIndex) => ({
        id: option.id || `${field.id}-option-${optionIndex}`,
        value: option.value || option.label,
        label: option.label || option.value,
      })),
    }));

export const buildEffectiveFieldSchema = (funnel?: FunnelConfig): FunnelFieldConfig[] =>
  normalizeFieldSchema(funnel?.fieldSchema || []);

export const getBaseFieldKeys = (operation?: FunnelConfig['operation'], templates: FieldTemplate[] = getDefaultFieldTemplates()) =>
  new Set(getTemplatesForOperation(templates, operation).filter((template) => template.system).map((template) => template.key));

export const findTemplateByKey = (templates: FieldTemplate[], key: string, operation?: FunnelConfig['operation']) =>
  getTemplatesForOperation(templates, operation).find((template) => template.key === key);

export const ensureFunnelFieldSchema = (
  funnel: FunnelConfig,
  templates: FieldTemplate[],
  legacyFields: FunnelFieldConfig[] = [],
): FunnelFieldConfig[] => {
  if (funnel.fieldSchema && funnel.fieldSchema.length > 0) {
    return normalizeFieldSchema(funnel.fieldSchema);
  }

  const defaultFields = getDefaultFieldSchema(funnel.operation, templates);
  const legacyByKey = new Map(legacyFields.map((field) => [field.key, field]));

  return defaultFields.map((field, index) => {
    const legacyField = legacyByKey.get(field.key);
    if (!legacyField) return { ...field, order: index };
    return {
      ...field,
      id: legacyField.id || field.id,
      label: legacyField.label || field.label,
      required: legacyField.required ?? field.required,
      placeholder: legacyField.placeholder || field.placeholder,
      helpText: legacyField.helpText || field.helpText,
      options: legacyField.options?.length ? legacyField.options.map((option) => ({ ...option })) : field.options,
      order: index,
    };
  }).concat(
    normalizeFieldSchema(legacyFields.filter((field) => !defaultFields.some((baseField) => baseField.key === field.key))).map((field, index) => ({
      ...field,
      order: defaultFields.length + index,
    })),
  );
};

export const createFieldOptions = (labels: string[]): FunnelFieldOption[] =>
  createOptions(labels.filter(Boolean).map((label) => label.trim()).filter(Boolean));
