const normalizeBase = (value?: string | null): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
};

export const getApiBase = (): string => {
  const envBase = normalizeBase(import.meta.env.VITE_API_BASE_URL);
  if (envBase) return envBase;

  if (typeof window === 'undefined') return '';

  const origin = normalizeBase(window.location.origin);
  return origin === 'null' ? '' : origin;
};
