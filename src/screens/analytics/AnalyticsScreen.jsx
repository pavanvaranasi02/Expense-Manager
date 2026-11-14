import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboardData } from "../../services/expenseService";
import useAuthStore from "../../store/useAuthStore";
import { formatCurrency } from "../../utils/format";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const SCREEN_WIDTH = Dimensions.get("window").width;

const PERIODS = [
  { id: "1m", label: "1M", months: 1 },
  { id: "3m", label: "3M", months: 3 },
  { id: "6m", label: "6M", months: 6 },
  { id: "12m", label: "1Y", months: 12 },
];

const AnalyticsScreen = ({ navigation }) => {
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    savings: 0,
  });
  const [topCategory, setTopCategory] = useState(null);
  const [paymentModes, setPaymentModes] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [personality, setPersonality] = useState(null);

  useEffect(() => {
    fetchPeriodData();
  }, [period]);

  const fetchPeriodData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const allResults = [];
      let totalInc = 0;
      let totalExp = 0;
      const combinedCats = {};
      const combinedPayments = {};

      // Fetch data for each month in the period
      for (let i = period.months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const res = await getDashboardData(m, y);

        if (res.success) {
          const monthData = res.data;
          allResults.push({
            month: MONTHS[m - 1],
            income: monthData.totalIncome,
            expense: monthData.totalExpense,
            savings: monthData.savings,
          });
          totalInc += monthData.totalIncome;
          totalExp += monthData.totalExpense;

          // Merge categories
          monthData.categoryBreakdown.forEach((cat) => {
            if (!combinedCats[cat.id]) {
              combinedCats[cat.id] = { ...cat, total: 0 };
            }
            combinedCats[cat.id].total += cat.total;
          });

          // Merge payment modes
          Object.entries(monthData.paymentBreakdown).forEach(
            ([mode, amount]) => {
              combinedPayments[mode] = (combinedPayments[mode] || 0) + amount;
            },
          );
        }
      }

      setAnalyticsData(allResults);
      setSummary({
        totalIncome: totalInc,
        totalExpense: totalExp,
        savings: totalInc - totalExp,
      });

      const sortedCats = Object.values(combinedCats).sort(
        (a, b) => b.total - a.total,
      );
      setCategoryData(sortedCats);
      setTopCategory(sortedCats[0] || null);
      setPaymentModes(
        Object.entries(combinedPayments).sort((a, b) => b[1] - a[1]),
      );

      // Calculate Personality
      const investCat = sortedCats.find((c) =>
        c.name.toLowerCase().includes("investment"),
      );
      const investPercentOfIncome =
        totalInc > 0 ? (investCat?.total || 0) / totalInc : 0;
      const savingsPercent =
        totalInc > 0 ? (totalInc - totalExp) / totalInc : 0;
      const topCatPercent =
        totalExp > 0 ? (sortedCats[0]?.total || 0) / totalExp : 0;

      let tag = {
        name: "The Balanced",
        icon: "⚖️",
        color: "#134E4A",
        desc: "Maintain a healthy balance between spending and saving.",
      };

      if (investPercentOfIncome > 0.2)
        tag = {
          name: "The Investor",
          icon: "📈",
          color: "#047857",
          desc: "You prioritize future wealth and long-term security.",
        };
      else if (savingsPercent > 0.35)
        tag = {
          name: "The Saver",
          icon: "💰",
          color: "#047857",
          desc: "Excellent job keeping more than you spend!",
        };
      else if (totalExp > 0 && totalInc > 0 && savingsPercent < 0.05)
        tag = {
          name: "The Spender",
          icon: "💳",
          color: "#B91C1C",
          desc: "Careful! Your spending is almost matching your income.",
        };
      else if (sortedCats[0]?.name.includes("Food") && topCatPercent > 0.3)
        tag = {
          name: "The Foodie",
          icon: "🍜",
          color: "#F59E0B",
          desc: "Good food is your biggest motivation (and expense).",
        };
      else if (sortedCats[0]?.name.includes("Travel") && topCatPercent > 0.3)
        tag = {
          name: "The Wanderer",
          icon: "✈️",
          color: "#0EA5E9",
          desc: "Your heart (and money) is always on the road.",
        };
      else if (sortedCats[0]?.name.includes("Shopping") && topCatPercent > 0.3)
        tag = {
          name: "The Shopaholic",
          icon: "🛍️",
          color: "#E91E63",
          desc: "Treat yourself—but maybe check that budget again.",
        };

      setPersonality(tag);
    } catch (e) {
      console.log("Error fetching analytics:", e);
    }
    setLoading(false);
  };

  const getPieData = () => {
    const colors = [
      "#134E4A", // Indigo
      "#047857", // Emerald
      "#F59E0B", // Amber
      "#EC4899", // Pink
      "#3B82F6", // Blue
      "#B91C1C", // Red
      "#0F766E", // Violet
    ];
    
    return categoryData.slice(0, 5).map((cat, idx) => ({
      name: cat.name,
      population: cat.total,
      color: colors[idx % colors.length],
      legendFontColor: "#71717A",
      legendFontSize: 11,
    }));
  };

  const getComparisonData = () => {
    return {
      labels: analyticsData.map((d) => d.month),
      datasets: [
        {
          data: analyticsData.map((d) => d.income),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        },
        {
          data: analyticsData.map((d) => d.expense),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        },
      ],
    };
  };

  const chartData = {
    labels: analyticsData.map((d) => d.month),
    datasets: [
      {
        data: analyticsData.map((d) => d.income),
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: analyticsData.map((d) => d.expense),
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ["Income", "Expense"],
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <View style={styles.periodSelector}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.periodBtn,
                period.id === p.id && styles.periodBtnActive,
              ]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.periodBtnText,
                  period.id === p.id && styles.periodBtnTextActive,
                ]}
              >
                {p.label}
              </Text>
              {period.id === p.id && (
                <View style={styles.periodDot} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#134E4A"
            style={{ marginTop: 60 }}
          />
        ) : (
          <>
            {/* Overview Summary */}
            <View style={styles.periodLabelContainer}>
              <Text style={styles.periodDataRange}>
                {(() => {
                  const now = new Date();
                  const start = new Date(
                    now.getFullYear(),
                    now.getMonth() - (period.months - 1),
                    1,
                  );
                  const end = new Date();
                  return `${start.toLocaleDateString("en-IN", { month: "short", year: "numeric" })} to ${end.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
                })()}
              </Text>
              <Text style={styles.periodDataSubtitle}>
                Total for the selected {period.label} period
              </Text>
            </View>

            <View style={styles.insightHeader}>
              <Text style={styles.insightTitle}>Financial Health Insight</Text>
              <Ionicons name="sparkles" size={16} color="#134E4A" />
            </View>

            {personality && (
              <LinearGradient
                colors={['#FFFFFF', '#F8FAFC']}
                style={styles.personalityCard}
              >
                <LinearGradient
                  colors={[personality.color, personality.color + 'DD']}
                  style={styles.personaHead}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.personaIconContainer}>
                    <Text style={styles.personaEmoji}>{personality.icon}</Text>
                  </View>
                  <View>
                    <Text style={styles.personaTitle}>{personality.name}</Text>
                    <Text style={styles.personaBadge}>CURATED PROFILE</Text>
                  </View>
                </LinearGradient>
                <Text style={styles.personaDesc}>{personality.desc}</Text>
              </LinearGradient>
            )}

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, { backgroundColor: '#04785720' }]}>
                  <Ionicons name="wallet-outline" size={18} color="#047857" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.summarySub} numberOfLines={1} adjustsFontSizeToFit>
                    Avg Monthly Savings
                  </Text>
                  <Text style={[styles.summaryVal, { color: "#047857" }]} numberOfLines={1}>
                    {formatCurrency(
                      Math.round(summary.savings / period.months),
                      isStealthMode,
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Ionicons name="star-outline" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.summarySub} numberOfLines={1}>Top Category</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {topCategory?.name || "N/A"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Income vs Expense Graph */}
            <Text style={styles.sectionTitle}>Income vs Expense Trend</Text>
            <View style={styles.chartCard}>
              <LineChart
                data={chartData}
                width={SCREEN_WIDTH - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                fromZero
                yAxisLabel={isStealthMode ? "" : "₹"}
                hidePointsAtIndex={[]}
                formatYLabel={(val) => (isStealthMode ? "****" : val)}
              />
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#047857" }]} />
                  <Text style={styles.legendText}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#B91C1C" }]} />
                  <Text style={styles.legendText}>Expense</Text>
                </View>
              </View>
            </View>

            {/* Category Pie Chart */}
            <Text style={styles.sectionTitle}>Expense Allocation</Text>
            <View style={styles.chartCard}>
              {categoryData.length > 0 ? (
                <PieChart
                  data={getPieData()}
                  width={SCREEN_WIDTH - 40}
                  height={220}
                  chartConfig={chartConfig}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"15"}
                  center={[10, 0]}
                  absolute
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No data available for this period</Text>
                </View>
              )}
            </View>

            {/* Monthly Comparison Bar Chart */}
            <Text style={styles.sectionTitle}>Monthly Comparison</Text>
            <View style={styles.chartCard}>
              <BarChart
                data={getComparisonData()}
                width={SCREEN_WIDTH - 40}
                height={220}
                chartConfig={{
                  ...chartConfig,
                  barPercentage: 0.7,
                }}
                style={styles.chart}
                fromZero
                yAxisLabel={isStealthMode ? "" : "₹"}
                showValuesOnTopOfBars
              />
            </View>

            {/* Category Breakdown */}
            <View style={styles.categoryHeader}>
              <Text style={styles.sectionTitle}>Category Spending</Text>
              <Text style={styles.totalRange}>
                Total: {formatCurrency(summary.totalExpense, isStealthMode)}
              </Text>
            </View>
            <View style={styles.card}>
              {categoryData.slice(0, 5).map((cat) => {
                const percent =
                  summary.totalExpense > 0
                    ? (cat.total / summary.totalExpense) * 100
                    : 0;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.catRow}
                    onPress={() => {
                      const now = new Date();
                      const start = new Date(
                        now.getFullYear(),
                        now.getMonth() - (period.months - 1),
                        1,
                      );
                      navigation.navigate("Activity", {
                        screen: "ExpenseList",
                        params: {
                          categoryId: cat.id,
                          categoryName: cat.name,
                          startDate: start.toISOString(),
                          endDate: new Date().toISOString(),
                          searchText: cat.name,
                        },
                      });
                    }}
                  >
                    {cat.icon && cat.icon.length > 2 ? (
                      <View style={styles.catIconContainer}>
                        <Ionicons name={cat.icon} size={20} color="#134E4A" />
                      </View>
                    ) : (
                      <Text style={styles.catIcon}>{cat.icon || "📦"}</Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.catInfo}>
                        <Text style={styles.catName}>{cat.name}</Text>
                        <Text style={styles.catAmount}>
                          {formatCurrency(cat.total, isStealthMode)}
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${percent}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.catPercent}>
                      {Math.round(percent)}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Payment Modes */}
            <Text style={styles.sectionTitle}>Payment Distribution</Text>
            <View style={styles.card}>
              <View style={styles.paymentContainer}>
                {paymentModes.map(([mode, amount]) => {
                  const percent =
                    summary.totalExpense > 0
                      ? (amount / summary.totalExpense) * 100
                      : 0;
                  const icons = {
                    UPI: "📱",
                    DEBIT_CARD: "💳",
                    CREDIT_CARD: "🔴",
                    CASH: "💵",
                    NET_BANKING: "🏦",
                    OTHER: "📦",
                  };
                  return (
                    <View key={mode} style={styles.paymentItem}>
                      <View style={styles.paymentCircle}>
                        <Text style={styles.paymentEmoji}>
                          {icons[mode] || "📦"}
                        </Text>
                      </View>
                      <Text style={styles.paymentLabel}>
                        {mode.replace("_", " ")}
                      </Text>
                      <Text style={styles.paymentVal}>
                        {formatCurrency(amount, isStealthMode)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: "5", strokeWidth: "3", stroke: "#FFFFFF" },
  propsForLabels: { fontSize: 10, fontFamily: 'Manrope_600SemiBold' },
  fillShadowGradientFrom: "#134E4A",
  fillShadowGradientTo: "#FFF",
  fillShadowGradientOpacity: 0.2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F6F2" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: "#18181B", letterSpacing: -0.5 },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  periodBtn: { 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 11,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  periodBtnText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: "#60A5FA" },
  periodBtnTextActive: { color: "#2563EB" },
  periodDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2563EB",
    marginTop: 2,
  },

  content: { padding: 24, paddingBottom: 120 },

  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  personalityCard: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
    elevation: 8,
    shadowColor: "#134E4A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  personaHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  personaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  personaEmoji: { fontSize: 26 },
  personaTitle: {
    color: "#FFFFFF",
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    letterSpacing: 0.2,
  },
  personaBadge: {
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.8)",
    fontFamily: 'Manrope_700Bold',
    marginTop: 2,
    letterSpacing: 1,
  },
  personaDesc: {
    fontSize: 13,
    color: "#3F3F46",
    fontFamily: 'Manrope_600SemiBold',
    paddingVertical: 16,
    paddingHorizontal: 20,
    lineHeight: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 28,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E2DC',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summarySub: {
    fontSize: 10,
    color: "#71717A",
    fontFamily: 'Manrope_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryVal: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: "#18181B" },

  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 16,
    marginBottom: 28,
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#F1EFEA',
  },
  chart: { borderRadius: 20 },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1EFEA',
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#71717A',
  },

  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#71717A',
    fontFamily: 'Manrope_600SemiBold',
  },

  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalRange: { 
    fontSize: 12, 
    fontFamily: 'Manrope_700Bold', 
    color: "#FFFFFF",
    backgroundColor: '#134E4A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    marginBottom: 28,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#F1EFEA',
  },

  catRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  catIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E6F2F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  catIcon: { fontSize: 22, marginRight: 16 },
  catInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  catName: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: "#1F2937" },
  catAmount: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: "#3F3F46" },
  progressBar: {
    height: 8,
    backgroundColor: "#F1EFEA",
    borderRadius: 4,
    flex: 1,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: "#134E4A", borderRadius: 4 },
  catPercent: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#71717A",
    marginLeft: 12,
    width: 36,
    textAlign: "right",
  },

  paymentContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: 'space-between' },
  paymentItem: { width: "30%", alignItems: "center", marginBottom: 12 },
  paymentCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#F7F6F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1EFEA',
  },
  paymentEmoji: { fontSize: 24 },
  paymentLabel: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: "#71717A",
    textAlign: "center",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentVal: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginTop: 4,
  },

  periodLabelContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E2DC",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  periodDataRange: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginBottom: 4,
  },
  periodDataSubtitle: {
    fontSize: 11,
    color: "#71717A",
    fontFamily: 'Manrope_700Bold',
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});

export default AnalyticsScreen;
