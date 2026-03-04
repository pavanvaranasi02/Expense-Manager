import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDashboardData } from '../../services/expenseService';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SCREEN_WIDTH = Dimensions.get('window').width - 40;

const AnalyticsScreen = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    const result = await getDashboardData(month, year);
    if (result.success) setData(result.data);
    setLoading(false);
  };

  const changeMonth = (dir) => {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const maxDaily = data ? Math.max(...Object.values(data.dailyTotals || {}), 1) : 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Analytics</Text>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><Ionicons name="chevron-back" size={22} color="#6C63FF" /></TouchableOpacity>
          <Text style={styles.monthText}>{MONTHS[month - 1]} {year}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><Ionicons name="chevron-forward" size={22} color="#6C63FF" /></TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 60 }} />
        ) : !data || data.expenseCount === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No data for {MONTHS[month - 1]}</Text>
            <Text style={styles.emptyText}>Add expenses to see analytics</Text>
          </View>
        ) : (
          <>
            {/* Overview Cards */}
            <View style={styles.overviewRow}>
              <View style={[styles.overviewCard, { backgroundColor: '#D1FAE5' }]}>
                <Text style={styles.overviewLabel}>Income</Text>
                <Text style={[styles.overviewAmount, { color: '#10B981' }]}>
                  ₹{(data.totalIncome || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={[styles.overviewCard, { backgroundColor: '#FEE2E2' }]}>
                <Text style={styles.overviewLabel}>Expense</Text>
                <Text style={[styles.overviewAmount, { color: '#EF4444' }]}>
                  ₹{(data.totalExpense || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.expenseCount}</Text>
                <Text style={styles.statLabel}>Transactions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  ₹{data.expenseCount > 0 ? Math.round(data.totalExpense / data.expenseCount).toLocaleString('en-IN') : 0}
                </Text>
                <Text style={styles.statLabel}>Avg/Transaction</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  ₹{data.topExpense ? data.topExpense.amount.toLocaleString('en-IN') : 0}
                </Text>
                <Text style={styles.statLabel}>Highest</Text>
              </View>
            </View>

            {/* Category Pie (Simple Bar Representation) */}
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <View style={styles.card}>
              {data.categoryBreakdown.map((cat) => {
                const percent = data.totalExpense > 0 ? (cat.total / data.totalExpense) * 100 : 0;
                return (
                  <View key={cat.id} style={styles.catAnalyticRow}>
                    <Text style={styles.catAnalyticIcon}>{cat.icon || '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={styles.catAnalyticHeader}>
                        <Text style={styles.catAnalyticName}>{cat.name}</Text>
                        <Text style={styles.catAnalyticAmount}>
                          ₹{cat.total.toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={styles.catAnalyticBarBg}>
                        <View style={[styles.catAnalyticBarFill, { width: `${percent}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.catAnalyticPercent}>{Math.round(percent)}%</Text>
                  </View>
                );
              })}
            </View>

            {/* Daily Spending */}
            <Text style={styles.sectionTitle}>Daily Spending</Text>
            <View style={styles.card}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.barChart}>
                  {Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1).map((day) => {
                    const val = data.dailyTotals[day] || 0;
                    const height = maxDaily > 0 ? (val / maxDaily) * 100 : 0;
                    return (
                      <View key={day} style={styles.barItem}>
                        <Text style={styles.barValue}>
                          {val > 0 ? `${Math.round(val / 1000)}k` : ''}
                        </Text>
                        <View style={[styles.bar, { height: Math.max(height, 2) }]} />
                        <Text style={styles.barLabel}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Payment Mode */}
            <Text style={styles.sectionTitle}>Payment Mode</Text>
            <View style={styles.card}>
              {Object.entries(data.paymentBreakdown).map(([mode, amount]) => {
                const percent = data.totalExpense > 0 ? (amount / data.totalExpense) * 100 : 0;
                const icons = { UPI: '📱', DEBIT_CARD: '💳', CREDIT_CARD: '🔴', CASH: '💵', NET_BANKING: '🏦', OTHER: '📦' };
                return (
                  <View key={mode} style={styles.paymentRow}>
                    <Text style={styles.paymentIcon}>{icons[mode] || '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paymentName}>{mode.replace('_', ' ')}</Text>
                      <View style={styles.paymentBarBg}>
                        <View style={[styles.paymentBarFill, { width: `${percent}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.paymentAmount}>₹{amount.toLocaleString('en-IN')}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },

  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: 16,
  },
  monthText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginHorizontal: 20 },

  overviewRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  overviewCard: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  overviewLabel: { fontSize: 12, color: '#6B7280' },
  overviewAmount: { fontSize: 20, fontWeight: '700', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statItem: {
    flex: 1, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  statLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', marginTop: 16, marginBottom: 10 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },

  catAnalyticRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  catAnalyticIcon: { fontSize: 22, marginRight: 10 },
  catAnalyticHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  catAnalyticName: { fontSize: 14, fontWeight: '500', color: '#1A1A2E' },
  catAnalyticAmount: { fontSize: 13, fontWeight: '600', color: '#374151' },
  catAnalyticBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginTop: 6 },
  catAnalyticBarFill: { height: 6, backgroundColor: '#6C63FF', borderRadius: 3 },
  catAnalyticPercent: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginLeft: 8, width: 35, textAlign: 'right' },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 130, paddingTop: 20 },
  barItem: { alignItems: 'center', width: 24, marginRight: 4 },
  bar: { width: 14, backgroundColor: '#6C63FF', borderRadius: 4, minHeight: 2 },
  barValue: { fontSize: 8, color: '#6B7280', marginBottom: 2 },
  barLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 4 },

  paymentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  paymentIcon: { fontSize: 20, marginRight: 10 },
  paymentName: { fontSize: 13, fontWeight: '500', color: '#1A1A2E', marginBottom: 4 },
  paymentBarBg: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 },
  paymentBarFill: { height: 4, backgroundColor: '#10B981', borderRadius: 2 },
  paymentAmount: { fontSize: 14, fontWeight: '600', color: '#374151', marginLeft: 10 },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
});

export default AnalyticsScreen;