import { getApiBase } from '@/lib/apiConfig';
import { normalizePtBrDeep } from '@/lib/text';

const getToken = () => localStorage.getItem('lawcrm-token');

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error('Conexão não configurada.');
  }
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const normalizedBody = init?.body && typeof init.body === 'string'
    ? JSON.stringify(normalizePtBrDeep(JSON.parse(init.body)))
    : init?.body;

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    cache: 'no-store',
    body: normalizedBody,
    headers,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(json?.message || 'Erro na requisicao', response.status, json?.code);
  }

  return normalizePtBrDeep(json) as T;
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
