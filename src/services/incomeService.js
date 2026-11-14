import {
    collection,
    doc,
    getDocs,
    increment,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    where,
    writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { logUserAction } from './activityLogService';
import {
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
  acquireIdempotencyLock,
  releaseIdempotencyLock,
  validateTransactionInput,
} from './transactionValidation';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

export const INCOME_SOURCES = [
  { id: 'salary', name: 'Salary', icon: '💼', color: '#10B981' },
  { id: 'freelance', name: 'Freelance', icon: '💻', color: '#6C63FF' },
  { id: 'business', name: 'Business', icon: '🏢', color: '#3B82F6' },
  { id: 'investment_return', name: 'Investment Returns', icon: '📈', color: '#8B5CF6' },
  { id: 'dividend', name: 'Dividend', icon: '💹', color: '#14B8A6' },
  { id: 'interest', name: 'Interest', icon: '🏦', color: '#0EA5E9' },
  { id: 'rental', name: 'Rental Income', icon: '🏠', color: '#F97316' },
  { id: 'gift', name: 'Gift Received', icon: '🎁', color: '#EC4899' },
  { id: 'cashback', name: 'Cashback / Reward', icon: '💸', color: '#F59E0B' },
  { id: 'refund', name: 'Refund', icon: '🔄', color: '#64748B' },
  { id: 'sold_item', name: 'Sold Item', icon: '🏷️', color: '#84CC16' },
  { id: 'bonus', name: 'Bonus', icon: '🎯', color: '#E11D48' },
  { id: 'other', name: 'Other', icon: '📦', color: '#9E9E9E' },
];

// ============ ADD INCOME ============
export const addIncome = async (incomeData) => {
  const idempotencyKey = incomeData?.idempotencyKey || null;
  const lock = acquireIdempotencyLock(idempotencyKey);
  if (!lock.acquired) {
    return {
      success: false,
      duplicate: true,
      existingId: lock.existingId,
      error: 'Duplicate income submission prevented.',
    };
  }

  let createdId = null;
  try {
    const userId = getUserId();

    if (isLocalMode()) {
      const accounts = await getLocalCollection(userId, LOCAL_COLLECTIONS.ACCOUNTS);
      const validation = validateTransactionInput(incomeData, {
        kind: TRANSACTION_TYPES.INCOME,
        accounts,
        requireAccount: Boolean(incomeData?.accountId),
      });
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      if (idempotencyKey) {
        const existingIncomes = await getLocalCollection(userId, LOCAL_COLLECTIONS.INCOMES);
        const dup = existingIncomes.find((i) => i.idempotencyKey === idempotencyKey);
        if (dup) {
          createdId = dup.id;
          return {
            success: false,
            duplicate: true,
            existingId: dup.id,
            error: 'Duplicate income submission prevented.',
          };
        }
      }

      const { amount, amountPaise, dateIso } = validation.normalized;

      const created = await addLocalDoc(userId, LOCAL_COLLECTIONS.INCOMES, {
        amount,
        transactionType: TRANSACTION_TYPES.INCOME,
        source: incomeData.source,
        sourceName: incomeData.sourceName || incomeData.source,
        sourceIcon: incomeData.sourceIcon || '📦',
        accountId: incomeData.accountId || null,
        accountName: incomeData.accountName || '',
        note: incomeData.note?.trim() || '',
        date: dateIso,
        paymentMode: incomeData.paymentMode || 'UPI',
        isRecurring: incomeData.isRecurring || false,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
      createdId = created.id;

      if (incomeData.accountId) {
        const acc = await getLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, incomeData.accountId);
        if (!acc) {
          await deleteLocalDoc(userId, LOCAL_COLLECTIONS.INCOMES, created.id);
          createdId = null;
          return { success: false, error: 'Referenced account does not exist.' };
        }
        const updatedAcc = await updateLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, incomeData.accountId, {
          balance: fromPaise(toPaise(acc.balance) + amountPaise),
        });
        if (!updatedAcc) {
          await deleteLocalDoc(userId, LOCAL_COLLECTIONS.INCOMES, created.id);
          createdId = null;
          return { success: false, error: 'Failed to update account balance.' };
        }
      }

      logUserAction({
        action: 'INCOME_ADD',
        entity: 'Transactions',
        summary: `Added income: ${incomeData.sourceName || incomeData.source || 'Income'} (${amount})`,
        previousState: {},
        nextState: created,
        explicitUserId: userId,
      });
      return { success: true, id: created.id };
    }

    const validation = validateTransactionInput(incomeData, {
      kind: TRANSACTION_TYPES.INCOME,
    });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    const { amount, dateIso } = validation.normalized;

    const batch = writeBatch(db);

    const incomeRef = doc(collection(db, 'users', userId, 'incomes'));

    batch.set(incomeRef, {
      amount,
      transactionType: TRANSACTION_TYPES.INCOME,
      source: incomeData.source,
      sourceName: incomeData.sourceName || incomeData.source,
      sourceIcon: incomeData.sourceIcon || '📦',
      accountId: incomeData.accountId,
      accountName: incomeData.accountName,
      note: incomeData.note?.trim() || '',
      date: Timestamp.fromDate(new Date(dateIso)),
      paymentMode: incomeData.paymentMode || 'UPI',
      isRecurring: incomeData.isRecurring || false,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Add to account balance
    if (incomeData.accountId) {
      const accRef = doc(db, 'users', userId, 'accounts', incomeData.accountId);
      batch.update(accRef, {
        balance: increment(amount),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    createdId = incomeRef.id;
    console.log('✅ Income added:', incomeRef.id);
    logUserAction({
      action: 'INCOME_ADD',
      entity: 'Transactions',
      summary: `Added income: ${incomeData.sourceName || incomeData.source || 'Income'} (${amount})`,
      previousState: {},
      nextState: { id: incomeRef.id, ...incomeData, amount },
      explicitUserId: userId,
    });
    return { success: true, id: incomeRef.id };
  } catch (error) {
    console.log('❌ Add income error:', error);
    return { success: false, error: error.message };
  } finally {
    releaseIdempotencyLock(idempotencyKey, createdId);
  }
};

// ============ GET INCOMES ============
export const getIncomes = async (filters = {}) => {
  try {
    const userId = getUserId();

    if (isLocalMode()) {
      let incomes = (await getLocalCollection(userId, LOCAL_COLLECTIONS.INCOMES)).map((i) => ({
        ...i,
        type: 'income',
      }));
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        incomes = incomes.filter((i) => i.date && new Date(i.date) >= start);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        incomes = incomes.filter((i) => i.date && new Date(i.date) <= end);
      }
      incomes.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        incomes = incomes.filter(
          (i) =>
            i.note?.toLowerCase().includes(search) ||
            i.sourceName?.toLowerCase().includes(search)
        );
      }
      if (filters.accountId) {
        incomes = incomes.filter((i) => i.accountId === filters.accountId);
      }
      if (filters.paymentMode) {
        incomes = incomes.filter((i) => i.paymentMode === filters.paymentMode);
      }
      if (filters.categoryId) {
        return { success: true, incomes: [] };
      }
      return { success: true, incomes };
    }

    let constraints = [];

    if (filters.startDate) {
      constraints.push(where('date', '>=', Timestamp.fromDate(new Date(filters.startDate))));
    }
    if (filters.endDate) {
      constraints.push(where('date', '<=', Timestamp.fromDate(new Date(filters.endDate))));
    }

    constraints.push(orderBy('date', 'desc'));

    const q = query(
      collection(db, 'users', userId, 'incomes'),
      ...constraints
    );

    const snapshot = await getDocs(q);
    let incomes = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        date: data.date?.toDate?.() ? data.date.toDate().toISOString() : data.date || null,
        type: 'income',
      };
    });

    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      incomes = incomes.filter(
        (i) =>
          i.note?.toLowerCase().includes(search) ||
          i.sourceName?.toLowerCase().includes(search)
      );
    }

    if (filters.accountId) {
      incomes = incomes.filter((i) => i.accountId === filters.accountId);
    }
    
    if (filters.paymentMode) {
      incomes = incomes.filter((i) => i.paymentMode === filters.paymentMode);
    }

    // If a category filter is active (expense category), incomes should be excluded
    if (filters.categoryId) {
      return { success: true, incomes: [] };
    }

    return { success: true, incomes };
  } catch (error) {
    console.log('❌ Get incomes error:', error);
    return { success: false, error: error.message, incomes: [] };
  }
};

