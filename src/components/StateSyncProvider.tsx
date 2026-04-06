import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ApiError, api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { useSystemStore } from '@/store/useSystemStore';
import { normalizePtBrDeep } from '@/lib/text';
import { getOfflineSnapshot, saveOfflineSnapshot } from '@/lib/offlineSnapshot';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';

const pickState = (state: ReturnType<typeof useStore.getState>) => ({
  leads: state.leads,
  campaigns: state.campaigns,
  adGroups: state.adGroups,
  ads: state.ads,
  areasOfLaw: state.areasOfLaw,
  services: state.services,
  standardTasks: state.standardTasks,
  funnels: state.funnels,
  commercialDefaultFunnelId: state.commercialDefaultFunnelId,
  prospectingDefaultFunnelId: state.prospectingDefaultFunnelId,
  kanbanStages: state.kanbanStages,
  notifications: state.notifications,
  weeklySnapshots: state.weeklySnapshots,
  prospectLeads: state.prospectLeads,
  prospectKanbanStages: state.prospectKanbanStages,
  prospectObjections: state.prospectObjections,
  prospectPlaybook: state.prospectPlaybook,
  dailyInsight: state.dailyInsight,
});

const isSnapshotNewer = (capturedAt?: string | null, updatedAt?: string | null) => {
  if (!capturedAt) return false;
  if (!updatedAt) return true;
  const snapshotTime = new Date(capturedAt).getTime();
  const serverTime = new Date(updatedAt).getTime();
  if (Number.isNaN(snapshotTime) || Number.isNaN(serverTime)) return false;
  return snapshotTime > serverTime;
};

export function StateSyncProvider() {
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const syncingRef = useRef(false);
  const skipNextRef = useRef(false);
  const lastServerUpdatedAtRef = useRef<string | null>(null);
  const pendingStateRef = useRef<ReturnType<typeof pickState> | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const inactivityTimerRef = useRef<number | undefined>(undefined);
  const pullTimerRef = useRef<number | undefined>(undefined);
  const setRuntimeInfo = useSystemStore((state) => state.setRuntimeInfo);
  const setSyncState = useSystemStore((state) => state.setSyncState);

  const flushPendingState = async () => {
    if (!loadedRef.current || syncingRef.current || !pendingStateRef.current) return;

    syncingRef.current = true;
    setSyncState({ syncState: 'syncing', syncError: null });
    try {
      const response = await api.put<{ updatedAt?: string }>('/api/state', {
        state: pendingStateRef.current,
        clientUpdatedAt: lastServerUpdatedAtRef.current,
      });
      if (response?.updatedAt) {
        lastServerUpdatedAtRef.current = response.updatedAt;
        setSyncState({ syncState: 'synced', syncError: null, lastSyncAt: response.updatedAt });
      } else {
        setSyncState({ syncState: 'synced', syncError: null, lastSyncAt: new Date().toISOString() });
      }
      pendingStateRef.current = null;
    } catch (error) {
      setSyncState({
        syncState: 'error',
        syncError: error instanceof Error ? error.message : 'Falha ao sincronizar dados',
      });
      if (error instanceof ApiError && error.status === 409) {
        await pullLatestState();
      }
    } finally {
      syncingRef.current = false;
    }
  };

  const pullLatestState = async () => {
    if (!loadedRef.current || syncingRef.current) return;

    try {
      const data = await api.get<{ state: ReturnType<typeof pickState>; updatedAt?: string }>('/api/state');
      if (!data.updatedAt || data.updatedAt === lastServerUpdatedAtRef.current) return;

      const normalizedState = normalizePtBrDeep(data.state);
      skipNextRef.current = true;
      useStore.setState((current) => ({ ...current, ...normalizedState }));
      saveOfflineSnapshot(normalizedState as unknown as Record<string, unknown>);
      lastServerUpdatedAtRef.current = data.updatedAt;
      setSyncState({ syncState: 'synced', syncError: null, lastSyncAt: data.updatedAt || new Date().toISOString() });
    } catch {
      // keep local state and retry
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const snapshot = getOfflineSnapshot();
        const health = await fetch('/api/health', { cache: 'no-store' });
        const healthJson = await health.json().catch(() => ({}));
        setRuntimeInfo({
          apiBase: window.location.origin,
          backendReachable: health.ok,
          mode: String(healthJson?.mode || 'online'),
          database: String(healthJson?.database || 'unknown'),
        });

        const data = await api.get<{ state: ReturnType<typeof pickState>; updatedAt?: string }>('/api/state');
        const shouldPreferSnapshot = isSnapshotNewer(snapshot?.capturedAt, data.updatedAt || null);
        const sourceState = shouldPreferSnapshot && snapshot?.state ? snapshot.state : data.state;
        const normalizedState = normalizePtBrDeep(sourceState);
        skipNextRef.current = true;
        useStore.setState((current) => ({ ...current, ...normalizedState }));
        saveOfflineSnapshot(normalizedState as unknown as Record<string, unknown>);
        lastServerUpdatedAtRef.current = data.updatedAt || null;
        if (shouldPreferSnapshot && snapshot?.state) {
          pendingStateRef.current = normalizedState as ReturnType<typeof pickState>;
          setSyncState({
            syncState: 'error',
            syncError: 'Snapshot local mais recente encontrado. Tentando reenviar ao servidor.',
            lastSyncAt: data.updatedAt || null,
          });
        } else {
          setSyncState({ syncState: 'synced', syncError: null, lastSyncAt: data.updatedAt || new Date().toISOString() });
        }
      } catch {
        const snapshot = getOfflineSnapshot();
        if (snapshot?.state) {
          const normalizedState = normalizePtBrDeep(snapshot.state);
          skipNextRef.current = true;
          useStore.setState((current) => ({ ...current, ...normalizedState }));
          pendingStateRef.current = normalizedState as ReturnType<typeof pickState>;
        }
        setSyncState({ syncState: 'error', syncError: 'Falha ao carregar dados iniciais do servidor' });
        // fallback: keep local state
      } finally {
        loadedRef.current = true;
        useStore.getState().runInactivityAutomation(24);
        useStore.getState().syncOperationalNotifications(24);
        useStore.getState().ensureWeeklySnapshot();
        if (mounted) {
          setLoading(false);
        }
        flushPendingState();
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      if (!loadedRef.current) {
        return;
      }

      if (skipNextRef.current) {
        skipNextRef.current = false;
        return;
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(async () => {
        saveOfflineSnapshot(pickState(state) as unknown as Record<string, unknown>);
        pendingStateRef.current = pickState(state);
        await flushPendingState();
      }, 500);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    pullTimerRef.current = window.setInterval(() => {
      pullLatestState();
      flushPendingState();
    }, 2000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        pullLatestState();
      }
    };
    const onFocus = () => {
      pullLatestState();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (pullTimerRef.current) {
        window.clearInterval(pullTimerRef.current);
      }
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    inactivityTimerRef.current = window.setInterval(() => {
      const store = useStore.getState();
      store.runInactivityAutomation(24);
      store.syncOperationalNotifications(24);
      store.ensureWeeklySnapshot();
    }, 5 * 60 * 1000);

    return () => {
      if (inactivityTimerRef.current) {
        window.clearInterval(inactivityTimerRef.current);
      }
    };
  }, []);

  if (loading) {
    return <AppLoadingScreen title="Carregando dados" subtitle="Sincronizando informacoes do servidor..." />;
  }

  return <Outlet />;
}
