import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return uid;
};

// ============ NOTIFICATION PREFERENCES ============
export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,             // Master toggle for all notifications
  sipReminders: true,        // Mutual Fund SIP alerts
  rdReminders: true,         // Recurring Deposit alerts
  maturityAlerts: true,      // Maturity reminders for FD/RD
  budgetAlerts: true,        // Budget warning/exceeded alerts
  creditCardAlerts: true,    // CC payment due alerts
  dailyReminder: true,       // Daily expense logging reminder
};

export const getNotificationPreferences = async () => {
  try {
    const userId = getUserId();
    const snap = await getDoc(doc(db, "users", userId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(data.notificationSettings || {}),
      };
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  } catch (error) {
    console.log("❌ Get notification preferences error:", error);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

export const updateNotificationPreferences = async (newSettings) => {
  try {
    const userId = getUserId();
    await setDoc(
      doc(db, "users", userId),
      {
        notificationSettings: newSettings,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { success: true };
  } catch (error) {
    console.log("❌ Update notification preferences error:", error);
    return { success: false, error: error.message };
  }
};

// ============ SEND NOTIFICATION ============
export const sendNotification = async (notificationData) => {
  try {
    const userId = getUserId();
    const settings = await getNotificationPreferences();
    if (!settings.enabled) {
      return { success: true, disabled: true };
    }

    const notificationRef = doc(
      collection(db, "users", userId, "notifications"),
    );

    const notification = {
      ...notificationData,
      read: false,
      createdAt: serverTimestamp(),
    };

    await setDoc(notificationRef, notification);
    return { success: true, notificationId: notificationRef.id };
  } catch (error) {
    console.log("❌ Send notification error:", error);
    return { success: false, error: error.message };
  }
};

// ============ SEND CREDIT CARD ALERT ============
export const sendCreditCardAlert = async (
  cardName,
  daysLeft,
  amount,
  interestRate,
  type,
) => {
  try {
    const settings = await getNotificationPreferences();
    if (!settings.enabled || !settings.creditCardAlerts) {
      return { success: true, disabled: true };
    }

    const isUrgent = daysLeft <= 3;
    const alertType = type === "DANGER" ? "CREDIT_CARD_URGENT" : "CREDIT_CARD_DUE";
    
    const userId = getUserId();
    const existingQuery = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", alertType),
      where("metadata.cardName", "==", cardName)
    );
    
    const snapshot = await getDocs(existingQuery);
    
    let shouldSend = true;
    if (!snapshot.empty) {
      // Check if there's a notification from the last 24 hours
      const now = Date.now();
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toMillis?.() || 0;
        if (now - createdAt < 24 * 60 * 60 * 1000) {
          shouldSend = false;
        }
      });
    }

    if (!shouldSend) return { success: true, existing: true };

    await sendNotification({
      type: alertType,
      title: `${cardName} Bill ${isUrgent ? "URGENT: " : ""}Due ${daysLeft <= 0 ? "TODAY!" : `in ${daysLeft} days`}`,
      body: `Pay ₹${amount.toLocaleString("en-IN")} to avoid ${interestRate}% interest`,
      actionRoute: "CreditCardBill",
      priority: isUrgent ? "high" : "medium",
      metadata: {
        cardName,
        daysLeft,
        amount,
        interestRate,
      },
    });
    return { success: true };
  } catch (error) {
    console.log("❌ Send CC alert error:", error);
    return { success: false, error: error.message };
  }
};

// ============ SEND SIP NOTIFICATION ============
export const sendSipNotification = async (
  investmentName,
  sipAmount,
  sipDate,
  investmentId,
) => {
  try {
    const settings = await getNotificationPreferences();
    if (!settings.enabled || !settings.sipReminders) {
      return { success: true, disabled: true };
    }

    const userId = getUserId();
    const notificationRef = doc(
      collection(db, "users", userId, "notifications"),
    );

    // Check if notification already exists for this SIP
    const existingQuery = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", "SIP_DUE"),
      where("metadata.investmentId", "==", investmentId),
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      // Already exists, don't create duplicate
      return { success: true, existing: true };
    }

    const notification = {
      type: "SIP_DUE",
      title: `SIP Due: ${investmentName}`,
      body: `₹${sipAmount.toLocaleString("en-IN")} SIP payment due on ${sipDate}th`,
      actionRoute: "Portfolio",
      priority: "medium",
      persistent: true, // Can't be deleted
      metadata: {
        investmentName,
        sipAmount,
        sipDate,
        investmentId,
      },
      read: false,
      createdAt: serverTimestamp(),
    };

    await setDoc(notificationRef, notification);
    return { success: true, notificationId: notificationRef.id };
  } catch (error) {
    console.log("❌ Send SIP notification error:", error);
    return { success: false, error: error.message };
  }
};

// ============ SEND RD NOTIFICATION ============
export const sendRdNotification = async (
  investmentName,
  rdAmount,
  currentMonth,
  totalMonths,
  investmentId,
) => {
  try {
    const settings = await getNotificationPreferences();
    if (!settings.enabled || !settings.rdReminders) {
      return { success: true, disabled: true };
    }

    const userId = getUserId();
    const notificationRef = doc(
      collection(db, "users", userId, "notifications"),
    );

    // Check if notification already exists for this RD
    const existingQuery = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", "RD_DUE"),
      where("metadata.investmentId", "==", investmentId),
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      return { success: true, existing: true };
    }

    const notification = {
      type: "RD_DUE",
      title: `RD Payment Due: ${investmentName}`,
      body: `₹${rdAmount.toLocaleString("en-IN")} • Month ${currentMonth}/${totalMonths}`,
      actionRoute: "Portfolio",
      priority: "medium",
      persistent: true, // Can't be deleted
      metadata: {
        investmentName,
        rdAmount,
        currentMonth,
        totalMonths,
        investmentId,
      },
      read: false,
      createdAt: serverTimestamp(),
    };

    await setDoc(notificationRef, notification);
    return { success: true, notificationId: notificationRef.id };
  } catch (error) {
    console.log("❌ Send RD notification error:", error);
    return { success: false, error: error.message };
  }
};

