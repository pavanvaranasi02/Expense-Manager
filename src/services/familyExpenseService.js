import NetInfo from "@react-native-community/netinfo";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import {
  addExpense,
  deleteExpense as deletePersonalExpense,
} from "./expenseService";
import {
  checkFamilyBudgetAlerts,
  sendBudgetAlertNotifications,
} from "./familyBudgetService";

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return uid;
};

const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
};

// ============ ADD FAMILY EXPENSE ============
export const addFamilyExpense = async (
  familyId,
  expenseData,
  syncToPersonal = false,
) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return {
        success: false,
        error: "You must be online to add family expenses",
      };
    }

    const amount = parseFloat(expenseData.amount);
    const batch = writeBatch(db);
    const expenseRef = doc(collection(db, "families", familyId, "expenses"));

    // Prepare family expense data
    const familyExpense = {
      amount,
      category: expenseData.category,
      categoryIcon: expenseData.categoryIcon,
      categoryName: expenseData.categoryName,
      paidBy: expenseData.paidBy,
      paidByName: expenseData.paidByName,
      addedBy: userId,
      splitType: expenseData.splitType || "PAID_FOR_ALL",
      splitAmong: expenseData.splitAmong || [],
      date: Timestamp.fromDate(new Date(expenseData.date)),
      note: expenseData.note?.trim() || "",
      receiptUrl: null,
      syncedToPersonal: [],
      personalExpenseIds: {},
      accountId: expenseData.accountId || null,
      accountName: expenseData.accountName || null,
      accountType: expenseData.accountType || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(expenseRef, familyExpense);

    await batch.commit();

    // Sync to personal if enabled and user is the payer
    if (syncToPersonal && expenseData.paidBy === userId) {
      const syncResult = await syncFamilyExpenseToPersonal(
        familyId,
        expenseRef.id,
        {
          ...familyExpense,
          id: expenseRef.id,
          date: new Date(expenseData.date),
        },
      );

      if (syncResult.success) {
        // Update family expense with sync info
        await updateDoc(
          doc(db, "families", familyId, "expenses", expenseRef.id),
          {
            syncedToPersonal: [userId],
            personalExpenseIds: {
              [userId]: syncResult.personalExpenseId,
            },
          },
        );
      }
    }

    // NEW: Check budget alerts after adding expense
    await checkAndSendBudgetAlerts(familyId);

    console.log("✅ Family expense added:", expenseRef.id);
    return { success: true, expenseId: expenseRef.id };
  } catch (error) {
    console.log("❌ Add family expense error:", error);
    return { success: false, error: error.message };
  }
};

