import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Analytics } from '../../config/firebase';
import { getAccounts } from '../../services/accountService';
import { getBudgets } from '../../services/budgetService';
import { getDashboardData } from '../../services/expenseService';
import { calculateInvestmentTotals, getAllPendingActions, getInvestments } from '../../services/investmentService';
import useAuthStore from '../../store/useAuthStore';

const DashboardScreen = ({ navigation }) => {
  const userName = useAuthStore((s) => s.getUserName());
  const userProfile = useAuthStore((s) => s.userProfile);

  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [dashData, setDashData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [investmentTotals, setInvestmentTotals] = useState(null);
const showInvestmentsInAssets = userProfile?.showInvestmentsInAssets || false;

  const cs = userProfile?.currency === 'USD' ? '$' : userProfile?.currency === 'EUR' ? '€' : '₹';

  // Replace your existing fetchAll with this:
const fetchAll = async () => {
  const [dashResult, accResult, budgetResult, invResult] = await Promise.all([
    getDashboardData(month, year),
    getAccounts(),
    getBudgets(month, year),
    getInvestments(),
  ]);

  if (dashResult.success) setDashData(dashResult.data);
  if (accResult.success) setAccounts(accResult.accounts);
  if (budgetResult.success) setBudgets(budgetResult.budgets);

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
    allInvestments
  );
  setLoading(false);
  setRefreshing(false);
};

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('Dashboard');
      fetchAll();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const generateAlerts = (accs, budgs, data, investments = []) => {
  const newAlerts = [];
  const today = new Date().getDate();

  // ===== Credit card due date alerts =====
  accs.filter(a => a.type === 'CREDIT_CARD' && (a.currentUsage || 0) > 0).forEach(cc => {
    let daysLeft = (cc.billDueDate || 15) - today;
    if (daysLeft < 0) daysLeft += 30;

    if (daysLeft <= 10) {
      newAlerts.push({
        id: `cc_due_${cc.id}`,
        type: daysLeft <= 3 ? 'DANGER' : 'WARNING',
        icon: '💳',
        title: `${cc.name} Bill Due ${daysLeft <= 0 ? 'TODAY!' : `in ${daysLeft} days`}`,
        message: `Pay ${cs}${(cc.currentUsage || 0).toLocaleString('en-IN')} to avoid ${cc.interestRate || 36}% interest`,
        color: daysLeft <= 3 ? '#EF4444' : '#F59E0B',
        bgColor: daysLeft <= 3 ? '#FEE2E2' : '#FEF3C7',
        action: () => navigation.navigate('Profile', { screen: 'CreditCardBill' }),
        actionLabel: 'Pay Now',
      });
    }

    const usagePercent = ((cc.currentUsage || 0) / (cc.creditLimit || 1)) * 100;
    if (usagePercent >= 80) {
      newAlerts.push({
        id: `cc_usage_${cc.id}`,
        type: usagePercent >= 95 ? 'DANGER' : 'WARNING',
        icon: '🔴',
        title: `${cc.name}: ${Math.round(usagePercent)}% Credit Used`,
        message: `Only ${cs}${((cc.creditLimit || 0) - (cc.currentUsage || 0)).toLocaleString('en-IN')} available`,
        color: usagePercent >= 95 ? '#EF4444' : '#F59E0B',
        bgColor: usagePercent >= 95 ? '#FEE2E2' : '#FEF3C7',
      });
    }
  });

  // ===== Bill payment reminders (partial payments) =====
  accs.filter(a =>
    a.type === 'CREDIT_CARD' &&
    a.billPaymentReminder &&
    (a.currentUsage || 0) > 0
  ).forEach(cc => {
    newAlerts.push({
      id: `cc_reminder_${cc.id}`,
      type: 'WARNING',
      icon: '🔔',
      title: `${cc.name}: Remaining Bill`,
      message: `₹${(cc.currentUsage || 0).toLocaleString('en-IN')} still unpaid. Complete your payment to avoid interest.`,
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      action: () => navigation.navigate('Profile', { screen: 'CreditCardBill' }),
      actionLabel: 'Pay Now',
    });
  });

  // ===== Investment SIP & RD alerts =====
  if (investments.length > 0) {
    const { pendingSips, pendingRdPayments } = getAllPendingActions(investments);

    pendingSips.forEach(inv => {
      newAlerts.push({
        id: `sip_due_${inv.id}`,
        type: 'WARNING',
        icon: '📊',
        title: `SIP Due: ${inv.name}`,
        message: `₹${(inv.sipAmount || 0).toLocaleString('en-IN')} SIP payment due on ${inv.sipDate}th`,
        color: '#6C63FF',
        bgColor: '#F0EFFF',
        action: () => navigation.navigate('Profile', { screen: 'Portfolio' }),
        actionLabel: 'Confirm',
      });
    });

    pendingRdPayments.forEach(inv => {
      newAlerts.push({
        id: `rd_due_${inv.id}`,
        type: 'WARNING',
        icon: '🔄',
        title: `RD Payment Due: ${inv.name}`,
        message: `₹${(inv.rdMonthlyAmount || 0).toLocaleString('en-IN')} • Month ${(inv.rdCompletedMonths || 0) + 1}/${inv.rdTotalMonths || '?'}`,
        color: '#14B8A6',
        bgColor: '#F0FDFA',
        action: () => navigation.navigate('Profile', { screen: 'Portfolio' }),
        actionLabel: 'Pay',
      });
    });
  }

  // ===== Budget alerts =====
  if (data) {
    budgs.forEach(budget => {
      let spent = 0;
      if (budget.type === 'OVERALL') {
        spent = data.totalExpense || 0;
      } else {
        const cat = data.categoryBreakdown?.find(c => c.id === budget.categoryId);
        spent = cat?.total || 0;
      }
      const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      if (percent >= 100) {
        newAlerts.push({
          id: `budget_over_${budget.id}`, type: 'DANGER', icon: '🚨',
          title: `${budget.categoryName} Budget Exceeded!`,
          message: `Spent ${cs}${spent.toLocaleString('en-IN')} of ${cs}${budget.amount.toLocaleString('en-IN')} (${Math.round(percent)}%)`,
          color: '#EF4444', bgColor: '#FEE2E2',
        });
      } else if (percent >= 80) {
        newAlerts.push({
          id: `budget_warn_${budget.id}`, type: 'WARNING', icon: '⚠️',
          title: `${budget.categoryName} Budget: ${Math.round(percent)}%`,
          message: `${cs}${(budget.amount - spent).toLocaleString('en-IN')} remaining`,
          color: '#F59E0B', bgColor: '#FEF3C7',
        });
      }
    });
  }

  newAlerts.sort((a, b) => (a.type === 'DANGER' ? -1 : 1));
  setAlerts(newAlerts);
};

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  };

  const totalAssets = accounts.filter(a => a.type !== 'CREDIT_CARD').reduce((s, a) => s + (a.balance || 0), 0);
  const totalDebts = accounts.filter(a => a.type === 'CREDIT_CARD').reduce((s, a) => s + (a.currentUsage || 0), 0);
  const investmentValue = investmentTotals?.totalCurrentValue || 0;
  const netWorth = showInvestmentsInAssets
  ? totalAssets + investmentValue - totalDebts
  : totalAssets - totalDebts;

  const formatDate = (d) => {
    if (!d) return '';
    const date = d instanceof Date ? d : d.toDate?.() || new Date(d);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C63FF']} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.name}>{userName}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            {alerts.length > 0 && <View style={styles.notifDot} />}
            <Ionicons name="notifications-outline" size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        {/* ===== ALERTS (Always on top) ===== */}
        {alerts.map((alert) => (
  <TouchableOpacity
    key={alert.id}
    style={[styles.alertCard, { backgroundColor: alert.bgColor }]}
    onPress={alert.action || undefined}
    activeOpacity={alert.action ? 0.7 : 1}
  >
    <Text style={styles.alertIcon}>{alert.icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={[styles.alertTitle, { color: alert.color }]}>{alert.title}</Text>
      <Text style={styles.alertMessage}>{alert.message}</Text>
    </View>
    {alert.actionLabel && (
      <View style={[styles.alertActionBtn, { backgroundColor: alert.color }]}>
        <Text style={styles.alertActionBtnText}>{alert.actionLabel}</Text>
      </View>
    )}
  </TouchableOpacity>
))}

        {/* Net Worth */}
<View style={styles.netWorthCard}>
  <Text style={styles.nwLabel}>Net Worth</Text>
  <Text style={styles.nwAmount}>{cs}{netWorth.toLocaleString('en-IN')}</Text>
  <View style={styles.nwRow}>
    <View style={styles.nwItem}>
      <Ionicons name="arrow-up-circle" size={16} color="#10B981" />
      <Text style={styles.nwItemText}>
        {' '}Assets: {cs}{totalAssets.toLocaleString('en-IN')}
      </Text>
    </View>
    <View style={styles.nwItem}>
      <Ionicons name="arrow-down-circle" size={16} color="#EF4444" />
      <Text style={styles.nwItemText}>
        {' '}Debts: {cs}{totalDebts.toLocaleString('en-IN')}
      </Text>
    </View>
  </View>
  {showInvestmentsInAssets && investmentValue > 0 && (
    <View style={[styles.nwItem, { marginTop: 8 }]}>
      <Ionicons name="trending-up" size={16} color="#F59E0B" />
      <Text style={styles.nwItemText}>
        {' '}Investments: {cs}{investmentValue.toLocaleString('en-IN')} (included)
      </Text>
    </View>
  )}
        </View>
        
        {/* Investment Portfolio */}
{investmentTotals && investmentTotals.activeCount > 0 && (
  <>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Investments</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Profile', { screen: 'Portfolio' })}>
        <Text style={styles.seeAll}>View All</Text>
      </TouchableOpacity>
    </View>

    <TouchableOpacity
      style={styles.investmentCard}
      onPress={() => navigation.navigate('Profile', { screen: 'Portfolio' })}
    >
      <View style={styles.investmentRow}>
        <View style={styles.investmentCol}>
          <Text style={styles.investmentLabel}>Portfolio Value</Text>
          <Text style={styles.investmentAmount}>
            {cs}{investmentTotals.totalCurrentValue.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={[styles.investmentCol, { alignItems: 'flex-end' }]}>
          <Text style={styles.investmentLabel}>Returns</Text>
          <Text style={[
            styles.investmentAmount,
            { color: investmentTotals.totalReturns >= 0 ? '#10B981' : '#EF4444', fontSize: 16 },
          ]}>
            {investmentTotals.totalReturns >= 0 ? '+' : ''}
            {cs}{investmentTotals.totalReturns.toLocaleString('en-IN')}
            {' '}({investmentTotals.returnPercent}%)
          </Text>
        </View>
      </View>
      <View style={styles.investmentMeta}>
        <Text style={styles.investmentMetaText}>
          {investmentTotals.activeCount} investments • Invested: {cs}{investmentTotals.totalInvested.toLocaleString('en-IN')}
        </Text>
        {!showInvestmentsInAssets && (
          <Text style={styles.investmentMetaNote}>Not included in net worth</Text>
        )}
      </View>
    </TouchableOpacity>
  </>
)}

        {/* Monthly Summary */}
        <Text style={styles.sectionTitle}>This Month</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
            <Ionicons name="arrow-down-circle" size={22} color="#10B981" />
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryAmount, { color: '#10B981' }]}>
              {cs}{(dashData?.totalIncome || 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#EF4444' }]}>
            <Ionicons name="arrow-up-circle" size={22} color="#EF4444" />
            <Text style={styles.summaryLabel}>Expense</Text>
            <Text style={[styles.summaryAmount, { color: '#EF4444' }]}>
              {cs}{(dashData?.totalExpense || 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#6C63FF' }]}>
            <Ionicons name="wallet" size={22} color="#6C63FF" />
            <Text style={styles.summaryLabel}>Savings</Text>
            <Text style={[styles.summaryAmount, { color: '#6C63FF' }]}>
              {cs}{(dashData?.savings || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Account Cards */}
        {accounts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Accounts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {accounts.map((acc) => (
                <View key={acc.id} style={[styles.accountCard, { backgroundColor: acc.color || '#6C63FF' }]}>
                  <Text style={styles.accCardName}>{acc.name}</Text>
                  {acc.type === 'CREDIT_CARD' ? (
                    <>
                      <Text style={styles.accCardAmount}>
                        {cs}{(acc.currentUsage || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.accCardSub}>
                        of {cs}{(acc.creditLimit || 0).toLocaleString('en-IN')}
                      </Text>
                      <View style={styles.accBarBg}>
                        <View style={[styles.accBarFill, {
                          width: `${Math.min(((acc.currentUsage || 0) / (acc.creditLimit || 1)) * 100, 100)}%`
                        }]} />
                      </View>
                    </>
                  ) : (
                    <Text style={styles.accCardAmount}>
                      {cs}{(acc.balance || 0).toLocaleString('en-IN')}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Top Categories */}
        {dashData?.categoryBreakdown?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Categories</Text>
            {dashData.categoryBreakdown.slice(0, 4).map((cat, i) => {
              const percent = dashData.totalExpense > 0
                ? Math.round((cat.total / dashData.totalExpense) * 100)
                : 0;
              return (
                <View key={cat.id} style={styles.catRow}>
                  <Text style={styles.catIcon}>{cat.icon || '📦'}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.catNameRow}>
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catAmount}>{cs}{cat.total.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.catBarBg}>
                      <View style={[styles.catBarFill, { width: `${percent}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.catPercent}>{percent}%</Text>
                </View>
              );
            })}
          </>
        )}

        {/* Budget Status */}
        {budgets.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Budget Status</Text>
            {budgets.map((budget) => {
              let spent = 0;
              if (budget.type === 'OVERALL') {
                spent = dashData?.totalExpense || 0;
              } else {
                const cat = dashData?.categoryBreakdown?.find(c => c.id === budget.categoryId);
                spent = cat?.total || 0;
              }
              const percent = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
              const exceeded = spent > budget.amount;

              return (
                <View key={budget.id} style={styles.budgetRow}>
                  <View style={styles.budgetInfo}>
                    <Text style={styles.budgetName}>{budget.categoryName}</Text>
                    <Text style={styles.budgetDetail}>
                      {cs}{spent.toLocaleString('en-IN')} / {cs}{budget.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.budgetBarBg}>
                    <View style={[
                      styles.budgetBarFill,
                      { width: `${percent}%` },
                      exceeded && { backgroundColor: '#EF4444' },
                      percent >= 80 && !exceeded && { backgroundColor: '#F59E0B' },
                    ]} />
                  </View>
                  <Text style={[styles.budgetPercent, exceeded && { color: '#EF4444' }]}>
                    {Math.round(percent)}%
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {(!dashData?.recentExpenses || dashData.recentExpenses.length === 0) ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No expenses this month</Text>
            <Text style={styles.emptyText}>Tap + to add your first expense</Text>
          </View>
        ) : (
          dashData.recentExpenses.map((exp) => (
            <TouchableOpacity
              key={exp.id}
              style={styles.txnCard}
              onPress={() => navigation.navigate('Transactions', {
                screen: 'ExpenseDetail',
                params: { expense: exp },
              })}
            >
              <Text style={styles.txnIcon}>{exp.categoryIcon || '📦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnCategory}>{exp.categoryName}</Text>
                <Text style={styles.txnNote} numberOfLines={1}>
                  {exp.note || exp.accountName} • {formatDate(exp.date)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.txnAmount}>-{cs}{exp.amount.toLocaleString('en-IN')}</Text>
                {exp.isCredit && (
                  <Text style={styles.txnCredit}>Credit Card</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[
            { label: 'Expense', icon: 'add-circle', color: '#EF4444', bg: '#FEE2E2', onPress: () => navigation.navigate('AddExpenseModal') },
            { label: 'Income', icon: 'arrow-down-circle', color: '#10B981', bg: '#D1FAE5', onPress: () => navigation.navigate('AddIncomeModal') },
            { label: 'Accounts', icon: 'card', color: '#3B82F6', bg: '#DBEAFE', onPress: () => navigation.navigate('Profile', { screen: 'ManageAccounts' }) },
            { label: 'Analytics', icon: 'pie-chart', color: '#8B5CF6', bg: '#F3E8FF', onPress: () => navigation.navigate('Analytics') },
          ].map((a, i) => (
            <TouchableOpacity key={i} style={styles.actionItem} onPress={a.onPress}>
              <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={24} color={a.color} />
              </View>
              <Text style={styles.actionText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  scrollContent: { padding: 20, paddingBottom: 100 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { fontSize: 14, color: '#6B7280' },
  name: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', marginTop: 2 },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', zIndex: 1 },

  // Alerts
  alertCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8,
  },
  alertIcon: { fontSize: 22, marginRight: 10 },
  alertTitle: { fontSize: 14, fontWeight: '600' },
  alertMessage: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  // Add to existing styles
alertActionBtn: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
  marginLeft: 8,
},
alertActionBtnText: {
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: '700',
},

  // Net Worth
  netWorthCard: { backgroundColor: '#6C63FF', padding: 20, borderRadius: 16, marginBottom: 16 },
  nwLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  nwAmount: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  nwRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  nwItem: { flexDirection: 'row', alignItems: 'center' },
  nwItemText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', marginBottom: 10, marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  seeAll: { fontSize: 14, color: '#6C63FF', fontWeight: '500' },

  // Investment Card
  investmentCard: {
  backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#E5E7EB',
  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
},
investmentRow: { flexDirection: 'row', justifyContent: 'space-between' },
investmentCol: {},
investmentLabel: { fontSize: 12, color: '#6B7280' },
investmentAmount: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginTop: 4 },
investmentMeta: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
investmentMetaText: { fontSize: 12, color: '#6B7280' },
investmentMetaNote: { fontSize: 11, color: '#F59E0B', fontStyle: 'italic', marginTop: 2 },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderLeftWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginTop: 6 },
  summaryAmount: { fontSize: 15, fontWeight: '700', marginTop: 2 },

  // Account Cards
  accountCard: {
    width: 160, padding: 16, borderRadius: 14, marginRight: 10,
  },
  accCardName: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  accCardAmount: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 8 },
  accCardSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  accBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 8 },
  accBarFill: { height: 4, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 },

  // Category rows
  catRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 12, borderRadius: 10, marginBottom: 6,
  },
  catIcon: { fontSize: 22, marginRight: 10 },
  catNameRow: { flexDirection: 'row', justifyContent: 'space-between' },
  catName: { fontSize: 14, fontWeight: '500', color: '#1A1A2E' },
  catAmount: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  catBarBg: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 6 },
  catBarFill: { height: 4, backgroundColor: '#6C63FF', borderRadius: 2 },
  catPercent: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginLeft: 8, width: 35, textAlign: 'right' },

  // Budget rows
  budgetRow: {
    backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, marginBottom: 6,
  },
  budgetInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetName: { fontSize: 14, fontWeight: '500', color: '#1A1A2E' },
  budgetDetail: { fontSize: 12, color: '#6B7280' },
  budgetBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 },
  budgetBarFill: { height: 6, backgroundColor: '#6C63FF', borderRadius: 3 },
  budgetPercent: { fontSize: 12, fontWeight: '600', color: '#6B7280', textAlign: 'right', marginTop: 4 },

  // Transactions
  txnCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 14, borderRadius: 12, marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  txnIcon: { fontSize: 24, marginRight: 12 },
  txnCategory: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  txnNote: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  txnCredit: { fontSize: 10, color: '#F59E0B', marginTop: 2 },

  // Quick Actions
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionItem: { alignItems: 'center', width: '22%' },
  actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionText: { fontSize: 11, color: '#6B7280' },

  // Empty
  emptyCard: {
    backgroundColor: '#FFFFFF', padding: 32, borderRadius: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginTop: 12 },
  emptyText: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});

export default DashboardScreen;