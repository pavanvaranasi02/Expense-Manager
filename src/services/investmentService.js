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
    writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { addIncome } from './incomeService';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

export const INVESTMENT_TYPES = [
  { id: 'mutual_fund', name: 'Mutual Funds', icon: '📊', color: '#6C63FF' },
  { id: 'stocks', name: 'Stocks', icon: '📈', color: '#10B981' },
  { id: 'fd', name: 'Fixed Deposit', icon: '🏦', color: '#3B82F6' },
  { id: 'rd', name: 'Recurring Deposit', icon: '🔄', color: '#14B8A6' },
  { id: 'ppf', name: 'PPF / EPF', icon: '🛡️', color: '#8B5CF6' },
  { id: 'gold', name: 'Gold / Silver / Precious Metals', icon: '🥇', color: '#F59E0B' },
  { id: 'crypto', name: 'Crypto', icon: '₿', color: '#F97316' },
  { id: 'real_estate', name: 'Real Estate', icon: '🏠', color: '#EC4899' },
  { id: 'nps', name: 'NPS', icon: '📋', color: '#0EA5E9' },
  { id: 'bonds', name: 'Bonds', icon: '📄', color: '#64748B' },
  { id: 'other', name: 'Other', icon: '💰', color: '#9E9E9E' },
];

// ============ ADD INVESTMENT ============
export const addInvestment = async (data) => {
  try {
    const userId = getUserId();

    const investment = {
      name: data.name.trim(),
      type: data.type,
      typeName: data.typeName,
      typeIcon: data.typeIcon,
      platform: data.platform?.trim() || null,
      investedAmount: parseFloat(data.investedAmount) || 0,
      currentValue: parseFloat(data.currentValue) || parseFloat(data.investedAmount) || 0,

      // SIP fields (for mutual funds)
      sipAmount: parseFloat(data.sipAmount) || null,
      sipDate: data.sipDate ? parseInt(data.sipDate) : null,
      sipHistory: [],

      // RD-specific fields
      rdMonthlyAmount: parseFloat(data.rdMonthlyAmount) || null,
      rdTotalMonths: parseInt(data.rdTotalMonths) || null,
      rdCompletedMonths: parseInt(data.rdCompletedMonths) || 0,
      rdPaymentDate: data.rdPaymentDate ? parseInt(data.rdPaymentDate) : null,
      rdPaymentHistory: [],

      // Maturity fields (for FD/RD)
      maturityAmount: parseFloat(data.maturityAmount) || null,
      maturityDate: data.maturityDate || null,

      // Transaction history — universal for ALL types
      transactions: [],

      startDate: data.startDate || new Date().toISOString(),
      interestRate: parseFloat(data.interestRate) || null,
      note: data.note?.trim() || '',
      isActive: true,

      // Auto-maturity credit fields
      paidFromAccountId: data.paidFromAccountId || null,
      autoMaturityCredit: !!data.paidFromAccountId,
      maturityCredited: false,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, 'users', userId, 'investments'),
      investment
    );

    console.log('✅ Investment added:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.log('❌ Add investment error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET ALL INVESTMENTS ============
export const getInvestments = async () => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, 'users', userId, 'investments'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const investments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, investments };
  } catch (error) {
    console.log('❌ Get investments error:', error);
    return { success: false, error: error.message, investments: [] };
  }
};

