import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import InviteCodeCard from "../../components/Family/InviteCodeCard";
import MemberAvatar from "../../components/Family/MemberAvatar";
import NotificationBell from "../../components/Notifications/NotificationBell";
import { Analytics } from "../../config/firebase";
import { FAMILY_ROLES, ROLE_LABELS } from "../../constants/familyRoles";
import { getFamilyBudget } from "../../services/familyBudgetService";
import { getMonthlyFamilyExpenses } from "../../services/familyExpenseService";
import { getFamily } from "../../services/familyService";
import { getNotifications } from "../../services/notificationService";
import useAuthStore from "../../store/useAuthStore";
import useFamilyStore from "../../store/useFamilyStore";
import useNotificationStore from "../../store/useNotificationStore";

const FamilyDashboardScreen = ({ navigation }) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const userId = useAuthStore((s) => s.user?.uid);
  const {
    family,
    members,
    setFamily,
    setMembers,
    isOwner,
    isCoAdmin,
    canManageMembers,
  } = useFamilyStore();
  const { unreadCount, setNotifications, setUnreadCount } =
    useNotificationStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [monthlyExpenses, setMonthlyExpenses] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [budget, setBudget] = useState(null);

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const fetchData = async () => {
    try {
      const familyId = userProfile?.familyId || family?.id;

      if (!familyId) {
        console.log("No familyId found, redirecting to landing");
        navigation.replace("FamilyLanding");
        return;
      }

      if (!family || refreshing) {
        const familyResult = await getFamily(familyId);

        if (familyResult.success) {
          setFamily(familyResult.family);
          setMembers(familyResult.family.members || []);
        } else {
          console.log("Family not found, redirecting to landing");
          navigation.replace("FamilyLanding");
          return;
        }
      }

      // NEW: Fetch monthly expenses
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const expensesResult = await getMonthlyFamilyExpenses(
        familyId,
        month,
        year,
      );
      if (expensesResult.success) {
        setMonthlyExpenses(expensesResult.expenses);
        const total = expensesResult.expenses.reduce(
          (sum, e) => sum + (e.amount || 0),
          0,
        );
        setTotalSpent(total);
      }

      // NEW: Fetch budget
      const budgetResult = await getFamilyBudget(familyId, month, year);
      if (budgetResult.success && budgetResult.budget) {
        setBudget(budgetResult.budget);
      }

      // Fetch notifications
      const notifResult = await getNotifications();
      if (notifResult.success) {
        setNotifications(notifResult.notifications);
        setUnreadCount(notifResult.unreadCount);
      }
    } catch (error) {
      console.log("Fetch family data error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView("FamilyDashboard");
      fetchData();
    }, [userProfile?.familyId, family?.id]), // Added family?.id as dependency
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const currentMember = members.find((m) => m.userId === userId);
  const currentRole = currentMember?.role || FAMILY_ROLES.MEMBER;

  // Show loading only if we don't have family data yet
  if (loading && !family) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  // Safety check - if no family data after loading, don't render
  if (!family) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
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
        {/* Header */}
        <LinearGradient
          colors={["#6C63FF", "#4F46E5"]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.familyName}>
                {family?.name || "My Family"}
              </Text>
              <Text style={styles.roleText}>
                You are {ROLE_LABELS[currentRole]}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <NotificationBell
                unreadCount={unreadCount}
                onPress={() =>
                  navigation.navigate("Home", { screen: "Notifications" })
                }
              />
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => navigation.navigate("FamilySettings")}
              >
                <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Row - NOW WITH LIVE DATA */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{members.length}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ₹{totalSpent.toLocaleString("en-IN")}
              </Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{monthlyExpenses.length}</Text>
              <Text style={styles.statLabel}>Expenses</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {/* Quick Actions Grid - 4 per row */}
          <View style={styles.quickActionsGrid}>
            <Text style={styles.gridSectionTitle}>Quick Actions</Text>

            {/* Row 1 */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("FamilyInvite")}
              >
                <View
                  style={[
                    styles.gridActionIcon,
                    { backgroundColor: "#F0EFFF" },
                  ]}
                >
                  <Ionicons name="person-add" size={22} color="#6C63FF" />
                </View>
                <Text style={styles.gridActionText}>Invite</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("FamilyMembers")}
              >
                <View
                  style={[
                    styles.gridActionIcon,
                    { backgroundColor: "#DBEAFE" },
                  ]}
                >
                  <Ionicons name="people" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.gridActionText}>Members</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("AddFamilyExpense")}
              >
                <View style={{ width: '100%', borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <Animated.View style={{ width: 250, height: 250, transform: [{ rotate: spin }] }}>
                      <LinearGradient colors={['#9b3232', 'rgba(239,68,68,0)', 'rgba(239,68,68,0)', '#EF4444']} start={{x:0, y:0}} end={{x:1, y:1}} style={{ flex: 1 }} />
                    </Animated.View>
                  </View>
                  <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
                    <View style={[styles.gridActionIcon, { backgroundColor: "#D1FAE5", marginBottom: 4 }]}>
                      <Ionicons name="add-circle" size={22} color="#10B981" />
                    </View>
                    <Text style={[styles.gridActionText, styles.expenseGridText]}>
                      Expense
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("FamilyAnalytics")}
              >
                <View
                  style={[
                    styles.gridActionIcon,
                    { backgroundColor: "#FEF3C7" },
                  ]}
                >
                  <Ionicons name="bar-chart" size={22} color="#F59E0B" />
                </View>
                <Text style={styles.gridActionText}>Analytics</Text>
              </TouchableOpacity>
            </View>

            {/* Row 2 */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("FamilyComparison")}
              >
                <View
                  style={[
                    styles.gridActionIcon,
                    { backgroundColor: "#F0EFFF" },
                  ]}
                >
                  <Ionicons name="trending-up" size={22} color="#6C63FF" />
                </View>
                <Text style={styles.gridActionText}>Compare</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("FamilyTemplates")}
              >
                <View
                  style={[
                    styles.gridActionIcon,
                    { backgroundColor: "#D1FAE5" },
                  ]}
                >
                  <Ionicons name="repeat" size={22} color="#10B981" />
                </View>
                <Text style={styles.gridActionText}>Recurring</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("ExportExpenses")}
              >
                <View
                  style={[
                    styles.gridActionIcon,
                    { backgroundColor: "#DBEAFE" },
                  ]}
                >
                  <Ionicons name="download" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.gridActionText}>Export</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("FamilyExpenses")}
              >
                <View style={{ width: '100%', borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <Animated.View style={{ width: 250, height: 250, transform: [{ rotate: spin }] }}>
                      <LinearGradient colors={['#EF4444', 'rgba(239,68,68,0)', 'rgba(239,68,68,0)', '#EF4444']} start={{x:0, y:0}} end={{x:1, y:1}} style={{ flex: 1 }} />
                    </Animated.View>
                  </View>
                  <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
                    <View style={[styles.gridActionIcon, { backgroundColor: "#FEE2E2", marginBottom: 4 }]}>
                      <Ionicons name="receipt" size={22} color="#EF4444" />
                    </View>
                    <Text style={[styles.gridActionText, styles.expenseGridText]}>
                      Expenses
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Row 3 */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.gridActionBtn}
                onPress={() => navigation.navigate("FamilyBudget")}
              >
                <View
                  style={[
                    styles.gridActionIcon,
                    { backgroundColor: "#FEF3C7" },
                  ]}
                >
                  <Ionicons name="wallet" size={22} color="#F59E0B" />
                </View>
                <Text style={styles.gridActionText}>Budget</Text>
              </TouchableOpacity>

              {canManageMembers() && (
                <TouchableOpacity
                  style={styles.gridActionBtn}
                  onPress={() => navigation.navigate("FamilyInvite")}
                >
                  <View
                    style={[
                      styles.gridActionIcon,
                      { backgroundColor: "#E0E7FF" },
                    ]}
                  >
                    <Ionicons name="mail" size={22} color="#6C63FF" />
                  </View>
                  <Text style={styles.gridActionText}>Invite Link</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Invite Code Card */}
          {canManageMembers() && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Invite Family Members</Text>
              <InviteCodeCard
                inviteCode={family?.inviteCode || "FAM-XXXXXX"}
                familyName={family?.name || "My Family"}
                canRegenerate={isOwner() || isCoAdmin()}
                onRegenerate={() => {
                  navigation.navigate("FamilyInvite");
                }}
              />
            </View>
          )}

          {/* Members Preview */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Family Members</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("FamilyMembers")}
              >
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.membersGrid}>
              {members.slice(0, 6).map((member) => (
                <View key={member.userId} style={styles.memberCard}>
                  <MemberAvatar
                    member={member}
                    size={56}
                    showBadge={true}
                    showName={true}
                  />
                </View>
              ))}
              {members.length === 0 && (
                <Text style={styles.noMembersText}>No members yet</Text>
              )}
            </View>

            {members.length < 6 && canManageMembers() && (
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={() => navigation.navigate("FamilyInvite")}
              >
                <Ionicons name="add-circle-outline" size={20} color="#6C63FF" />
                <Text style={styles.addMemberText}>
                  Invite more members ({6 - members.length} slots available)
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* UPDATED: Live Family Expenses Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Expenses</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("FamilyExpenses")}
              >
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {monthlyExpenses.length === 0 ? (
              <View style={styles.comingSoonCard}>
                <View style={styles.comingSoonIcon}>
                  <Ionicons name="receipt-outline" size={40} color="#CBD5E1" />
                </View>
                <Text style={styles.comingSoonTitle}>No expenses yet</Text>
                <Text style={styles.comingSoonDesc}>
                  Add your first family expense to start tracking
                </Text>
                <TouchableOpacity
                  style={styles.addExpenseBtn}
                  onPress={() => navigation.navigate("AddFamilyExpense")}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.addExpenseBtnText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.expensesCard}>
                {monthlyExpenses.slice(0, 5).map((expense) => (
                  <TouchableOpacity
                    key={expense.id}
                    style={styles.expenseRow}
                    onPress={() => navigation.navigate("FamilyExpenses")}
                  >
                    <View style={styles.expenseLeft}>
                      <View
                        style={[
                          styles.expenseIcon,
                          { backgroundColor: "#F0EFFF" },
                        ]}
                      >
                        <Ionicons
                          name={expense.categoryIcon || "ellipsis-horizontal"}
                          size={20}
                          color="#6C63FF"
                        />
                      </View>
                      <View>
                        <Text style={styles.expenseName}>
                          {expense.categoryName}
                        </Text>
                        <Text style={styles.expenseMeta}>
                          By {expense.paidByName}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.expenseAmount}>
                      ₹{expense.amount.toLocaleString("en-IN")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* UPDATED: Live Family Budget Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Family Budget</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("FamilyBudget")}
              >
                <Text style={styles.seeAll}>
                  {budget ? "Manage" : "Set Budget"}
                </Text>
              </TouchableOpacity>
            </View>

            {budget && budget.overall > 0 ? (
              <View style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                  <Text style={styles.budgetLabel}>Monthly Budget</Text>
                  <Text style={styles.budgetValue}>
                    ₹{budget.overall.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={styles.budgetProgress}>
                  <View style={styles.budgetProgressBar}>
                    <View
                      style={[
                        styles.budgetProgressFill,
                        {
                          width: `${Math.min((totalSpent / budget.overall) * 100, 100)}%`,
                          backgroundColor:
                            (totalSpent / budget.overall) * 100 >= 100
                              ? "#EF4444"
                              : (totalSpent / budget.overall) * 100 >= 80
                                ? "#F59E0B"
                                : "#10B981",
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.budgetStats}>
                    <Text style={styles.budgetSpent}>
                      Spent: ₹{totalSpent.toLocaleString("en-IN")}
                    </Text>
                    <Text
                      style={[
                        styles.budgetPercent,
                        {
                          color:
                            (totalSpent / budget.overall) * 100 >= 100
                              ? "#EF4444"
                              : (totalSpent / budget.overall) * 100 >= 80
                                ? "#F59E0B"
                                : "#10B981",
                        },
                      ]}
                    >
                      {Math.round((totalSpent / budget.overall) * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.comingSoonCard}>
                <View style={styles.comingSoonIcon}>
                  <Ionicons name="wallet-outline" size={40} color="#CBD5E1" />
                </View>
                <Text style={styles.comingSoonTitle}>No budget set</Text>
                <Text style={styles.comingSoonDesc}>
                  Set a family budget to track spending limits
                </Text>
                {canManageMembers() && (
                  <TouchableOpacity
                    style={styles.addExpenseBtn}
                    onPress={() => navigation.navigate("FamilyBudget")}
                  >
                    <Ionicons name="wallet" size={20} color="#FFFFFF" />
                    <Text style={styles.addExpenseBtnText}>Set Budget</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerGradient: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  familyName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  roleText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 8,
  },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: -10,
  },
  quickActionsGrid: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  gridSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  gridActionBtn: {
    alignItems: "center",
    width: "23%",
  },
  gridActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  gridActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
  },
  expenseGridBtn: {
    borderWidth: 2,
    borderColor: "#EF4444",
    borderRadius: 18,
  },
  expenseGridText: {
    color: "#EF4444",
    fontWeight: "800",
  },
  comingSoonBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  comingSoonText: {
    fontSize: 7,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6C63FF",
  },
  membersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  memberCard: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 16,
  },
  noMembersText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    width: "100%",
    paddingVertical: 20,
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 12,
    backgroundColor: "#F0EFFF",
    borderRadius: 12,
    gap: 8,
  },
  addMemberText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6C63FF",
  },
  comingSoonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#F1F5F9",
    borderStyle: "dashed",
  },
  comingSoonIcon: {
    marginBottom: 12,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 6,
  },
  comingSoonDesc: {
    fontSize: 13,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 18,
  },
  // NEW: Expense styles
  expensesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
  },
  expenseLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  expenseName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  expenseMeta: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },

  // NEW: Budget styles
  budgetCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  budgetLabel: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
  budgetValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  budgetProgress: {
    marginTop: 0,
  },
  budgetProgressBar: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  budgetProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  budgetStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetSpent: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  budgetPercent: {
    fontSize: 14,
    fontWeight: "800",
  },

  // NEW: Action button
  addExpenseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6C63FF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  addExpenseBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default FamilyDashboardScreen;
