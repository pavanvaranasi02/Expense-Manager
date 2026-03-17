import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import NotificationBell from "../../components/Notifications/NotificationBell";
import { Analytics } from "../../config/firebase";
import { getAccounts } from "../../services/accountService";
import { updateUserProfile } from "../../services/authService";
import {
  deleteBudget,
  getBudgets,
  updateBudget,
} from "../../services/budgetService";
import { getDashboardData } from "../../services/expenseService";
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

const screenWidth = Dimensions.get("window").width;

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
    userProfile?.currency === "USD"
      ? "$"
      : userProfile?.currency === "EUR"
        ? "€"
        : "₹";

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

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setNewBudgetAmount(budget.amount.toString());
    setShowBudgetModal(true);
  };

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

  const totalAssets = accounts
    .filter((a) => a.type !== "CREDIT_CARD")
    .reduce((s, a) => s + (a.balance || 0), 0);
  const totalDebts = accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((s, a) => s + (a.currentUsage || 0), 0);
  const investmentValue = investmentTotals?.totalCurrentValue || 0;
  const netWorth = showInvestmentsInAssets
    ? totalAssets + investmentValue - totalDebts
    : totalAssets - totalDebts;

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#6C63FF" />
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
            colors={["#6C63FF"]}
          />
        }
      >
        {/* Header Section with Gradient */}
        <LinearGradient
          colors={["#6C63FF", "#4F46E5"]}
          style={styles.topSection}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{getGreeting()} 👋</Text>
              <Text style={styles.name}>{userName}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {/* Eye icon - only shows when stealth mode is OFF, clicking enables it */}
              {!isStealthMode && (
                <TouchableOpacity
                  style={styles.notifBtn}
                  onPress={() => {
                    Alert.alert(
                      "Enable Stealth Mode",
                      "Once enabled, you can only turn off Stealth Mode from the Settings screen. Do you want to continue?",
                      [
                        {
                          text: "Cancel",
                          style: "cancel",
                        },
                        {
                          text: "Enable",
                          onPress: async () => {
                            // Enable stealth mode
                            toggleStealthMode();
                            // Sync to Firebase
                            setTimeout(async () => {
                              const userId = useAuthStore.getState().user?.uid;
                              const newState =
                                useAuthStore.getState().isStealthMode;
                              if (userId) {
                                await updateUserProfile(userId, {
                                  isStealthMode: newState,
                                });
                              }
                            }, 0);
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Ionicons name="eye" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <NotificationBell
                unreadCount={unreadCount}
                onPress={() => navigation.navigate("Notifications")}
              />
            </View>
          </View>

          <View style={styles.netWorthSection}>
            <Text style={styles.nwLabel}>Net Worth Balance</Text>
            <Text style={styles.nwAmount}>
              {formatCurrency(netWorth, isStealthMode, cs)}
            </Text>

            <View style={styles.nwBreakdown}>
              <View style={styles.nwBadge}>
                <Ionicons name="arrow-up" size={12} color="#10B981" />
                <Text style={styles.nwBadgeText}>
                  Assets: {formatCurrency(totalAssets, isStealthMode, cs)}
                </Text>
              </View>
              <View
                style={[
                  styles.nwBadge,
                  { backgroundColor: "rgba(239, 68, 68, 0.15)" },
                ]}
              >
                <Ionicons name="arrow-down" size={12} color="#EF4444" />
                <Text style={[styles.nwBadgeText, { color: "#EF4444" }]}>
                  Debt: {formatCurrency(totalDebts, isStealthMode, cs)}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {/* Quick Actions - Floating style */}
          <View style={styles.quickActionsContainer}>
            {[
              {
                label: "Expense ",
                icon: "remove-circle",
                color: "#EF4444",
                bg: "#FEE2E2",
                onPress: () => navigation.navigate("AddExpenseModal"),
              },
              {
                label: "Income ",
                icon: "add-circle",
                color: "#10B981",
                bg: "#D1FAE5",
                onPress: () => navigation.navigate("AddIncomeModal"),
              },
              {
                label: "Accounts ",
                icon: "card",
                color: "#3B82F6",
                bg: "#DBEAFE",
                onPress: () =>
                  navigation.navigate("Profile", { screen: "ManageAccounts" }),
              },
              {
                label: "Analytics ",
                icon: "bar-chart",
                color: "#8B5CF6",
                bg: "#F3E8FF",
                onPress: () => navigation.navigate("AnalyticsMain"),
              },
            ].map((a, i) => (
              <TouchableOpacity
                key={i}
                style={styles.actionItem}
                onPress={a.onPress}
              >
                <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={styles.actionText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Financial Summary Unified Card */}
          <View style={styles.unifiedCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Activity This Month</Text>
              <Text style={styles.cardSubtitle}>
                {new Date().toLocaleString("default", { month: "long" })}
              </Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>Income</Text>
                <Text style={[styles.summaryGridValue, { color: "#10B981" }]}>
                  {formatCurrency(
                    dashData?.totalIncome || 0,
                    isStealthMode,
                    cs,
                  )}
                </Text>
              </View>
              <View style={styles.summaryGridDivider} />
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>Spent</Text>
                <Text style={[styles.summaryGridValue, { color: "#EF4444" }]}>
                  {formatCurrency(
                    dashData?.totalExpense || 0,
                    isStealthMode,
                    cs,
                  )}
                </Text>
              </View>
              <View style={styles.summaryGridDivider} />
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>Savings</Text>
                <Text style={[styles.summaryGridValue, { color: "#6C63FF" }]}>
                  {formatCurrency(dashData?.savings || 0, isStealthMode, cs)}
                </Text>
              </View>
            </View>
          </View>

          {/* Investment Portfolio */}
          {investmentTotals && investmentTotals.activeCount > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Investments</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("Profile", { screen: "Portfolio" })
                  }
                >
                  <Text style={styles.seeAll}>View All</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.investmentCard}
                onPress={() =>
                  navigation.navigate("Profile", { screen: "Portfolio" })
                }
              >
                <View style={styles.investmentRow}>
                  <View style={styles.investmentCol}>
                    <Text style={styles.investmentLabel}>Portfolio Value</Text>
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
                    <Text style={styles.investmentLabel}>Returns</Text>
                    <Text
                      style={[
                        styles.investmentAmount,
                        {
                          color:
                            investmentTotals.totalReturns >= 0
                              ? "#10B981"
                              : "#EF4444",
                          fontSize: 16,
                        },
                      ]}
                    >
                      {investmentTotals.totalReturns >= 0 ? "+" : ""}
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
                <View style={styles.investmentMeta}>
                  <Text style={styles.investmentMetaText}>
                    {investmentTotals.activeCount} investments • Invested:{" "}
                    {formatCurrency(
                      investmentTotals.totalInvested,
                      isStealthMode,
                      cs,
                    )}
                  </Text>
                  {!showInvestmentsInAssets && (
                    <Text style={styles.investmentMetaNote}>
                      Not included in net worth
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Account Cards */}
          {accounts.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Accounts</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("Profile", { screen: "ManageAccounts" })
                  }
                >
                  <Text style={styles.seeAll}>Manage </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.accountsScroll}
                contentContainerStyle={{ paddingRight: 20 }}
              >
                {accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.accountCard,
                      { backgroundColor: acc.color || "#6C63FF" },
                    ]}
                    activeOpacity={0.9}
                  >
                    <View style={styles.accCardTop}>
                      <Text style={styles.accCardName}>{acc.name}</Text>
                      <Ionicons
                        name={acc.type === "CREDIT_CARD" ? "card" : "wallet"}
                        size={16}
                        color="rgba(255,255,255,0.6)"
                      />
                    </View>
                    <View style={styles.accCardBottom}>
                      {acc.type === "CREDIT_CARD" ? (
                        <>
                          <Text style={styles.accCardAmount}>
                            {cs}
                            {(acc.currentUsage || 0).toLocaleString("en-IN")}
                          </Text>
                          <Text style={styles.accCardSub}>
                            of {cs}
                            {(acc.creditLimit || 0).toLocaleString("en-IN")}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.accCardAmount}>
                          {formatCurrency(acc.balance || 0, isStealthMode, cs)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Spendings Section - Pie Chart Visualization */}
          {dashData?.categoryBreakdown?.length > 0 && (
            <View style={styles.spendingsContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Spendings</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("AnalyticsMain")}
                >
                  <Text style={styles.seeAll}>Insights</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.chartWrapper}>
                <PieChart
                  data={dashData.categoryBreakdown
                    .slice(0, 5)
                    .map((cat, index) => {
                      const isStealth = isStealthMode;
                      const percent =
                        dashData.totalExpense > 0
                          ? Math.round(
                              (cat.total / dashData.totalExpense) * 100,
                            )
                          : 0;
                      return {
                        name: isStealth
                          ? `${cat.name} (${percent}%)`
                          : cat.name,
                        population: cat.total,
                        color: [
                          "#6C63FF",
                          "#3B82F6",
                          "#10B981",
                          "#F59E0B",
                          "#EF4444",
                        ][index % 5],
                        legendFontColor: "#64748B",
                        legendFontSize: 11,
                      };
                    })}
                  width={screenWidth - 40}
                  height={180}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  center={[5, 0]}
                  absolute
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScrollMini}
                contentContainerStyle={{ paddingRight: 20 }}
              >
                {dashData.categoryBreakdown
                  .filter(
                    (cat) => !budgets.some((b) => b.categoryId === cat.id),
                  )
                  .slice(0, 6)
                  .map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.catSnapCardMini}
                      onPress={() =>
                        navigation.navigate("Transactions", {
                          categoryId: cat.id,
                          categoryName: cat.name,
                        })
                      }
                    >
                      {cat.icon && cat.icon.length > 2 ? (
                        <View style={styles.catSnapIconContainer}>
                          <Ionicons name={cat.icon} size={20} color="#6C63FF" />
                        </View>
                      ) : (
                        <Text style={styles.catSnapEmoji}>
                          {cat.icon || "📦"}
                        </Text>
                      )}
                      <Text style={styles.catSnapName} numberOfLines={1}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          )}

          {/* Unified Budget Progress - Scrollable to avoid clutter */}
          {budgets.length > 0 && (
            <View style={styles.budgetMainWrapper}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Budget Progress</Text>
              </View>
              <ScrollView
                style={styles.budgetScrollContainer}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.budgetUnifiedContainer}>
                  {budgets.map((budget, index) => {
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
                      budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
                    const exceeded = spent > budget.amount;

                    return (
                      <TouchableOpacity
                        key={budget.id}
                        style={[
                          styles.budgetModernRow,
                          index === budgets.length - 1 && {
                            borderBottomWidth: 0,
                          },
                        ]}
                        onPress={() => handleEditBudget(budget)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.budgetRowTop}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Text style={styles.budgetRowName}>
                              {budget.categoryName}
                            </Text>
                            <Ionicons
                              name="pencil"
                              size={10}
                              color="#94A3B8"
                              style={{ marginLeft: 6 }}
                            />
                          </View>
                          <Text style={styles.budgetRowValues}>
                            <Text
                              style={{
                                fontWeight: "700",
                                color: exceeded ? "#EF4444" : "#1E293B",
                              }}
                            >
                              {formatCurrency(spent, isStealthMode, cs)}
                            </Text>
                            <Text style={{ color: "#94A3B8" }}>
                              {" "}
                              /{" "}
                              {formatCurrency(budget.amount, isStealthMode, cs)}
                            </Text>
                          </Text>
                        </View>
                        <View style={styles.budgetRowBarBg}>
                          <View
                            style={[
                              styles.budgetRowBarFill,
                              { width: `${Math.min(percent, 100)}%` },
                              exceeded && { backgroundColor: "#EF4444" },
                              percent >= 85 &&
                                !exceeded && { backgroundColor: "#F59E0B" },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.budgetPercentMini,
                            exceeded && { color: "#EF4444" },
                          ]}
                        >
                          {Math.round(percent)}% used
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
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
                    <Ionicons name="trash" size={20} color="#EF4444" />
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
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.modalBtnApplyText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Recent Transactions */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Transactions")}
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {!dashData?.recentExpenses || dashData.recentExpenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No expenses this month</Text>
              <Text style={styles.emptyText}>
                Tap + to add your first expense
              </Text>
            </View>
          ) : (
            dashData.recentExpenses.map((exp) => (
              <TouchableOpacity
                key={exp.id}
                style={styles.txnCard}
                onPress={() =>
                  navigation.navigate("Transactions", {
                    screen: "ExpenseDetail",
                    params: { expense: exp },
                  })
                }
              >
                {exp.categoryIcon && exp.categoryIcon.length > 2 ? (
                  <View style={styles.txnIconContainer}>
                    <Ionicons
                      name={exp.categoryIcon}
                      size={20}
                      color="#DC2626"
                    />
                  </View>
                ) : (
                  <Text style={styles.txnIcon}>{exp.categoryIcon || "📦"}</Text>
                )}
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
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FE" },
  scrollContent: { paddingBottom: 120 },
  topSection: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
  name: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", marginTop: 2 },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  notifDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
    borderWeight: 1,
    borderColor: "#FFFFFF",
  },

  netWorthSection: { alignItems: "center" },
  nwLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  nwAmount: { fontSize: 36, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },
  nwBreakdown: { flexDirection: "row", gap: 10, marginTop: 16 },
  nwBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  nwBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
    marginLeft: 4,
  },

  mainContent: { paddingHorizontal: 20, marginTop: -25 },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 18,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  actionItem: { alignItems: "center", width: "22%" },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  actionText: { fontSize: 10, fontWeight: "700", color: "#64748B" },

  // Unified Card
  unifiedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  cardSubtitle: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  summaryGrid: { flexDirection: "row", alignItems: "center" },
  summaryGridItem: { flex: 1, alignItems: "center" },
  summaryGridLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryGridValue: { fontSize: 15, fontWeight: "800" },
  summaryGridDivider: { width: 1, height: 24, backgroundColor: "#F1F5F9" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  seeAll: { fontSize: 11, color: "#6C63FF", fontWeight: "700" },

  // Accounts
  accountsScroll: { marginHorizontal: -20, paddingLeft: 20, marginTop: 4 },
  accountCard: {
    width: 130,
    height: 80,
    borderRadius: 16,
    padding: 10,
    marginRight: 10,
    justifyContent: "space-between",
  },
  accCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accCardName: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
  },
  accCardBottom: {},
  accCardAmount: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  accCardSub: { fontSize: 8, color: "rgba(255,255,255,0.6)", marginTop: 1 },

  // Spendings Pie
  spendingsContainer: { marginTop: 4 },
  chartWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  categoriesScrollMini: { marginHorizontal: -20, paddingLeft: 20 },
  catSnapCardMini: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  catSnapEmoji: { fontSize: 14, marginRight: 6 },
  catSnapIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F0EFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  catSnapName: { fontSize: 10, fontWeight: "700", color: "#64748B" },

  // Budget Refined
  budgetMainWrapper: { marginTop: 4 },
  budgetScrollContainer: { maxHeight: 220 },
  budgetUnifiedContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  budgetModernRow: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  budgetRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  budgetRowName: { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  budgetRowValues: { fontSize: 11 },
  budgetRowBarBg: {
    height: 5,
    backgroundColor: "#F1F5F9",
    borderRadius: 2.5,
    overflow: "hidden",
  },
  budgetRowBarFill: {
    height: 5,
    backgroundColor: "#6C63FF",
    borderRadius: 2.5,
  },
  budgetPercentMini: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    textAlign: "right",
    marginTop: 4,
    textTransform: "uppercase",
  },

  // Investment
  investmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  investmentRow: { flexDirection: "row", justifyContent: "space-between" },
  investmentLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  investmentAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 4,
  },
  investmentMeta: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  investmentMetaText: { fontSize: 12, color: "#64748B" },
  investmentMetaNote: {
    fontSize: 11,
    color: "#F59E0B",
    fontStyle: "italic",
    marginTop: 2,
  },

  // Budget
  budgetRow: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  budgetInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  budgetName: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  budgetDetail: { fontSize: 12, color: "#64748B" },
  budgetBarBg: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3 },
  budgetBarFill: { height: 6, backgroundColor: "#6C63FF", borderRadius: 3 },
  budgetPercent: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "right",
    marginTop: 6,
  },

  // Transaction card
  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  txnIcon: {
    fontSize: 22,
    marginRight: 12,
    width: 40,
    height: 40,
    backgroundColor: "#F8F9FE",
    borderRadius: 10,
    textAlign: "center",
    lineHeight: 40,
  },
  txnIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: "#F8F9FE",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txnCategory: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  txnNote: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
  txnCredit: {
    fontSize: 10,
    color: "#F59E0B",
    fontWeight: "600",
    marginTop: 2,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 12,
  },
  emptyText: { fontSize: 13, color: "#94A3B8", marginTop: 4 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  budgetModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  amountInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FE",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6C63FF",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnDelete: {
    width: 52,
    backgroundColor: "#FEE2E2",
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  modalBtnApply: {
    flex: 2,
    backgroundColor: "#6C63FF",
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  modalBtnApplyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default DashboardScreen;
