import type { Lead } from '@/types/crm';

const toMs = (value?: string): number | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export function getLeadLastInteractionMs(lead: Lead): number {
  const candidates: number[] = [];
  const lastInteraction = toMs(lead.lastInteractionAt);
  const createdAt = toMs(lead.createdAt);
  if (lastInteraction !== null) candidates.push(lastInteraction);
  if (createdAt !== null) candidates.push(createdAt);

  for (const note of lead.notes || []) {
    const noteTime = toMs(note.createdAt);
    if (noteTime !== null) candidates.push(noteTime);
  }

  for (const doc of lead.documents || []) {
    const docTime = toMs(doc.createdAt);
    if (docTime !== null) candidates.push(docTime);
  }

  for (const task of lead.tasks || []) {
    const taskTime = toMs(task.date);
    if (taskTime !== null) candidates.push(taskTime);
  }

  for (const followUp of lead.followUps || []) {
    const followTime = toMs(followUp.date);
    if (followTime !== null) candidates.push(followTime);
  }

  return candidates.length > 0 ? Math.max(...candidates) : Date.now();
}

export function getLeadIdleHours(lead: Lead, nowMs = Date.now()): number {
  const lastMs = getLeadLastInteractionMs(lead);
  return Math.max(0, (nowMs - lastMs) / 36e5);
}

