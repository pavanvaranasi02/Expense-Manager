import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../config/firebase';
import useStorageStore from '../store/useStorageStore';

const MODE_KEY_PREFIX = '@kosh_storage_mode_';
const DATA_KEY_PREFIX = '@kosh_local_';
const LEGACY_CACHE_PREFIX = '@expense_manager_cache_';
const LEGACY_QUEUE_KEY = '@expense_manager_offline_queue';

export const LOCAL_COLLECTIONS = {
  PROFILE: 'profile',
  ACCOUNTS: 'accounts',
  EXPENSES: 'expenses',
  INCOMES: 'incomes',
  BUDGETS: 'budgets',
  CUSTOM_CATEGORIES: 'custom_categories',
  INVESTMENTS: 'investments',
  EMIS: 'emis',
  NOTIFICATIONS: 'notifications',
  ACTIVITY_LOGS: 'activity_logs',
};

const assertCurrentUser = (userId) => {
  const currentUid = auth.currentUser?.uid;
  if (!userId || !currentUid || userId !== currentUid) {
    throw new Error('Access denied: cannot access or store another user\'s data locally.');
  }
};

const getModeKey = (userId) => {
  assertCurrentUser(userId);
  return `${MODE_KEY_PREFIX}${userId}`;
};

const getCollectionKey = (userId, collectionName) => {
  assertCurrentUser(userId);
  return `${DATA_KEY_PREFIX}${userId}_${collectionName}`;
};

/**
 * Remove any locally stored data belonging to any user other than activeUserId.
 * Ensures we never retain another user's account or financial details on the device.
 */
export const purgeOtherUsersLocalData = async (activeUserId) => {
  try {
    if (!activeUserId) return;
    const allKeys = await AsyncStorage.getAllKeys();
    const activeDataPrefix = `${DATA_KEY_PREFIX}${activeUserId}_`;
    const activeModeKey = `${MODE_KEY_PREFIX}${activeUserId}`;

    const keysToRemove = allKeys.filter((key) => {
      if (key.startsWith(DATA_KEY_PREFIX) && !key.startsWith(activeDataPrefix)) {
        return true;
      }
      if (key.startsWith(MODE_KEY_PREFIX) && key !== activeModeKey) {
        return true;
      }
      return false;
    });

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      // Also clear legacy shared cache/queue so no previous user's data leaks
      const legacyKeys = allKeys.filter(
        (k) => k.startsWith(LEGACY_CACHE_PREFIX) || k === LEGACY_QUEUE_KEY
      );
      if (legacyKeys.length > 0) {
        await AsyncStorage.multiRemove(legacyKeys);
      }
      console.log(`🧹 Purged ${keysToRemove.length} local storage key(s) from other user(s)`);
    }
  } catch (error) {
    console.log('❌ purgeOtherUsersLocalData error:', error);
  }
};

/**
 * Clear all local data for a specific user (e.g., after migrating Local -> Cloud or Cloud logout).
 */
export const clearUserLocalData = async (userId, includeModeKey = false) => {
  try {
    if (!userId) return;
    const allKeys = await AsyncStorage.getAllKeys();
    const userDataPrefix = `${DATA_KEY_PREFIX}${userId}_`;
    const userModeKey = `${MODE_KEY_PREFIX}${userId}`;

    const keysToRemove = allKeys.filter(
      (key) =>
        key.startsWith(userDataPrefix) ||
        (includeModeKey && key === userModeKey) ||
        key.startsWith(LEGACY_CACHE_PREFIX) ||
        key === LEGACY_QUEUE_KEY
    );

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`🧹 Cleared ${keysToRemove.length} local storage key(s) for user`);
    }
  } catch (error) {
    console.log('❌ clearUserLocalData error:', error);
  }
};

// ============ MODE HELPERS ============

export const isLocalMode = () => useStorageStore.getState().storageMode === 'local';

export const loadStorageMode = async (userId) => {
  try {
    if (!userId) return 'cloud';
    await purgeOtherUsersLocalData(userId);
    const stored = await AsyncStorage.getItem(getModeKey(userId));
    const mode = stored === 'local' ? 'local' : 'cloud';
    useStorageStore.getState().setStorageMode(mode);
    return mode;
  } catch (error) {
    console.log('❌ loadStorageMode error:', error);
    useStorageStore.getState().setStorageMode('cloud');
    return 'cloud';
  }
};

export const saveStorageMode = async (userId, mode) => {
  try {
    if (!userId) return;
    const normalized = mode === 'local' ? 'local' : 'cloud';
    await AsyncStorage.setItem(getModeKey(userId), normalized);
    useStorageStore.getState().setStorageMode(normalized);
    console.log(`💾 Storage mode set to: ${normalized}`);
  } catch (error) {
    console.log('❌ saveStorageMode error:', error);
  }
};

