import { create } from 'zustand';

const useSyncStore = create((set, get) => ({
  // Network state
  isOnline: true,
  isConnected: true, // more granular (connected but maybe no internet)

  // Sync state
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  syncError: null,

  // Setters
  setOnline: (isOnline) => set({ isOnline }),
  setConnected: (isConnected) => set({ isConnected }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setSyncError: (syncError) => set({ syncError }),

  // Increment / decrement pending count optimistically
  incrementPending: () =>
    set((state) => ({ pendingCount: state.pendingCount + 1 })),
  decrementPending: (by = 1) =>
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - by),
    })),

  // Called when sync completes
  onSyncComplete: (synced, failed) =>
    set((state) => ({
      isSyncing: false,
      lastSyncedAt: new Date().toISOString(),
      pendingCount: Math.max(0, state.pendingCount - synced),
      syncError: failed > 0 ? `${failed} item(s) failed to sync` : null,
    })),
}));

export default useSyncStore;