// ============ SYNC TO PERSONAL ============
export const syncFamilyExpenseToPersonal = async (
  familyId,
  familyExpenseId,
  familyExpense,
) => {
  try {
    const userId = getUserId();

    // Get family name for note
    const familyDoc = await getDoc(doc(db, "families", familyId));
    const familyName = familyDoc.exists() ? familyDoc.data().name : "Family";

    // Get user's account for accountId
    let accountId = familyExpense.accountId || null;
    let accountName = familyExpense.accountName || "Cash";
    let paymentMode = "CASH";

    if (familyExpense.accountType === "CREDIT_CARD") {
      paymentMode = "CREDIT_CARD";
    } else if (familyExpense.accountType === "BANK_ACCOUNT" || familyExpense.accountType === "BANK") {
      paymentMode = "BANK_ACCOUNT";
    }

    if (!accountId) {
      const accountsSnap = await getDocs(
        collection(db, "users", userId, "accounts"),
      );
      if (accountsSnap.docs.length > 0) {
        const defaultAccount = accountsSnap.docs[0];
        accountId = defaultAccount.id;
        accountName = defaultAccount.data().name;
        const type = defaultAccount.data().type;
        if (type === "CREDIT_CARD") paymentMode = "CREDIT_CARD";
        else if (type === "BANK_ACCOUNT" || type === "BANK") paymentMode = "BANK_ACCOUNT";
      }
    }

    const personalExpenseData = {
      amount: familyExpense.amount,
      categoryId: familyExpense.category,
      categoryName: familyExpense.categoryName,
      categoryIcon: familyExpense.categoryIcon,
      accountId: accountId,
      accountName: accountName,
      paymentMode: paymentMode,
      note: `[${familyName}] ${familyExpense.note || familyExpense.categoryName}`,
      date:
        familyExpense.date instanceof Date ? familyExpense.date : new Date(),
      tags: ["family"],
      isFromFamily: true,
      familyId,
      familyExpenseId,
    };

    const result = await addExpense(personalExpenseData);

    if (result.success) {
      console.log("✅ Synced to personal expenses:", result.id);
      return { success: true, personalExpenseId: result.id };
    } else {
      console.log("❌ Failed to sync to personal:", result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.log("❌ Sync to personal error:", error);
    return { success: false, error: error.message };
  }
};

// ============ UPDATE FAMILY EXPENSE ============
export const updateFamilyExpense = async (
  familyId,
  expenseId,
  newData,
  syncOnEdit = false,
) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return {
        success: false,
        error: "You must be online to edit family expenses",
      };
    }

    // Get existing expense
    const expenseRef = doc(db, "families", familyId, "expenses", expenseId);
    const expenseDoc = await getDoc(expenseRef);

    if (!expenseDoc.exists()) {
      return { success: false, error: "Expense not found" };
    }

    const oldData = expenseDoc.data();

    // Prepare updated data
    const amount = parseFloat(newData.amount);
    const updatedFields = {
      amount,
      category: newData.category,
      categoryIcon: newData.categoryIcon,
      categoryName: newData.categoryName,
      paidBy: newData.paidBy,
      paidByName: newData.paidByName,
      splitType: newData.splitType || oldData.splitType,
      splitAmong: newData.splitAmong || oldData.splitAmong,
      date: Timestamp.fromDate(new Date(newData.date)),
      note: newData.note?.trim() || "",
      updatedAt: serverTimestamp(),
    };

    await updateDoc(expenseRef, updatedFields);

    // Handle personal expense sync if enabled
    if (syncOnEdit && oldData.personalExpenseIds?.[userId]) {
      const personalExpenseId = oldData.personalExpenseIds[userId];

      // Check if personal expense exists and hasn't been modified
      const personalExpenseRef = doc(
        db,
        "users",
        userId,
        "expenses",
        personalExpenseId,
      );
      const personalExpenseDoc = await getDoc(personalExpenseRef);

      if (personalExpenseDoc.exists()) {
        const personalData = personalExpenseDoc.data();

        // Simple conflict check: if personal expense was modified after family expense
        const wasManuallyModified =
          personalData.updatedAt?.toMillis?.() >
          oldData.updatedAt?.toMillis?.();

        if (wasManuallyModified) {
          // Return conflict flag for UI to handle
          return {
            success: true,
            conflict: true,
            personalExpenseId,
            message: "Personal expense was manually modified",
          };
        }

        // Update personal expense
        const familyDoc = await getDoc(doc(db, "families", familyId));
        const familyName = familyDoc.exists()
          ? familyDoc.data().name
          : "Family";

        await updateDoc(personalExpenseRef, {
          amount,
          categoryId: newData.category,
          categoryName: newData.categoryName,
          categoryIcon: newData.categoryIcon,
          note: `[${familyName}] ${newData.note || newData.categoryName}`,
          date: Timestamp.fromDate(new Date(newData.date)),
        });

        console.log("✅ Updated synced personal expense");
      }
    }

    // NEW: Check budget alerts after updating expense
    await checkAndSendBudgetAlerts(familyId);

    console.log("✅ Family expense updated:", expenseId);
    return { success: true };
  } catch (error) {
    console.log("❌ Update family expense error:", error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE FAMILY EXPENSE ============
export const deleteFamilyExpense = async (
  familyId,
  expenseId,
  syncOnDelete = false,
) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return {
        success: false,
        error: "You must be online to delete family expenses",
      };
    }

    // Get expense data before deleting
    const expenseRef = doc(db, "families", familyId, "expenses", expenseId);
    const expenseDoc = await getDoc(expenseRef);

    if (!expenseDoc.exists()) {
      return { success: false, error: "Expense not found" };
    }

    const expenseData = expenseDoc.data();

    // Delete family expense
    await deleteDoc(expenseRef);

    // Delete synced personal expense if setting enabled
    if (syncOnDelete && expenseData.personalExpenseIds?.[userId]) {
      const personalExpenseId = expenseData.personalExpenseIds[userId];
      const personalExpenseRef = doc(
        db,
        "users",
        userId,
        "expenses",
        personalExpenseId,
      );
      const personalExpenseDoc = await getDoc(personalExpenseRef);

      if (personalExpenseDoc.exists()) {
        const personalData = personalExpenseDoc.data();

        // Delete the personal expense (will update account balances)
        await deletePersonalExpense(personalExpenseId, personalData);
        console.log("✅ Deleted synced personal expense");
      }
    }

    console.log("✅ Family expense deleted:", expenseId);
    return { success: true };
  } catch (error) {
    console.log("❌ Delete family expense error:", error);
    return { success: false, error: error.message };
  }
};

