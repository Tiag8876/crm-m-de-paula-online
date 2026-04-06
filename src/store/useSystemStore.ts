import { create } from 'zustand';

type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

interface RuntimeInfo {
  mode: string;
  database: string;
  apiBase: string;
  backendReachable: boolean;
  publicSetupAllowed: boolean;
  bootstrapConfigured: boolean;
  initialized: boolean;
}

interface SystemStore extends RuntimeInfo {
  syncState: SyncState;
  syncError: string | null;
  lastSyncAt: string | null;
  setRuntimeInfo: (payload: Partial<RuntimeInfo>) => void;
  setSyncState: (payload: { syncState: SyncState; syncError?: string | null; lastSyncAt?: string | null }) => void;
}

export const useSystemStore = create<SystemStore>((set) => ({
  mode: 'online',
  database: 'unknown',
  apiBase: '',
  backendReachable: false,
  publicSetupAllowed: false,
  bootstrapConfigured: false,
  initialized: false,
  syncState: 'idle',
  syncError: null,
  lastSyncAt: null,
  setRuntimeInfo: (payload) => set((state) => ({ ...state, ...payload })),
  setSyncState: (payload) => set((state) => ({
    ...state,
    syncState: payload.syncState,
    syncError: payload.syncError ?? state.syncError,
    lastSyncAt: payload.lastSyncAt ?? state.lastSyncAt,
  })),
}));