// ============ SEND BUDGET ALERT ============
export const sendBudgetAlertNotification = async (
  categoryName,
  spent,
  budget,
  percent,
  type,
) => {
  try {
    const settings = await getNotificationPreferences();
    if (!settings.enabled || !settings.budgetAlerts) {
      return { success: true, disabled: true };
    }

    const isExceeded = percent >= 100;
    const alertType = isExceeded ? "BUDGET_EXCEEDED" : "BUDGET_WARNING";
    
    const userId = getUserId();
    const existingQuery = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", alertType),
      where("metadata.categoryName", "==", categoryName)
    );
    
    const snapshot = await getDocs(existingQuery);
    
    let shouldSend = true;
    if (!snapshot.empty) {
      // Check if there's a notification from the last 24 hours
      const now = Date.now();
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toMillis?.() || 0;
        if (now - createdAt < 24 * 60 * 60 * 1000) {
          shouldSend = false;
        }
      });
    }

    if (!shouldSend) return { success: true, existing: true };

    await sendNotification({
      type: alertType,
      title: isExceeded
        ? `${categoryName} Budget Exceeded!`
        : `${categoryName} Budget: ${Math.round(percent)}%`,
      body: isExceeded
        ? `Spent ₹${spent.toLocaleString("en-IN")} of ₹${budget.toLocaleString("en-IN")}`
        : `₹${(budget - spent).toLocaleString("en-IN")} remaining`,
      actionRoute: "Budget",
      priority: isExceeded ? "high" : "medium",
      metadata: {
        categoryName,
        spent,
        budget,
        percent,
      },
    });
    return { success: true };
  } catch (error) {
    console.log("❌ Send budget alert error:", error);
    return { success: false, error: error.message };
  }
};

// ============ SEND RECURRING EXPENSE NOTIFICATION ============
export const sendRecurringExpenseNotification = async (
  templateName,
  amount,
  dueDate,
) => {
  try {
    await sendNotification({
      type: "RECURRING_EXPENSE_DUE",
      title: `Recurring Expense: ${templateName}`,
      body: `₹${amount.toLocaleString("en-IN")} due on ${dueDate}`,
      actionRoute: "FamilyTemplates",
      priority: "medium",
      metadata: {
        templateName,
        amount,
        dueDate,
      },
    });
    return { success: true };
  } catch (error) {
    console.log("❌ Send recurring expense notification error:", error);
    return { success: false, error: error.message };
  }
};

// ============ GET NOTIFICATIONS ============
export const getNotifications = async () => {
  try {
    const userId = getUserId();

    const q = query(
      collection(db, "users", userId, "notifications"),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()
          ? data.createdAt.toDate().toISOString()
          : null,
      };
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return { success: true, notifications, unreadCount };
  } catch (error) {
    console.log("❌ Get notifications error:", error);
    return {
      success: false,
      error: error.message,
      notifications: [],
      unreadCount: 0,
    };
  }
};

// ============ MARK AS READ ============
export const markAsRead = async (notificationId) => {
  try {
    const userId = getUserId();
    await updateDoc(doc(db, "users", userId, "notifications", notificationId), {
      read: true,
    });
    return { success: true };
  } catch (error) {
    console.log("❌ Mark as read error:", error);
    return { success: false, error: error.message };
  }
};

// ============ MARK ALL AS READ ============
export const markAllAsRead = async () => {
  try {
    const userId = getUserId();

    const q = query(
      collection(db, "users", userId, "notifications"),
      where("read", "==", false),
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.log("❌ Mark all as read error:", error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE NOTIFICATION ============
export const deleteNotification = async (notificationId) => {
  try {
    const userId = getUserId();
    await deleteDoc(doc(db, "users", userId, "notifications", notificationId));
    return { success: true };
  } catch (error) {
    console.log("❌ Delete notification error:", error);
    return { success: false, error: error.message };
  }
};

// ============ CLEAR ALL NOTIFICATIONS ============
export const clearAllNotifications = async () => {
  try {
    const userId = getUserId();
    const snapshot = await getDocs(
      collection(db, "users", userId, "notifications"),
    );

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.log("❌ Clear all notifications error:", error);
    return { success: false, error: error.message };
  }
};