// ============ GET FAMILY EXPENSES ============
export const getFamilyExpenses = async (familyId, filters = {}) => {
  try {
    const online = await isOnline();

    if (!online) {
      return {
        success: false,
        error: "You must be online to fetch family expenses",
      };
    }

    let constraints = [];

    if (filters.startDate) {
      constraints.push(
        where("date", ">=", Timestamp.fromDate(new Date(filters.startDate))),
      );
    }
    if (filters.endDate) {
      constraints.push(
        where("date", "<=", Timestamp.fromDate(new Date(filters.endDate))),
      );
    }
    if (filters.category) {
      constraints.push(where("category", "==", filters.category));
    }
    if (filters.paidBy) {
      constraints.push(where("paidBy", "==", filters.paidBy));
    }

    constraints.push(orderBy("date", "desc"));

    const q = query(
      collection(db, "families", familyId, "expenses"),
      ...constraints,
    );

    const snapshot = await getDocs(q);
    const expenses = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        date: data.date?.toDate?.()
          ? data.date.toDate().toISOString()
          : data.date || null,
        createdAt: data.createdAt?.toDate?.()
          ? data.createdAt.toDate().toISOString()
          : data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.()
          ? data.updatedAt.toDate().toISOString()
          : data.updatedAt || null,
      };
    });

    // Apply client-side search filter
    let filteredExpenses = expenses;
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      filteredExpenses = expenses.filter(
        (e) =>
          e.note?.toLowerCase().includes(search) ||
          e.categoryName?.toLowerCase().includes(search) ||
          e.paidByName?.toLowerCase().includes(search),
      );
    }

    console.log(`✅ Fetched ${filteredExpenses.length} family expenses`);
    return { success: true, expenses: filteredExpenses };
  } catch (error) {
    console.log("❌ Get family expenses error:", error);
    return { success: false, error: error.message, expenses: [] };
  }
};

// ============ GET MONTHLY FAMILY EXPENSES ============
export const getMonthlyFamilyExpenses = async (familyId, month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return getFamilyExpenses(familyId, { startDate, endDate });
};

