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
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    const incomeRef = doc(collection(db, 'users', userId, 'incomes'));

    batch.set(incomeRef, {
      amount: parseFloat(incomeData.amount),
      source: incomeData.source,
      sourceName: incomeData.sourceName || incomeData.source,
      sourceIcon: incomeData.sourceIcon || '📦',
      accountId: incomeData.accountId,
      accountName: incomeData.accountName,
      note: incomeData.note?.trim() || '',
      date: Timestamp.fromDate(new Date(incomeData.date)),
      isRecurring: incomeData.isRecurring || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Add to account balance
    if (incomeData.accountId) {
      const accRef = doc(db, 'users', userId, 'accounts', incomeData.accountId);
      batch.update(accRef, {
        balance: increment(parseFloat(incomeData.amount)),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    console.log('✅ Income added:', incomeRef.id);
    return { success: true, id: incomeRef.id };
  } catch (error) {
    console.log('❌ Add income error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET INCOMES ============
export const getIncomes = async (month, year) => {
  try {
    const userId = getUserId();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const q = query(
      collection(db, 'users', userId, 'incomes'),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
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

// ============ GET ALL INCOMES ============
export const getAllIncomes = async () => {
  try {
    const userId = getUserId();

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

// ============ DELETE INCOME ============
export const deleteIncome = async (incomeId, incomeData) => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    batch.delete(doc(db, 'users', userId, 'incomes', incomeId));

    // Reverse account balance
    if (incomeData.accountId) {
      batch.update(doc(db, 'users', userId, 'accounts', incomeData.accountId), {
        balance: increment(-parseFloat(incomeData.amount)),
      });
    }

    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};