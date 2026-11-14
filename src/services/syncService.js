import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    increment,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { fromPaise, toPaise } from './financialCalculationService';
import {
    clearPoisonedEntries,
    dequeue,
    getQueue,
    incrementRetry,
    OP,
} from './offlineQueue';

// ============ SYNC ENGINE ============
// Replays all queued operations against Firestore in order

let isSyncing = false;

export const syncOfflineQueue = async (onProgress = null) => {
  // Prevent concurrent sync runs
  if (isSyncing) {
    console.log('⏳ Sync already in progress — skipping');
    return { success: true, synced: 0, failed: 0 };
  }

  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.log('⚠️ Sync skipped — no authenticated user');
    return { success: false, synced: 0, failed: 0 };
  }

  isSyncing = true;
  console.log('🔄 Starting offline queue sync...');

  // Remove entries that have failed too many times
  await clearPoisonedEntries();

  const queue = await getQueue();

  if (queue.length === 0) {
    console.log('✅ Queue empty — nothing to sync');
    isSyncing = false;
    return { success: true, synced: 0, failed: 0 };
  }

  console.log(`📋 Syncing ${queue.length} queued operation(s)...`);

  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      await replayOperation(userId, entry);
      await dequeue(entry.id);
      synced++;

      if (onProgress) {
        onProgress({ synced, total: queue.length, current: entry });
      }

      console.log(`✅ Synced [${entry.type}] ${entry.collection}/${entry.docId || 'new'}`);
    } catch (error) {
      console.log(`❌ Failed to sync [${entry.type}] ${entry.collection}:`, error.message);
      await incrementRetry(entry.id);
      failed++;
    }
  }

  isSyncing = false;
  console.log(`🏁 Sync complete — ${synced} synced, ${failed} failed`);

  return { success: true, synced, failed };
};

// ============ REPLAY A SINGLE OPERATION ============
const replayOperation = async (userId, entry) => {
  const { type, collection: col, docId, data } = entry;

  // Base path for this user's subcollection
  const colRef = collection(db, 'users', userId, col);

  switch (type) {
    case OP.ADD: {
      if (docId) {
        // We know the intended docId (set by optimistic update)
        // Check if it already exists (e.g. duplicate sync attempt)
        const existing = await getDoc(doc(db, 'users', userId, col, docId));
        if (existing.exists()) {
          console.log(`⚠️ Document already exists — skipping ADD for ${col}/${docId}`);
          return;
        }
        await setDoc(doc(db, 'users', userId, col, docId), {
          ...data,
          _offlineSynced: true,
        });
      } else {
        await addDoc(colRef, {
          ...data,
          _offlineSynced: true,
        });
      }
      if (entry.accountUpdate?.accountId) {
        const { accountId, paymentMode, amount } = entry.accountUpdate;
        const amt = fromPaise(toPaise(amount));
        const accRef = doc(db, 'users', userId, 'accounts', accountId);
        if (paymentMode === 'CREDIT_CARD') {
          await updateDoc(accRef, {
            currentUsage: increment(amt),
            availableCredit: increment(-amt),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(accRef, {
            balance: increment(-amt),
            updatedAt: serverTimestamp(),
          });
        }
      }
      break;
    }

    case OP.UPDATE: {
      if (!docId) throw new Error('UPDATE requires docId');
      const docRef = doc(db, 'users', userId, col, docId);
      // Check if document exists before updating
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        console.log(`⚠️ Document not found — skipping UPDATE for ${col}/${docId}`);
        return;
      }
      await updateDoc(docRef, {
        ...data,
        _offlineSynced: true,
      });
      if (entry.oldData) {
        const oldData = entry.oldData;
        const oldAmt = fromPaise(toPaise(oldData.amount));
        const newAmt = fromPaise(toPaise(data?.amount));
        if (oldData.accountId) {
          const oldAccRef = doc(db, 'users', userId, 'accounts', oldData.accountId);
          if (oldData.paymentMode === 'CREDIT_CARD' || oldData.isCredit) {
            await updateDoc(oldAccRef, {
              currentUsage: increment(-oldAmt),
              availableCredit: increment(oldAmt),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(oldAccRef, {
              balance: increment(oldAmt),
              updatedAt: serverTimestamp(),
            });
          }
        }
        if (data?.accountId) {
          const newAccRef = doc(db, 'users', userId, 'accounts', data.accountId);
          if (data.paymentMode === 'CREDIT_CARD' || data.isCredit) {
            await updateDoc(newAccRef, {
              currentUsage: increment(newAmt),
              availableCredit: increment(-newAmt),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(newAccRef, {
              balance: increment(-newAmt),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
      break;
    }

    case OP.DELETE: {
      if (!docId) throw new Error('DELETE requires docId');
      const docRef = doc(db, 'users', userId, col, docId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        // Already deleted — not an error
        console.log(`⚠️ Document already gone — skipping DELETE for ${col}/${docId}`);
        return;
      }
      await deleteDoc(docRef);
      if (data?.accountId && data?.amount) {
        const amt = fromPaise(toPaise(data.amount));
        const accRef = doc(db, 'users', userId, 'accounts', data.accountId);
        if (data.paymentMode === 'CREDIT_CARD' || data.isCredit) {
          await updateDoc(accRef, {
            currentUsage: increment(-amt),
            availableCredit: increment(amt),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(accRef, {
            balance: increment(amt),
            updatedAt: serverTimestamp(),
          });
        }
      }
      break;
    }

    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
};

// ============ CHECK SYNC STATUS ============
export const getSyncStatus = async () => {
  const queue = await getQueue();
  return {
    pendingCount: queue.length,
    isSyncing,
    hasPending: queue.length > 0,
    oldestPending: queue.length > 0 ? queue[0].timestamp : null,
  };
};