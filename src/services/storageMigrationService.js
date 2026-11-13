import NetInfo from '@react-native-community/netinfo';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { auth, db } from '../config/firebase';
import useAuthStore from '../store/useAuthStore';
import useStorageStore from '../store/useStorageStore';
import {
  clearUserLocalData,
  deserializeForFirestore,
  getLocalCollection,
  getLocalProfile,
  LOCAL_COLLECTIONS,
  saveLocalCollection,
  saveLocalProfile,
  saveStorageMode,
  serializeForLocal,
} from './localStorageService';
import { COLLECTIONS, saveToCache } from './offlineQueue';

const MIGRATION_COLLECTIONS = [
  { key: LOCAL_COLLECTIONS.ACCOUNTS, label: 'Accounts' },
  { key: LOCAL_COLLECTIONS.EXPENSES, label: 'Expenses' },
  { key: LOCAL_COLLECTIONS.INCOMES, label: 'Income' },
  { key: LOCAL_COLLECTIONS.BUDGETS, label: 'Budgets' },
  { key: LOCAL_COLLECTIONS.CUSTOM_CATEGORIES, label: 'Categories' },
  { key: LOCAL_COLLECTIONS.INVESTMENTS, label: 'Investments' },
  { key: LOCAL_COLLECTIONS.EMIS, label: 'EMIs' },
  { key: LOCAL_COLLECTIONS.NOTIFICATIONS, label: 'Notifications' },
];

const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 10));

const downloadCollectionFromCloud = async (userId, colName) => {
  const snapshot = await getDocs(collection(db, 'users', userId, colName));
  const items = snapshot.docs.map((d) =>
    serializeForLocal({ id: d.id, ...d.data() })
  );
  await saveLocalCollection(userId, colName, items);

  if (colName === LOCAL_COLLECTIONS.EXPENSES) {
    await saveToCache(COLLECTIONS.EXPENSES, items);
  }
  return items.length;
};

const uploadCollectionToCloud = async (userId, colName) => {
  const items = await getLocalCollection(userId, colName);
  if (!items || items.length === 0) return 0;

  const CHUNK_SIZE = 400; // Firestore batch limit is 500
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      if (!item.id) continue;
      const docRef = doc(db, 'users', userId, colName, item.id);
      const firestoreData = deserializeForFirestore(item, colName);
      batch.set(docRef, firestoreData, { merge: true });
    }
    await batch.commit();
    await yieldToUI();
  }
  return items.length;
};

/**
 * Background Cloud -> Local migration.
 * Downloads all user collections and profile from Firestore into AsyncStorage,
 * then flips storageMode to 'local' without blocking the UI.
 */
