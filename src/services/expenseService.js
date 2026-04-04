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
  try {
    const userId = getUserId();
    const online = await isOnline();

    const amount = parseFloat(expenseData.amount);
    const now = new Date().toISOString();

    // Build the expense object
    const expense = {
      amount,
      categoryId: expenseData.categoryId,
      categoryName: expenseData.categoryName,
      categoryIcon: expenseData.categoryIcon || '📦',
      accountId: expenseData.accountId || null,
      accountName: expenseData.accountName || 'Unknown',
      paymentMode: expenseData.paymentMode,
      note: expenseData.note?.trim() || '',
      date: new Date(expenseData.date).toISOString(),
      isCredit: expenseData.paymentMode === 'CREDIT_CARD',
      tags: expenseData.tags || [],
      createdAt: now,
      updatedAt: now,
      _pendingSync: !online, // mark if saved offline
    };

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

      // Update local cache with real Firestore data
      const realExpense = { ...expense, id: expenseRef.id, _pendingSync: false };
      await addToCache(COLLECTIONS.EXPENSES, realExpense);

      console.log('✅ Expense added online:', expenseRef.id);
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
          date: new Date(expenseData.date).toISOString(),
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

      console.log('📥 Expense queued offline:', tempId);
      return { success: true, id: tempId, offline: true };
    }
  } catch (error) {
    console.log('❌ Add expense error:', error);
    return { success: false, error: error.message };
  }
};

// ============ UPDATE EXPENSE ============
export const updateExpense = async (expenseId, newData, oldData) => {
  try {
    const userId = getUserId();
    const online = await isOnline();
    const now = new Date().toISOString();

    const amount = parseFloat(newData.amount);

    const updatedFields = {
      amount,
      categoryId: newData.categoryId,
      categoryName: newData.categoryName,
      categoryIcon: newData.categoryIcon || '📦',
      accountId: newData.accountId || null,
      accountName: newData.accountName || 'Unknown',
      paymentMode: newData.paymentMode,
      note: newData.note?.trim() || '',
      date: new Date(newData.date).toISOString(),
      isCredit: newData.paymentMode === 'CREDIT_CARD',
      updatedAt: now,
      _pendingSync: !online,
    };

    // Optimistically update local cache immediately
    await updateInCache(COLLECTIONS.EXPENSES, expenseId, updatedFields);

    if (online) {
      const batch = writeBatch(db);
      const expenseRef = doc(db, 'users', userId, 'expenses', expenseId);

      batch.update(expenseRef, {
        ...updatedFields,
        date: Timestamp.fromDate(new Date(newData.date)),
        updatedAt: serverTimestamp(),
        _pendingSync: false,
      });

      // Reverse old account impact
      if (oldData.accountId) {
        const oldAccRef = doc(db, 'users', userId, 'accounts', oldData.accountId);
        if (oldData.paymentMode === 'CREDIT_CARD' || oldData.isCredit) {
          batch.update(oldAccRef, {
            currentUsage: increment(-parseFloat(oldData.amount)),
            availableCredit: increment(parseFloat(oldData.amount)),
          });
        } else {
          batch.update(oldAccRef, { balance: increment(parseFloat(oldData.amount)) });
        }
      }

      // Apply new account impact
      if (newData.accountId) {
        const newAccRef = doc(db, 'users', userId, 'accounts', newData.accountId);
        if (newData.paymentMode === 'CREDIT_CARD') {
          batch.update(newAccRef, {
            currentUsage: increment(amount),
            availableCredit: increment(-amount),
          });
        } else {
          batch.update(newAccRef, { balance: increment(-amount) });
        }
      }

      await batch.commit();
      await updateInCache(COLLECTIONS.EXPENSES, expenseId, { _pendingSync: false });

      return { success: true, offline: false };
    } else {
      await enqueue({
        type: OP.UPDATE,
        collection: COLLECTIONS.EXPENSES,
        docId: expenseId,
        data: updatedFields,
        oldData: {
          accountId: oldData.accountId,
          paymentMode: oldData.paymentMode,
          amount: oldData.amount,
          isCredit: oldData.isCredit,
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
    const online = await isOnline();

    // Optimistically remove from cache immediately
    await removeFromCache(COLLECTIONS.EXPENSES, expenseId);

    if (online) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', userId, 'expenses', expenseId));

      // Restore account balance
      if (expenseData.accountId) {
        const accRef = doc(db, 'users', userId, 'accounts', expenseData.accountId);
        if (expenseData.paymentMode === 'CREDIT_CARD' || expenseData.isCredit) {
          batch.update(accRef, {
            currentUsage: increment(-parseFloat(expenseData.amount)),
            availableCredit: increment(parseFloat(expenseData.amount)),
          });
        } else {
          batch.update(accRef, { balance: increment(parseFloat(expenseData.amount)) });
        }
      }

      await batch.commit();
      return { success: true, offline: false };
    } else {
      await enqueue({
        type: OP.DELETE,
        collection: COLLECTIONS.EXPENSES,
        docId: expenseId,
        data: {
          accountId: expenseData.accountId,
          paymentMode: expenseData.paymentMode,
          amount: expenseData.amount,
          isCredit: expenseData.isCredit,
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

    // Last resort — try cache even if online fetch threw
    const { data } = await readFromCache(COLLECTIONS.EXPENSES);
    return {
      success: true,
      expenses: data || [],
      fromCache: true,
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

    const online = await isOnline();
    let incomes = [];

    if (online) {
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

    const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);

    const categoryMap = {};
    expenses.forEach((e) => {
      // Group by ID, but if it's 'other', group by name to keep distinct types separate
      // We must avoid duplicate 'id' fields in the final array to prevent React key errors
      const catId = e.categoryId || 'other';
      const key = catId !== 'other' ? catId : `other_${e.categoryName}`;
      
      if (!categoryMap[key]) {
        categoryMap[key] = { 
          id: key, // Use the unique key as ID for component mapping
          originalId: catId, 
          name: e.categoryName || 'Other', 
          icon: e.categoryIcon || '📦', 
          total: 0, 
          count: 0 
        };
      }
      categoryMap[key].total += e.amount || 0;
      categoryMap[key].count += 1;
    });

    const dailyMap = {};
    expenses.forEach((e) => {
      const day = e.date ? new Date(e.date).getDate() : 1;
      dailyMap[day] = (dailyMap[day] || 0) + (e.amount || 0);
    });

    const paymentMap = {};
    expenses.forEach((e) => {
      const mode = e.paymentMode || 'OTHER';
      paymentMap[mode] = (paymentMap[mode] || 0) + (e.amount || 0);
    });

    const sortedByAmount = [...expenses].sort((a, b) => b.amount - a.amount);

    return {
      success: true,
      fromCache: expResult.fromCache,
      data: {
        totalExpense,
        totalIncome,
        savings: totalIncome - totalExpense,
        expenseCount: expenses.length,
        categoryBreakdown: Object.values(categoryMap).sort((a, b) => b.total - a.total),
        dailyTotals: dailyMap,
        paymentBreakdown: paymentMap,
        recentExpenses: expenses.slice(0, 5),
        topExpense: sortedByAmount[0] || null,
      },
    };
  } catch (error) {
    console.log('❌ Dashboard data error:', error);
    return { success: false, error: error.message, data: null };
  }
};