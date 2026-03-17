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
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboardData } from "../../services/expenseService";
import useAuthStore from "../../store/useAuthStore";
import { formatCurrency } from "../../utils/format";
import { Ionicons } from "@expo/vector-icons";

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
        color: "#6C63FF",
        desc: "Maintain a healthy balance between spending and saving.",
      };

      if (investPercentOfIncome > 0.2)
        tag = {
          name: "The Investor",
          icon: "📈",
          color: "#10B981",
          desc: "You prioritize future wealth and long-term security.",
        };
      else if (savingsPercent > 0.35)
        tag = {
          name: "The Saver",
          icon: "💰",
          color: "#10B981",
          desc: "Excellent job keeping more than you spend!",
        };
      else if (totalExp > 0 && totalInc > 0 && savingsPercent < 0.05)
        tag = {
          name: "The Spender",
          icon: "💳",
          color: "#EF4444",
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
            >
              <Text
                style={[
                  styles.periodBtnText,
                  period.id === p.id && styles.periodBtnTextActive,
                ]}
              >
                {p.label}
              </Text>
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
            color="#6C63FF"
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

            <View style={styles.summaryGrid}>
              {personality && (
                <View style={styles.personalityCard}>
                  <View
                    style={[
                      styles.personaHead,
                      { backgroundColor: personality.color },
                    ]}
                  >
                    <Text style={styles.personaEmoji}>{personality.icon}</Text>
                    <Text style={styles.personaTitle}>{personality.name}</Text>
                  </View>
                  <Text style={styles.personaDesc}>{personality.desc}</Text>
                </View>
              )}
              <View style={styles.summaryItem}>
                <Text style={styles.summarySub}>Avg Monthly Savings</Text>
                <Text style={[styles.summaryVal, { color: "#10B981" }]}>
                  {formatCurrency(
                    Math.round(summary.savings / period.months),
                    isStealthMode,
                  )}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summarySub}>Top Category</Text>
                <Text style={styles.summaryVal}>
                  {topCategory?.name || "N/A"}
                </Text>
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
                      navigation.navigate("Transactions", {
                        categoryId: cat.id,
                        categoryName: cat.name,
                        startDate: start.toISOString(),
                        endDate: new Date().toISOString(),
                        // Pass searchText to find items by name too, helpful for ghost entries
                        searchText: cat.name,
                      });
                    }}
                  >
                    {cat.icon && cat.icon.length > 2 ? (
                      <View style={styles.catIconContainer}>
                        <Ionicons name={cat.icon} size={20} color="#6C63FF" />
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
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#6C63FF" },
  propsForLabels: { fontSize: 10 },
  fillShadowGradientFrom: "#6C63FF",
  fillShadowGradientTo: "#FFF",
  fillShadowGradientOpacity: 0.1,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FE" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#1A1A2E" },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
  },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  periodBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodBtnText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  periodBtnTextActive: { color: "#6C63FF" },

  content: { padding: 20, paddingBottom: 100 },

  personalityCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    padding: 4,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  personaHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  personaEmoji: { fontSize: 24, marginRight: 12 },
  personaTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0.5,
  },
  personaDesc: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    padding: 12,
    lineHeight: 18,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  summarySub: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryVal: { fontSize: 16, fontWeight: "800", color: "#1A1A2E" },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 10,
    marginBottom: 24,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  chart: { borderRadius: 16 },

  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalRange: { fontSize: 13, fontWeight: "700", color: "#6C63FF" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  catRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  catIcon: { fontSize: 20, marginRight: 12 },
  catIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0EFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  catInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  catName: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  catAmount: { fontSize: 13, fontWeight: "700", color: "#475569" },
  progressBar: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    flex: 1,
  },
  progressFill: { height: 6, backgroundColor: "#6C63FF", borderRadius: 3 },
  catPercent: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    marginLeft: 10,
    width: 30,
    textAlign: "right",
  },

  paymentContainer: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  paymentItem: { width: "30%", alignItems: "center", marginBottom: 8 },
  paymentCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8F9FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  paymentEmoji: { fontSize: 20 },
  paymentLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
  },
  paymentVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1A1A2E",
    marginTop: 2,
  },

  // Period Label
  periodLabelContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: "center",
    backgroundColor: "#F8F9FE",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  periodDataRange: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  periodDataSubtitle: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default AnalyticsScreen;
