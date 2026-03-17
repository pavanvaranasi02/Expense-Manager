import NetInfo from "@react-native-community/netinfo";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return uid;
};

const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
};

// ============ SET FAMILY BUDGET ============
export const setFamilyBudget = async (familyId, month, year, budgetData) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: "You must be online to set budgets" };
    }

    const budgetId = `${year}-${String(month).padStart(2, "0")}`;

    const data = {
      month: budgetId,
      year,
      overall: parseFloat(budgetData.overall) || 0,
      categories: budgetData.categories || {},
      createdBy: userId,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, "families", familyId, "budgets", budgetId), data);

    console.log("✅ Family budget set for", budgetId);
    return { success: true, budgetId };
  } catch (error) {
    console.log("❌ Set family budget error:", error);
    return { success: false, error: error.message };
  }
};

// ============ GET FAMILY BUDGET ============
export const getFamilyBudget = async (familyId, month, year) => {
  try {
    const online = await isOnline();

    if (!online) {
      return { success: false, error: "You must be online to fetch budgets" };
    }

    const budgetId = `${year}-${String(month).padStart(2, "0")}`;
    const budgetDoc = await getDoc(
      doc(db, "families", familyId, "budgets", budgetId),
    );

    if (!budgetDoc.exists()) {
      return { success: true, budget: null }; // No budget set for this month
    }

    const data = budgetDoc.data();
    return {
      success: true,
      budget: {
        id: budgetDoc.id,
        ...data,
      },
    };
  } catch (error) {
    console.log("❌ Get family budget error:", error);
    return { success: false, error: error.message, budget: null };
  }
};

// ============ DELETE FAMILY BUDGET ============
export const deleteFamilyBudget = async (familyId, month, year) => {
  try {
    const online = await isOnline();

    if (!online) {
      return { success: false, error: "You must be online to delete budgets" };
    }

    const budgetId = `${year}-${String(month).padStart(2, "0")}`;
    await deleteDoc(doc(db, "families", familyId, "budgets", budgetId));

    console.log("✅ Family budget deleted");
    return { success: true };
  } catch (error) {
    console.log("❌ Delete family budget error:", error);
    return { success: false, error: error.message };
  }
};

// ============ CHECK BUDGET ALERTS ============
export const checkFamilyBudgetAlerts = async (
  familyId,
  month,
  year,
  totalSpent,
  categorySpending,
) => {
  try {
    const budgetResult = await getFamilyBudget(familyId, month, year);

    if (!budgetResult.success || !budgetResult.budget) {
      return { success: true, alerts: [] }; // No budget set
    }

    const budget = budgetResult.budget;
    const alerts = [];
    const budgetId = `${year}-${String(month).padStart(2, "0")}`;

    // Get previously sent alerts to avoid duplicates
    const sentAlertsDoc = await getDoc(
      doc(db, "families", familyId, "budgetAlerts", budgetId),
    );
    const sentAlerts = sentAlertsDoc.exists()
      ? sentAlertsDoc.data()
      : { overall: {}, categories: {} };

    // Check overall budget with multiple thresholds
    if (budget.overall > 0) {
      const percent = (totalSpent / budget.overall) * 100;

      // 50% threshold - Info
      if (percent >= 50 && percent < 80 && !sentAlerts.overall?.["50"]) {
        alerts.push({
          type: "BUDGET_INFO_50",
          category: "Overall",
          percent: Math.round(percent),
          spent: totalSpent,
          limit: budget.overall,
          threshold: 50,
        });
        sentAlerts.overall = { ...sentAlerts.overall, 50: true };
      }

      // 80% threshold - Warning
      if (percent >= 80 && percent < 100 && !sentAlerts.overall?.["80"]) {
        alerts.push({
          type: "BUDGET_WARNING_80",
          category: "Overall",
          percent: Math.round(percent),
          spent: totalSpent,
          limit: budget.overall,
          threshold: 80,
        });
        sentAlerts.overall = { ...sentAlerts.overall, 80: true };
      }

      // 100% threshold - Critical
      if (percent >= 100 && !sentAlerts.overall?.["100"]) {
        alerts.push({
          type: "BUDGET_EXCEEDED",
          category: "Overall",
          percent: Math.round(percent),
          spent: totalSpent,
          limit: budget.overall,
          threshold: 100,
        });
        sentAlerts.overall = { ...sentAlerts.overall, 100: true };
      }

      // 110% threshold - Danger
      if (percent >= 110 && !sentAlerts.overall?.["110"]) {
        alerts.push({
          type: "BUDGET_DANGER",
          category: "Overall",
          percent: Math.round(percent),
          spent: totalSpent,
          limit: budget.overall,
          threshold: 110,
        });
        sentAlerts.overall = { ...sentAlerts.overall, 110: true };
      }
    }

    // Check category budgets
    Object.entries(budget.categories || {}).forEach(
      ([categoryId, categoryLimit]) => {
        const spent = categorySpending[categoryId] || 0;
        if (categoryLimit > 0) {
          const percent = (spent / categoryLimit) * 100;

          if (!sentAlerts.categories) sentAlerts.categories = {};
          if (!sentAlerts.categories[categoryId])
            sentAlerts.categories[categoryId] = {};

          // 80% threshold
          if (
            percent >= 80 &&
            percent < 100 &&
            !sentAlerts.categories[categoryId]["80"]
          ) {
            alerts.push({
              type: "BUDGET_WARNING_80",
              category: categoryId,
              percent: Math.round(percent),
              spent,
              limit: categoryLimit,
              threshold: 80,
            });
            sentAlerts.categories[categoryId]["80"] = true;
          }

          // 100% threshold
          if (percent >= 100 && !sentAlerts.categories[categoryId]["100"]) {
            alerts.push({
              type: "BUDGET_EXCEEDED",
              category: categoryId,
              percent: Math.round(percent),
              spent,
              limit: categoryLimit,
              threshold: 100,
            });
            sentAlerts.categories[categoryId]["100"] = true;
          }
        }
      },
    );

    // Save sent alerts to prevent duplicates
    if (alerts.length > 0) {
      await setDoc(
        doc(db, "families", familyId, "budgetAlerts", budgetId),
        sentAlerts,
      );
    }

    return { success: true, alerts };
  } catch (error) {
    console.log("❌ Check budget alerts error:", error);
    return { success: false, error: error.message, alerts: [] };
  }
};

