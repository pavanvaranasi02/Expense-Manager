import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
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
import BalanceHero from '../../components/ui/BalanceHero';
import EmptyState from '../../components/ui/EmptyState';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionHeader from '../../components/ui/SectionHeader';
import { getCurrencySymbol } from '../../constants/currencies';
import { getAccounts } from '../../services/accountService';
import { calculateAccountTotals } from '../../services/financialCalculationService';
import { calculateInvestmentTotals, getInvestments } from '../../services/investmentService';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '../../utils/format';

const getAccountIcon = (type) => {
  switch (type) {
    case 'BANK':
      return { name: 'business-outline', label: 'Bank Account' };
    case 'CREDIT_CARD':
      return { name: 'card-outline', label: 'Credit Card' };
    case 'CASH':
      return { name: 'cash-outline', label: 'Cash' };
    default:
      return { name: 'wallet-outline', label: 'Account' };
  }
};

const WealthScreen = ({ navigation }) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const cs = userProfile?.currencySymbol || getCurrencySymbol(userProfile?.currency, '₹');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [invTotals, setInvTotals] = useState(null);
  const [investmentsCount, setInvestmentsCount] = useState(0);

  const fetchWealthData = useCallback(async () => {
    try {
      const [accRes, invRes] = await Promise.all([getAccounts(), getInvestments()]);
      if (accRes?.success) {
        setAccounts((accRes.accounts || []).filter((a) => a.isActive !== false));
      }
      if (invRes?.success) {
        const list = invRes.investments || [];
        setInvestmentsCount(list.filter((i) => i.isActive).length);
        setInvTotals(calculateInvestmentTotals(list));
      }
    } catch (e) {
      console.log('Wealth fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWealthData();
    }, [fetchWealthData])
  );

  const formatAmt = (val) => formatCurrency(val || 0, isStealthMode, cs);

  const {
    bankBalance,
    cashBalance,
    investmentValue,
    totalAssets,
    totalLiabilities,
    netWorth,
    assetAccounts,
    liabilityAccounts,
  } = useMemo(
    () =>
      calculateAccountTotals(accounts, invTotals, {
        includeInvestmentsInAssets: true,
      }),
    [accounts, invTotals]
  );

  const gain = Number(invTotals?.totalReturns) || 0;
  const gainPct = invTotals?.returnPercent || 0;

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScreenHeader title="Wealth" subtitle="Balance sheet & holdings" navigation={navigation} showAvatar />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title="Wealth"
        subtitle="Balance sheet & holdings"
        navigation={navigation}
        showAvatar
        rightActions={
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate('AddAccount')}
            accessibilityLabel="Add account"
          >
            <Ionicons name="add" size={20} color={Theme.colors.text} />
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
              fetchWealthData();
            }}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {/* A. Net Worth — Primary Balance Sheet Anchor */}
        <BalanceHero
          eyebrow="NET WORTH · ASSETS − LIABILITIES"
          amountText={`${netWorth < 0 && !isStealthMode ? '-' : ''}${formatAmt(Math.abs(netWorth))}`}
          showRatioBar
          leftWeight={totalAssets}
          rightWeight={totalLiabilities}
          leftLabel="Total Assets"
          leftValue={formatAmt(totalAssets)}
          rightLabel="Total Liabilities"
          rightValue={formatAmt(totalLiabilities)}
          rightHighlightError={totalLiabilities > 0}
          style={{ marginBottom: 20 }}
        />

        {/* B. Asset Breakdown — Summary-level asset classes, distinct from account rows */}
        <View style={styles.section}>
          <SectionHeader title="Asset Breakdown" />
          <View style={styles.ledgerBox}>
            {[
              {
                key: 'liquid',
                label: 'Cash & Bank Balances',
                sub: 'Savings, current & cash accounts',
                value: bankBalance + cashBalance,
              },
              {
                key: 'invested',
                label: 'Invested Assets',
                sub: 'Mutual funds, SIPs & FDs',
                value: investmentValue,
              },
            ].map((row, idx) => {
              const share =
                totalAssets > 0 && !isStealthMode
                  ? `${Math.round((row.value / totalAssets) * 100)}%`
                  : null;
              return (
                <View
                  key={row.key}
                  style={[styles.breakdownRow, idx > 0 && styles.rowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.breakdownLabel}>{row.label}</Text>
                    <Text style={styles.breakdownSub}>{row.sub}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.breakdownValue,
                        row.value === 0 && { color: Theme.colors.textMuted },
                      ]}
                    >
                      {formatAmt(row.value)}
                    </Text>
                    {share && row.value > 0 ? (
                      <Text style={styles.breakdownShare}>{share} of assets</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* C. Investments — Concise summary or understated empty route */}
        <View style={styles.section}>
          <SectionHeader
            title="Investments"
            actionLabel={investmentsCount > 0 ? 'Open Portfolio' : 'Explore'}
            onAction={() => navigation.navigate('Portfolio')}
          />

          <View style={styles.ledgerBox}>
            <TouchableOpacity
              style={styles.portfolioRow}
              onPress={() => navigation.navigate('Portfolio')}
              activeOpacity={0.75}
            >
              <View style={styles.rowIconWrap}>
                <Ionicons name="trending-up-outline" size={18} color={Theme.colors.primary} />
              </View>
              {investmentsCount > 0 ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.portfolioTitle} numberOfLines={1}>
                      {investmentsCount} Active Holding{investmentsCount > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.portfolioSub} numberOfLines={1}>
                      Invested {formatAmt(invTotals?.totalInvested || 0)}
                    </Text>
                  </View>
                  <View style={styles.portfolioRight}>
                    <Text style={styles.portfolioAmount}>{formatAmt(investmentValue)}</Text>
                    <Text
                      style={[
                        styles.portfolioReturnText,
                        gain < 0 && { color: Theme.colors.error },
                      ]}
                    >
                      {gain >= 0 ? '+' : ''}
                      {formatAmt(gain)} ({gain >= 0 ? '+' : ''}
                      {gainPct}%)
                    </Text>
                  </View>
                </>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={styles.portfolioTitle}>No investments tracked yet</Text>
                  <Text style={styles.portfolioSub}>
                    Track Mutual Funds, SIPs & Fixed Deposits
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={15} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Asset Accounts (Bank & Cash) */}
        <View style={styles.section}>
          <SectionHeader
            title={`Asset Accounts (${assetAccounts.length})`}
            actionLabel="Manage"
            onAction={() => navigation.navigate('ManageAccounts')}
          />

          {assetAccounts.length === 0 ? (
            <EmptyState
              compact
              icon="business-outline"
              title="No bank or cash accounts"
              description="Add a bank account or cash wallet to track liquid balances."
              actionLabel="Add Account"
              onAction={() => navigation.navigate('AddAccount')}
            />
          ) : (
            <View style={styles.ledgerBox}>
              {assetAccounts.map((acc, idx) => {
                const meta = getAccountIcon(acc.type);
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountRow, idx > 0 && styles.rowBorder]}
                    onPress={() =>
                      navigation.navigate('AddAccount', { account: acc, editMode: true })
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons name={meta.name} size={18} color={Theme.colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {acc.name}
                      </Text>
                      <Text style={styles.rowSub}>{meta.label}</Text>
                    </View>
                    <Text style={styles.rowAmount}>{formatAmt(acc.balance || 0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Liabilities (Credit Cards) */}
        <View style={styles.section}>
          <SectionHeader
            title={`Liabilities (${liabilityAccounts.length})`}
            actionLabel={liabilityAccounts.length > 0 ? 'Pay Bills' : 'Add Card'}
            onAction={() =>
              liabilityAccounts.length > 0
                ? navigation.navigate('Plan', { screen: 'CreditCardBill' })
                : navigation.navigate('AddAccount')
            }
          />

          {liabilityAccounts.length === 0 ? (
            <EmptyState
              compact
              icon="card-outline"
              title="No liabilities recorded"
              description="Credit cards you add will appear here with utilization and dues."
            />
          ) : (
            <View style={styles.ledgerBox}>
              {liabilityAccounts.map((acc, idx) => {
                const used = Number(acc.currentUsage) || 0;
                const limit = Number(acc.creditLimit) || 0;
                const available = Math.max(0, limit - used);
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountRow, idx > 0 && styles.rowBorder]}
                    onPress={() =>
                      navigation.navigate('AddAccount', { account: acc, editMode: true })
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="card-outline" size={18} color={Theme.colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {acc.name}
                      </Text>
                      <Text style={styles.rowSub}>
                        {limit > 0
                          ? `Available ${formatAmt(available)} · Limit ${formatAmt(limit)}`
                          : 'Credit Card'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rowAmount,
                        used > 0 && { color: Theme.colors.error },
                      ]}
                    >
                      {used > 0 ? '-' : ''}
                      {formatAmt(used)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 18,
  },
  compositionStoneBox: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  portfolioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  portfolioIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioTitle: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 14,
    color: Theme.colors.text,
  },
  portfolioSub: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  portfolioRight: {
    alignItems: 'flex-end',
  },
  portfolioAmount: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 14,
    color: Theme.colors.text,
    ...Theme.typography.tabularNums,
  },
  portfolioReturnText: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 11,
    color: Theme.colors.primary,
    marginTop: 1,
    ...Theme.typography.tabularNums,
  },
  ledgerBox: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  breakdownLabel: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 13,
    color: Theme.colors.text,
  },
  breakdownSub: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  breakdownValue: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 14,
    color: Theme.colors.text,
    ...Theme.typography.tabularNums,
  },
  breakdownShare: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    ...Theme.typography.presets.rowTitle,
    color: Theme.colors.text,
  },
  rowSub: {
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  rowAmount: {
    ...Theme.typography.presets.monoValue,
    color: Theme.colors.text,
  },
  rowDelta: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 11,
    marginTop: 2,
    ...Theme.typography.tabularNums,
  },
});

export default WealthScreen;
