import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import useAccountStore from '../store/useAccountStore';
import useAuthStore from '../store/useAuthStore';
import useBudgetStore from '../store/useBudgetStore';
import useFamilyStore from '../store/useFamilyStore';
import useStorageStore from '../store/useStorageStore';
import {
  generateLocalId,
  getLocalCollection,
  isLocalMode,
  LOCAL_COLLECTIONS,
  saveLocalCollection,
  serializeForLocal,
} from './localStorageService';

const MAX_LOCAL_LOGS = 200;
let unsubscribeFns = [];

const getActiveUserId = () =>
  auth.currentUser?.uid || useAuthStore.getState().getUserId();

const safeStateSnapshot = (val) => {
  if (val === undefined || val === null) return {};
  try {
    return serializeForLocal(val);
  } catch (_err) {
    return {};
  }
};

/**
 * Persists a single user-scoped activity log entry (Local-only or Cloud).
 * Records `isLocal`, `storageMode`, `previousState`, and `nextState`.
 * Never throws so state updates are never blocked by logging.
 */
export const logUserAction = async ({
  action,
  entity,
  summary,
  previousState = {},
  nextState = {},
  source = 'state',
  explicitUserId = null,
}) => {
  try {
    const userId = explicitUserId || getActiveUserId();
    if (!userId) return { success: false, error: 'No active user' };

    const localFlag = isLocalMode();
    const entry = {
      id: generateLocalId('log'),
      userId,
      action,
      entity,
      summary,
      isLocal: localFlag,
      storageMode: localFlag ? 'local' : 'cloud',
      previousState: safeStateSnapshot(previousState),
      nextState: safeStateSnapshot(nextState),
      source,
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
    };

    if (localFlag) {
      const existing = await getLocalCollection(
        userId,
        LOCAL_COLLECTIONS.ACTIVITY_LOGS
      );
      const scoped = existing.filter((item) => item.userId === userId);
      const next = [entry, ...scoped].slice(0, MAX_LOCAL_LOGS);
      await saveLocalCollection(userId, LOCAL_COLLECTIONS.ACTIVITY_LOGS, next);
      return { success: true, entry };
    }

    await setDoc(doc(db, 'users', userId, 'activity_logs', entry.id), entry);
    return { success: true, entry };
  } catch (error) {
    console.log('⚠️ Activity log error:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to write log' };
  }
};

/**
 * Fetches activity logs strictly belonging to the currently signed-in user.
 */
