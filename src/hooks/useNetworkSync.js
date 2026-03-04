import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { getQueue } from '../services/offlineQueue';
import { syncOfflineQueue } from '../services/syncService';
import useSyncStore from '../store/useSyncStore';

const useNetworkSync = () => {
  const {
    isOnline,
    setOnline,
    setSyncing,
    setPendingCount,
    onSyncComplete,
    incrementPending,
  } = useSyncStore();

  // Track previous online state to detect transitions
  const wasOnline = useRef(true);
  // Track if we already showed the "back online" toast
  const syncInProgress = useRef(false);

  // ── Refresh pending count from queue ──────────────────
  const refreshPendingCount = async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  };

  // ── Run sync when we come back online ─────────────────
  const runSync = async () => {
    if (syncInProgress.current) return;

    const queue = await getQueue();
    if (queue.length === 0) return;

    syncInProgress.current = true;
    setSyncing(true);

    Toast.show({
      type: 'info',
      text1: '🔄 Back Online',
      text2: `Syncing ${queue.length} pending item(s)...`,
      visibilityTime: 3000,
    });

    const result = await syncOfflineQueue();
    await refreshPendingCount();
    onSyncComplete(result.synced, result.failed);

    if (result.synced > 0 && result.failed === 0) {
      Toast.show({
        type: 'success',
        text1: '✅ All Synced',
        text2: `${result.synced} item(s) saved to cloud`,
        visibilityTime: 3000,
      });
    } else if (result.failed > 0) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Sync Partial',
        text2: `${result.synced} synced, ${result.failed} failed`,
        visibilityTime: 4000,
      });
    }

    syncInProgress.current = false;
  };

  // ── Network state listener ─────────────────────────────
  useEffect(() => {
    // Load initial pending count
    refreshPendingCount();

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setOnline(online);

      if (online && !wasOnline.current) {
        // Transitioned from offline → online
        console.log('🌐 Network restored — triggering sync');
        await runSync();
      } else if (!online && wasOnline.current) {
        // Transitioned from online → offline
        console.log('📡 Network lost — switching to offline mode');
        Toast.show({
          type: 'error',
          text1: '📡 No Internet',
          text2: 'Changes will sync when connection is restored',
          visibilityTime: 4000,
        });
        await refreshPendingCount();
      }

      wasOnline.current = online;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    refreshPendingCount,
    runSync,
  };
};

export default useNetworkSync;