export const migrateCloudToLocal = async (userId) => {
  const store = useStorageStore.getState();
  if (store.migrationStatus !== 'idle') {
    return { success: false, error: 'A storage migration is already in progress.' };
  }

  const netState = await NetInfo.fetch();
  if (!netState.isConnected || netState.isInternetReachable === false) {
    Toast.show({
      type: 'error',
      text1: 'Internet Required',
      text2: 'Connect to the internet to download your cloud data.',
    });
    return { success: false, error: 'No internet connection' };
  }

  const totalSteps = MIGRATION_COLLECTIONS.length + 1;
  store.clearDirtyCollections();
  store.setMigrationStatus('downloading', {
    current: 0,
    total: totalSteps,
    label: 'Starting download...',
  });

  try {
    // 1. Download all subcollections
    for (let i = 0; i < MIGRATION_COLLECTIONS.length; i++) {
      const { key, label } = MIGRATION_COLLECTIONS[i];
      useStorageStore.getState().setMigrationStatus('downloading', {
        current: i + 1,
        total: totalSteps,
        label: `Downloading ${label}...`,
      });
      await downloadCollectionFromCloud(userId, key);
      await yieldToUI();
    }

    // 2. Download user profile
    useStorageStore.getState().setMigrationStatus('downloading', {
      current: totalSteps,
      total: totalSteps,
      label: 'Downloading Profile & Settings...',
    });
    const userSnap = await getDoc(doc(db, 'users', userId));
    const currentProfile = useAuthStore.getState().userProfile || {};
    const cloudProfile = userSnap.exists()
      ? serializeForLocal(userSnap.data())
      : serializeForLocal(currentProfile);

    await saveLocalProfile(
      userId,
      {
        ...cloudProfile,
        storageMode: 'local',
        onboardingComplete: cloudProfile.onboardingComplete ?? true,
      },
      false
    );

    // 3. Re-sync any collections modified while download was running
    const dirty = [...useStorageStore.getState().dirtyCollections];
    for (const col of dirty) {
      if (col === LOCAL_COLLECTIONS.PROFILE) {
        const latestSnap = await getDoc(doc(db, 'users', userId));
        if (latestSnap.exists()) {
          await saveLocalProfile(
            userId,
            { ...serializeForLocal(latestSnap.data()), storageMode: 'local' },
            true
          );
        }
      } else {
        await downloadCollectionFromCloud(userId, col);
      }
    }

    // 4. Flip active storage mode to 'local'
    await saveStorageMode(userId, 'local');
    useAuthStore.getState().updateProfile({ storageMode: 'local' });

    // Best-effort record preference in cloud too
    setDoc(
      doc(db, 'users', userId),
      { storageMode: 'local', updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});

    useStorageStore.getState().clearDirtyCollections();
    useStorageStore.getState().setLastMigratedAt(new Date().toISOString());
    useStorageStore.getState().setMigrationStatus('idle', {
      current: totalSteps,
      total: totalSteps,
      label: 'Complete',
    });

    Toast.show({
      type: 'success',
      text1: 'Local Storage Active',
      text2: 'All your cloud data has been downloaded to this device.',
    });

    return { success: true };
  } catch (error) {
    console.log('❌ Cloud -> Local migration error:', error);
    useStorageStore
      .getState()
      .setMigrationStatus('error', null, error.message || 'Download failed');
    Toast.show({
      type: 'error',
      text1: 'Download Failed',
      text2: 'Could not download cloud data. Still using Cloud Storage.',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Background Local -> Cloud migration.
 * Uploads all local collections and profile to Firestore using stable doc IDs,
 * then flips storageMode to 'cloud' without blocking the UI.
 */
export const migrateLocalToCloud = async (userId) => {
  const store = useStorageStore.getState();
  if (store.migrationStatus !== 'idle') {
    return { success: false, error: 'A storage migration is already in progress.' };
  }

  const netState = await NetInfo.fetch();
  if (!netState.isConnected || netState.isInternetReachable === false) {
    Toast.show({
      type: 'error',
      text1: 'Internet Required',
      text2: 'Connect to the internet to upload your local data to the cloud.',
    });
    return { success: false, error: 'No internet connection' };
  }

  const totalSteps = MIGRATION_COLLECTIONS.length + 1;
  store.clearDirtyCollections();
  store.setMigrationStatus('uploading', {
    current: 0,
    total: totalSteps,
    label: 'Starting upload...',
  });

  try {
    // 1. Upload all subcollections
    for (let i = 0; i < MIGRATION_COLLECTIONS.length; i++) {
      const { key, label } = MIGRATION_COLLECTIONS[i];
      useStorageStore.getState().setMigrationStatus('uploading', {
        current: i + 1,
        total: totalSteps,
        label: `Uploading ${label}...`,
      });
      await uploadCollectionToCloud(userId, key);
      await yieldToUI();
    }

    // 2. Upload user profile
    useStorageStore.getState().setMigrationStatus('uploading', {
      current: totalSteps,
      total: totalSteps,
      label: 'Uploading Profile & Settings...',
    });
    const localProfile =
      (await getLocalProfile(userId)) || useAuthStore.getState().userProfile || {};
    const firestoreProfile = deserializeForFirestore({
      ...localProfile,
      storageMode: 'cloud',
    });
    await setDoc(
      doc(db, 'users', userId),
      {
        ...firestoreProfile,
        storageMode: 'cloud',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 3. Re-upload any collections modified locally while upload was running
    const dirty = [...useStorageStore.getState().dirtyCollections];
    for (const col of dirty) {
      if (col === LOCAL_COLLECTIONS.PROFILE) {
        const latestProfile = await getLocalProfile(userId);
        if (latestProfile) {
          await setDoc(
            doc(db, 'users', userId),
            {
              ...deserializeForFirestore(latestProfile),
              storageMode: 'cloud',
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } else {
        await uploadCollectionToCloud(userId, col);
      }
    }

    // 4. Flip active storage mode to 'cloud' and remove local-only copies
    await saveStorageMode(userId, 'cloud');
    await clearUserLocalData(userId, false);
    useAuthStore.getState().updateProfile({ storageMode: 'cloud' });

    useStorageStore.getState().clearDirtyCollections();
    useStorageStore.getState().setLastMigratedAt(new Date().toISOString());
    useStorageStore.getState().setMigrationStatus('idle', {
      current: totalSteps,
      total: totalSteps,
      label: 'Complete',
    });

    Toast.show({
      type: 'success',
      text1: 'Cloud Storage Active',
      text2: 'All your local data has been synced to the cloud.',
    });

    return { success: true };
  } catch (error) {
    console.log('❌ Local -> Cloud migration error:', error);
    useStorageStore
      .getState()
      .setMigrationStatus('error', null, error.message || 'Upload failed');
    Toast.show({
      type: 'error',
      text1: 'Upload Failed',
      text2: 'Could not upload local data. Still using Local Storage.',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Trigger a background storage mode switch without blocking the caller/UI.
 */
export const startBackgroundStorageSwitch = (targetMode) => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const currentMode = useStorageStore.getState().storageMode;
  if (currentMode === targetMode) return;

  if (targetMode === 'local') {
    // Fire and forget in background
    migrateCloudToLocal(userId);
  } else {
    migrateLocalToCloud(userId);
  }
};