// ============ SEND BUDGET ALERT NOTIFICATIONS ============
export const sendBudgetAlertNotifications = async (
  familyId,
  alerts,
  members,
) => {
  try {
    if (alerts.length === 0) return { success: true };

    const batch = writeBatch(db);

    // Get family name
    const familyDoc = await getDoc(doc(db, "families", familyId));
    const familyName = familyDoc.exists()
      ? familyDoc.data().name
      : "Your Family";

    members.forEach((member) => {
      alerts.forEach((alert) => {
        const notificationRef = doc(
          collection(db, "users", member.userId, "notifications"),
        );

        let title, body, icon;

        switch (alert.type) {
          case "BUDGET_INFO_50":
            title = `📊 Halfway there: ${alert.category} budget at 50%`;
            body = `${familyName}: Spent ₹${alert.spent.toLocaleString(
              "en-IN",
            )} of ₹${alert.limit.toLocaleString("en-IN")}. On track!`;
            break;

          case "BUDGET_WARNING_80":
            title = `⚠️ Warning: ${alert.category} budget at ${alert.percent}%`;
            body = `${familyName}: Spent ₹${alert.spent.toLocaleString(
              "en-IN",
            )} of ₹${alert.limit.toLocaleString("en-IN")}. ₹${(
              alert.limit - alert.spent
            ).toLocaleString("en-IN")} remaining.`;
            break;

          case "BUDGET_EXCEEDED":
            title = `🚨 Alert: ${alert.category} budget exceeded!`;
            body = `${familyName}: Spent ₹${alert.spent.toLocaleString(
              "en-IN",
            )} of ₹${alert.limit.toLocaleString("en-IN")}. Over by ₹${(
              alert.spent - alert.limit
            ).toLocaleString("en-IN")}.`;
            break;

          case "BUDGET_DANGER":
            title = `🔴 Critical: ${alert.category} budget at ${alert.percent}%!`;
            body = `${familyName}: Urgent review needed. Overspent by ₹${(
              alert.spent - alert.limit
            ).toLocaleString("en-IN")}.`;
            break;

          default:
            title = `Budget Alert: ${alert.category}`;
            body = `${alert.percent}% used`;
        }

        batch.set(notificationRef, {
          type: alert.type,
          title,
          body,
          familyId,
          read: false,
          createdAt: serverTimestamp(),
          actionRoute: "Family",
          metadata: {
            category: alert.category,
            percent: alert.percent,
            spent: alert.spent,
            limit: alert.limit,
          },
        });
      });
    });

    await batch.commit();
    console.log(
      `✅ Sent ${alerts.length} budget alerts to ${members.length} members`,
    );
    return { success: true };
  } catch (error) {
    console.log("❌ Send budget notifications error:", error);
    return { success: false, error: error.message };
  }
};

// ============ CLEAR BUDGET ALERTS ============
export const clearBudgetAlerts = async (familyId, month, year) => {
  try {
    const budgetId = `${year}-${String(month).padStart(2, "0")}`;
    await deleteDoc(doc(db, "families", familyId, "budgetAlerts", budgetId));
    return { success: true };
  } catch (error) {
    console.log("❌ Clear budget alerts error:", error);
    return { success: false, error: error.message };
  }
};
