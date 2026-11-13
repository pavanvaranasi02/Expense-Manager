import { create } from 'zustand';

const useStorageStore = create((set, get) => ({
  // 'cloud' | 'local'
  storageMode: 'cloud',
  isLoaded: false,

  // Background migration state: 'idle' | 'downloading' | 'uploading' | 'error'
  migrationStatus: 'idle',
  migrationProgress: { current: 0, total: 0, label: '' },
  migrationError: null,
  lastMigratedAt: null,

  // Track collections modified while a background migration is running
  dirtyCollections: [],

  setStorageMode: (storageMode) => set({ storageMode, isLoaded: true }),
  setIsLoaded: (isLoaded) => set({ isLoaded }),

  setMigrationStatus: (migrationStatus, migrationProgress = null, migrationError = null) =>
    set((state) => ({
      migrationStatus,
      migrationProgress: migrationProgress ?? state.migrationProgress,
      migrationError,
    })),

  setLastMigratedAt: (lastMigratedAt) => set({ lastMigratedAt }),

  markCollectionDirty: (collectionName) =>
    set((state) => {
      if (state.migrationStatus === 'idle') return state;
      if (state.dirtyCollections.includes(collectionName)) return state;
      return { dirtyCollections: [...state.dirtyCollections, collectionName] };
    }),

  clearDirtyCollections: () => set({ dirtyCollections: [] }),

  resetStorageStore: () =>
    set({
      storageMode: 'cloud',
      isLoaded: false,
      migrationStatus: 'idle',
      migrationProgress: { current: 0, total: 0, label: '' },
      migrationError: null,
      dirtyCollections: [],
    }),

  isLocalMode: () => get().storageMode === 'local',
}));

export default useStorageStore;
