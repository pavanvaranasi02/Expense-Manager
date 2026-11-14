import NetInfo from '@react-native-community/netinfo';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    where,
    writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { logUserAction } from './activityLogService';
import {
    calculateCashFlowSummary,
    calculateCategorySpending,
    fromPaise,
    toPaise,
    TRANSACTION_TYPES,
} from './financialCalculationService';
import {
    addLocalDoc,
    deleteLocalDoc,
    getLocalCollection,
    getLocalDoc,
    isLocalMode,
    LOCAL_COLLECTIONS,
    updateLocalDoc,
} from './localStorageService';
import {
    addToCache,
    COLLECTIONS,
    enqueue,
    OP,
    readFromCache,
    removeFromCache,
    saveToCache,
    updateInCache,
} from './offlineQueue';
import {
    acquireIdempotencyLock,
    releaseIdempotencyLock,
    validateTransactionInput,
} from './transactionValidation';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

// Check if we have internet
const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
};

const adjustLocalAccountForExpense = async (userId, accountId, paymentMode, isCredit, deltaPaise) => {
  if (!accountId || deltaPaise === 0) return { success: true };
  const acc = await getLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, accountId);
  if (!acc) return { success: false, error: 'Referenced account does not exist.' };
  if (paymentMode === 'CREDIT_CARD' || isCredit || acc.type === 'CREDIT_CARD') {
    const nextUsagePaise = toPaise(acc.currentUsage) + deltaPaise;
    const nextAvailPaise = Math.max(0, toPaise(acc.creditLimit) - nextUsagePaise);
    const updated = await updateLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, accountId, {
      currentUsage: fromPaise(nextUsagePaise),
      availableCredit: fromPaise(nextAvailPaise),
    });
    return updated ? { success: true } : { success: false, error: 'Failed to update credit card balance.' };
  } else {
    const updated = await updateLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, accountId, {
      balance: fromPaise(toPaise(acc.balance) - deltaPaise),
    });
    return updated ? { success: true } : { success: false, error: 'Failed to update account balance.' };
  }
};

// ── Serialize dates so they are safe for navigation params & AsyncStorage ──
export const serializeExpense = (expense) => {
  if (!expense) return expense;
  return {
    ...expense,
    date: expense.date instanceof Date
      ? expense.date.toISOString()
      : expense.date?.toDate?.()
        ? expense.date.toDate().toISOString()
        : expense.date || null,
    createdAt: expense.createdAt?.toDate?.()
      ? expense.createdAt.toDate().toISOString()
      : expense.createdAt instanceof Date
        ? expense.createdAt.toISOString()
        : expense.createdAt || null,
    updatedAt: expense.updatedAt?.toDate?.()
      ? expense.updatedAt.toDate().toISOString()
      : expense.updatedAt instanceof Date
        ? expense.updatedAt.toISOString()
        : expense.updatedAt || null,
  };
};