// ============ UPDATE INVESTMENT ============
export const updateInvestment = async (investmentId, data) => {
  try {
    const userId = getUserId();
    const updateData = { ...data, updatedAt: serverTimestamp() };

    if (data.currentValue !== undefined) updateData.currentValue = parseFloat(data.currentValue) || 0;
    if (data.investedAmount !== undefined) updateData.investedAmount = parseFloat(data.investedAmount) || 0;
    if (data.sipAmount !== undefined) updateData.sipAmount = data.sipAmount ? parseFloat(data.sipAmount) : null;
    if (data.maturityAmount !== undefined) updateData.maturityAmount = data.maturityAmount ? parseFloat(data.maturityAmount) : null;
    if (data.rdMonthlyAmount !== undefined) updateData.rdMonthlyAmount = data.rdMonthlyAmount ? parseFloat(data.rdMonthlyAmount) : null;

    await updateDoc(doc(db, 'users', userId, 'investments', investmentId), updateData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ ADD INVESTMENT AMOUNT (UNIVERSAL) ============
// Works for ALL investment types — records a new investment transaction
export const addInvestmentAmount = async (investmentId, amount, currentValue, note = '', customDate = null) => {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'investments', investmentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return { success: false, error: 'Investment not found' };

    const data = docSnap.data();
    const newInvested = (data.investedAmount || 0) + parseFloat(amount);
    const newCurrentValue = currentValue ? parseFloat(currentValue) : newInvested;

    const txnDate = customDate
      ? (customDate instanceof Date ? customDate.toISOString() : new Date(customDate).toISOString())
      : new Date().toISOString();

    const transaction = {
      id: `txn_${Date.now()}`,
      type: 'INVEST',
      amount: parseFloat(amount),
      date: txnDate,
      note: note || '',
      balanceAfter: newInvested,
    };

    const existingTxns = data.transactions || [];

    await updateDoc(docRef, {
      investedAmount: newInvested,
      currentValue: newCurrentValue,
      transactions: [...existingTxns, transaction],
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Investment amount added:', amount);
    return { success: true, newInvested, newCurrentValue };
  } catch (error) {
    console.log('❌ Add investment amount error:', error);
    return { success: false, error: error.message };
  }
};

// ============ CONFIRM SIP ============
export const confirmSip = async (investmentId, sipAmount, investedAmount) => {
  try {
    const userId = getUserId();
    const newInvested = (parseFloat(investedAmount) || 0) + (parseFloat(sipAmount) || 0);

    const sipEntry = {
      date: new Date().toISOString(),
      amount: parseFloat(sipAmount) || 0,
      confirmed: true,
    };

    const transaction = {
      id: `txn_${Date.now()}`,
      type: 'SIP',
      amount: parseFloat(sipAmount) || 0,
      date: new Date().toISOString(),
      note: 'Monthly SIP',
      balanceAfter: newInvested,
    };

    const docRef = doc(db, 'users', userId, 'investments', investmentId);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();

    await updateDoc(docRef, {
      investedAmount: newInvested,
      sipHistory: [...(data.sipHistory || []), sipEntry],
      transactions: [...(data.transactions || []), transaction],
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ SKIP SIP ============
export const skipSip = async (investmentId) => {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'investments', investmentId);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();

    const sipEntry = {
      date: new Date().toISOString(),
      amount: 0,
      confirmed: false,
      skipped: true,
    };

    await updateDoc(docRef, {
      sipHistory: [...(data.sipHistory || []), sipEntry],
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ CONFIRM RD MONTHLY PAYMENT ============
export const confirmRdPayment = async (investmentId, amount) => {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'investments', investmentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return { success: false, error: 'Investment not found' };

    const data = docSnap.data();
    const newInvested = (data.investedAmount || 0) + parseFloat(amount);
    const newCompleted = (data.rdCompletedMonths || 0) + 1;

    const paymentEntry = {
      date: new Date().toISOString(),
      amount: parseFloat(amount),
      monthNumber: newCompleted,
      confirmed: true,
    };

    const transaction = {
      id: `txn_${Date.now()}`,
      type: 'RD_PAYMENT',
      amount: parseFloat(amount),
      date: new Date().toISOString(),
      note: `RD Payment - Month ${newCompleted}/${data.rdTotalMonths || '?'}`,
      balanceAfter: newInvested,
    };

    // Check if RD is complete
    const isComplete = data.rdTotalMonths && newCompleted >= data.rdTotalMonths;

    await updateDoc(docRef, {
      investedAmount: newInvested,
      currentValue: data.maturityAmount && isComplete
        ? parseFloat(data.maturityAmount)
        : newInvested,
      rdCompletedMonths: newCompleted,
      rdPaymentHistory: [...(data.rdPaymentHistory || []), paymentEntry],
      transactions: [...(data.transactions || []), transaction],
      isActive: !isComplete,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ RD payment confirmed: Month ${newCompleted}`);
    return {
      success: true,
      completedMonths: newCompleted,
      totalMonths: data.rdTotalMonths,
      isComplete,
    };
  } catch (error) {
    console.log('❌ RD payment error:', error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE INVESTMENT ============
export const deleteInvestment = async (investmentId) => {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'investments', investmentId);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      const data = snap.data();
      // If there's a linked expense, try to delete it too
      if (data.expenseId) {
        try {
          const userId = getUserId();
          const expRef = doc(db, 'users', userId, 'expenses', data.expenseId);
          await deleteDoc(expRef);
          // Also try to remove from offline cache if possible (best effort)
          import('./offlineQueue').then(m => m.removeFromCache('expenses', data.expenseId)).catch(() => {});
        } catch (e) {
          console.log('Skipping expense cleanup:', e);
        }
      }
    }

    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ CALCULATE INVESTMENT TOTALS ============
export const calculateInvestmentTotals = (investments) => {
  const active = investments.filter((i) => i.isActive);
  const totalInvested = active.reduce((s, i) => s + (i.investedAmount || 0), 0);
  const totalCurrentValue = active.reduce((s, i) => s + (i.currentValue || 0), 0);
  const totalReturns = totalCurrentValue - totalInvested;
  const returnPercent = totalInvested > 0
    ? ((totalReturns / totalInvested) * 100).toFixed(1) : 0;

  const byType = {};
  active.forEach((inv) => {
    if (!byType[inv.type]) {
      byType[inv.type] = {
        type: inv.type, typeName: inv.typeName, typeIcon: inv.typeIcon,
        invested: 0, currentValue: 0, count: 0,
      };
    }
    byType[inv.type].invested += inv.investedAmount || 0;
    byType[inv.type].currentValue += inv.currentValue || 0;
    byType[inv.type].count += 1;
  });

  return {
    totalInvested, totalCurrentValue, totalReturns, returnPercent,
    activeCount: active.length,
    byType: Object.values(byType).sort((a, b) => b.currentValue - a.currentValue),
  };
};

// ============ GET PENDING SIPs ============
export const getPendingSips = (investments) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  return investments.filter((inv) => {
    if (!inv.isActive || inv.type !== 'mutual_fund' || !inv.sipDate || !inv.sipAmount) return false;
    const sipDay = parseInt(inv.sipDate);
    if (currentDay < sipDay) return false;

    const sipHistory = inv.sipHistory || [];
    const confirmedThisMonth = sipHistory.some((entry) => {
      const d = new Date(entry.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    return !confirmedThisMonth;
  });
};

// ============ GET PENDING RD PAYMENTS ============
export const getPendingRdPayments = (investments) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  return investments.filter((inv) => {
    if (!inv.isActive || inv.type !== 'rd' || !inv.rdMonthlyAmount) return false;

    // Check if all months are done
    if (inv.rdTotalMonths && (inv.rdCompletedMonths || 0) >= inv.rdTotalMonths) return false;

    const paymentDay = inv.rdPaymentDate || 1;
    if (currentDay < paymentDay) return false;

    const history = inv.rdPaymentHistory || [];
    const paidThisMonth = history.some((entry) => {
      const d = new Date(entry.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    return !paidThisMonth;
  });
};

// ============ GET ALL PENDING ACTIONS (for Dashboard) ============
export const getAllPendingActions = (investments) => {
  return {
    pendingSips: getPendingSips(investments),
    pendingRdPayments: getPendingRdPayments(investments),
  };
};

// ============ PROCESS MATURED INVESTMENTS ============
/**
 * Checks for matured FD/RDs and credits the maturity amount to the bank account
 * if autoMaturityCredit is enabled.
 */
export const processMaturedInvestments = async (investments) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return { success: false, message: 'Not authenticated' };

    const maturedToProcess = investments.filter(inv => 
      inv.isActive && 
      inv.autoMaturityCredit && 
      !inv.maturityCredited && 
      inv.maturityAmount > 0 &&
      inv.maturityDate && 
      new Date(inv.maturityDate) <= new Date()
    );

    if (maturedToProcess.length === 0) return { success: true, processed: 0 };

    let processedCount = 0;
    for (const inv of maturedToProcess) {
      if (!inv.paidFromAccountId) continue;

      // 1. Record as Income (Investment Returns)
      // This will also update the account balance via addIncome batch
      const incomeRes = await addIncome({
        amount: inv.maturityAmount,
        source: 'investment_return',
        sourceName: 'Investment Maturity',
        sourceIcon: inv.typeIcon || '📈',
        accountId: inv.paidFromAccountId,
        accountName: inv.platform || 'Bank',
        note: `Maturity: ${inv.name}`,
        date: new Date().toISOString(),
      });

      if (incomeRes.success) {
        // 2. Mark investment as matured and inactive
        await updateDoc(doc(db, 'users', userId, 'investments', inv.id), {
          maturityCredited: true,
          isActive: false,
          updatedAt: serverTimestamp(),
        });
        processedCount++;
      }
    }

    return { success: true, processed: processedCount };
  } catch (error) {
    console.log('❌ Process maturity error:', error);
    return { success: false, error: error.message };
  }
};

// ============ WITHDRAW / REDEEM FROM INVESTMENT ============
export const withdrawInvestmentAmount = async (investmentId, amount, newCurrentValue, note = '') => {
  try {
    const userId = getUserId();
    const docRef = doc(db, 'users', userId, 'investments', investmentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return { success: false, error: 'Investment not found' };

    const data = docSnap.data();
    const withdrawAmt = parseFloat(amount) || 0;
    const oldCurrent = data.currentValue || 0;
    const updatedCurrent = newCurrentValue !== null && newCurrentValue !== undefined
      ? parseFloat(newCurrentValue)
      : Math.max(0, oldCurrent - withdrawAmt);

    // Proportionally adjust invested amount if desired, or keep as is
    const oldInvested = data.investedAmount || 0;
    const reductionRatio = oldCurrent > 0 ? withdrawAmt / oldCurrent : 1;
    const updatedInvested = Math.max(0, oldInvested - oldInvested * reductionRatio);

    const transaction = {
      id: `txn_${Date.now()}`,
      type: 'WITHDRAW',
      amount: withdrawAmt,
      date: new Date().toISOString(),
      note: note || 'Withdrawal / Redemption',
      balanceAfter: updatedCurrent,
    };

    const existingTxns = data.transactions || [];

    await updateDoc(docRef, {
      investedAmount: updatedInvested,
      currentValue: updatedCurrent,
      transactions: [...existingTxns, transaction],
      updatedAt: serverTimestamp(),
    });

    return { success: true, newInvested: updatedInvested, newCurrentValue: updatedCurrent };
  } catch (error) {
    console.log('❌ Withdraw investment error:', error);
    return { success: false, error: error.message };
  }
};

// ============ UPDATE FULL INVESTMENT DETAILS ============
export const updateInvestmentDetails = async (investmentId, details) => {
  try {
    const userId = getUserId();
    const updateData = { updatedAt: serverTimestamp() };

    if (details.name !== undefined) updateData.name = details.name.trim();
    if (details.investedAmount !== undefined) updateData.investedAmount = parseFloat(details.investedAmount) || 0;
    if (details.currentValue !== undefined) updateData.currentValue = parseFloat(details.currentValue) || 0;
    if (details.platform !== undefined) updateData.platform = details.platform ? details.platform.trim() : null;
    if (details.note !== undefined) updateData.note = details.note ? details.note.trim() : '';
    if (details.sipAmount !== undefined) updateData.sipAmount = details.sipAmount ? parseFloat(details.sipAmount) : null;
    if (details.sipDate !== undefined) updateData.sipDate = details.sipDate ? parseInt(details.sipDate) : null;
    if (details.interestRate !== undefined) updateData.interestRate = details.interestRate ? parseFloat(details.interestRate) : null;
    if (details.maturityDate !== undefined) updateData.maturityDate = details.maturityDate || null;
    if (details.maturityAmount !== undefined) updateData.maturityAmount = details.maturityAmount ? parseFloat(details.maturityAmount) : null;
    if (details.rdMonthlyAmount !== undefined) updateData.rdMonthlyAmount = details.rdMonthlyAmount ? parseFloat(details.rdMonthlyAmount) : null;
    if (details.rdTotalMonths !== undefined) updateData.rdTotalMonths = details.rdTotalMonths ? parseInt(details.rdTotalMonths) : null;
    if (details.rdPaymentDate !== undefined) updateData.rdPaymentDate = details.rdPaymentDate ? parseInt(details.rdPaymentDate) : null;
    if (details.isActive !== undefined) updateData.isActive = !!details.isActive;

    await updateDoc(doc(db, 'users', userId, 'investments', investmentId), updateData);
    return { success: true };
  } catch (error) {
    console.log('❌ Update investment details error:', error);
    return { success: false, error: error.message };
  }
};

// ============ BATCH ADD INVESTMENTS (FOR BULK IMPORT) ============
export const batchAddInvestments = async (investmentsList) => {
  try {
    const userId = getUserId();
    if (!investmentsList || investmentsList.length === 0) {
      return { success: false, error: 'No investments to add' };
    }

    const batch = writeBatch(db);
    const investmentsCol = collection(db, 'users', userId, 'investments');

    let count = 0;
    for (const inv of investmentsList) {
      const docRef = doc(investmentsCol);
      const newInv = {
        name: inv.name.trim(),
        type: inv.type,
        typeName: inv.typeName || inv.type,
        typeIcon: inv.typeIcon || '💰',
        platform: inv.platform?.trim() || null,
        investedAmount: parseFloat(inv.investedAmount) || 0,
        currentValue: parseFloat(inv.currentValue) || parseFloat(inv.investedAmount) || 0,
        interestRate: inv.interestRate ? parseFloat(inv.interestRate) : null,
        startDate: inv.startDate || new Date().toISOString(),
        note: inv.note?.trim() || '',
        isActive: true,
        transactions: [
          {
            id: `txn_${Date.now()}_${count}`,
            type: 'INVEST',
            amount: parseFloat(inv.investedAmount) || 0,
            date: inv.startDate || new Date().toISOString(),
            note: 'Initial import',
            balanceAfter: parseFloat(inv.investedAmount) || 0,
          },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(docRef, newInv);
      count++;
    }

    await batch.commit();
    return { success: true, count };
  } catch (error) {
    console.log('❌ Batch add investments error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET ALL INVESTMENT TRANSACTIONS (FOR TIMELINE/HISTORY) ============
export const getAllInvestmentTransactions = (investments) => {
  const allTxns = [];

  (investments || []).forEach((inv) => {
    // 1. Transactions array
    if (inv.transactions && inv.transactions.length > 0) {
      inv.transactions.forEach((t) => {
        allTxns.push({
          id: t.id || `txn_${inv.id}_${t.date}`,
          investmentId: inv.id,
          investmentName: inv.name,
          investmentType: inv.type,
          investmentIcon: inv.typeIcon || '💰',
          type: t.type || 'INVEST',
          amount: t.amount || 0,
          date: t.date || inv.startDate || new Date().toISOString(),
          note: t.note || '',
          balanceAfter: t.balanceAfter || null,
        });
      });
    } else if (inv.investedAmount > 0) {
      // Synthetic initial investment transaction if none recorded
      allTxns.push({
        id: `initial_${inv.id}`,
        investmentId: inv.id,
        investmentName: inv.name,
        investmentType: inv.type,
        investmentIcon: inv.typeIcon || '💰',
        type: 'INVEST',
        amount: inv.investedAmount,
        date: inv.startDate || (inv.createdAt?.toDate ? inv.createdAt.toDate().toISOString() : new Date().toISOString()),
        note: 'Initial investment',
        balanceAfter: inv.investedAmount,
      });
    }

    // 2. Maturity credit transaction if matured
    if (inv.maturityCredited && inv.maturityAmount) {
      allTxns.push({
        id: `matured_${inv.id}`,
        investmentId: inv.id,
        investmentName: inv.name,
        investmentType: inv.type,
        investmentIcon: inv.typeIcon || '📈',
        type: 'MATURED',
        amount: inv.maturityAmount,
        date: inv.maturityDate || new Date().toISOString(),
        note: 'Matured & credited to bank',
        balanceAfter: 0,
      });
    }
  });

  // Sort newest first
  return allTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};