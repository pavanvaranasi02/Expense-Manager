import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  addLocalDoc,
  deleteLocalDoc,
  getLocalCollection,
  isLocalMode,
  LOCAL_COLLECTIONS,
  updateLocalDoc,
} from './localStorageService';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

// ============ SAVE SINGLE BUDGET ============
export const saveBudget = async (budgetData) => {
  try {
    const userId = getUserId();

    const data = {
      type: budgetData.categoryId === 'overall' ? 'OVERALL' : 'CATEGORY',
      categoryId: budgetData.categoryId,
      categoryName: budgetData.categoryName,
      amount: parseFloat(budgetData.amount) || 0,
      month: budgetData.month,
      year: budgetData.year,
      alertAt: parseInt(budgetData.alertAt) || 80,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (isLocalMode()) {
      const created = await addLocalDoc(userId, LOCAL_COLLECTIONS.BUDGETS, {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { success: true, id: created.id, budget: created };
    }

    const docRef = await addDoc(collection(db, 'users', userId, 'budgets'), data);
    console.log('✅ Budget saved:', docRef.id);
    return { success: true, id: docRef.id, budget: { id: docRef.id, ...data } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ SAVE MULTIPLE BUDGETS ============
export const saveBudgets = async (budgets, month, year) => {
  try {
    const userId = getUserId();
    const results = [];

    for (const budget of budgets) {
      if (!budget.amount || parseFloat(budget.amount) <= 0) continue;

      const data = {
        type: budget.categoryId === 'overall' ? 'OVERALL' : 'CATEGORY',
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        amount: parseFloat(budget.amount),
        month,
        year,
        alertAt: 80,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isLocalMode()) {
        const created = await addLocalDoc(userId, LOCAL_COLLECTIONS.BUDGETS, {
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        results.push(created);
      } else {
        const docRef = await addDoc(collection(db, 'users', userId, 'budgets'), data);
        results.push({ id: docRef.id, ...data });
      }
    }

    return { success: true, budgets: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ GET BUDGETS FOR MONTH ============
export const getBudgets = async (month, year) => {
  try {
    const userId = getUserId();

    if (isLocalMode()) {
      const all = await getLocalCollection(userId, LOCAL_COLLECTIONS.BUDGETS);
      const budgets = all.filter((b) => b.month === month && b.year === year);
      return { success: true, budgets };
    }

    const q = query(
      collection(db, 'users', userId, 'budgets'),
      where('month', '==', month),
      where('year', '==', year)
    );

    const snapshot = await getDocs(q);
    const budgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { success: true, budgets };
  } catch (error) {
    return { success: false, error: error.message, budgets: [] };
  }
};

// ============ GET ALL BUDGETS (all months) ============
export const getAllBudgets = async () => {
  try {
    const userId = getUserId();

    if (isLocalMode()) {
      const budgets = await getLocalCollection(userId, LOCAL_COLLECTIONS.BUDGETS);
      return { success: true, budgets };
    }

    const snapshot = await getDocs(collection(db, 'users', userId, 'budgets'));
    const budgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { success: true, budgets };
  } catch (error) {
    return { success: false, error: error.message, budgets: [] };
  }
};

// ============ UPDATE BUDGET ============
export const updateBudget = async (budgetId, data) => {
  try {
    const userId = getUserId();
    if (isLocalMode()) {
      await updateLocalDoc(userId, LOCAL_COLLECTIONS.BUDGETS, budgetId, {
        amount: parseFloat(data.amount),
        alertAt: parseInt(data.alertAt) || 80,
      });
      return { success: true };
    }
    await updateDoc(doc(db, 'users', userId, 'budgets', budgetId), {
      amount: parseFloat(data.amount),
      alertAt: parseInt(data.alertAt) || 80,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ DELETE BUDGET ============
export const deleteBudget = async (budgetId) => {
  try {
    const userId = getUserId();
    if (isLocalMode()) {
      await deleteLocalDoc(userId, LOCAL_COLLECTIONS.BUDGETS, budgetId);
      return { success: true };
    }
    await deleteDoc(doc(db, 'users', userId, 'budgets', budgetId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};