import { getApiBase } from '@/lib/apiConfig';

const STORAGE_KEY = 'lawcrm-offline-snapshot';

export interface OfflineSnapshotPayload {
  capturedAt: string;
  apiBase: string;
  state: Record<string, unknown>;
}

export const saveOfflineSnapshot = (state: Record<string, unknown>): void => {
  if (typeof window === 'undefined') return;
  const payload: OfflineSnapshotPayload = {
    capturedAt: new Date().toISOString(),
    apiBase: getApiBase(),
    state,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const getOfflineSnapshot = (): OfflineSnapshotPayload | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflineSnapshotPayload;
    if (!parsed?.state || !parsed?.capturedAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const hasOfflineSnapshot = (): boolean => getOfflineSnapshot() !== null;

