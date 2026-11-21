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
import { AppAlert as Alert } from '../../components/ui/AppAlert';
import EmptyState from '../../components/ui/EmptyState';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { getCurrencySymbol } from '../../constants/currencies';
import {
  calculateInsuranceTotals,
  deleteInsurance,
  getDaysUntilRenewal,
  getInsurances,
  INSURANCE_TYPES,
  markPremiumPaid,
  PREMIUM_FREQUENCIES,
} from '../../services/insuranceService';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '../../utils/format';

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  ...INSURANCE_TYPES.map((t) => ({ id: t.id, label: t.name })),
];

const InsuranceScreen = ({ navigation }) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const cs = userProfile?.currencySymbol || getCurrencySymbol(userProfile?.currency, '₹');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insurances, setInsurances] = useState([]);
  const [selectedType, setSelectedType] = useState('all');

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await getInsurances();
      if (res?.success) {
        setInsurances(res.insurances || []);
      }
    } catch (e) {
      console.log('Insurance fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPolicies();
    }, [fetchPolicies])
  );

  const totals = useMemo(() => calculateInsuranceTotals(insurances), [insurances]);

  const filtered = useMemo(() => {
    if (selectedType === 'all') return insurances;
    return insurances.filter((p) => p.type === selectedType);
  }, [insurances, selectedType]);

  const formatAmt = (val) => formatCurrency(val || 0, isStealthMode, cs);

  const handleMarkPaid = (policy) => {
    Alert.alert(
      'Mark Premium Paid',
      `Record ${formatAmt(policy.premiumAmount)} payment for "${policy.name}" and advance the next due date?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            const res = await markPremiumPaid(policy.id);
            if (res.success) {
              fetchPolicies();
            } else {
              Alert.alert('Error', res.error || 'Could not update policy.');
            }
          },
        },
      ]
    );
  };

  const handleDelete = (policy) => {
    Alert.alert(
      'Delete Policy',
      `Remove "${policy.name}" from your insurance tracker?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteInsurance(policy.id);
            if (res.success) {
              fetchPolicies();
            } else {
              Alert.alert('Error', res.error || 'Could not delete policy.');
            }
          },
        },
      ]
    );
  };

  const renderRenewalBadge = (nextDueDate) => {
    const days = getDaysUntilRenewal(nextDueDate);
    if (days === null) return null;
    if (days < 0) {
      return (
        <View style={[styles.dueBadge, { backgroundColor: '#FEF2F2' }]}>
          <Text style={[styles.dueBadgeText, { color: Theme.colors.error }]}>
            Overdue by {Math.abs(days)}d
          </Text>
        </View>
      );
    }
    if (days <= 30) {
      return (
        <View style={[styles.dueBadge, { backgroundColor: '#FFFBEB' }]}>
          <Text style={[styles.dueBadgeText, { color: '#D97706' }]}>
            Due in {days === 0 ? 'Today' : `${days}d`}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.dueBadge, { backgroundColor: Theme.colors.surfaceMuted }]}>
        <Text style={[styles.dueBadgeText, { color: Theme.colors.textSecondary }]}>
          Due {nextDueDate}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScreenHeader title="Insurance" subtitle="Health, Term & Car" showBack navigation={navigation} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title="Insurance"
        subtitle="Health, Term & Car"
        showBack
        navigation={navigation}
        rightActions={
          <TouchableOpacity
            style={styles.addHeaderBtn}
            onPress={() => navigation.navigate('AddInsurance')}
            accessibilityLabel="Add insurance policy"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
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
              fetchPolicies();
            }}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {/* Hero Summary */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>TOTAL COVERAGE</Text>
              <Text style={styles.heroAmount}>{formatAmt(totals.totalCoverage)}</Text>
            </View>
            <View style={styles.heroCountPill}>
              <Text style={styles.heroCountText}>
                {totals.activeCount} {totals.activeCount === 1 ? 'Policy' : 'Policies'}
              </Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroBottomRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Annual Premium</Text>
              <Text style={styles.heroStatValue}>{formatAmt(totals.annualPremium)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Renewals (30d)</Text>
              <Text
                style={[
                  styles.heroStatValue,
                  totals.upcomingRenewals > 0 && { color: '#FCD34D' },
                ]}
              >
                {totals.upcomingRenewals}
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((tab) => {
            const active = selectedType === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedType(tab.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Policy List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title={
              selectedType === 'all'
                ? 'No insurance policies yet'
                : `No ${FILTER_TABS.find((t) => t.id === selectedType)?.label || ''} policies`
            }
            description="Track your Health, Term Life, and Car insurance coverage, premiums, and renewal dates in one place."
            actionLabel="Add Policy"
            onAction={() =>
              navigation.navigate('AddInsurance', {
                initialType: selectedType === 'all' ? 'health' : selectedType,
              })
            }
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((policy) => {
              const typeMeta =
                INSURANCE_TYPES.find((t) => t.id === policy.type) || INSURANCE_TYPES[0];
              const freqLabel =
                PREMIUM_FREQUENCIES.find((f) => f.id === policy.frequency)?.label || 'Yearly';

              return (
                <View key={policy.id} style={styles.policyCard}>
                  <View style={styles.policyHeader}>
                    <View style={[styles.typeIconWrap, { backgroundColor: typeMeta.bg }]}>
                      <Ionicons name={typeMeta.icon} size={20} color={typeMeta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.policyTitleRow}>
                        <Text style={styles.policyName} numberOfLines={1}>
                          {policy.name}
                        </Text>
                        {renderRenewalBadge(policy.nextDueDate)}
                      </View>
                      <Text style={styles.policySub} numberOfLines={1}>
                        {typeMeta.name}
                        {policy.insurer ? ` • ${policy.insurer}` : ''}
                        {policy.policyNumber ? ` • #${policy.policyNumber}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Coverage</Text>
                      <Text style={styles.metricValue}>{formatAmt(policy.sumInsured)}</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Premium ({freqLabel})</Text>
                      <Text style={styles.metricValue}>{formatAmt(policy.premiumAmount)}</Text>
                    </View>
                  </View>

                  {/* Type-specific details */}
                  {policy.type === 'health' && !!policy.coveredMembers && (
                    <Text style={styles.metaNote} numberOfLines={1}>
                      Members: {policy.coveredMembers}
                    </Text>
                  )}
                  {policy.type === 'term' && (policy.nomineeName || policy.coverTillAge) && (
                    <Text style={styles.metaNote} numberOfLines={1}>
                      {policy.nomineeName ? `Nominee: ${policy.nomineeName}` : ''}
                      {policy.nomineeName && policy.coverTillAge ? ' • ' : ''}
                      {policy.coverTillAge ? `Cover till age ${policy.coverTillAge}` : ''}
                    </Text>
                  )}
                  {policy.type === 'car' && (policy.vehicleNumber || policy.idvAmount || policy.ncbPercent !== null) && (
                    <Text style={styles.metaNote} numberOfLines={1}>
                      {[
                        policy.vehicleNumber || null,
                        policy.idvAmount ? `IDV ${formatAmt(policy.idvAmount)}` : null,
                        policy.ncbPercent !== null && policy.ncbPercent !== undefined
                          ? `NCB ${policy.ncbPercent}%`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  )}

                  <View style={styles.actionsRow}>
                    {policy.frequency !== 'one_time' && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleMarkPaid(policy)}
                      >
                        <Ionicons name="checkmark-circle-outline" size={15} color={Theme.colors.primary} />
                        <Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>
                          Mark Paid
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        navigation.navigate('AddInsurance', { policy, editMode: true })
                      }
                    >
                      <Ionicons name="create-outline" size={15} color={Theme.colors.textSecondary} />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleDelete(policy)}
                    >
                      <Ionicons name="trash-outline" size={15} color={Theme.colors.error} />
                      <Text style={[styles.actionBtnText, { color: Theme.colors.error }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Theme.spacing.md, paddingBottom: 40, gap: 14 },
  addHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.lg,
    padding: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroCountPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroCountText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginVertical: 14,
  },
  heroBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStat: { flex: 1 },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  heroStatValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Theme.colors.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },
  list: { gap: 12 },
  policyCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    gap: 10,
  },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  policyName: { fontSize: 15, fontWeight: '700', color: Theme.colors.textPrimary, flex: 1 },
  policySub: { fontSize: 12, color: Theme.colors.textSecondary, marginTop: 2 },
  dueBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  dueBadgeText: { fontSize: 11, fontWeight: '700' },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: Theme.borderRadius.md,
    padding: 10,
    gap: 12,
  },
  metricBox: { flex: 1 },
  metricLabel: { fontSize: 11, color: Theme.colors.textSecondary },
  metricValue: { fontSize: 15, fontWeight: '700', color: Theme.colors.textPrimary, marginTop: 2 },
  metaNote: { fontSize: 12, color: Theme.colors.textSecondary },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 10,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Theme.colors.textSecondary },
});

export default InsuranceScreen;
