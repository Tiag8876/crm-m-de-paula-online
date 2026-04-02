const LOCAL_API_BASE = 'http://127.0.0.1:3001';
const API_BASE_STORAGE_KEY = 'lawcrm-api-base-url';

const normalizeBase = (value?: string | null): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
};

const getEnvApiBase = (): string => normalizeBase(import.meta.env.VITE_API_BASE_URL);

const getStoredApiBase = (): string => {
  if (typeof window === 'undefined') return '';
  return normalizeBase(window.localStorage.getItem(API_BASE_STORAGE_KEY));
};

const isDesktopRuntime = (): boolean => {
  if (import.meta.env.VITE_DESKTOP === '1') return true;
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'file:';
};

const getSameOriginBase = (): string => {
  if (typeof window === 'undefined') return '';
  const origin = normalizeBase(window.location.origin);
  return origin === 'null' ? '' : origin;
};

const getDefaultApiBase = (): string => {
  const envBase = getEnvApiBase();
  if (envBase) return envBase;

  if (isDesktopRuntime()) {
    return LOCAL_API_BASE;
  }

  return getSameOriginBase() || LOCAL_API_BASE;
};

export const getApiBase = (): string => getStoredApiBase() || getDefaultApiBase();

export const getLocalApiBase = (): string => LOCAL_API_BASE;

export const setApiBase = (value: string): void => {
  if (typeof window === 'undefined') return;

  const normalized = normalizeBase(value);
  const defaultBase = getDefaultApiBase();

  if (!normalized || normalized === defaultBase) {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
};

export const clearApiBase = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(API_BASE_STORAGE_KEY);
};

export const getApiBaseStorageKey = (): string => API_BASE_STORAGE_KEY;

export const isApiBaseConfigured = (): boolean => Boolean(getApiBase());