// ============ GET FAMILY EXPENSE ANALYTICS ============
export const getFamilyExpenseAnalytics = async (familyId, month, year) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await getFamilyExpenses(familyId, { startDate, endDate });

    if (!result.success) {
      return result;
    }

    const expenses = result.expenses;

    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Category breakdown
    const categoryMap = {};
    expenses.forEach((e) => {
      const catId = e.category || "miscellaneous";
      if (!categoryMap[catId]) {
        categoryMap[catId] = {
          id: catId,
          name: e.categoryName || "Miscellaneous",
          icon: e.categoryIcon || "ellipsis-horizontal",
          total: 0,
          count: 0,
        };
      }
      categoryMap[catId].total += e.amount || 0;
      categoryMap[catId].count += 1;
    });

    // Member breakdown
    const memberMap = {};
    expenses.forEach((e) => {
      const memberId = e.paidBy;
      if (!memberMap[memberId]) {
        memberMap[memberId] = {
          userId: memberId,
          name: e.paidByName || "Unknown",
          total: 0,
          count: 0,
        };
      }
      memberMap[memberId].total += e.amount || 0;
      memberMap[memberId].count += 1;
    });

    // Daily totals
    const dailyMap = {};
    expenses.forEach((e) => {
      const day = e.date ? new Date(e.date).getDate() : 1;
      dailyMap[day] = (dailyMap[day] || 0) + (e.amount || 0);
    });

    const analytics = {
      totalSpent,
      expenseCount: expenses.length,
      categoryBreakdown: Object.values(categoryMap).sort(
        (a, b) => b.total - a.total,
      ),
      memberBreakdown: Object.values(memberMap).sort(
        (a, b) => b.total - a.total,
      ),
      dailyTotals: dailyMap,
      topExpense: expenses.length > 0 ? expenses[0] : null,
      averageExpense: expenses.length > 0 ? totalSpent / expenses.length : 0,
    };

    return { success: true, analytics };
  } catch (error) {
    console.log("❌ Get family analytics error:", error);
    return { success: false, error: error.message, analytics: null };
  }
};

// ============ MANUALLY UNSYNC FROM PERSONAL ============
export const unsyncFamilyExpenseFromPersonal = async (
  familyId,
  familyExpenseId,
) => {
  try {
    const userId = getUserId();

    // Get family expense
    const expenseRef = doc(
      db,
      "families",
      familyId,
      "expenses",
      familyExpenseId,
    );
    const expenseDoc = await getDoc(expenseRef);

    if (!expenseDoc.exists()) {
      return { success: false, error: "Family expense not found" };
    }

    const expenseData = expenseDoc.data();
    const personalExpenseId = expenseData.personalExpenseIds?.[userId];

    if (!personalExpenseId) {
      return { success: false, error: "No personal expense linked" };
    }

    // Delete personal expense
    const personalExpenseRef = doc(
      db,
      "users",
      userId,
      "expenses",
      personalExpenseId,
    );
    const personalExpenseDoc = await getDoc(personalExpenseRef);

    if (personalExpenseDoc.exists()) {
      const personalData = personalExpenseDoc.data();
      await deletePersonalExpense(personalExpenseId, personalData);
    }

    // Update family expense to remove sync info
    const updatedSyncedList = (expenseData.syncedToPersonal || []).filter(
      (id) => id !== userId,
    );
    const updatedPersonalIds = { ...expenseData.personalExpenseIds };
    delete updatedPersonalIds[userId];

    await updateDoc(expenseRef, {
      syncedToPersonal: updatedSyncedList,
      personalExpenseIds: updatedPersonalIds,
    });

    console.log("✅ Unsynced from personal");
    return { success: true };
  } catch (error) {
    console.log("❌ Unsync error:", error);
    return { success: false, error: error.message };
  }
};

// ============ CHECK AND SEND BUDGET ALERTS ============
const checkAndSendBudgetAlerts = async (familyId) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Fetch expenses and budget
    const expensesResult = await getMonthlyFamilyExpenses(
      familyId,
      month,
      year,
    );
    if (!expensesResult.success) return;

    const expenses = expensesResult.expenses;
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Calculate category spending
    const categorySpending = {};
    expenses.forEach((exp) => {
      const catId = exp.category || "miscellaneous";
      categorySpending[catId] =
        (categorySpending[catId] || 0) + (exp.amount || 0);
    });

    // Check for alerts
    const alertResult = await checkFamilyBudgetAlerts(
      familyId,
      month,
      year,
      totalSpent,
      categorySpending,
    );

    if (alertResult.success && alertResult.alerts.length > 0) {
      // Get family members
      const familyDoc = await getDoc(doc(db, "families", familyId));
      if (familyDoc.exists()) {
        const members = familyDoc.data().members || [];
        await sendBudgetAlertNotifications(
          familyId,
          alertResult.alerts,
          members,
        );
      }
    }
  } catch (error) {
    console.log("❌ Check budget alerts error:", error);
    // Don't throw - this is a background operation
  }
};
