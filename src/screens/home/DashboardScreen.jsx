import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Theme } from "../../theme/theme";

import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
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

  const { totalAssets, totalDebts, netWorth } = useMemo(() => {
    const assets = accounts
      .filter((a) => a.type !== "CREDIT_CARD")
      .reduce((s, a) => s + (a.balance || 0), 0);
    const debts = accounts
      .filter((a) => a.type === "CREDIT_CARD")
      .reduce((s, a) => s + (a.currentUsage || 0), 0);
    const invValue = investmentTotals?.totalCurrentValue || 0;
    const nw = showInvestmentsInAssets ? assets + invValue - debts : assets - debts;

    return { totalAssets: assets, totalDebts: debts, netWorth: nw };
  }, [accounts, investmentTotals, showInvestmentsInAssets]);

  const investmentValue = investmentTotals?.totalCurrentValue || 0;

  const chartData = useMemo(() => {
    if (!dashData?.categoryBreakdown) return [];
    return dashData.categoryBreakdown.slice(0, 5).map((cat, index) => {
      const percent =
        dashData.totalExpense > 0
          ? Math.round((cat.total / dashData.totalExpense) * 100)
          : 0;
      return {
        name: isStealthMode ? `${cat.name} (${percent}%)` : cat.name,
        population: cat.total,
        color: [
          Theme.colors.primary,
          Theme.colors.info,
          Theme.colors.success,
          Theme.colors.warning,
          Theme.colors.error,
        ][index % 5],
        legendFontColor: Theme.colors.textMuted,
        legendFontSize: 11,
      };
    });
  }, [dashData, isStealthMode]);

  const trendData = useMemo(() => {
    if (!dashData?.dailyTotals) return null;
    
    // Sort days and get last 7 active spending days
    const activeDays = Object.keys(dashData.dailyTotals)
      .map(d => parseInt(d))
      .sort((a, b) => a - b);
    
    // Take the last 7 days from the array
    const selection = activeDays.slice(-7);
    
    return {
      labels: selection.map(d => `${d}`),
      datasets: [
        {
          data: selection.map(d => dashData.dailyTotals[d])
        }
      ]
    };
  }, [dashData]);

  const cumulativeData = useMemo(() => {
    if (!dashData?.dailyTotals) return null;
    const days = Object.keys(dashData.dailyTotals).map(d => parseInt(d)).sort((a, b) => a - b);
    let runningSum = 0;
    const history = [];
    const labels = [];
    
    // Fill in every 5 days for a clean line
    days.forEach((day, idx) => {
      runningSum += dashData.dailyTotals[day];
      if (idx % 3 === 0 || idx === days.length - 1) {
        history.push(runningSum);
        labels.push(`${day}`);
      }
    });

    return {
      labels,
      datasets: [{ data: history }]
    };
  }, [dashData]);


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
        {/* Clean Modern Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greetingText}>{greeting} 👋</Text>
              <Text style={styles.userNameText}>{userName}</Text>
            </View>
            <View style={styles.headerRight}>
               <TouchableOpacity 
                style={styles.headerIconBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Toggle stealth mode logic is already handled, let's just make it accessible
                  toggleStealthMode();
                }}
               >
                 <Ionicons name={isStealthMode ? "eye-off" : "eye"} size={22} color={Theme.colors.textMuted} />
               </TouchableOpacity>
               <NotificationBell
                  unreadCount={unreadCount}
                  onPress={() => navigation.navigate("Notifications")}
               />
            </View>
          </View>

          {/* Hero Net Worth Card */}
          <LinearGradient
            colors={[Theme.colors.primary, Theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>TOTAL NET WORTH</Text>
            <Text style={styles.heroAmount}>
              {formatCurrency(netWorth, isStealthMode, cs)}
            </Text>
            
            <View style={styles.heroDivider} />
            
            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <View style={styles.heroStatIcon}>
                    <Ionicons name="trending-up" size={14} color="#FFF" />
                </View>
                <View>
                    <Text style={styles.heroStatLabel}>ASSETS</Text>
                    <Text style={styles.heroStatValue}>{formatCurrency(totalAssets, isStealthMode, cs)}</Text>
                </View>
              </View>
              <View style={styles.heroStatItem}>
                <View style={[styles.heroStatIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name="trending-down" size={14} color="#FFF" />
                </View>
                <View>
                    <Text style={styles.heroStatLabel}>DEBTS</Text>
                    <Text style={styles.heroStatValue}>{formatCurrency(totalDebts, isStealthMode, cs)}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <Animated.View style={[styles.mainContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Quick Actions - Bento Box Style */}


          {/* Quick Actions - Floating style */}
          <View style={styles.quickActionsContainer}>
            {[
              {
                label: "Expense",
                icon: "remove-circle",
                color: Theme.colors.error,
                bg: Theme.colors.errorLight,
                onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("AddExpenseModal");
                },
              },
              {
                label: "Income",
                icon: "add-circle",
                color: Theme.colors.success,
                bg: Theme.colors.successLight,
                onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("AddIncomeModal");
                },
              },
              {
                label: "Accounts",
                icon: "card",
                color: Theme.colors.info,
                bg: Theme.colors.infoLight,
                onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Profile", { screen: "ManageAccounts" });
                },
              },
              {
                label: "Analytics",
                icon: "bar-chart",
                color: Theme.colors.secondary,
                bg: Theme.colors.secondaryLight,
                onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("AnalyticsMain");
                },
              },


            ].map((a, i) => (
              <TouchableOpacity
                key={i}
                style={styles.actionItem}
                onPress={a.onPress}
                activeOpacity={0.7}
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
                <Text style={[styles.summaryGridValue, { color: Theme.colors.success }]}>
                  {formatCurrency(dashData?.totalIncome || 0, isStealthMode, cs)}
                </Text>
              </View>
              <View style={styles.summaryGridDivider} />
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>Spent</Text>
                <Text style={[styles.summaryGridValue, { color: Theme.colors.error }]}>
                  {formatCurrency(dashData?.totalExpense || 0, isStealthMode, cs)}
                </Text>
              </View>
              <View style={styles.summaryGridDivider} />
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridLabel}>Savings</Text>
                <Text style={[styles.summaryGridValue, { color: Theme.colors.primary }]}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.investmentAmount,
                          {
                            color: investmentTotals.totalReturns >= 0 ? Theme.colors.success : Theme.colors.error,
                            fontSize: 16,
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
                      <Ionicons 
                        name={investmentTotals.totalReturns >= 0 ? "trending-up" : "trending-down"} 
                        size={16} 
                        color={investmentTotals.totalReturns >= 0 ? Theme.colors.success : Theme.colors.error} 
                        style={{ marginLeft: 6 }} 
                      />
                    </View>
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
                      { backgroundColor: acc.color || Theme.colors.primary },

                    ]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
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
                  data={chartData}
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

              {trendData && trendData.labels.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Daily Momentum</Text>
                    <Text style={styles.cardSubtitle}>Last 7 Dynamic Days</Text>
                  </View>
                  <View style={styles.chartWrapper}>
                    <BarChart
                      data={trendData}
                      width={screenWidth - 60}
                      height={200}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => Theme.colors.primary,
                        labelColor: (opacity = 1) => Theme.colors.textLight,
                        style: { borderRadius: 16 },
                        propsForBackgroundLines: {
                          strokeDasharray: '', // solid background lines
                          stroke: Theme.colors.border,
                        },
                      }}
                      verticalLabelRotation={0}
                      style={{
                        marginVertical: 8,
                        borderRadius: 16,
                      }}
                      showValuesOnTopOfBars={true}
                      fromZero={true}
                    />
                  </View>
                </>
              )}

              {cumulativeData && cumulativeData.labels.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Spending Pace</Text>
                    <Text style={styles.cardSubtitle}>Monthly Accumulation</Text>
                  </View>
                  <View style={styles.chartWrapper}>
                    <LineChart
                      data={cumulativeData}
                      width={screenWidth - 60}
                      height={180}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        color: (opacity = 1) => Theme.colors.secondary,
                        labelColor: (opacity = 1) => Theme.colors.textLight,
                        propsForDots: {
                          r: '4',
                          strokeWidth: '2',
                          stroke: Theme.colors.secondary,
                        },
                        propsForBackgroundLines: {
                          strokeWidth: 1,
                          stroke: Theme.colors.border,
                        },
                      }}
                      bezier
                      style={{
                        marginVertical: 8,
                        borderRadius: 16,
                      }}
                    />
                  </View>
                </>
              )}


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
                          <Ionicons name={cat.icon} size={20} color={Theme.colors.primary} />

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
                              color={Theme.colors.textLight}

                              style={{ marginLeft: 6 }}
                            />
                          </View>
                          <Text style={styles.budgetRowValues}>
                            <Text
                              style={{
                                fontWeight: "700",
                                color: exceeded ? Theme.colors.error : Theme.colors.text,

                              }}
                            >
                              {formatCurrency(spent, isStealthMode, cs)}
                            </Text>
                            <Text style={{ color: Theme.colors.textLight }}>
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
                              exceeded && { backgroundColor: Theme.colors.error },
                              percent >= 85 &&
                                !exceeded && { backgroundColor: Theme.colors.warning },

                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.budgetPercentMini,
                            exceeded && { color: Theme.colors.error },

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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("Transactions");
              }}
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Transactions", {
                    screen: "ExpenseDetail",
                    params: { expense: exp },
                  });
                }}

              >
                {exp.categoryIcon && exp.categoryIcon.length > 2 ? (
                  <View style={styles.txnIconContainer}>
                    <Ionicons
                      name={exp.categoryIcon}
                      size={20}
                      color={Theme.colors.error}

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
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scrollContent: { paddingBottom: 120 },
  

  headerContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  greetingText: {
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.textLight,
    fontWeight: Theme.typography.weight.semibold,
  },
  userNameText: {
    fontSize: Theme.typography.size.lg,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },

  // Hero Card
  heroCard: {
    padding: 24,
    borderRadius: 32,
    ...Theme.shadows.premium,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: Theme.typography.weight.extrabold,
    letterSpacing: 1.5,
  },
  heroAmount: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: Theme.typography.weight.extrabold,
    marginTop: 8,
    letterSpacing: -1,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 20,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: Theme.typography.weight.extrabold,
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: Theme.typography.weight.bold,
    marginTop: 1,
  },

  mainContent: { paddingHorizontal: Theme.spacing.lg },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: -15, // Overlap effect
    ...Theme.shadows.card,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
  },
  actionItem: { alignItems: "center", width: "23%" },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Theme.spacing.xs,
  },
  actionText: { 
    fontSize: 11, 
    fontWeight: Theme.typography.weight.bold, 
    color: Theme.colors.textMuted 
  },

  // Cards
  unifiedCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    padding: 20,
    marginTop: 24,
    ...Theme.shadows.soft,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
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
    marginTop: 32,
    marginBottom: 16,
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

  // Accounts
  accountsScroll: { marginHorizontal: -20, paddingLeft: 20 },
  accountCard: {
    width: 160,
    height: 100,
    borderRadius: 24,
    padding: 16,
    marginRight: 12,
    justifyContent: "space-between",
    ...Theme.shadows.card,
  },
  accCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accCardName: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: Theme.typography.weight.bold,
  },
  accCardBottom: {},
  accCardAmount: { 
    fontSize: 18, 
    fontWeight: Theme.typography.weight.extrabold, 
    color: Theme.colors.surface 
  },
  accCardSub: { fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 2 },

  // Charts
  spendingsContainer: { marginTop: 4 },
  chartWrapper: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    ...Theme.shadows.soft,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 20,
  },
  categoriesScrollMini: { marginHorizontal: -20, paddingLeft: 20 },
  catSnapCardMini: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },
  catSnapEmoji: { fontSize: 16, marginRight: 8 },
  catSnapIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  catSnapName: { 
    fontSize: 12, 
    fontWeight: Theme.typography.weight.bold, 
    color: Theme.colors.textMuted 
  },

  // Budget
  budgetMainWrapper: { marginTop: 4 },
  budgetScrollContainer: { maxHeight: 300 },
  budgetUnifiedContainer: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    padding: 20,
    ...Theme.shadows.soft,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  budgetModernRow: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  budgetRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  budgetRowName: { 
    fontSize: 14, 
    fontWeight: Theme.typography.weight.bold, 
    color: Theme.colors.text 
  },
  budgetRowValues: { fontSize: 13 },
  budgetRowBarBg: {
    height: 8,
    backgroundColor: Theme.colors.background,
    borderRadius: 4,
    overflow: "hidden",
  },
  budgetRowBarFill: {
    height: 8,
    backgroundColor: Theme.colors.primary,
    borderRadius: 4,
  },
  budgetPercentMini: {
    fontSize: 10,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.textLight,
    textAlign: "right",
    marginTop: 8,
    textTransform: "uppercase",
  },

  // Investment
  investmentCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.card,
  },
  investmentRow: { flexDirection: "row", justifyContent: "space-between" },
  investmentCol: { flex: 1 },
  investmentLabel: {
    fontSize: 10,
    color: Theme.colors.textLight,
    fontWeight: Theme.typography.weight.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  investmentAmount: {
    fontSize: 18,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    marginTop: 6,
  },
  investmentMeta: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 16,
  },
  investmentMetaText: { fontSize: 13, color: Theme.colors.textMuted, fontWeight: '500' },
  investmentMetaNote: {
    fontSize: 11,
    color: Theme.colors.warning,
    fontWeight: Theme.typography.weight.bold,
    marginTop: 4,
  },

  // Transactions
  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },
  txnIcon: {
    fontSize: 24,
    marginRight: 16,
    width: 48,
    height: 48,
    backgroundColor: Theme.colors.background,
    borderRadius: 14,
    textAlign: "center",
    lineHeight: 48,
  },
  txnIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: Theme.colors.background,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  txnCategory: { 
    fontSize: 15, 
    fontWeight: Theme.typography.weight.bold, 
    color: Theme.colors.text 
  },
  txnNote: { 
    fontSize: 12, 
    color: Theme.colors.textLight, 
    marginTop: 4,
    fontWeight: Theme.typography.weight.medium,
  },
  txnAmount: { 
    fontSize: 16, 
    fontWeight: Theme.typography.weight.extrabold, 
    color: Theme.colors.error 
  },
  txnCredit: {
    fontSize: 11,
    color: Theme.colors.warning,
    fontWeight: Theme.typography.weight.bold,
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: Theme.colors.surface,
    padding: 40,
    borderRadius: 28,
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: Theme.colors.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
    marginTop: 16,
  },
  emptyText: { fontSize: 14, color: Theme.colors.textLight, marginTop: 8, textAlign: 'center' },

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
