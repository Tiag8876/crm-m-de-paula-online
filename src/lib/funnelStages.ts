import type { FunnelConfig, KanbanStage, StageSemantic } from '@/types/crm';

export const STAGE_SEMANTIC_OPTIONS: Array<{ value: StageSemantic; label: string; description: string }> = [
  { value: 'new', label: 'Novo lead', description: 'Entrada inicial do registro' },
  { value: 'contact', label: 'Em contato', description: 'Contato iniciado ou em andamento' },
  { value: 'waiting', label: 'Aguardando resposta', description: 'Lead aguardando retorno' },
  { value: 'meeting', label: 'Reuniao ou retorno', description: 'Compromisso ou retorno agendado' },
  { value: 'qualified', label: 'Qualificado', description: 'Lead ja qualificado' },
  { value: 'proposal', label: 'Proposta', description: 'Proposta enviada ou apresentada' },
  { value: 'negotiation', label: 'Negociacao', description: 'Negociacao aberta' },
  { value: 'inspection', label: 'Inspecao ou visita', description: 'Etapa presencial ou tecnica' },
  { value: 'won', label: 'Fechado', description: 'Etapa de ganho ou contrato fechado' },
  { value: 'lost', label: 'Perdido', description: 'Etapa de perda' },
  { value: 'other', label: 'Personalizada', description: 'Etapa livre sem semantica padrao' },
];

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const inferStageSemantic = (
  operation: FunnelConfig['operation'],
  stage: Pick<KanbanStage, 'id' | 'name' | 'semanticKey'>,
): StageSemantic => {
  if (stage.semanticKey) return stage.semanticKey;

  const haystack = `${normalizeText(stage.id)} ${normalizeText(stage.name)}`;
  if (/(fechado|fechada|ganho|ganha|contrato fechado|closed|won)\b/.test(haystack)) return 'won';
  if (/(perdido|perdida|lost)\b/.test(haystack)) return 'lost';
  if (/(reuniao|retorno agendado|agenda|agendada)\b/.test(haystack)) return 'meeting';
  if (/(negociacao|negotiation)\b/.test(haystack)) return 'negotiation';
  if (/(proposta|proposal)\b/.test(haystack)) return 'proposal';
  if (/(qualificada|qualificado|qualificacao)\b/.test(haystack)) return 'qualified';
  if (/(inspecao|inspeca|vistoria|visita)\b/.test(haystack)) return 'inspection';
  if (/(aguardando|espera|waiting|sem contato)\b/.test(haystack)) return 'waiting';
  if (/(contato|ligacao|primeira ligacao|primeiro contato)\b/.test(haystack)) return 'contact';
  if (/(novo|nova|cadastro)\b/.test(haystack)) return 'new';

  return operation === 'prospecting' ? 'contact' : 'other';
};

export const normalizeStage = (
  stage: KanbanStage,
  operation: FunnelConfig['operation'],
  order: number,
): KanbanStage => ({
  ...stage,
  order,
  semanticKey: inferStageSemantic(operation, stage),
});

export const normalizeKanbanStages = (
  stages: KanbanStage[] = [],
  operation: FunnelConfig['operation'],
): KanbanStage[] =>
  [...stages]
    .sort((a, b) => a.order - b.order)
    .map((stage, index) => normalizeStage(stage, operation, index));

export const findStageById = (funnel: FunnelConfig | undefined, stageId: string) =>
  (funnel?.stages || []).find((stage) => stage.id === stageId);

export const findStageBySemantic = (funnel: FunnelConfig | undefined, semantic: StageSemantic) =>
  (funnel?.stages || []).find((stage) => inferStageSemantic(funnel?.operation || 'commercial', stage) === semantic);

export const getStageSemantic = (
  funnel: FunnelConfig | undefined,
  stageId: string | undefined,
  fallbackOperation: FunnelConfig['operation'] = 'commercial',
): StageSemantic => {
  if (!stageId) return 'other';
  const stage = findStageById(funnel, stageId);
  if (stage) return inferStageSemantic(funnel?.operation || fallbackOperation, stage);
  return inferStageSemantic(funnel?.operation || fallbackOperation, { id: stageId, name: stageId });
};

export const isClosedSemantic = (semantic: StageSemantic) => semantic === 'won';
export const isLostSemantic = (semantic: StageSemantic) => semantic === 'lost';
export const isTerminalSemantic = (semantic: StageSemantic) => semantic === 'won' || semantic === 'lost';