// ============ SERIALIZATION HELPERS ============

export const serializeForLocal = (value) => {
  if (value === null || value === undefined) return value;

  // Firestore Timestamp
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeForLocal);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Skip Firestore FieldValue sentinels if any leaked in
      if (v && typeof v === 'object' && v._methodName === 'serverTimestamp') {
        out[k] = new Date().toISOString();
      } else {
        out[k] = serializeForLocal(v);
      }
    }
    return out;
  }
  return value;
};

const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt', 'lastLoginAt']);

export const deserializeForFirestore = (obj, collectionName = null) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'id' || key === '_pendingSync' || key === '_offlineSynced') {
      continue;
    }
    if (
      (TIMESTAMP_FIELDS.has(key) ||
        (key === 'date' &&
          (collectionName === LOCAL_COLLECTIONS.EXPENSES ||
            collectionName === LOCAL_COLLECTIONS.INCOMES))) &&
      typeof val === 'string' &&
      !Number.isNaN(Date.parse(val))
    ) {
      out[key] = Timestamp.fromDate(new Date(val));
    } else {
      out[key] = val;
    }
  }
  return out;
};

export const generateLocalId = (prefix = 'loc') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ============ PROFILE OPERATIONS ============

export const getLocalProfile = async (userId) => {
  try {
    if (!userId) return null;
    const raw = await AsyncStorage.getItem(
      getCollectionKey(userId, LOCAL_COLLECTIONS.PROFILE)
    );
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.log('❌ getLocalProfile error:', error);
    return null;
  }
};

export const saveLocalProfile = async (userId, profileData, merge = true) => {
  try {
    if (!userId) return { success: false, error: 'Missing userId' };
    const serialized = serializeForLocal(profileData);
    let nextProfile = serialized;
    if (merge) {
      const existing = (await getLocalProfile(userId)) || {};
      nextProfile = {
        ...existing,
        ...serialized,
        updatedAt: new Date().toISOString(),
      };
    }
    await AsyncStorage.setItem(
      getCollectionKey(userId, LOCAL_COLLECTIONS.PROFILE),
      JSON.stringify(nextProfile)
    );
    useStorageStore.getState().markCollectionDirty(LOCAL_COLLECTIONS.PROFILE);
    return { success: true, profile: nextProfile };
  } catch (error) {
    console.log('❌ saveLocalProfile error:', error);
    return { success: false, error: error.message };
  }
};

// ============ COLLECTION OPERATIONS ============

export const getLocalCollection = async (userId, collectionName) => {
  try {
    if (!userId) return [];
    const raw = await AsyncStorage.getItem(getCollectionKey(userId, collectionName));
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log(`❌ getLocalCollection (${collectionName}) error:`, error);
    return [];
  }
};

export const saveLocalCollection = async (userId, collectionName, items) => {
  try {
    if (!userId) return false;
    const serialized = serializeForLocal(items || []);
    await AsyncStorage.setItem(
      getCollectionKey(userId, collectionName),
      JSON.stringify(serialized)
    );
    return true;
  } catch (error) {
    console.log(`❌ saveLocalCollection (${collectionName}) error:`, error);
    return false;
  }
};

export const getLocalDoc = async (userId, collectionName, docId) => {
  const items = await getLocalCollection(userId, collectionName);
  return items.find((item) => item.id === docId) || null;
};

export const addLocalDoc = async (userId, collectionName, data, customId = null) => {
  const items = await getLocalCollection(userId, collectionName);
  const now = new Date().toISOString();
  const id = customId || generateLocalId(collectionName.slice(0, 3));
  const docItem = serializeForLocal({
    ...data,
    id,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  });
  const next = [docItem, ...items];
  await saveLocalCollection(userId, collectionName, next);
  useStorageStore.getState().markCollectionDirty(collectionName);
  return docItem;
};

export const updateLocalDoc = async (userId, collectionName, docId, updates) => {
  const items = await getLocalCollection(userId, collectionName);
  const now = new Date().toISOString();
  let found = false;
  const serializedUpdates = serializeForLocal(updates);
  const next = items.map((item) => {
    if (item.id === docId) {
      found = true;
      return {
        ...item,
        ...serializedUpdates,
        updatedAt: now,
      };
    }
    return item;
  });
  if (!found) return null;
  await saveLocalCollection(userId, collectionName, next);
  useStorageStore.getState().markCollectionDirty(collectionName);
  return next.find((item) => item.id === docId);
};

export const deleteLocalDoc = async (userId, collectionName, docId) => {
  const items = await getLocalCollection(userId, collectionName);
  const next = items.filter((item) => item.id !== docId);
  await saveLocalCollection(userId, collectionName, next);
  useStorageStore.getState().markCollectionDirty(collectionName);
  return true;
};
