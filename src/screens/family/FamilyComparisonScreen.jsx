import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { Analytics } from '../../config/firebase';
import {
  getCategoryComparison,
  getMonthlyComparison,
  getMonthlyInsights,
} from '../../services/familyComparisonService';
import useFamilyStore from '../../store/useFamilyStore';
import { TouchableOpacity } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const FamilyComparisonScreen = ({ navigation }) => {
  const { family } = useFamilyStore();

  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [categoryComparison, setCategoryComparison] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const result = await getMonthlyComparison(family.id, 6);

      if (result.success && result.data.length > 0) {
        setComparisonData(result.data);

        // Get insights (current vs previous month)
        const currentMonth = result.data[result.data.length - 1];
        const previousMonth = result.data[result.data.length - 2];

        if (currentMonth && previousMonth) {
          const monthlyInsights = getMonthlyInsights(currentMonth, previousMonth);
          setInsights(monthlyInsights);

          const catComparison = getCategoryComparison(currentMonth, previousMonth);
          setCategoryComparison(catComparison);
        }
      }
    } catch (error) {
      console.log('Fetch comparison data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('FamilyComparison');
      if (family?.id) {
        fetchData();
      }
    }, [family?.id])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Monthly Comparison</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  const chartData = {
    labels: comparisonData.map((d) => d.label.split(' ')[0]),
    datasets: [
      {
        data: comparisonData.map((d) => d.totalSpent),
        color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Comparison</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Spending Trend Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6-Month Spending Trend</Text>
          <View style={styles.chartCard}>
            <LineChart
              data={chartData}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '5',
                  strokeWidth: '2',
                  stroke: '#6C63FF',
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: '#F1F5F9',
                },
              }}
              bezier
              style={{
                borderRadius: 16,
              }}
              formatYLabel={(value) => `₹${(parseFloat(value) / 1000).toFixed(0)}k`}
            />
          </View>
        </View>

        {/* Insights */}
        {insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monthly Insights</Text>
            <View style={styles.insightsCard}>
              {insights.map((insight, index) => (
                <View
                  key={index}
                  style={[
                    styles.insightRow,
                    index < insights.length - 1 && styles.insightBorder,
                  ]}
                >
                  <View
                    style={[styles.insightIcon, { backgroundColor: insight.color + '20' }]}
                  >
                    <Ionicons name={insight.icon} size={18} color={insight.color} />
                  </View>
                  <Text style={styles.insightText}>{insight.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Category Comparison */}
        {categoryComparison.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category Comparison</Text>
            <Text style={styles.sectionSubtitle}>This Month vs Last Month</Text>

            {categoryComparison.map((cat) => (
              <View key={cat.categoryId} style={styles.categoryCard}>
                <Text style={styles.categoryName}>{cat.category}</Text>

                <View style={styles.categoryBars}>
                  <View style={styles.barRow}>
                    <Text style={styles.barLabel}>This Month</Text>
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.bar,
                          styles.barCurrent,
                          {
                            width: `${Math.min(
                              (cat.currentTotal /
                                Math.max(cat.currentTotal, cat.previousTotal)) *
                                100,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>
                      ₹{cat.currentTotal.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.barRow}>
                    <Text style={styles.barLabel}>Last Month</Text>
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.bar,
                          styles.barPrevious,
                          {
                            width: `${Math.min(
                              (cat.previousTotal /
                                Math.max(cat.currentTotal, cat.previousTotal)) *
                                100,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>
                      ₹{cat.previousTotal.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {cat.trend !== 'same' && (
                  <View style={styles.categoryChange}>
                    <Ionicons
                      name={cat.trend === 'up' ? 'trending-up' : 'trending-down'}
                      size={16}
                      color={cat.trend === 'up' ? '#EF4444' : '#10B981'}
                    />
                    <Text
                      style={[
                        styles.changeText,
                        { color: cat.trend === 'up' ? '#EF4444' : '#10B981' },
                      ]}
                    >
                      {cat.changePercent > 0 ? '+' : ''}
                      {cat.changePercent}%
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {comparisonData.length < 2 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bar-chart-outline" size={64} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>Not enough data</Text>
            <Text style={styles.emptyText}>
              Add expenses for at least 2 months to see comparisons
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
    backgroundColor: '#F8F9FE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8F9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  insightBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  categoryBars: {
    marginBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 12,
    color: '#94A3B8',
    width: 80,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  barCurrent: {
    backgroundColor: '#6C63FF',
  },
  barPrevious: {
    backgroundColor: '#CBD5E1',
  },
  barValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    width: 80,
    textAlign: 'right',
  },
  categoryChange: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

export default FamilyComparisonScreen;
