import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Theme } from "../../theme/theme";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NotificationBell from "../../components/Notifications/NotificationBell";
import BalanceHero from "../../components/ui/BalanceHero";
import EmptyState from "../../components/ui/EmptyState";
import MetricStrip from "../../components/ui/MetricStrip";
import SectionHeader from "../../components/ui/SectionHeader";
import { Analytics } from "../../config/firebase";
import { getAccounts } from "../../services/accountService";
import {
  deleteBudget,
  getBudgets,
  updateBudget,
} from "../../services/budgetService";
import { getCurrencySymbol } from "../../constants/currencies";
import { getDashboardData } from "../../services/expenseService";
import { calculateAccountTotals } from "../../services/financialCalculationService";
import {
  calculateInvestmentTotals,
  getAllPendingActions,
  getInvestments,
} from "../../services/investmentService";
import {
  getNotifications,
  sendBudgetAlertNotification,
  sendCreditCardAlert,
  sendRdNotification,
  sendSipNotification,
} from "../../services/notificationService";
import useAuthStore from "../../store/useAuthStore";
import useNotificationStore from "../../store/useNotificationStore";
import { formatCurrency } from "../../utils/format";

const DashboardScreen = ({ navigation }) => {
  const userName = useAuthStore((s) => s.getUserName());
  const userProfile = useAuthStore((s) => s.userProfile);
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const toggleStealthMode = useAuthStore((s) => s.toggleStealthMode);
  const { unreadCount, setNotifications, setUnreadCount } =
    useNotificationStore();

  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [dashData, setDashData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [investmentTotals, setInvestmentTotals] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const showInvestmentsInAssets = userProfile?.showInvestmentsInAssets || false;

  const cs =
    userProfile?.currencySymbol ||
    getCurrencySymbol(userProfile?.currency, "₹");

  // Replace your existing fetchAll with this:
  const fetchDashboardData = async () => {
    try {
      const [dashResult, accResult, budgetResult, invResult, notifResult] =
        await Promise.all([
          getDashboardData(month, year),
          getAccounts(),
          getBudgets(month, year),
          getInvestments(),
          getNotifications(),
        ]);

      if (dashResult.success) setDashData(dashResult.data);
      if (accResult.success) setAccounts(accResult.accounts);
      if (budgetResult.success) setBudgets(budgetResult.budgets);
      if (notifResult.success) {
        setNotifications(notifResult.notifications);
        setUnreadCount(notifResult.unreadCount);
      }

      let invTotals = null;
      let allInvestments = [];
      if (invResult.success) {
        allInvestments = invResult.investments;
        invTotals = calculateInvestmentTotals(allInvestments);
        setInvestmentTotals(invTotals);
      }

      generateAlerts(
        accResult.accounts || [],
        budgetResult.budgets || [],
        dashResult.data,
        allInvestments,
      );
    } catch (error) {
      console.log("❌ Dashboard fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView("Dashboard");
      fetchDashboardData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const generateAlerts = async (accs, budgs, data, investments = []) => {
    const today = new Date().getDate();

    // ===== Credit card due date alerts =====
    for (const cc of accs.filter(
      (a) => a.type === "CREDIT_CARD" && (a.currentUsage || 0) > 0,
    )) {
      let daysLeft = (cc.billDueDate || 15) - today;
      if (daysLeft < 0) daysLeft += 30;

      if (daysLeft <= 10) {
        const type = daysLeft <= 3 ? "DANGER" : "WARNING";
        await sendCreditCardAlert(
          cc.name,
          daysLeft,
          cc.currentUsage || 0,
          cc.interestRate || 36,
          type,
        );
      }

      const usagePercent =
        ((cc.currentUsage || 0) / (cc.creditLimit || 1)) * 100;
      if (usagePercent >= 80) {
        const type = usagePercent >= 95 ? "DANGER" : "WARNING";
        await sendCreditCardAlert(
          `${cc.name} (Limit Alert)`,
          Math.round(usagePercent),
          cc.currentUsage || 0,
          cc.interestRate || 36,
          type,
        );
      }
    }

    // ===== Bill payment reminders (partial payments) =====
    for (const cc of accs.filter(
      (a) =>
        a.type === "CREDIT_CARD" &&
        a.billPaymentReminder &&
        (a.currentUsage || 0) > 0,
    )) {
      await sendCreditCardAlert(
        `${cc.name} (Remaining)`,
        0,
        cc.currentUsage || 0,
        cc.interestRate || 36,
        "WARNING",
      );
    }

    // ===== Investment SIP & RD alerts =====
    if (investments.length > 0) {
      const { pendingSips, pendingRdPayments } =
        getAllPendingActions(investments);

      for (const inv of pendingSips) {
        try {
          await sendSipNotification(
            inv.name,
            inv.sipAmount || 0,
            inv.sipDate,
            inv.id,
          );
        } catch (error) {
          console.log(
            "❌ Failed to send SIP notification for:",
            inv.name,
            error,
          );
        }
      }

      for (const inv of pendingRdPayments) {
        try {
          await sendRdNotification(
            inv.name,
            inv.rdMonthlyAmount || 0,
            (inv.rdCompletedMonths || 0) + 1,
            inv.rdTotalMonths || "?",
            inv.id,
          );
        } catch (error) {
          console.log(
            "❌ Failed to send RD notification for:",
            inv.name,
            error,
          );
        }
      }
    }

    // ===== Budget alerts =====
    if (data) {
      for (const budget of budgs) {
        let spent = 0;
        if (budget.type === "OVERALL") {
          spent = data.totalExpense || 0;
        } else {
          const cat = data.categoryBreakdown?.find(
            (c) => c.id === budget.categoryId,
          );
          spent = cat?.total || 0;
        }
        const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        if (percent >= 100) {
          await sendBudgetAlertNotification(
            budget.categoryName,
            spent,
            budget.amount,
            percent,
            "DANGER",
          );
        } else if (percent >= 80) {
          await sendBudgetAlertNotification(
            budget.categoryName,
            spent,
            budget.amount,
            percent,
            "WARNING",
          );
        }
      }
    }
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  }, []);

  const handleEditBudget = useCallback((budget) => {
    setEditingBudget(budget);
    setNewBudgetAmount(budget.amount.toString());
    setShowBudgetModal(true);
  }, []);

  const handleUpdateBudget = async () => {
    if (!newBudgetAmount || parseFloat(newBudgetAmount) <= 0) return;
    setSavingBudget(true);
    const res = await updateBudget(editingBudget.id, {
      amount: newBudgetAmount,
    });
    if (res.success) {
      setShowBudgetModal(false);
      fetchDashboardData();
    } else {
      Alert.alert("Error", res.error);
    }
    setSavingBudget(false);
  };

  const handleDeleteBudget = async () => {
    Alert.alert(
      "Delete Budget",
      `Are you sure you want to delete the budget for ${editingBudget.categoryName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSavingBudget(true);
            const res = await deleteBudget(editingBudget.id);
            if (res.success) {
              setShowBudgetModal(false);
              fetchDashboardData();
            } else {
              Alert.alert("Error", res.error);
            }
            setSavingBudget(false);
          },
        },
      ],
    );
  };

  const { totalAssets, totalDebts, netWorth } = useMemo(
    () =>
      calculateAccountTotals(accounts, investmentTotals, {
        includeInvestmentsInAssets: showInvestmentsInAssets,
      }),
    [accounts, investmentTotals, showInvestmentsInAssets]
  );


  const formatDate = (d) => {
    if (!d) return "";
    const date = d instanceof Date ? d : d.toDate?.() || new Date(d);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={Theme.colors.primary} />

        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>

      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Theme.colors.primary]}
          />
        }
      >
        {/* Clean Editorial Header (Only 2 right controls: Notifications & Profile Avatar) */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greetingText}>{greeting}</Text>
              <Text style={styles.userNameText}>{userName}</Text>
            </View>
            <View style={styles.headerRight}>
              <NotificationBell
                unreadCount={unreadCount}
                onPress={() => navigation.navigate("Notifications")}
              />
              <TouchableOpacity
                style={styles.avatarBtn}
                onPress={() => navigation.navigate("Profile")}
                activeOpacity={0.8}
                accessibilityLabel="Open profile and settings"
              >
                <Text style={styles.avatarText}>
                  {(userName || "K").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "K"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reusable Open Editorial Net Worth Block (clean, no redundant bar on Home) */}
          <BalanceHero
            eyebrow="NET WORTH"
            amountText={`${netWorth < 0 && !isStealthMode ? '-' : ''}${formatCurrency(Math.abs(netWorth), isStealthMode, cs)}`}
            badgeText={
              totalAssets > 0 && totalDebts === 0 && !isStealthMode
                ? 'Debt Free'
                : undefined
            }
            leftLabel="ASSETS"
            leftValue={formatCurrency(totalAssets, isStealthMode, cs)}
            rightLabel="LIABILITIES"
            rightValue={formatCurrency(totalDebts, isStealthMode, cs)}
            rightHighlightError={totalDebts > 0}
            isStealthMode={isStealthMode}
            onToggleStealth={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleStealthMode();
            }}
          />
        </View>

        <Animated.View style={[styles.mainContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Open Editorial Monthly Cash Flow Strip (single hairline divider from hero) */}
          <MetricStrip
            omitTopBorder
            headerTitle="Cash Flow"
            headerRight={(() => {
              const monthLabel = new Date().toLocaleString("default", { month: "long" });
              if ((dashData?.totalIncome || 0) > 0 && !isStealthMode) {
                const savedPct = Math.max(0, Math.round(((dashData?.savings || 0) / dashData.totalIncome) * 100));
                return `${monthLabel} · ${savedPct}% saved`;
              }
              return monthLabel;
            })()}
            style={{ marginTop: 0 }}
            items={[
              {
                label: "Income",
                value: formatCurrency(dashData?.totalIncome || 0, isStealthMode, cs),
                color: (dashData?.totalIncome || 0) > 0 ? Theme.colors.success : Theme.colors.text,
              },
              {
                label: "Spent",
                value: formatCurrency(dashData?.totalExpense || 0, isStealthMode, cs),
                color: (dashData?.totalExpense || 0) > 0 ? Theme.colors.error : Theme.colors.text,
              },
              {
                label: "Savings",
                value: `${(dashData?.savings || 0) < 0 && !isStealthMode ? '-' : ''}${formatCurrency(Math.abs(dashData?.savings || 0), isStealthMode, cs)}`,
                color:
                  (dashData?.savings || 0) < 0
                    ? Theme.colors.error
                    : (dashData?.savings || 0) > 0
                    ? Theme.colors.success
                    : Theme.colors.text,
              },
            ]}
          />

          {/* Investment Portfolio */}
          {investmentTotals && investmentTotals.activeCount > 0 && (
            <>
              <SectionHeader
                title="Investments"
                actionLabel="View All"
                onAction={() =>
                  navigation.navigate("Wealth", {
                    screen: "Portfolio",
                    initial: false,
                  })
                }
                style={{ marginTop: 20 }}
              />

              <TouchableOpacity
                style={styles.investmentCard}
                onPress={() =>
                  navigation.navigate("Wealth", {
                    screen: "Portfolio",
                    initial: false,
                  })
                }
                activeOpacity={0.8}
              >
                <View style={styles.investmentRow}>
                  <View style={styles.investmentCol}>
                    <Text style={styles.investmentLabel}>PORTFOLIO VALUE</Text>
                    <Text style={styles.investmentAmount}>
                      {formatCurrency(
                        investmentTotals.totalCurrentValue,
                        isStealthMode,
                        cs,
                      )}
                    </Text>
                  </View>
                  <View
                    style={[styles.investmentCol, { alignItems: "flex-end" }]}
                  >
                    <Text style={styles.investmentLabel}>RETURNS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.investmentAmount,
                          {
                            color: investmentTotals.totalReturns >= 0 ? Theme.colors.success : Theme.colors.error,
                            fontSize: 15,
                          },
                        ]}
                      >
                        {investmentTotals.totalReturns > 0 ? "+" : ""}
                        {formatCurrency(
                          investmentTotals.totalReturns,
                          isStealthMode,
                          cs,
                        )}
                        {!isStealthMode &&
                          ` (${investmentTotals.returnPercent}%)`}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.investmentMeta}>
                  <Text style={styles.investmentMetaText}>
                    {investmentTotals.activeCount} active • Invested{" "}
                    {formatCurrency(
                      investmentTotals.totalInvested,
                      isStealthMode,
                      cs,
                    )}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Accounts Summary (Neutral hairline tiles, no progress bars) */}
          {accounts.length > 0 && (
            <>
              <SectionHeader
                title="Accounts & Cards"
                actionLabel="Manage"
                onAction={() =>
                  navigation.navigate("Wealth", {
                    screen: "ManageAccounts",
                    initial: false,
                  })
                }
                style={{ marginTop: 20 }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.accountsScroll}
                contentContainerStyle={{ paddingRight: 20 }}
              >
                {accounts.map((acc) => {
                  const isCard = acc.type === "CREDIT_CARD";
                  const used = acc.currentUsage || 0;
                  const limit = acc.creditLimit || 0;
                  const available = Math.max(0, limit - used);
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={styles.accountTile}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate("Wealth");
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.accCardTop}>
                        <Text style={styles.accTileName} numberOfLines={1}>
                          {acc.name}
                        </Text>
                        <Ionicons
                          name={isCard ? "card-outline" : acc.type === "CASH" ? "cash-outline" : "business-outline"}
                          size={14}
                          color={Theme.colors.textMuted}
                        />
                      </View>
                      <View style={styles.accCardBottom}>
                        {isCard ? (
                          <>
                            <Text style={[styles.accTileAmount, used > 0 && { color: Theme.colors.error }]}>
                              {used > 0 ? "-" : ""}
                              {formatCurrency(used, isStealthMode, cs)}
                            </Text>
                            <Text style={styles.accTileSub} numberOfLines={1}>
                              {limit > 0
                                ? `Avail ${formatCurrency(available, isStealthMode, cs)}`
                                : "Credit Card"}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.accTileAmount}>
                              {formatCurrency(acc.balance || 0, isStealthMode, cs)}
                            </Text>
                            <Text style={styles.accTileSub} numberOfLines={1}>
                              {acc.type === "CASH" ? "Cash Wallet" : "Bank Account"}
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Top Spending Summary (Clean hairline rows, no progress bars) */}
          {dashData?.categoryBreakdown?.length > 0 && (
            <View style={styles.spendingsContainer}>
              <SectionHeader
                title="Top Spending"
                actionLabel="Insights"
                onAction={() => navigation.navigate("AnalyticsMain")}
                style={{ marginTop: 20 }}
              />
              <View style={styles.ledgerBox}>
                {dashData.categoryBreakdown.slice(0, 3).map((cat, idx) => {
                  const pct =
                    (dashData?.totalExpense || 0) > 0
                      ? Math.round((cat.total / dashData.totalExpense) * 100)
                      : 0;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.txnCard,
                        idx > 0 && styles.ledgerRowBorder,
                      ]}
                      onPress={() =>
                        navigation.navigate("Activity", {
                          screen: "ExpenseList",
                          params: {
                            categoryId: cat.id,
                            categoryName: cat.name,
                          },
                        })
                      }
                      activeOpacity={0.75}
                    >
                      <View style={styles.txnIconContainer}>
                        <Ionicons
                          name={
                            cat.icon && cat.icon.length > 2
                              ? cat.icon
                              : /food|dining/i.test(cat.name)
                              ? "restaurant-outline"
                              : /travel|cab|transport/i.test(cat.name)
                              ? "car-outline"
                              : /shop/i.test(cat.name)
                              ? "bag-handle-outline"
                              : /bill|utilit/i.test(cat.name)
                              ? "flash-outline"
                              : /health/i.test(cat.name)
                              ? "medkit-outline"
                              : /rent|home/i.test(cat.name)
                              ? "home-outline"
                              : "pricetag-outline"
                          }
                          size={16}
                          color={Theme.colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txnCategory}>{cat.name}</Text>
                        <Text style={styles.txnNote}>{pct}% of monthly spend</Text>
                      </View>
                      <Text style={styles.txnAmount}>
                        {formatCurrency(cat.total, isStealthMode, cs)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Concise Budget Summary (Full progress bars live in Plan) */}
          {budgets.length > 0 && (
            <View style={styles.budgetMainWrapper}>
              <SectionHeader
                title="Budgets"
                actionLabel="Plan"
                onAction={() => navigation.navigate("Plan")}
                style={{ marginTop: 20 }}
              />
              <View style={styles.ledgerBox}>
                {budgets.slice(0, 3).map((budget, index) => {
                  let spent = 0;
                  if (budget.type === "OVERALL") {
                    spent = dashData?.totalExpense || 0;
                  } else {
                    const cat = dashData?.categoryBreakdown?.find(
                      (c) => c.id === budget.categoryId,
                    );
                    spent = cat?.total || 0;
                  }
                  const percent =
                    budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
                  const exceeded = spent > budget.amount;

                  return (
                    <TouchableOpacity
                      key={budget.id}
                      style={[
                        styles.txnCard,
                        index > 0 && styles.ledgerRowBorder,
                      ]}
                      onPress={() => handleEditBudget(budget)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txnCategory}>{budget.categoryName}</Text>
                        <Text style={styles.txnNote}>
                          {formatCurrency(spent, isStealthMode, cs)} of{" "}
                          {formatCurrency(budget.amount, isStealthMode, cs)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.txnAmount,
                          exceeded && { color: Theme.colors.error },
                        ]}
                      >
                        {percent}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Budget Action Modal */}
          <Modal
            visible={showBudgetModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowBudgetModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.budgetModalContent}>
                <Text style={styles.modalTitle}>
                  Manage {editingBudget?.categoryName} Budget
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Monthly Target Amount</Text>
                  <View style={styles.amountInputGroup}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={newBudgetAmount}
                      onChangeText={setNewBudgetAmount}
                      autoFocus
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnDelete]}
                    onPress={handleDeleteBudget}
                  >
                    <Ionicons name="trash" size={20} color={Theme.colors.error} />

                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnCancel]}
                    onPress={() => setShowBudgetModal(false)}
                  >
                    <Text style={styles.modalBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnApply]}
                    onPress={handleUpdateBudget}
                    disabled={savingBudget}
                  >
                    {savingBudget ? (
                      <ActivityIndicator size="small" color={Theme.colors.surface} />
                    ) : (
                      <Text style={styles.modalBtnApplyText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>

                </View>
              </View>
            </View>
          </Modal>

          {/* Recent Transactions */}
          <SectionHeader
            title="Recent Transactions"
            actionLabel="See All"
            onAction={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("Activity");
            }}
            style={{ marginTop: 20 }}
          />

          {!dashData?.recentExpenses || dashData.recentExpenses.length === 0 ? (
            <EmptyState
              compact
              icon="receipt-outline"
              title="No expenses this month"
              description="Tap + to record an expense or income."
              actionLabel="Add Expense"
              onAction={() => navigation.navigate("AddExpenseModal")}
            />
          ) : (
            <View style={styles.ledgerBox}>
              {dashData.recentExpenses.map((exp, idx) => (
                <TouchableOpacity
                  key={exp.id}
                  style={[styles.txnCard, idx > 0 && styles.ledgerRowBorder]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate("Activity", {
                      screen: "ExpenseDetail",
                      params: { expense: exp },
                    });
                  }}
                >
                  <View style={styles.txnIconContainer}>
                    <Ionicons
                      name={
                        exp.categoryIcon && exp.categoryIcon.length > 2
                          ? exp.categoryIcon
                          : /food|dining/i.test(exp.categoryName)
                          ? "restaurant-outline"
                          : /travel|cab|transport/i.test(exp.categoryName)
                          ? "car-outline"
                          : /shop/i.test(exp.categoryName)
                          ? "bag-handle-outline"
                          : /bill|utilit/i.test(exp.categoryName)
                          ? "flash-outline"
                          : "receipt-outline"
                      }
                      size={16}
                      color={Theme.colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnCategory}>{exp.categoryName}</Text>
                    <Text style={styles.txnNote} numberOfLines={1}>
                      {exp.note || exp.accountName} • {formatDate(exp.date)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.txnAmount}>
                      -{cs}
                      {exp.amount.toLocaleString("en-IN")}
                    </Text>
                    {exp.isCredit && (
                      <Text style={styles.txnCredit}>Credit Card</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scrollContent: { paddingBottom: 120 },
  

  headerContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  greetingText: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
  },
  userNameText: {
    ...Theme.typography.presets.title,
    color: Theme.colors.text,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(19, 78, 74, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 13,
    color: Theme.colors.primary,
  },

  // Open Editorial Net Worth Header
  editorialHero: {
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: Theme.typography.weight.semibold,
    letterSpacing: 0.9,
  },
  heroAmount: {
    color: Theme.colors.text,
    fontSize: 32,
    fontWeight: Theme.typography.weight.bold,
    marginTop: 4,
    letterSpacing: -0.8,
    ...Theme.typography.tabularNums,
  },
  heroEquation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  heroStatItem: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Theme.colors.border,
    marginHorizontal: 14,
  },
  heroStatLabel: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    fontWeight: Theme.typography.weight.semibold,
    letterSpacing: 0.6,
  },
  heroStatValue: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: Theme.typography.weight.semibold,
    marginTop: 2,
    ...Theme.typography.tabularNums,
  },

  mainContent: { paddingHorizontal: Theme.spacing.md },

  // Compact Quick Strip (borderless warm-stone pill bar)
  quickStrip: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.canvasRecessed,
    borderRadius: Theme.radius.lg,
    marginTop: 8,
    overflow: 'hidden',
  },
  quickStripItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
  },
  quickStripBorder: {
    borderLeftWidth: 1,
    borderLeftColor: Theme.colors.border,
  },
  quickStripLabel: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 12,
    color: Theme.colors.text,
  },
  cashFlowBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 14,
  },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  actionItem: { alignItems: "center", width: "23%" },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  actionText: { 
    fontSize: 11, 
    fontWeight: Theme.typography.weight.semibold, 
    color: Theme.colors.textSecondary 
  },

  // Cards
  unifiedCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 10,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: { 
    fontSize: 15, 
    fontWeight: Theme.typography.weight.extrabold, 
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: { 
    fontSize: 11, 
    color: Theme.colors.textLight, 
    fontWeight: Theme.typography.weight.bold 
  },
  summaryGrid: { flexDirection: "row", alignItems: "center" },
  summaryGridItem: { flex: 1, alignItems: "center" },
  summaryGridLabel: {
    fontSize: 10,
    color: Theme.colors.textLight,
    fontWeight: Theme.typography.weight.extrabold,
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  summaryGridValue: { 
    fontSize: 16, 
    fontWeight: Theme.typography.weight.extrabold 
  },
  summaryGridDivider: { width: 1, height: 36, backgroundColor: Theme.colors.border },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  seeAll: { 
    fontSize: 12, 
    color: Theme.colors.primary, 
    fontWeight: Theme.typography.weight.bold 
  },

  // Accounts (Neutral hairline tiles, no progress bars)
  accountsScroll: { marginHorizontal: -16, paddingLeft: 16 },
  accountTile: {
    width: 168,
    minHeight: 92,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    justifyContent: "space-between",
  },
  accCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accTileName: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 13,
    color: Theme.colors.text,
    flex: 1,
    marginRight: 6,
  },
  accCardBottom: {
    marginTop: 10,
  },
  accTileAmount: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 17,
    color: Theme.colors.text,
    letterSpacing: -0.3,
    ...Theme.typography.tabularNums,
  },
  accTileSub: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },

  // Charts
  spendingsContainer: { marginTop: 0 },
  chartWrapper: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 16,
  },
  categoriesScrollMini: { marginHorizontal: -16, paddingLeft: 16 },
  catSnapCardMini: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.radius.md,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  catSnapEmoji: { fontSize: 16, marginRight: 8 },
  catSnapIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Theme.colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  catSnapName: { 
    fontFamily: Theme.typography.fontFamily.semiBold,
    fontSize: 12, 
    color: Theme.colors.textMuted 
  },

  // Budget
  budgetMainWrapper: { marginTop: 0 },
  budgetScrollContainer: { maxHeight: 300 },
  budgetUnifiedContainer: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  budgetModernRow: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderSubtle,
  },
  budgetRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  budgetRowName: { 
    fontFamily: Theme.typography.fontFamily.semiBold,
    fontSize: 13, 
    color: Theme.colors.text 
  },
  budgetRowValues: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 12,
    ...Theme.typography.tabularNums,
  },
  budgetRowBarBg: {
    height: 6,
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 3,
    overflow: "hidden",
  },
  budgetRowBarFill: {
    height: 6,
    backgroundColor: Theme.colors.primary,
    borderRadius: 3,
  },
  budgetPercentMini: {
    fontFamily: Theme.typography.fontFamily.semiBold,
    fontSize: 10,
    color: Theme.colors.textLight,
    textAlign: "right",
    marginTop: 6,
    textTransform: "uppercase",
  },

  // Investment
  investmentCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  investmentRow: { flexDirection: "row", justifyContent: "space-between" },
  investmentCol: { flex: 1 },
  investmentLabel: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
  },
  investmentAmount: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 17,
    color: Theme.colors.text,
    marginTop: 4,
    ...Theme.typography.tabularNums,
  },
  investmentMeta: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
    paddingTop: 10,
  },
  investmentMetaText: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  investmentMetaNote: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 11,
    color: Theme.colors.textLight,
    marginTop: 4,
  },

  // Transactions
  ledgerBox: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  ledgerRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  txnIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 38,
    height: 38,
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 8,
    textAlign: "center",
    lineHeight: 38,
  },
  txnIconContainer: {
    width: 38,
    height: 38,
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txnCategory: { 
    ...Theme.typography.presets.rowTitle,
    color: Theme.colors.text 
  },
  txnNote: { 
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.textMuted, 
    marginTop: 2,
  },
  txnAmount: { 
    ...Theme.typography.presets.monoValue,
    color: Theme.colors.text,
  },
  txnCredit: {
    fontSize: 11,
    color: Theme.colors.warning,
    fontWeight: Theme.typography.weight.bold,
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: Theme.colors.surface,
    padding: 22,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.borderSubtle,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
    marginTop: 10,
  },
  emptyText: { fontSize: 13, color: Theme.colors.textMuted, marginTop: 4, textAlign: 'center' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  budgetModalContent: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 32,
    padding: 28,
    width: "100%",
    ...Theme.shadows.premium,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    color: Theme.colors.textLight,
    fontWeight: Theme.typography.weight.extrabold,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amountInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.background,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 64,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnDelete: {
    width: 58,
    backgroundColor: Theme.colors.errorBackground,
    borderWidth: 1,
    borderColor: Theme.colors.errorLight,
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalBtnApply: {
    flex: 2,
    backgroundColor: Theme.colors.primary,
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.textMuted,
  },
  modalBtnApplyText: {
    fontSize: 14,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.surface,
  },
});

export default DashboardScreen;
