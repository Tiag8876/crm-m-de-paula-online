import type { Lead } from '@/types/crm';

export const LOSS_REASON_OPTIONS = [
  { value: 'sem_orcamento', label: 'Sem orcamento' },
  { value: 'fora_do_perfil', label: 'Fora do perfil do escritorio' },
  { value: 'sem_documentacao', label: 'Sem documentacao minima' },
  { value: 'concorrente', label: 'Fechou com concorrente' },
  { value: 'sem_interesse_real', label: 'Sem interesse real na demanda' },
  { value: 'contato_invalido', label: 'Contato invalido' },
] as const;

const WEAK_LOSS_REASON_PATTERNS = [
  /nao respondeu/i,
  /sem resposta/i,
  /sumiu/i,
];

export function isValidLossReasonDetail(detail: string): boolean {
  const trimmed = detail.trim();
  if (trimmed.length < 12) return false;
  return !WEAK_LOSS_REASON_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function hasLeadInteraction(lead: Lead): boolean {
  if ((lead.notes || []).length > 0) return true;
  if ((lead.followUps || []).length > 0) return true;
  if ((lead.tasks || []).length > 0) return true;
  return (lead.logs || []).some((log) =>
    ['note_added', 'followup_scheduled', 'task_added'].includes(log.type)
  );
}

export function validateLeadStatusChange(lead: Lead, nextStatus: string): string | null {
  if (nextStatus === lead.status) return null;

  if (nextStatus !== 'novo' && !lead.ownerUserId) {
    return 'Defina o vendedor responsavel antes de avancar o lead.';
  }

  if (nextStatus === 'em_contato' && !hasLeadInteraction(lead)) {
    return 'Registre a primeira interacao (observacao, tarefa ou follow-up) antes de avancar para Em Contato.';
  }

  if (nextStatus === 'reuniao_agendada' && (lead.followUps || []).length === 0) {
    return 'Agende ao menos um follow-up antes de mover para Reuniao Agendada.';
  }

  if (nextStatus === 'fechado' && !hasLeadInteraction(lead)) {
    return 'Para fechar, o lead precisa ter historico minimo de interacao registrado.';
  }

  if (nextStatus === 'perdido') {
    if (!lead.lossReasonCode) {
      return 'Motivo de perda obrigatorio para mover o lead para Perdido.';
    }
    if (!lead.lossReasonDetail || !isValidLossReasonDetail(lead.lossReasonDetail)) {
      return 'Descreva um motivo de perda claro (minimo de 12 caracteres e sem justificativas genericas).';
    }
  }

  return null;
}
