import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BalanceHero from '../../components/ui/BalanceHero';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { getCurrencySymbol } from '../../constants/currencies';
import { getAccounts } from '../../services/accountService';
import { getBudgets } from '../../services/budgetService';
import { getDashboardData } from '../../services/expenseService';
import { getInvestments } from '../../services/investmentService';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '../../utils/format';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PlanScreen = ({ navigation }) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const cs = userProfile?.currencySymbol || getCurrencySymbol(userProfile?.currency, '₹');

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [budgets, setBudgets] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [recurringInvs, setRecurringInvs] = useState([]);

  const fetchPlanData = useCallback(async () => {
    try {
      const [budgetRes, dashRes, accRes, invRes] = await Promise.all([
        getBudgets(month, year),
        getDashboardData(month, year),
        getAccounts(),
        getInvestments(),
      ]);

      if (budgetRes?.success) setBudgets(budgetRes.budgets || []);
      if (dashRes?.success) setCategoryBreakdown(dashRes.data?.categoryBreakdown || []);
      if (accRes?.success) {
        const cards = (accRes.accounts || []).filter(
          (a) => a.type === 'CREDIT_CARD' && a.isActive !== false
        );
        setCreditCards(cards);
      }
      if (invRes?.success) {
        const sips = (invRes.investments || []).filter(
          (i) => i.isActive && (i.type === 'SIP' || i.type === 'RD' || i.isRecurring)
        );
        setRecurringInvs(sips);
      }
    } catch (e) {
      console.log('Plan fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      fetchPlanData();
    }, [fetchPlanData])
  );

  const changeMonth = (dir) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const formatAmt = (val) => formatCurrency(val || 0, isStealthMode, cs);

  // Merge budgets with actual category spend
  const enrichedBudgets = useMemo(() => {
    const spendMap = {};
    categoryBreakdown.forEach((c) => {
      spendMap[c.originalId || c.id] = c.total || 0;
      if (c.name) spendMap[c.name.toLowerCase()] = c.total || 0;
    });

    return budgets.map((b) => {
      const spent =
        spendMap[b.categoryId] ??
        spendMap[(b.categoryName || '').toLowerCase()] ??
        b.spent ??
        0;
      const limit = Number(b.amount) || 0;
      const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      const isOver = spent > limit && limit > 0;
      return { ...b, spent, limit, pct, isOver };
    });
  }, [budgets, categoryBreakdown]);

  const totalBudgeted = useMemo(
    () => enrichedBudgets.reduce((s, b) => s + b.limit, 0),
    [enrichedBudgets]
  );
  const totalSpent = useMemo(
    () => enrichedBudgets.reduce((s, b) => s + b.spent, 0),
    [enrichedBudgets]
  );
  const overallPct = totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;

  // Upcoming Credit Card Bills sorted by due date proximity
  const upcomingBills = useMemo(() => {
    const today = new Date().getDate();
    return creditCards
      .map((cc) => {
        const dueDay = cc.billDueDate || 15;
        let daysLeft = dueDay - today;
        if (daysLeft < 0) daysLeft += 30;
        return {
          ...cc,
          dueDay,
          daysLeft,
          dueAmount: cc.currentUsage || 0,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [creditCards]);

  if (loading) {
    return <LoadingState message="Loading plan..." />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title="Plan"
        subtitle="Budgets, bills & commitments"
        navigation={navigation}
        showAvatar
        rightActions={
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate('BudgetList')}
            accessibilityLabel="Manage budgets"
          >
            <Ionicons name="options-outline" size={20} color={Theme.colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPlanData();
            }}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {/* Month Switcher */}
        <View style={styles.monthBar}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTHS[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} hitSlop={8}>
            <Ionicons name="chevron-forward" size={18} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Open Editorial Monthly Budget Hero */}
        <View style={styles.heroWrap}>
          <BalanceHero
            eyebrow="MONTHLY SPENT"
            amountText={formatAmt(totalSpent)}
            badgeText={
              totalBudgeted > 0
                ? `${overallPct}% used`
                : undefined
            }
            leftLabel="BUDGETED"
            leftValue={formatAmt(totalBudgeted)}
            rightLabel={totalSpent > totalBudgeted && totalBudgeted > 0 ? 'OVER BUDGET' : 'REMAINING'}
            rightValue={
              totalBudgeted === 0
                ? formatAmt(0)
                : formatAmt(Math.abs(totalBudgeted - totalSpent))
            }
            rightHighlightError={totalSpent > totalBudgeted && totalBudgeted > 0}
            showRatioBar={totalBudgeted > 0}
            ratioPrimary={totalSpent}
            ratioSecondary={Math.max(0, totalBudgeted - totalSpent)}
            isStealthMode={isStealthMode}
          />
        </View>

        {/* Category Budgets */}
        <View style={styles.section}>
          <SectionHeader
            title="Category Budgets"
            actionLabel="Manage"
            onAction={() => navigation.navigate('BudgetList')}
          />

          {enrichedBudgets.length === 0 ? (
            <EmptyState
              compact
              icon="pie-chart-outline"
              title="No budgets configured"
              description="Set monthly spending limits per category to stay on track."
              actionLabel="Set a Budget"
              onAction={() => navigation.navigate('BudgetList')}
            />
          ) : (
            <SurfaceCard padding={0}>
              {enrichedBudgets.map((b, idx) => (
                <TouchableOpacity
                  key={b.id || b.categoryId || idx}
                  style={[styles.budgetRow, idx > 0 && styles.rowBorder]}
                  onPress={() => navigation.navigate('BudgetList')}
                  activeOpacity={0.75}
                >
                  <View style={styles.budgetRowTop}>
                    <View style={styles.budgetTitleWrap}>
                      <View style={styles.catIcon}>
                        <Ionicons name="pricetag-outline" size={16} color={Theme.colors.primary} />
                      </View>
                      <Text style={styles.budgetName} numberOfLines={1}>
                        {b.categoryName || 'Category'}
                      </Text>
                    </View>
                    <Text style={styles.budgetAmounts}>
                      <Text style={b.isOver ? styles.overText : styles.spentText}>
                        {formatAmt(b.spent)}
                      </Text>
                      <Text style={styles.limitText}> / {formatAmt(b.limit)}</Text>
                    </Text>
                  </View>
                  <View style={styles.smallTrack}>
                    <View
                      style={[
                        styles.smallFill,
                        {
                          width: `${b.pct}%`,
                          backgroundColor: b.isOver
                            ? Theme.colors.error
                            : b.pct >= 80
                            ? Theme.colors.warning
                            : Theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </SurfaceCard>
          )}
        </View>

        {/* Upcoming Bills & Credit Card Dues */}
        <View style={styles.section}>
          <SectionHeader
            title="Credit Card Bills & Dues"
            actionLabel="Pay Bills"
            onAction={() => navigation.navigate('CreditCardBill')}
          />

          {upcomingBills.length === 0 ? (
            <EmptyState
              compact
              icon="card-outline"
              title="No credit card bills"
              description="Add a credit card account in Wealth to track statement due dates."
              actionLabel="Add Card"
              onAction={() => navigation.navigate('Wealth', { screen: 'AddAccount' })}
            />
          ) : (
            <SurfaceCard padding={0}>
              {upcomingBills.map((cc, idx) => {
                const urgent = cc.dueAmount > 0 && cc.daysLeft <= 5;
                return (
                  <TouchableOpacity
                    key={cc.id}
                    style={[styles.billRow, idx > 0 && styles.rowBorder]}
                    onPress={() => navigation.navigate('CreditCardBill')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.billIcon, urgent && styles.billIconUrgent]}>
                      <Ionicons
                        name="card-outline"
                        size={18}
                        color={urgent ? Theme.colors.error : Theme.colors.primary}
                      />
                    </View>
                    <View style={styles.billInfo}>
                      <Text style={styles.billTitle} numberOfLines={1}>
                        {cc.name}
                      </Text>
                      <Text style={styles.billSub}>
                        Due on {cc.dueDay}th · {cc.daysLeft === 0 ? 'Due today' : `in ${cc.daysLeft}d`}
                      </Text>
                    </View>
                    <View style={styles.billRight}>
                      <Text style={styles.billAmount}>{formatAmt(cc.dueAmount)}</Text>
                      <Text style={styles.billStatus}>
                        {cc.dueAmount > 0 ? 'Pay now' : 'Settled'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </SurfaceCard>
          )}
        </View>

        {/* Recurring Commitments (SIPs / RDs) */}
        {recurringInvs.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Recurring Investments (SIP / RD)"
              actionLabel="View Portfolio"
              onAction={() => navigation.navigate('Wealth', { screen: 'Portfolio' })}
            />
            <SurfaceCard padding={0}>
              {recurringInvs.slice(0, 4).map((inv, idx) => (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.billRow, idx > 0 && styles.rowBorder]}
                  onPress={() => navigation.navigate('Wealth', { screen: 'Portfolio' })}
                  activeOpacity={0.75}
                >
                  <View style={[styles.billIcon, { backgroundColor: Theme.colors.successLight }]}>
                    <Ionicons name="repeat-outline" size={18} color={Theme.colors.success} />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billTitle} numberOfLines={1}>
                      {inv.name}
                    </Text>
                    <Text style={styles.billSub}>
                      {inv.typeName || inv.type} · {inv.frequency || 'Monthly'}
                    </Text>
                  </View>
                  <Text style={styles.billAmount}>
                    {formatAmt(inv.sipAmount || inv.recurringAmount || inv.investedAmount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </SurfaceCard>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: 110,
  },
  hubSwitcher: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: Theme.radius.md,
    padding: 3,
    marginBottom: 14,
  },
  hubTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  hubTabActive: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.borderSubtle,
  },
  hubTabText: {
    fontSize: Theme.typography.size.xs,
    fontWeight: Theme.typography.weight.semibold,
    color: Theme.colors.textMuted,
  },
  hubTabTextActive: {
    fontSize: Theme.typography.size.xs,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  monthArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
  },
  heroWrap: {
    marginBottom: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  summaryCard: {
    marginBottom: 20,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: Theme.typography.size.xxl,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    ...Theme.typography.tabularNums,
  },
  summarySub: {
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  pctBadge: {
    backgroundColor: Theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.radius.full,
  },
  pctBadgeText: {
    fontSize: Theme.typography.size.xs,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.primary,
    ...Theme.typography.tabularNums,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingText: {
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
  },
  manageLink: {
    fontSize: Theme.typography.size.xs,
    fontWeight: Theme.typography.weight.semibold,
    color: Theme.colors.primary,
  },
  section: {
    marginBottom: 20,
  },
  budgetRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  budgetRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 8,
  },
  catIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
    flex: 1,
  },
  budgetAmounts: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: Theme.typography.size.xs,
    ...Theme.typography.tabularNums,
  },
  spentText: {
    fontFamily: Theme.typography.fontFamily.bold,
    color: Theme.colors.text,
  },
  overText: {
    fontFamily: Theme.typography.fontFamily.bold,
    color: Theme.colors.error,
  },
  limitText: {
    fontFamily: Theme.typography.fontFamily.regular,
    color: Theme.colors.textMuted,
  },
  smallTrack: {
    height: 5,
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  smallFill: {
    height: '100%',
    borderRadius: 3,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  billIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billIconUrgent: {
    backgroundColor: Theme.colors.errorLight,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
  },
  billSub: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
    ...Theme.typography.tabularNums,
  },
  billStatus: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 11,
    color: Theme.colors.primary,
    marginTop: 2,
  },
});

export default PlanScreen;