export const getUserLogs = async (limitCount = 150) => {
  try {
    const userId = getActiveUserId();
    if (!userId) return { success: false, logs: [], error: 'Not authenticated' };

    if (isLocalMode()) {
      const all = await getLocalCollection(
        userId,
        LOCAL_COLLECTIONS.ACTIVITY_LOGS
      );
      const logs = all
        .filter((item) => item.userId === userId)
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
        .slice(0, limitCount);
      return { success: true, logs };
    }

    const q = query(
      collection(db, 'users', userId, 'activity_logs'),
      orderBy('createdAtMs', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((item) => item.userId === userId);

    return { success: true, logs };
  } catch (error) {
    console.log('❌ Get user logs error:', error?.message || error);
    return { success: false, logs: [], error: error?.message || 'Failed to load logs' };
  }
};

/**
 * Clears all activity logs for the currently signed-in user only.
 */
export const clearUserLogs = async () => {
  try {
    const userId = getActiveUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };

    if (isLocalMode()) {
      await saveLocalCollection(userId, LOCAL_COLLECTIONS.ACTIVITY_LOGS, []);
      return { success: true };
    }

    const snapshot = await getDocs(
      collection(db, 'users', userId, 'activity_logs')
    );
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
    return { success: true };
  } catch (error) {
    console.log('❌ Clear user logs error:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to clear logs' };
  }
};

/**
 * Subscribes to Zustand store state updates and records per-user logs
 * with previousState -> nextState snapshots.
 */
export const initStateLoggers = () => {
  if (unsubscribeFns.length > 0) {
    return () => stopStateLoggers();
  }

  const unsubAuth = useAuthStore.subscribe((state, prevState) => {
    const uid = state.user?.uid || prevState.user?.uid;
    if (!uid) return;

    if (!prevState.isAuthenticated && state.isAuthenticated) {
      logUserAction({
        action: 'AUTH_LOGIN',
        entity: 'Auth',
        summary: 'Signed in to KOSH',
        previousState: { isAuthenticated: false },
        nextState: { isAuthenticated: true, uid },
        explicitUserId: uid,
      });
      return;
    }

    if (prevState.isAuthenticated && !state.isAuthenticated) {
      logUserAction({
        action: 'AUTH_LOGOUT',
        entity: 'Auth',
        summary: 'Signed out of KOSH',
        previousState: { isAuthenticated: true, uid },
        nextState: { isAuthenticated: false },
        explicitUserId: uid,
      });
      return;
    }

    if (prevState.isStealthMode !== state.isStealthMode && prevState.userProfile) {
      logUserAction({
        action: 'PREFERENCE_UPDATE',
        entity: 'Profile',
        summary: `Stealth Mode ${state.isStealthMode ? 'enabled' : 'disabled'}`,
        previousState: { isStealthMode: prevState.isStealthMode },
        nextState: { isStealthMode: state.isStealthMode },
        explicitUserId: uid,
      });
    }

    if (prevState.showTabLabels !== state.showTabLabels && prevState.userProfile) {
      logUserAction({
        action: 'PREFERENCE_UPDATE',
        entity: 'Profile',
        summary: `Bottom tab labels ${state.showTabLabels ? 'shown' : 'hidden'}`,
        previousState: { showTabLabels: prevState.showTabLabels },
        nextState: { showTabLabels: state.showTabLabels },
        explicitUserId: uid,
      });
    }

    if (!prevState.isOnboardingComplete && state.isOnboardingComplete && prevState.userProfile) {
      logUserAction({
        action: 'ONBOARDING_COMPLETE',
        entity: 'Profile',
        summary: 'Completed onboarding setup',
        previousState: { onboardingComplete: false },
        nextState: { onboardingComplete: true },
        explicitUserId: uid,
      });
    }

    if (prevState.userProfile && state.userProfile && prevState.userProfile !== state.userProfile) {
      const ignoredKeys = new Set(['updatedAt', 'showTabLabels', 'isStealthMode']);
      const changedKeys = Object.keys(state.userProfile).filter(
        (key) =>
          !ignoredKeys.has(key) &&
          JSON.stringify(prevState.userProfile[key]) !==
            JSON.stringify(state.userProfile[key])
      );
      if (changedKeys.length > 0) {
        const prevDiff = {};
        const nextDiff = {};
        changedKeys.forEach((k) => {
          prevDiff[k] = prevState.userProfile[k] ?? null;
          nextDiff[k] = state.userProfile[k] ?? null;
        });
        logUserAction({
          action: 'PROFILE_UPDATE',
          entity: 'Profile',
          summary: `Updated profile (${changedKeys.join(', ')})`,
          previousState: prevDiff,
          nextState: nextDiff,
          explicitUserId: uid,
        });
      }
    }
  });

  const unsubStorage = useStorageStore.subscribe((state, prevState) => {
    const uid = getActiveUserId();
    if (!uid) return;

    if (prevState.storageModeLoaded && prevState.storageMode !== state.storageMode) {
      logUserAction({
        action: 'STORAGE_MODE_CHANGE',
        entity: 'Storage',
        summary: `Switched storage mode to ${state.storageMode === 'local' ? 'Local Only' : 'Cloud Sync'}`,
        previousState: { storageMode: prevState.storageMode },
        nextState: { storageMode: state.storageMode },
        explicitUserId: uid,
      });
    }

    if (
      prevState.migrationStatus !== state.migrationStatus &&
      (state.migrationStatus === 'done' || state.migrationStatus === 'error')
    ) {
      logUserAction({
        action: 'STORAGE_MIGRATION',
        entity: 'Storage',
        summary:
          state.migrationStatus === 'done'
            ? 'Completed storage migration'
            : `Storage migration failed: ${state.migrationError || 'Unknown error'}`,
        previousState: { migrationStatus: prevState.migrationStatus },
        nextState: {
          migrationStatus: state.migrationStatus,
          ...(state.migrationError ? { error: state.migrationError } : {}),
        },
        explicitUserId: uid,
      });
    }
  });

  const unsubAccounts = useAccountStore.subscribe((state, prevState) => {
    const uid = getActiveUserId();
    if (!uid || (prevState.loading && !state.loading)) return;
    if (prevState.accounts === state.accounts) return;
    if (prevState.accounts.length === 0 && state.accounts.length > 1) return;

    if (state.accounts.length > prevState.accounts.length) {
      const added = state.accounts.find(
        (a) => !prevState.accounts.some((p) => p.id === a.id)
      );
      if (added) {
        logUserAction({
          action: 'ACCOUNT_ADD',
          entity: 'Accounts',
          summary: `Added account: ${added.name || added.type || 'Account'}`,
          previousState: {},
          nextState: added,
          explicitUserId: uid,
        });
      }
    } else if (state.accounts.length < prevState.accounts.length) {
      const removed = prevState.accounts.find(
        (p) => !state.accounts.some((a) => a.id === p.id)
      );
      if (removed) {
        logUserAction({
          action: 'ACCOUNT_REMOVE',
          entity: 'Accounts',
          summary: `Removed account: ${removed.name || removed.type || 'Account'}`,
          previousState: removed,
          nextState: {},
          explicitUserId: uid,
        });
      }
    } else {
      const updated = state.accounts.find((a) => {
        const prev = prevState.accounts.find((p) => p.id === a.id);
        return prev && JSON.stringify(prev) !== JSON.stringify(a);
      });
      if (updated) {
        const prevAcc = prevState.accounts.find((p) => p.id === updated.id) || {};
        logUserAction({
          action: 'ACCOUNT_UPDATE',
          entity: 'Accounts',
          summary: `Updated account: ${updated.name || updated.type || 'Account'}`,
          previousState: prevAcc,
          nextState: updated,
          explicitUserId: uid,
        });
      }
    }
  });

  const unsubBudgets = useBudgetStore.subscribe((state, prevState) => {
    const uid = getActiveUserId();
    if (!uid || (prevState.loading && !state.loading)) return;
    if (prevState.budgets === state.budgets) return;
    if (prevState.budgets.length === 0 && state.budgets.length > 1) return;

    if (state.budgets.length > prevState.budgets.length) {
      const added = state.budgets.find(
        (b) => !prevState.budgets.some((p) => p.id === b.id)
      );
      if (added) {
        logUserAction({
          action: 'BUDGET_ADD',
          entity: 'Budgets',
          summary: `Created budget: ${added.categoryName || 'Monthly Budget'}`,
          previousState: {},
          nextState: added,
          explicitUserId: uid,
        });
      }
    } else if (state.budgets.length < prevState.budgets.length) {
      const removed = prevState.budgets.find(
        (p) => !state.budgets.some((b) => b.id === p.id)
      );
      if (removed) {
        logUserAction({
          action: 'BUDGET_REMOVE',
          entity: 'Budgets',
          summary: `Removed budget: ${removed.categoryName || 'Budget'}`,
          previousState: removed,
          nextState: {},
          explicitUserId: uid,
        });
      }
    } else {
      const updated = state.budgets.find((b) => {
        const prev = prevState.budgets.find((p) => p.id === b.id);
        return prev && JSON.stringify(prev) !== JSON.stringify(b);
      });
      if (updated) {
        const prevBudget = prevState.budgets.find((p) => p.id === updated.id) || {};
        logUserAction({
          action: 'BUDGET_UPDATE',
          entity: 'Budgets',
          summary: `Updated budget: ${updated.categoryName || 'Budget'}`,
          previousState: prevBudget,
          nextState: updated,
          explicitUserId: uid,
        });
      }
    }
  });

  const unsubFamily = useFamilyStore.subscribe((state, prevState) => {
    const uid = getActiveUserId();
    if (!uid) return;
    if (!prevState.family && state.family) {
      logUserAction({
        action: 'FAMILY_JOIN',
        entity: 'Family',
        summary: `Connected to family: ${state.family.name || 'Family'}`,
        previousState: {},
        nextState: state.family,
        explicitUserId: uid,
      });
    } else if (prevState.family && !state.family) {
      logUserAction({
        action: 'FAMILY_LEAVE',
        entity: 'Family',
        summary: `Left family: ${prevState.family.name || 'Family'}`,
        previousState: prevState.family,
        nextState: {},
        explicitUserId: uid,
      });
    }
  });

  unsubscribeFns = [unsubAuth, unsubStorage, unsubAccounts, unsubBudgets, unsubFamily];
  return () => stopStateLoggers();
};

export const stopStateLoggers = () => {
  unsubscribeFns.forEach((unsub) => {
    try {
      unsub();
    } catch (_err) {
      // Ignore cleanup errors
    }
  });
  unsubscribeFns = [];
};
