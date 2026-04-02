import { getApiBase } from '@/lib/apiConfig';

export interface SetupStatusResponse {
  initialized: boolean;
  needsSetup: boolean;
  publicSetupAllowed?: boolean;
  bootstrapConfigured?: boolean;
}

const getErrorMessage = async (response: Response): Promise<string> => {
  const json = await response.json().catch(() => ({}));
  return json?.message || 'Falha na requisicao';
};

export const fetchSetupStatus = async (): Promise<SetupStatusResponse> => {
  const response = await fetch(`${getApiBase()}/api/setup/status`);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json();
};

export const initializeSetup = async (payload: { name: string; email: string; password: string }): Promise<void> => {
  const response = await fetch(`${getApiBase()}/api/setup/initialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};