// ============ GET ALL INCOMES ============
export const getAllIncomes = async () => {
  try {
    const userId = getUserId();

    if (isLocalMode()) {
      const items = await getLocalCollection(userId, LOCAL_COLLECTIONS.INCOMES);
      const incomes = items
        .map((i) => ({ ...i, date: i.date ? new Date(i.date) : null }))
        .sort((a, b) => (b.date || 0) - (a.date || 0));
      return { success: true, incomes };
    }

    const q = query(
      collection(db, 'users', userId, 'incomes'),
      orderBy('date', 'desc'),
    );

    const snapshot = await getDocs(q);
    const incomes = snapshot.docs.map(d => ({
      id: d.id, ...d.data(), date: d.data().date?.toDate(),
    }));

    return { success: true, incomes };
  } catch (error) {
    return { success: false, error: error.message, incomes: [] };
  }
};

// ============ UPDATE INCOME ============
export const updateIncome = async (incomeId, newData, oldData) => {
  try {
    const userId = getUserId();
    const localMode = isLocalMode();
    const accounts = localMode ? await getLocalCollection(userId, LOCAL_COLLECTIONS.ACCOUNTS) : null;
    const validation = validateTransactionInput(newData, {
      kind: TRANSACTION_TYPES.INCOME,
      accounts,
    });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { amount: newAmount, amountPaise: newPaise, dateIso } = validation.normalized;
    const oldPaise = toPaise(oldData?.amount || 0);

    const updatedFields = {
      amount: newAmount,
      transactionType: TRANSACTION_TYPES.INCOME,
      source: newData.source,
      sourceName: newData.sourceName || newData.source,
      sourceIcon: newData.sourceIcon || '📦',
      accountId: newData.accountId,
      accountName: newData.accountName,
      note: newData.note?.trim() || '',
      date: dateIso,
      paymentMode: newData.paymentMode || 'UPI',
      updatedAt: new Date().toISOString(),
    };

    if (localMode) {
      const existingIncome = await getLocalDoc(userId, LOCAL_COLLECTIONS.INCOMES, incomeId);
      if (!existingIncome) {
        return { success: false, error: 'Income record not found.' };
      }

      const prevAccountId = oldData?.accountId ?? existingIncome.accountId;
      const prevPaise = oldData?.amount !== undefined ? oldPaise : toPaise(existingIncome.amount);

      const updatedDoc = await updateLocalDoc(userId, LOCAL_COLLECTIONS.INCOMES, incomeId, updatedFields);
      if (!updatedDoc) {
        return { success: false, error: 'Failed to update income record.' };
      }

      if (prevAccountId && prevAccountId === newData.accountId) {
        const diffPaise = newPaise - prevPaise;
        if (diffPaise !== 0) {
          const acc = await getLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, prevAccountId);
          if (acc) {
            await updateLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, prevAccountId, {
              balance: fromPaise(toPaise(acc.balance) + diffPaise),
            });
          }
        }
      } else {
        if (prevAccountId) {
          const oldAcc = await getLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, prevAccountId);
          if (oldAcc) {
            await updateLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, prevAccountId, {
              balance: fromPaise(toPaise(oldAcc.balance) - prevPaise),
            });
          }
        }
        if (newData.accountId) {
          const newAcc = await getLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, newData.accountId);
          if (newAcc) {
            await updateLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, newData.accountId, {
              balance: fromPaise(toPaise(newAcc.balance) + newPaise),
            });
          }
        }
      }

      logUserAction({
        action: 'INCOME_UPDATE',
        entity: 'Transactions',
        summary: `Updated income: ${updatedFields.sourceName} (${newAmount})`,
        previousState: oldData || existingIncome,
        nextState: updatedFields,
        explicitUserId: userId,
      });
      return { success: true };
    }

    const batch = writeBatch(db);
    const incomeRef = doc(db, 'users', userId, 'incomes', incomeId);
    batch.update(incomeRef, {
      ...updatedFields,
      date: Timestamp.fromDate(new Date(dateIso)),
      updatedAt: serverTimestamp(),
    });

    if (oldData?.accountId && oldData.accountId === newData.accountId) {
      const diff = fromPaise(newPaise - oldPaise);
      if (diff !== 0) {
        batch.update(doc(db, 'users', userId, 'accounts', newData.accountId), {
          balance: increment(diff),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      if (oldData?.accountId) {
        batch.update(doc(db, 'users', userId, 'accounts', oldData.accountId), {
          balance: increment(fromPaise(-oldPaise)),
          updatedAt: serverTimestamp(),
        });
      }
      if (newData.accountId) {
        batch.update(doc(db, 'users', userId, 'accounts', newData.accountId), {
          balance: increment(newAmount),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
    logUserAction({
      action: 'INCOME_UPDATE',
      entity: 'Transactions',
      summary: `Updated income: ${updatedFields.sourceName} (${newAmount})`,
      previousState: oldData || { id: incomeId },
      nextState: updatedFields,
      explicitUserId: userId,
    });
    return { success: true };
  } catch (error) {
    console.log('❌ Update income error:', error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE INCOME ============
export const deleteIncome = async (incomeId, incomeData) => {
  try {
    const userId = getUserId();

    if (isLocalMode()) {
      const existing = await getLocalDoc(userId, LOCAL_COLLECTIONS.INCOMES, incomeId);
      if (!existing) {
        return { success: false, error: 'Income record not found.' };
      }
      const deleted = await deleteLocalDoc(userId, LOCAL_COLLECTIONS.INCOMES, incomeId);
      if (!deleted) {
        return { success: false, error: 'Failed to delete income record.' };
      }
      const accountId = incomeData?.accountId ?? existing.accountId;
      const amtPaise = toPaise(incomeData?.amount ?? existing.amount);
      if (accountId && amtPaise > 0) {
        const acc = await getLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, accountId);
        if (acc) {
          await updateLocalDoc(userId, LOCAL_COLLECTIONS.ACCOUNTS, accountId, {
            balance: fromPaise(toPaise(acc.balance) - amtPaise),
          });
        }
      }
      logUserAction({
        action: 'INCOME_DELETE',
        entity: 'Transactions',
        summary: `Deleted income: ${incomeData?.sourceName || existing.sourceName || 'Income'}`,
        previousState: incomeData || existing,
        nextState: {},
        explicitUserId: userId,
      });
      return { success: true };
    }

    const batch = writeBatch(db);

    batch.delete(doc(db, 'users', userId, 'incomes', incomeId));

    // Reverse account balance
    if (incomeData?.accountId) {
      batch.update(doc(db, 'users', userId, 'accounts', incomeData.accountId), {
        balance: increment(fromPaise(-toPaise(incomeData.amount))),
      });
    }

    await batch.commit();
    logUserAction({
      action: 'INCOME_DELETE',
      entity: 'Transactions',
      summary: `Deleted income: ${incomeData?.sourceName || incomeData?.source || 'Income'}`,
      previousState: incomeData || { id: incomeId },
      nextState: {},
      explicitUserId: userId,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};