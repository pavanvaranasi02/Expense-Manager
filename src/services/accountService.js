import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User not authenticated');
  return uid;
};

// ============ ADD ACCOUNT ============
export const addAccount = async (accountData) => {
  try {
    const userId = getUserId();

    const data = {
      type: accountData.type,
      name: accountData.name,
      bankName: accountData.bankName || null,
      accountNumber: accountData.accountNumber || null,
      balance: parseFloat(accountData.balance) || 0,

      hasDebitCard: accountData.hasDebitCard || false,
      debitCardLast4: accountData.debitCardLast4 || null,

      creditLimit: parseFloat(accountData.creditLimit) || 0,
      currentUsage: parseFloat(accountData.currentUsage) || 0,
      availableCredit: accountData.type === 'CREDIT_CARD'
        ? (parseFloat(accountData.creditLimit) || 0) - (parseFloat(accountData.currentUsage) || 0)
        : 0,
      billGenerationDate: parseInt(accountData.billGenerationDate) || 1,
      billDueDate: parseInt(accountData.billDueDate) || 15,
      interestRate: parseFloat(accountData.interestRate) || 36,
      userSpendLimit: accountData.userSpendLimit ? parseFloat(accountData.userSpendLimit) : null,
      alertAt: parseInt(accountData.alertAt) || 80,

      // Bill payment tracking
      lastBillPaidAmount: 0,
      lastBillPaidDate: null,
      billPaymentHistory: [],
      billPaymentReminder: false,
      unpaidBillAmount: 0,

      color: accountData.color || '#455A64',
      icon: accountData.icon || 'card',
      isDefault: accountData.isDefault || false,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'users', userId, 'accounts'), data);
    console.log('✅ Account added:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.log('❌ Add account error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET ALL ACCOUNTS ============
export const getAccounts = async () => {
  try {
    const userId = getUserId();
    const q = query(collection(db, 'users', userId, 'accounts'), orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    const accounts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log('✅ Fetched', accounts.length, 'accounts');
    return { success: true, accounts };
  } catch (error) {
    console.log('❌ Get accounts error:', error);
    return { success: false, error: error.message, accounts: [] };
  }
};

// ============ UPDATE ACCOUNT ============
export const updateAccount = async (accountId, data) => {
  try {
    const userId = getUserId();
    await updateDoc(doc(db, 'users', userId, 'accounts', accountId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ DELETE ACCOUNT ============
export const deleteAccount = async (accountId) => {
  try {
    const userId = getUserId();
    await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ PAY CREDIT CARD BILL ============
export const payCreditCardBill = async (cardId, paymentAmount, payFromAccountId = null, expenseId = null) => {
  try {
    const userId = getUserId();
    const amount = parseFloat(paymentAmount);

    if (!amount || amount <= 0) return { success: false, error: 'Invalid payment amount' };

    // Get credit card data
    const cardRef = doc(db, 'users', userId, 'accounts', cardId);
    const cardSnap = await getDocs(query(collection(db, 'users', userId, 'accounts')));
    let cardData = null;
    cardSnap.docs.forEach((d) => {
      if (d.id === cardId) cardData = d.data();
    });

    if (!cardData) return { success: false, error: 'Credit card not found' };

    const currentUsage = cardData.currentUsage || 0;
    const actualPayment = Math.min(amount, currentUsage);
    const newUsage = currentUsage - actualPayment;
    const newAvailable = (cardData.creditLimit || 0) - newUsage;
    const isFullPayment = newUsage <= 0;
    const remainingBill = Math.max(0, newUsage);

    const paymentEntry = {
      id: `bill_${Date.now()}`,
      amount: actualPayment,
      date: new Date().toISOString(),
      isFullPayment,
      remainingAfter: remainingBill,
      paidFromAccountId: payFromAccountId,
      expenseId: expenseId,
    };

    const existingHistory = cardData.billPaymentHistory || [];

    // Update credit card
    await updateDoc(cardRef, {
      currentUsage: newUsage,
      availableCredit: newAvailable,
      lastBillPaidAmount: actualPayment,
      lastBillPaidDate: new Date().toISOString(),
      unpaidBillAmount: remainingBill,
      billPaymentReminder: !isFullPayment,
      billPaymentHistory: [...existingHistory, paymentEntry],
      updatedAt: serverTimestamp(),
    });

    // Deduct from source bank account if specified (directly if no expenseId provided)
    if (payFromAccountId && !expenseId) {
      const bankRef = doc(db, 'users', userId, 'accounts', payFromAccountId);
      let bankData = null;
      cardSnap.docs.forEach((d) => {
        if (d.id === payFromAccountId) bankData = d.data();
      });

      if (bankData) {
        await updateDoc(bankRef, {
          balance: (bankData.balance || 0) - actualPayment,
          updatedAt: serverTimestamp(),
        });
      }
    }

    console.log(`✅ Bill paid: ₹${actualPayment}. Remaining: ₹${remainingBill}`);
    return {
      success: true,
      amountPaid: actualPayment,
      remainingBill,
      isFullPayment,
      paymentId: paymentEntry.id,
    };
  } catch (error) {
    console.log('❌ Pay bill error:', error);
    return { success: false, error: error.message };
  }
};

// ============ REVERT CREDIT CARD PAYMENT ============
export const revertCreditCardPayment = async (cardId, paymentId) => {
  try {
    const userId = getUserId();

    // Get credit card data
    const cardRef = doc(db, 'users', userId, 'accounts', cardId);
    const cardSnap = await getDocs(query(collection(db, 'users', userId, 'accounts')));
    let cardData = null;
    cardSnap.docs.forEach((d) => {
      if (d.id === cardId) cardData = d.data();
    });

    if (!cardData) return { success: false, error: 'Credit card not found' };

    const history = cardData.billPaymentHistory || [];
    const paymentIndex = history.findIndex((p) => p.id === paymentId);

    if (paymentIndex === -1) return { success: false, error: 'Payment record not found' };

    const payment = history[paymentIndex];
    const amountToRevert = payment.amount;

    // Remove the entry
    const newHistory = [...history];
    newHistory.splice(paymentIndex, 1);

    // Calculate new usage
    const newUsage = (cardData.currentUsage || 0) + amountToRevert;
    const newAvailable = (cardData.creditLimit || 0) - newUsage;

    // Get latest last payment if history still exists
    const lastPayment = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;

    await updateDoc(cardRef, {
      currentUsage: newUsage,
      availableCredit: newAvailable,
      lastBillPaidAmount: lastPayment ? lastPayment.amount : 0,
      lastBillPaidDate: lastPayment ? lastPayment.date : null,
      unpaidBillAmount: newUsage, // Logic might need to be smarter if multiple bills
      billPaymentHistory: newHistory,
      updatedAt: serverTimestamp(),
    });

    // If it was paid from bank account WITHOUT an expense (legacy or direct)
    // and we are NOT handling it via expense deletion, we should revert balance here.
    // However, the new flow will use expense deletion which handles balance.
    // We only revert balance here if there's no expenseId.
    if (payment.paidFromAccountId && !payment.expenseId) {
      const bankRef = doc(db, 'users', userId, 'accounts', payment.paidFromAccountId);
      let bankData = null;
      cardSnap.docs.forEach((d) => {
        if (d.id === payment.paidFromAccountId) bankData = d.data();
      });

      if (bankData) {
        await updateDoc(bankRef, {
          balance: (bankData.balance || 0) + amountToRevert,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { success: true, expenseId: payment.expenseId };
  } catch (error) {
    console.log('❌ Revert payment error:', error);
    return { success: false, error: error.message };
  }
};

// ============ SET BILL PAYMENT REMINDER ============
export const setBillReminder = async (cardId, remind) => {
  try {
    const userId = getUserId();
    await updateDoc(doc(db, 'users', userId, 'accounts', cardId), {
      billPaymentReminder: remind,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ GET CARDS WITH PENDING BILLS ============
export const getCardsWithPendingBills = (accounts) => {
  return accounts.filter(
    (a) =>
      a.type === 'CREDIT_CARD' &&
      ((a.currentUsage || 0) > 0 || a.billPaymentReminder)
  );
};

// ============ CALCULATE TOTALS ============
export const calculateTotals = (accounts) => {
  const totalAssets = accounts
    .filter((a) => a.type === 'BANK' || a.type === 'CASH')
    .reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalDebts = accounts
    .filter((a) => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + (a.currentUsage || 0), 0);
  return { totalAssets, totalDebts, netWorth: totalAssets - totalDebts };
};