// ============ ADD EXPENSE ============
export const addExpense = async (expenseData) => {
  const idempotencyKey = expenseData?.idempotencyKey || null;
  const lock = acquireIdempotencyLock(idempotencyKey);
  if (!lock.acquired) {
    return {
      success: false,
      duplicate: true,
      existingId: lock.existingId,
      error: 'Duplicate expense submission prevented.',
    };
  }

  let createdId = null;
  try {
    const userId = getUserId();
    const localMode = isLocalMode();
    const online = localMode ? false : await isOnline();

    const accounts = localMode
      ? await getLocalCollection(userId, LOCAL_COLLECTIONS.ACCOUNTS)
      : null;

    const kind = expenseData?.isTransfer
      ? TRANSACTION_TYPES.TRANSFER
      : TRANSACTION_TYPES.EXPENSE;
    const validation = validateTransactionInput(expenseData, {
      kind,
      accounts,
    });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { amount, amountPaise, dateIso, transactionType } = validation.normalized;
    const now = new Date().toISOString();

    if (localMode && idempotencyKey) {
      const existingExpenses = await getLocalCollection(userId, LOCAL_COLLECTIONS.EXPENSES);
      const dup = existingExpenses.find((e) => e.idempotencyKey === idempotencyKey);
      if (dup) {
        createdId = dup.id;
        return {
          success: false,
          duplicate: true,
          existingId: dup.id,
          error: 'Duplicate expense submission prevented.',
        };
      }
    }

    // Build the expense object
    const expense = {
      amount,
      transactionType,
      isTransfer: Boolean(expenseData.isTransfer || transactionType === TRANSACTION_TYPES.TRANSFER),
      categoryId: expenseData.categoryId,
      categoryName: expenseData.categoryName,
      categoryIcon: expenseData.categoryIcon || '📦',
      accountId: expenseData.accountId || null,
      accountName: expenseData.accountName || 'Unknown',
      paymentMode: expenseData.paymentMode,
      note: expenseData.note?.trim() || '',
      date: dateIso,
      isCredit: expenseData.paymentMode === 'CREDIT_CARD',
      tags: expenseData.tags || [],
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: now,
      updatedAt: now,
      _pendingSync: localMode ? false : !online, // mark if saved offline
    };

    if (localMode) {
      const created = await addLocalDoc(userId, LOCAL_COLLECTIONS.EXPENSES, expense);
      createdId = created.id;
      if (expenseData.accountId) {
        const adj = await adjustLocalAccountForExpense(
          userId,
          expenseData.accountId,
          expenseData.paymentMode,
          expense.isCredit,
          amountPaise
        );
        if (!adj.success) {
          await deleteLocalDoc(userId, LOCAL_COLLECTIONS.EXPENSES, created.id);
          createdId = null;
          return { success: false, error: adj.error };
        }
      }
      logUserAction({
        action: 'EXPENSE_ADD',
        entity: 'Transactions',
        summary: `Added expense: ${expenseData.categoryName || 'Expense'} (${amount})`,
        previousState: {},
        nextState: created,
        explicitUserId: userId,
      });
      return { success: true, id: created.id, offline: false };
    }

    // Generate a temporary local ID
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const localExpense = { id: tempId, ...expense };

    if (online) {
      // ── ONLINE: write to Firestore ──────────────────
      const batch = writeBatch(db);
      const expenseRef = doc(collection(db, 'users', userId, 'expenses'));

      batch.set(expenseRef, {
        ...expense,
        date: Timestamp.fromDate(new Date(expense.date)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        _pendingSync: false,
      });

      // Update account balance
      if (expenseData.accountId) {
        const accRef = doc(db, 'users', userId, 'accounts', expenseData.accountId);
        if (expenseData.paymentMode === 'CREDIT_CARD') {
          batch.update(accRef, {
            currentUsage: increment(amount),
            availableCredit: increment(-amount),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(accRef, {
            balance: increment(-amount),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      createdId = expenseRef.id;

      // Update local cache with real Firestore data
      const realExpense = { ...expense, id: expenseRef.id, _pendingSync: false };
      await addToCache(COLLECTIONS.EXPENSES, realExpense);

      console.log('✅ Expense added online:', expenseRef.id);
      logUserAction({
        action: 'EXPENSE_ADD',
        entity: 'Transactions',
        summary: `Added expense: ${expenseData.categoryName || 'Expense'} (${amount})`,
        previousState: {},
        nextState: realExpense,
        explicitUserId: userId,
      });
      return { success: true, id: expenseRef.id, offline: false };

    } else {
      // ── OFFLINE: save to cache + queue ──────────────
      await addToCache(COLLECTIONS.EXPENSES, localExpense);

      await enqueue({
        type: OP.ADD,
        collection: COLLECTIONS.EXPENSES,
        docId: tempId,
        data: {
          ...expense,
          // Store as ISO strings — Firestore SDK will handle Timestamps on sync
          date: dateIso,
        },
        // Also queue account balance update as a separate operation
        accountUpdate: expenseData.accountId
          ? {
              accountId: expenseData.accountId,
              paymentMode: expenseData.paymentMode,
              amount,
            }
          : null,
      });
      createdId = tempId;

      console.log('📥 Expense queued offline:', tempId);
      return { success: true, id: tempId, offline: true };
    }
  } catch (error) {
    console.log('❌ Add expense error:', error);
    return { success: false, error: error.message };
  } finally {
    releaseIdempotencyLock(idempotencyKey, createdId);
  }
};

// ============ UPDATE EXPENSE ============
export const updateExpense = async (expenseId, newData, oldData) => {
  try {
    const userId = getUserId();
    const localMode = isLocalMode();
    const online = localMode ? false : await isOnline();
    const now = new Date().toISOString();

    const accounts = localMode
      ? await getLocalCollection(userId, LOCAL_COLLECTIONS.ACCOUNTS)
      : null;

    const kind = newData?.isTransfer
      ? TRANSACTION_TYPES.TRANSFER
      : TRANSACTION_TYPES.EXPENSE;
    const validation = validateTransactionInput(newData, {
      kind,
      accounts,
    });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { amount, amountPaise: newPaise, dateIso, transactionType } = validation.normalized;

    const updatedFields = {
      amount,
      transactionType,
      isTransfer: Boolean(newData.isTransfer || transactionType === TRANSACTION_TYPES.TRANSFER),
      categoryId: newData.categoryId,
      categoryName: newData.categoryName,
      categoryIcon: newData.categoryIcon || '📦',
      accountId: newData.accountId || null,
      accountName: newData.accountName || 'Unknown',
      paymentMode: newData.paymentMode,
      note: newData.note?.trim() || '',
      date: dateIso,
      isCredit: newData.paymentMode === 'CREDIT_CARD',
      updatedAt: now,
      _pendingSync: localMode ? false : !online,
    };

    if (localMode) {
      const existing = await getLocalDoc(userId, LOCAL_COLLECTIONS.EXPENSES, expenseId);
      if (!existing) {
        return { success: false, error: 'Expense record not found.' };
      }

      const prevAccountId = oldData?.accountId ?? existing.accountId;
      const prevPaymentMode = oldData?.paymentMode ?? existing.paymentMode;
      const prevIsCredit = oldData?.isCredit ?? existing.isCredit;
      const prevPaise = toPaise(oldData?.amount ?? existing.amount);

      const updatedDoc = await updateLocalDoc(userId, LOCAL_COLLECTIONS.EXPENSES, expenseId, updatedFields);
      if (!updatedDoc) {
        return { success: false, error: 'Failed to update expense record.' };
      }

      if (prevAccountId) {
        await adjustLocalAccountForExpense(
          userId,
          prevAccountId,
          prevPaymentMode,
          prevIsCredit,
          -prevPaise
        );
      }
      if (newData.accountId) {
        await adjustLocalAccountForExpense(
          userId,
          newData.accountId,
          newData.paymentMode,
          newData.paymentMode === 'CREDIT_CARD',
          newPaise
        );
      }
      logUserAction({
        action: 'EXPENSE_UPDATE',
        entity: 'Transactions',
        summary: `Updated expense: ${newData.categoryName || existing.categoryName || 'Expense'}`,
        previousState: oldData || existing,
        nextState: updatedFields,
        explicitUserId: userId,
      });
      return { success: true, offline: false };
    }

    // Optimistically update local cache immediately
    await updateInCache(COLLECTIONS.EXPENSES, expenseId, updatedFields);

    if (online) {
      const batch = writeBatch(db);
      const expenseRef = doc(db, 'users', userId, 'expenses', expenseId);

      batch.update(expenseRef, {
        ...updatedFields,
        date: Timestamp.fromDate(new Date(dateIso)),
        updatedAt: serverTimestamp(),
        _pendingSync: false,
      });

      const oldPaise = toPaise(oldData?.amount || 0);
      const oldIsCredit = oldData?.paymentMode === 'CREDIT_CARD' || Boolean(oldData?.isCredit);
      const newIsCredit = newData.paymentMode === 'CREDIT_CARD';

      if (
        oldData?.accountId &&
        oldData.accountId === newData.accountId &&
        oldIsCredit === newIsCredit
      ) {
        const diff = fromPaise(newPaise - oldPaise);
        if (diff !== 0) {
          const accRef = doc(db, 'users', userId, 'accounts', newData.accountId);
          if (newIsCredit) {
            batch.update(accRef, {
              currentUsage: increment(diff),
              availableCredit: increment(-diff),
            });
          } else {
            batch.update(accRef, { balance: increment(-diff) });
          }
        }
      } else {
        // Reverse old account impact
        if (oldData?.accountId) {
          const oldAccRef = doc(db, 'users', userId, 'accounts', oldData.accountId);
          const oldAmt = fromPaise(oldPaise);
          if (oldIsCredit) {
            batch.update(oldAccRef, {
              currentUsage: increment(-oldAmt),
              availableCredit: increment(oldAmt),
            });
          } else {
            batch.update(oldAccRef, { balance: increment(oldAmt) });
          }
        }

        // Apply new account impact
        if (newData.accountId) {
          const newAccRef = doc(db, 'users', userId, 'accounts', newData.accountId);
          if (newIsCredit) {
            batch.update(newAccRef, {
              currentUsage: increment(amount),
              availableCredit: increment(-amount),
            });
          } else {
            batch.update(newAccRef, { balance: increment(-amount) });
          }
        }
      }

      await batch.commit();
      await updateInCache(COLLECTIONS.EXPENSES, expenseId, { _pendingSync: false });
      logUserAction({
        action: 'EXPENSE_UPDATE',
        entity: 'Transactions',
        summary: `Updated expense: ${newData.categoryName || oldData?.categoryName || 'Expense'}`,
        previousState: oldData || {},
        nextState: updatedFields,
        explicitUserId: userId,
      });

      return { success: true, offline: false };
    } else {
      await enqueue({
        type: OP.UPDATE,
        collection: COLLECTIONS.EXPENSES,
        docId: expenseId,
        data: updatedFields,
        oldData: {
          accountId: oldData?.accountId,
          paymentMode: oldData?.paymentMode,
          amount: oldData?.amount,
          isCredit: oldData?.isCredit,
        },
      });

      console.log('📥 Expense update queued offline:', expenseId);
      return { success: true, offline: true };
    }
  } catch (error) {
    console.log('❌ Update expense error:', error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE EXPENSE ============
export const deleteExpense = async (expenseId, expenseData) => {
  try {
    const userId = getUserId();
    if (isLocalMode()) {
      const existing = await getLocalDoc(userId, LOCAL_COLLECTIONS.EXPENSES, expenseId);
      if (!existing) {
        return { success: false, error: 'Expense record not found.' };
      }
      const deleted = await deleteLocalDoc(userId, LOCAL_COLLECTIONS.EXPENSES, expenseId);
      if (!deleted) {
        return { success: false, error: 'Failed to delete expense record.' };
      }
      const accountId = expenseData?.accountId ?? existing.accountId;
      const paymentMode = expenseData?.paymentMode ?? existing.paymentMode;
      const isCredit = expenseData?.isCredit ?? existing.isCredit;
      const amtPaise = toPaise(expenseData?.amount ?? existing.amount);
      if (accountId && amtPaise > 0) {
        await adjustLocalAccountForExpense(
          userId,
          accountId,
          paymentMode,
          isCredit,
          -amtPaise
        );
      }
      logUserAction({
        action: 'EXPENSE_DELETE',
        entity: 'Transactions',
        summary: `Deleted expense: ${expenseData?.categoryName || existing.categoryName || 'Expense'}`,
        previousState: expenseData || existing,
        nextState: {},
        explicitUserId: userId,
      });
      return { success: true, offline: false };
    }
    const online = await isOnline();

    // Optimistically remove from cache immediately
    await removeFromCache(COLLECTIONS.EXPENSES, expenseId);

    if (online) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', userId, 'expenses', expenseId));

      // Restore account balance
      if (expenseData?.accountId) {
        const amt = fromPaise(toPaise(expenseData.amount));
        const accRef = doc(db, 'users', userId, 'accounts', expenseData.accountId);
        if (expenseData.paymentMode === 'CREDIT_CARD' || expenseData.isCredit) {
          batch.update(accRef, {
            currentUsage: increment(-amt),
            availableCredit: increment(amt),
          });
        } else {
          batch.update(accRef, { balance: increment(amt) });
        }
      }

      await batch.commit();
      logUserAction({
        action: 'EXPENSE_DELETE',
        entity: 'Transactions',
        summary: `Deleted expense: ${expenseData?.categoryName || 'Expense'}`,
        previousState: expenseData || {},
        nextState: {},
        explicitUserId: userId,
      });
      return { success: true, offline: false };
    } else {
      await enqueue({
        type: OP.DELETE,
        collection: COLLECTIONS.EXPENSES,
        docId: expenseId,
        data: {
          accountId: expenseData?.accountId,
          paymentMode: expenseData?.paymentMode,
          amount: expenseData?.amount,
          isCredit: expenseData?.isCredit,
        },
      });

      console.log('📥 Expense delete queued offline:', expenseId);
      return { success: true, offline: true };
    }
  } catch (error) {
    console.log('❌ Delete expense error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET EXPENSES (cache-first) ============
export const getExpenses = async (filters = {}) => {
  try {
    const userId = getUserId();

    if (isLocalMode()) {
      let expenses = await getLocalCollection(userId, LOCAL_COLLECTIONS.EXPENSES);
      if (filters.startDate) {
        expenses = expenses.filter((e) => e.date && new Date(e.date) >= new Date(filters.startDate));
      }
      if (filters.endDate) {
        expenses = expenses.filter((e) => e.date && new Date(e.date) <= new Date(filters.endDate));
      }
      if (filters.categoryId) {
        expenses = expenses.filter((e) => e.categoryId === filters.categoryId);
      }
      if (filters.paymentMode) {
        expenses = expenses.filter((e) => e.paymentMode === filters.paymentMode);
      }
      if (filters.accountId) {
        expenses = expenses.filter((e) => e.accountId === filters.accountId);
      }
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        expenses = expenses.filter(
          (e) =>
            e.note?.toLowerCase().includes(search) ||
            e.categoryName?.toLowerCase().includes(search)
        );
      }
      expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { success: true, expenses, fromCache: false };
    }

    const online = await isOnline();

    if (online) {
      // ── ONLINE: fetch from Firestore + refresh cache ──
      let constraints = [];

      if (filters.startDate) {
        constraints.push(where('date', '>=', Timestamp.fromDate(new Date(filters.startDate))));
      }
      if (filters.endDate) {
        constraints.push(where('date', '<=', Timestamp.fromDate(new Date(filters.endDate))));
      }
      constraints.push(orderBy('date', 'desc'));

      const q = query(
        collection(db, 'users', userId, 'expenses'),
        ...constraints
      );

      const snapshot = await getDocs(q);
      let expenses = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          date: data.date?.toDate?.() ? data.date.toDate().toISOString() : data.date || null,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt || null,
          updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt || null,
        };
      });

      // Apply client-side filters on ALL fetched data
      let filteredExpenses = expenses;
      
      if (filters.categoryId) {
        filteredExpenses = filteredExpenses.filter((e) => e.categoryId === filters.categoryId);
      }
      if (filters.paymentMode) {
        filteredExpenses = filteredExpenses.filter((e) => e.paymentMode === filters.paymentMode);
      }
      if (filters.accountId) {
        filteredExpenses = filteredExpenses.filter((e) => e.accountId === filters.accountId);
      }
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        filteredExpenses = filteredExpenses.filter(
          (e) =>
            e.note?.toLowerCase().includes(search) ||
            e.categoryName?.toLowerCase().includes(search)
        );
      }

      // Save full unfiltered result to cache for offline use (only if no specific filters that restrict fetch)
      if (!filters.startDate && !filters.endDate && !filters.categoryId) {
        await saveToCache(COLLECTIONS.EXPENSES, expenses);
      }

      return { success: true, expenses: filteredExpenses, fromCache: false };

    } else {
      // ── OFFLINE: serve from cache ──────────────────
      const { data, cachedAt } = await readFromCache(COLLECTIONS.EXPENSES);
      let expenses = data || [];

      // Apply date filters client-side on cached data
      if (filters.startDate) {
        expenses = expenses.filter((e) =>
          e.date && new Date(e.date) >= new Date(filters.startDate)
        );
      }
      if (filters.endDate) {
        expenses = expenses.filter((e) =>
          e.date && new Date(e.date) <= new Date(filters.endDate)
        );
      }
      if (filters.categoryId) {
        expenses = expenses.filter((e) => e.categoryId === filters.categoryId);
      }
      if (filters.paymentMode) {
        expenses = expenses.filter((e) => e.paymentMode === filters.paymentMode);
      }
      if (filters.accountId) {
        expenses = expenses.filter((e) => e.accountId === filters.accountId);
      }
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        expenses = expenses.filter(
          (e) =>
            e.note?.toLowerCase().includes(search) ||
            e.categoryName?.toLowerCase().includes(search)
        );
      }

      // Sort by date desc
      expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log(`📦 Serving ${expenses.length} expenses from cache (cached at ${cachedAt})`);
      return { success: true, expenses, fromCache: true, cachedAt };
    }
  } catch (error) {
    console.log('❌ Get expenses error:', error);

    const { data } = await readFromCache(COLLECTIONS.EXPENSES);
    return {
      success: false,
      expenses: data || [],
      fromCache: Boolean(data),
      error: error.message,
    };
  }
};

// ── Keep remaining functions unchanged ──────────────────

export const getMonthlyExpenses = async (month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return getExpenses({ startDate, endDate });
};

export const getExpense = async (expenseId) => {
  try {
    const userId = getUserId();
    if (isLocalMode()) {
      const found = await getLocalDoc(userId, LOCAL_COLLECTIONS.EXPENSES, expenseId);
      if (found) return { success: true, expense: found, fromCache: false };
      return { success: false, error: 'Expense not found' };
    }
    const online = await isOnline();

    if (online) {
      const docSnap = await getDoc(doc(db, 'users', userId, 'expenses', expenseId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          success: true,
          expense: {
            id: docSnap.id,
            ...data,
            date: data.date?.toDate?.() ? data.date.toDate().toISOString() : data.date || null,
          },
        };
      }
      return { success: false, error: 'Expense not found' };
    } else {
      // Find in cache
      const { data } = await readFromCache(COLLECTIONS.EXPENSES);
      const found = (data || []).find((e) => e.id === expenseId);
      if (found) return { success: true, expense: found, fromCache: true };
      return { success: false, error: 'Expense not found in cache' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getDashboardData = async (month, year) => {
  try {
    const userId = getUserId();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const expResult = await getExpenses({ startDate, endDate });
    const expenses = expResult.expenses || [];

    const localMode = isLocalMode();
    const online = localMode ? false : await isOnline();
    let incomes = [];

    if (localMode) {
      const allIncomes = await getLocalCollection(userId, LOCAL_COLLECTIONS.INCOMES);
      incomes = allIncomes.filter((i) => {
        const d = new Date(i.date);
        return d >= startDate && d <= endDate;
      });
    } else if (online) {
      const { getDocs: _getDocs, collection: _col, query: _q, where: _where } = await import('firebase/firestore');
      const incomeQuery = query(
        collection(db, 'users', userId, 'incomes'),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
      const incomeSnap = await getDocs(incomeQuery);
      incomes = incomeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      const { data } = await readFromCache(COLLECTIONS.INCOMES);
      incomes = (data || []).filter((i) => {
        const d = new Date(i.date);
        return d >= startDate && d <= endDate;
      });
    }

    const taggedExpenses = expenses.map((e) => ({
      ...e,
      type: e.isTransfer || e.transactionType === TRANSACTION_TYPES.TRANSFER
        ? TRANSACTION_TYPES.TRANSFER
        : TRANSACTION_TYPES.EXPENSE,
    }));
    const taggedIncomes = incomes.map((i) => ({
      ...i,
      type: TRANSACTION_TYPES.INCOME,
    }));

    const cashFlow = calculateCashFlowSummary([...taggedExpenses, ...taggedIncomes]);
    const categoryBreakdown = calculateCategorySpending(taggedExpenses);

    const dailyMap = {};
    for (const e of taggedExpenses) {
      if (e.type === TRANSACTION_TYPES.TRANSFER) continue;
      const day = e.date ? new Date(e.date).getDate() : 1;
      dailyMap[day] = fromPaise(toPaise(dailyMap[day] || 0) + toPaise(e.amount));
    }

    const paymentMap = {};
    for (const e of taggedExpenses) {
      if (e.type === TRANSACTION_TYPES.TRANSFER) continue;
      const mode = e.paymentMode || 'OTHER';
      paymentMap[mode] = fromPaise(toPaise(paymentMap[mode] || 0) + toPaise(e.amount));
    }

    const nonTransferExpenses = taggedExpenses.filter(
      (e) => e.type !== TRANSACTION_TYPES.TRANSFER
    );
    const sortedByAmount = [...nonTransferExpenses].sort((a, b) => b.amount - a.amount);

    return {
      success: true,
      fromCache: expResult.fromCache,
      data: {
        totalExpense: cashFlow.totalExpenses,
        totalIncome: cashFlow.totalIncome,
        savings: cashFlow.netCashFlow,
        expenseCount: cashFlow.expenseCount,
        categoryBreakdown,
        dailyTotals: dailyMap,
        paymentBreakdown: paymentMap,
        recentExpenses: taggedExpenses.slice(0, 5),
        topExpense: sortedByAmount[0] || null,
      },
    };
  } catch (error) {
    console.log('❌ Dashboard data error:', error);
    return { success: false, error: error.message, data: null };
  }
};