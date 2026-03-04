import AsyncStorage from '@react-native-async-storage/async-storage';

// ============ CONSTANTS ============
const QUEUE_KEY = '@expense_manager_offline_queue';
const CACHE_KEY_PREFIX = '@expense_manager_cache_';

// Operation types
export const OP = {
  ADD: 'ADD',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};

// Collection names — must match Firestore subcollection names
export const COLLECTIONS = {
  EXPENSES: 'expenses',
  INCOMES: 'incomes',
  INVESTMENTS: 'investments',
  ACCOUNTS: 'accounts',
  BUDGETS: 'budgets',
  CATEGORIES: 'categories',
};

// ============ QUEUE OPERATIONS ============

// Get the full pending queue
export const getQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log('❌ getQueue error:', error);
    return [];
  }
};

// Add an operation to the queue
export const enqueue = async (operation) => {
  try {
    const queue = await getQueue();
    const entry = {
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      ...operation,
      // operation shape:
      // { type: OP.ADD, collection: COLLECTIONS.EXPENSES, docId, data }
    };
    queue.push(entry);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`📥 Queued offline ${operation.type} on ${operation.collection}:`, entry.id);
    return entry;
  } catch (error) {
    console.log('❌ enqueue error:', error);
    return null;
  }
};

// Remove one entry from the queue by its id
export const dequeue = async (entryId) => {
  try {
    const queue = await getQueue();
    const filtered = queue.filter((entry) => entry.id !== entryId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    console.log('✅ Dequeued entry:', entryId);
  } catch (error) {
    console.log('❌ dequeue error:', error);
  }
};

// Increment retry count on a failed entry
export const incrementRetry = async (entryId) => {
  try {
    const queue = await getQueue();
    const updated = queue.map((entry) =>
      entry.id === entryId
        ? { ...entry, retryCount: (entry.retryCount || 0) + 1, lastRetry: new Date().toISOString() }
        : entry
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.log('❌ incrementRetry error:', error);
  }
};

// Clear entries that have failed too many times (max 5 retries)
export const clearPoisonedEntries = async () => {
  try {
    const queue = await getQueue();
    const MAX_RETRIES = 5;
    const clean = queue.filter((entry) => (entry.retryCount || 0) < MAX_RETRIES);
    const removed = queue.length - clean.length;
    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} poisoned queue entries (exceeded max retries)`);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(clean));
    }
    return removed;
  } catch (error) {
    console.log('❌ clearPoisonedEntries error:', error);
    return 0;
  }
};

// Clear the entire queue (use after successful full sync)
export const clearQueue = async () => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([]));
    console.log('🧹 Queue cleared');
  } catch (error) {
    console.log('❌ clearQueue error:', error);
  }
};

// ============ LOCAL CACHE OPERATIONS ============
// Used to store full lists locally for offline reads

// Save a collection snapshot to local cache
export const saveToCache = async (collection, data) => {
  try {
    const cacheEntry = {
      data,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}${collection}`,
      JSON.stringify(cacheEntry)
    );
  } catch (error) {
    console.log(`❌ saveToCache (${collection}) error:`, error);
  }
};

// Read a collection snapshot from local cache
export const readFromCache = async (collection) => {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${collection}`);
    if (!raw) return { data: null, cachedAt: null };
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    console.log(`❌ readFromCache (${collection}) error:`, error);
    return { data: null, cachedAt: null };
  }
};

// Optimistically add an item to the local cache
export const addToCache = async (collection, item) => {
  try {
    const { data } = await readFromCache(collection);
    const current = data || [];
    const updated = [item, ...current];
    await saveToCache(collection, updated);
  } catch (error) {
    console.log(`❌ addToCache (${collection}) error:`, error);
  }
};

// Optimistically update an item in the local cache
export const updateInCache = async (collection, docId, updates) => {
  try {
    const { data } = await readFromCache(collection);
    if (!data) return;
    const updated = data.map((item) =>
      item.id === docId ? { ...item, ...updates } : item
    );
    await saveToCache(collection, updated);
  } catch (error) {
    console.log(`❌ updateInCache (${collection}) error:`, error);
  }
};

// Optimistically remove an item from the local cache
export const removeFromCache = async (collection, docId) => {
  try {
    const { data } = await readFromCache(collection);
    if (!data) return;
    const updated = data.filter((item) => item.id !== docId);
    await saveToCache(collection, updated);
  } catch (error) {
    console.log(`❌ removeFromCache (${collection}) error:`, error);
  }
};

// Clear cache for a specific collection (force refresh)
export const clearCache = async (collection) => {
  try {
    await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${collection}`);
  } catch (error) {
    console.log(`❌ clearCache (${collection}) error:`, error);
  }
};

// Get queue count for a specific collection (for UI badges)
export const getQueueCountForCollection = async (collection) => {
  try {
    const queue = await getQueue();
    return queue.filter((entry) => entry.collection === collection).length;
  } catch {
    return 0;
  }
};