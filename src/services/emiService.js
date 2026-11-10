import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { addExpense } from './expenseService';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

// ============ ADD EMI ============
export const addEmi = async (data) => {
  try {
    const userId = getUserId();
    const monthlyAmount = parseFloat(data.monthlyAmount) || 0;
    const totalMonths = parseInt(data.totalMonths, 10) || 1;
    const completedMonths = parseInt(data.completedMonths, 10) || 0;
    const totalAmount = data.totalAmount ? parseFloat(data.totalAmount) : (monthlyAmount * totalMonths);
    const startDate = data.startDate ? new Date(data.startDate).toISOString() : new Date().toISOString();
    const isCompleted = completedMonths >= totalMonths;

    // Generate initial history if completedMonths > 0 and user provided past installments
    const initialHistory = [];
    if (completedMonths > 0) {
      const start = new Date(startDate);
      for (let i = 1; i <= completedMonths; i++) {
        const payDate = new Date(start);
        payDate.setMonth(start.getMonth() + (i - 1));
        initialHistory.push({
          id: `emi_hist_${Date.now()}_${i}`,
          monthNumber: i,
          amount: monthlyAmount,
          date: payDate.toISOString(),
          note: `Installment ${i}/${totalMonths}`,
        });
      }
    }

    const emi = {
      name: data.name.trim(),
      monthlyAmount,
      totalMonths,
      completedMonths,
      totalAmount,
      interestRate: data.interestRate ? parseFloat(data.interestRate) : 0,
      processingFee: data.processingFee ? parseFloat(data.processingFee) : 0,
      
      // Linked account/card
      linkedAccountId: data.linkedAccountId || null,
      linkedAccountName: data.linkedAccountName || 'Credit Card',
      linkedAccountType: data.linkedAccountType || 'CREDIT_CARD',

      // Billing info
      debitDay: data.debitDay ? parseInt(data.debitDay, 10) : 5,
      startDate,
      endDate: data.endDate || null,
      maturedDate: isCompleted ? (data.maturedDate || new Date().toISOString()) : null,

      status: isCompleted ? 'COMPLETED' : 'ACTIVE',
      isActive: !isCompleted,

      note: data.note ? data.note.trim() : '',
      paymentHistory: initialHistory,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'users', userId, 'emis'), emi);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.log('❌ Add EMI error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET ALL EMIS ============
export const getEmis = async () => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, 'users', userId, 'emis'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const emis = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, emis };
  } catch (error) {
    console.log('❌ Get EMIs error:', error);
    return { success: false, error: error.message, emis: [] };
  }
};

// ============ RECORD EMI PAYMENT ============
export const recordEmiPayment = async (emiId, paymentData) => {
  try {
    const userId = getUserId();
    const emiRef = doc(db, 'users', userId, 'emis', emiId);
    const snap = await getDoc(emiRef);

    if (!snap.exists()) return { success: false, error: 'EMI record not found' };

    const emi = snap.data();
    const amount = parseFloat(paymentData.amount) || emi.monthlyAmount;
    const newCompleted = (emi.completedMonths || 0) + 1;
    const isCompleted = newCompleted >= emi.totalMonths;
    const payDate = paymentData.date ? new Date(paymentData.date).toISOString() : new Date().toISOString();

    const paymentEntry = {
      id: `emi_pay_${Date.now()}`,
      monthNumber: newCompleted,
      amount,
      date: payDate,
      note: paymentData.note?.trim() || `EMI Payment - Month ${newCompleted}/${emi.totalMonths}`,
      paidFromAccountId: paymentData.payFromAccountId || null,
      paidFromAccountName: paymentData.payFromAccountName || null,
    };

    // Optionally create an expense record if paid from a specific account
    if (paymentData.payFromAccountId) {
      await addExpense({
        amount,
        categoryId: 'bills',
        categoryName: 'EMI & Loans',
        categoryIcon: '💳',
        accountId: paymentData.payFromAccountId,
        accountName: paymentData.payFromAccountName,
        paymentMode: paymentData.paymentMode || 'BANK',
        note: `EMI: ${emi.name} (Month ${newCompleted}/${emi.totalMonths})`,
        date: payDate,
      });
    }

    const updatedData = {
      completedMonths: newCompleted,
      paymentHistory: [...(emi.paymentHistory || []), paymentEntry],
      updatedAt: serverTimestamp(),
    };

    if (isCompleted) {
      updatedData.status = 'COMPLETED';
      updatedData.isActive = false;
      updatedData.maturedDate = payDate;
    }

    await updateDoc(emiRef, updatedData);
    return { success: true, isCompleted, completedMonths: newCompleted };
  } catch (error) {
    console.log('❌ Record EMI payment error:', error);
    return { success: false, error: error.message };
  }
};

// ============ CLOSE / FORECLOSE EMI ============
export const closeEmi = async (emiId, note = 'Pre-closed / Foreclosed early') => {
  try {
    const userId = getUserId();
    const emiRef = doc(db, 'users', userId, 'emis', emiId);
    const nowIso = new Date().toISOString();

    await updateDoc(emiRef, {
      status: 'COMPLETED',
      isActive: false,
      maturedDate: nowIso,
      closureNote: note,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.log('❌ Close EMI error:', error);
    return { success: false, error: error.message };
  }
};

// ============ UPDATE EMI ============
export const updateEmi = async (emiId, data) => {
  try {
    const userId = getUserId();
    const emiRef = doc(db, 'users', userId, 'emis', emiId);
    const updateData = { ...data, updatedAt: serverTimestamp() };

    if (data.monthlyAmount !== undefined) updateData.monthlyAmount = parseFloat(data.monthlyAmount) || 0;
    if (data.totalMonths !== undefined) updateData.totalMonths = parseInt(data.totalMonths, 10) || 1;
    if (data.completedMonths !== undefined) {
      const comp = parseInt(data.completedMonths, 10) || 0;
      updateData.completedMonths = comp;
      const total = data.totalMonths ? parseInt(data.totalMonths, 10) : undefined;
      if (total !== undefined && comp >= total) {
        updateData.status = 'COMPLETED';
        updateData.isActive = false;
      }
    }

    await updateDoc(emiRef, updateData);
    return { success: true };
  } catch (error) {
    console.log('❌ Update EMI error:', error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE EMI ============
export const deleteEmi = async (emiId) => {
  try {
    const userId = getUserId();
    await deleteDoc(doc(db, 'users', userId, 'emis', emiId));
    return { success: true };
  } catch (error) {
    console.log('❌ Delete EMI error:', error);
    return { success: false, error: error.message };
  }
};

// ============ CALCULATE EMI TOTALS ============
export const calculateEmiTotals = (emis = []) => {
  const active = emis.filter((e) => e.isActive !== false && e.status !== 'COMPLETED');
  const completed = emis.filter((e) => e.isActive === false || e.status === 'COMPLETED');

  const totalMonthlyCommitment = active.reduce((sum, e) => sum + (parseFloat(e.monthlyAmount) || 0), 0);
  
  let totalRemainingBalance = 0;
  active.forEach((e) => {
    const remainingMonths = Math.max(0, (e.totalMonths || 0) - (e.completedMonths || 0));
    totalRemainingBalance += remainingMonths * (parseFloat(e.monthlyAmount) || 0);
  });

  return {
    activeCount: active.length,
    completedCount: completed.length,
    totalMonthlyCommitment,
    totalRemainingBalance,
  };
};
