import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Analytics } from '../../config/firebase';
import { getFamilyExpenseAnalytics } from '../../services/familyExpenseService';
import useFamilyStore from '../../store/useFamilyStore';

const screenWidth = Dimensions.get('window').width;

const FamilyAnalyticsScreen = ({ navigation }) => {
  const { family } = useFamilyStore();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const result = await getFamilyExpenseAnalytics(family.id, selectedMonth, selectedYear);

      if (result.success) {
        setAnalytics(result.analytics);
      }
    } catch (error) {
      console.log('Fetch analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('FamilyAnalytics');
      if (family?.id) {
        fetchAnalytics();
      }
    }, [selectedMonth, selectedYear, family?.id])
  );

  const navigateMonth = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Family Analytics</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#134E4A" />
        </View>
      </SafeAreaView>
    );
  }

  const categoryData =
    analytics?.categoryBreakdown.slice(0, 5).map((cat, index) => ({
      name: cat.name,
      population: cat.total,
      color: ['#134E4A', '#3B82F6', '#047857', '#F59E0B', '#B91C1C'][index % 5],
      legendFontColor: '#71717A',
      legendFontSize: 12,
    })) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Family Analytics</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity style={styles.monthBtn} onPress={() => navigateMonth(-1)}>
            <Ionicons name="chevron-back" size={20} color="#134E4A" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => navigateMonth(1)}
            disabled={
              selectedYear === new Date().getFullYear() &&
              selectedMonth === new Date().getMonth() + 1
            }
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                selectedYear === new Date().getFullYear() &&
                selectedMonth === new Date().getMonth() + 1
                  ? '#CBD5E1'
                  : '#134E4A'
              }
            />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="wallet" size={24} color="#B91C1C" />
            </View>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={styles.summaryValue}>
              ₹{(analytics?.totalSpent || 0).toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="receipt" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>{analytics?.expenseCount || 0}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="trending-down" size={24} color="#047857" />
            </View>
            <Text style={styles.summaryLabel}>Avg. Expense</Text>
            <Text style={styles.summaryValue}>
              ₹{Math.round(analytics?.averageExpense || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Category Breakdown */}
        {analytics?.categoryBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <View style={styles.chartCard}>
              <PieChart
                data={categoryData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                center={[10, 0]}
                absolute
              />
            </View>

            {/* Category List */}
            <View style={styles.categoryList}>
              {analytics.categoryBreakdown.map((cat) => (
                <View key={cat.id} style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={styles.categoryAmount}>
                      ₹{cat.total.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.categoryPercent}>
                      {analytics.totalSpent > 0
                        ? Math.round((cat.total / analytics.totalSpent) * 100)
                        : 0}
                      %
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Member Breakdown */}
        {analytics?.memberBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who Spent What</Text>
            <View style={styles.memberList}>
              {analytics.memberBreakdown.map((member, index) => {
                const percent = analytics.totalSpent > 0
                  ? (member.total / analytics.totalSpent) * 100
                  : 0;

                return (
                  <View key={member.userId} style={styles.memberRow}>
                    <View style={styles.memberLeft}>
                      <View
                        style={[
                          styles.memberRank,
                          index === 0 && { backgroundColor: '#F59E0B' },
                        ]}
                      >
                        <Text style={styles.memberRankText}>#{index + 1}</Text>
                      </View>
                      <Text style={styles.memberName}>{member.name}</Text>
                    </View>
                    <View style={styles.memberRight}>
                      <Text style={styles.memberAmount}>
                        ₹{member.total.toLocaleString('en-IN')}
                      </Text>
                      <View style={styles.memberBarBg}>
                        <View
                          style={[styles.memberBarFill, { width: `${Math.min(percent, 100)}%` }]}
                        />
                      </View>
                      <Text style={styles.memberPercent}>{Math.round(percent)}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty State */}
        {(!analytics || analytics.expenseCount === 0) && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bar-chart-outline" size={64} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No data for this month</Text>
            <Text style={styles.emptyText}>
              Add family expenses to see analytics and insights
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F7F6F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  monthBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#71717A',
    fontFamily: 'Manrope_600SemiBold',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  categoryList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  categoryName: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: '#18181B',
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    marginBottom: 2,
  },
  categoryPercent: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
  },
  memberList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  memberRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E5E2DC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  memberRankText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  memberName: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: '#18181B',
  },
  memberRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memberAmount: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    marginBottom: 6,
  },
  memberBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#ECEAE4',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  memberBarFill: {
    height: 6,
    backgroundColor: '#134E4A',
    borderRadius: 3,
  },
  memberPercent: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ECEAE4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
  },
});

export default FamilyAnalyticsScreen;