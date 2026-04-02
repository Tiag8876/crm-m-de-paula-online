import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { normalizePtBrDeep } from '@/lib/text';
import { saveOfflineSnapshot } from '@/lib/offlineSnapshot';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';

const pickState = (state: ReturnType<typeof useStore.getState>) => ({
  leads: state.leads,
  campaigns: state.campaigns,
  adGroups: state.adGroups,
  ads: state.ads,
  areasOfLaw: state.areasOfLaw,
  services: state.services,
  standardTasks: state.standardTasks,
  kanbanStages: state.kanbanStages,
  notifications: state.notifications,
  weeklySnapshots: state.weeklySnapshots,
  prospectLeads: state.prospectLeads,
  prospectKanbanStages: state.prospectKanbanStages,
  prospectObjections: state.prospectObjections,
  prospectPlaybook: state.prospectPlaybook,
  dailyInsight: state.dailyInsight,
});

export function StateSyncProvider() {
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const syncingRef = useRef(false);
  const skipNextRef = useRef(false);
  const lastServerUpdatedAtRef = useRef<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const inactivityTimerRef = useRef<number | undefined>(undefined);
  const pullTimerRef = useRef<number | undefined>(undefined);

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
    } catch {
      // keep local state and retry
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await api.get<{ state: ReturnType<typeof pickState>; updatedAt?: string }>('/api/state');
        const normalizedState = normalizePtBrDeep(data.state);
        skipNextRef.current = true;
        useStore.setState((current) => ({ ...current, ...normalizedState }));
        saveOfflineSnapshot(normalizedState as unknown as Record<string, unknown>);
        lastServerUpdatedAtRef.current = data.updatedAt || null;
      } catch {
        // fallback: keep local state
      } finally {
        loadedRef.current = true;
        useStore.getState().runInactivityAutomation(24);
        useStore.getState().syncOperationalNotifications(24);
        useStore.getState().ensureWeeklySnapshot();
        if (mounted) {
          setLoading(false);
        }
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
        if (syncingRef.current) {
          return;
        }
        saveOfflineSnapshot(pickState(state) as unknown as Record<string, unknown>);
        syncingRef.current = true;
        try {
          const response = await api.put<{ updatedAt?: string }>('/api/state', {
            state: pickState(state),
            clientUpdatedAt: lastServerUpdatedAtRef.current,
          });
          if (response?.updatedAt) {
            lastServerUpdatedAtRef.current = response.updatedAt;
          }
        } catch {
          await pullLatestState();
          // keep local changes and retry on next mutation
        } finally {
          syncingRef.current = false;
        }
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
