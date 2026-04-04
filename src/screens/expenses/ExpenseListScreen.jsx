import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from "react-native-safe-area-context";
import { Analytics } from "../../config/firebase";
import { getAccounts, calculateTotals } from "../../services/accountService";
import { getAllCategories } from "../../services/categoryService";
import { deleteExpense, getExpenses } from "../../services/expenseService";
import { deleteIncome, getIncomes } from "../../services/incomeService";
import useAuthStore from "../../store/useAuthStore";
import { Theme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const ExpenseListScreen = ({ navigation }) => {
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const [transactions, setTransactions] = useState([]);
  const [chartTxns, setChartTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("today");
  const [summary, setSummary] = useState({ totalExpense: 0, totalIncome: 0 });
  const [accountTotals, setAccountTotals] = useState({ totalAssets: 0, totalDebts: 0 });
  
  // Advanced Filter State
  const [showConfig, setShowConfig] = useState(false);
  const [categoryId, setCategoryId] = useState(null);
  const [categoryName, setCategoryName] = useState(null);
  const [paymentMode, setPaymentMode] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [categories, setCategories] = useState([]);

  const fetchTransactions = async () => {
    try {
      const filters = {};
      const now = new Date();
      
      // Basic Time Filters
      if (filter === 'today') {
        const start = new Date(now);
        start.setHours(0,0,0,0);
        filters.startDate = start.toISOString();
        const end = new Date(now);
        end.setHours(23,59,59,999);
        filters.endDate = end.toISOString();
      } else if (filter === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        weekStart.setHours(0,0,0,0);
        filters.startDate = weekStart.toISOString();
      } else if (filter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filters.startDate = monthStart.toISOString();
      }

      // Advanced Overrides
      if (startDate) filters.startDate = startDate.toISOString();
      if (endDate) filters.endDate = endDate.toISOString();
      if (categoryId) filters.categoryId = categoryId;
      if (paymentMode) filters.paymentMode = paymentMode;

      // Always fetch last 7 days for CHART
      const chartStart = new Date(now);
      chartStart.setDate(now.getDate() - 6);
      chartStart.setHours(0,0,0,0);
      const chartFilters = { startDate: chartStart.toISOString() };

      const [expResult, incResult, chartExp, chartInc, accountsResult, categoriesResult] = await Promise.all([
        getExpenses(filters),
        getIncomes(filters),
        getExpenses(chartFilters),
        getIncomes(chartFilters),
        getAccounts(),
        getAllCategories()
      ]);

      let allTxns = [];
      let totalEx = 0;
      let totalIn = 0;

      if (expResult.success) {
        const exps = expResult.expenses.map((e) => ({ ...e, type: "expense" }));
        allTxns = [...allTxns, ...exps];
        totalEx = exps.reduce((s, e) => s + (e.amount || 0), 0);
      }

      if (incResult.success) {
        const incs = incResult.incomes.map((i) => ({ ...i, type: "income" }));
        allTxns = [...allTxns, ...incs];
        totalIn = incs.reduce((s, i) => s + (i.amount || 0), 0);
      }

      // Prepare Chart Data
      let cTxns = [];
      if (chartExp.success) cTxns = [...cTxns, ...chartExp.expenses.map(e => ({ ...e, type: 'expense' }))];
      if (chartInc.success) cTxns = [...cTxns, ...chartInc.incomes.map(i => ({ ...i, type: 'income' }))];
      setChartTxns(cTxns);

      if (accountsResult.success) {
        setAccountTotals(calculateTotals(accountsResult.accounts));
      }

      if (categoriesResult.success) {
        setCategories(categoriesResult.categories);
      }

      allTxns.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(allTxns);
      setSummary({ totalExpense: totalEx, totalIncome: totalIn });
    } catch (error) {
      console.log("❌ Fetch transactions error:", error);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [filter, categoryId, paymentMode, startDate, endDate])
  );

  const clearFilters = () => {
    setCategoryId(null);
    setCategoryName(null);
    setPaymentMode(null);
    setStartDate(null);
    setEndDate(null);
    setShowConfig(false);
  };

  const handleDelete = (tx) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Transaction",
      `Are you sure you want to delete this ${tx.type}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
             const res = tx.type === "income" ? await deleteIncome(tx.id, tx) : await deleteExpense(tx.id, tx);
             if (res.success) fetchTransactions();
        }}
      ]
    );
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: 'numeric', month: 'short' });
  };

  const groupedTransactions = useMemo(() => {
    const groups = {};
    transactions.forEach(tx => {
      const date = new Date(tx.date).toDateString();
      const label = formatDate(date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    });
    return Object.entries(groups);
  }, [transactions]);

  const chartData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const labels = last7Days.map(d => d.toLocaleDateString('en-IN', { weekday: 'narrow' }));
    const spendData = last7Days.map(d => chartTxns.filter(tx => tx.type === 'expense' && new Date(tx.date).toDateString() === d.toDateString()).reduce((sum, tx) => sum + tx.amount, 0));
    const incomeData = last7Days.map(d => chartTxns.filter(tx => tx.type === 'income' && new Date(tx.date).toDateString() === d.toDateString()).reduce((sum, tx) => sum + tx.amount, 0));
    return {
      labels,
      datasets: [
        { data: spendData, color: (opacity = 1) => Theme.colors.error },
        { data: incomeData, color: (opacity = 1) => Theme.colors.success },
      ],
    };
  }, [chartTxns]);

  const { filteredInc, filteredExp } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    transactions.forEach(t => {
      if (t.type === 'income') inc += (t.amount || 0);
      else exp += (t.amount || 0);
    });
    return { filteredInc: inc, filteredExp: exp };
  }, [transactions]);

  const topCategory = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    if (expenses.length === 0) return null;
    const cats = {};
    expenses.forEach(t => cats[t.categoryName] = (cats[t.categoryName] || 0) + t.amount);
    const sorted = Object.entries(cats).sort((a,b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  }, [transactions]);

  const renderIcon = (tx) => {
    const icon = tx.type === 'income' ? (tx.sourceIcon || 'wallet-outline') : (tx.categoryIcon || 'cart-outline');
    if (icon && icon.length > 2 && !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(icon)) {
        return <Ionicons name={icon} size={20} color={tx.type === 'income' ? Theme.colors.success : Theme.colors.error} />;
    }
    return <Text style={{ fontSize: 18 }}>{icon || '💰'}</Text>;
  };

  const isFilterActive = categoryId || paymentMode || startDate || endDate;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>History</Text>
          <View style={styles.headerChips}>
              <View style={styles.summaryBadge}>
                <View style={[styles.dot, { backgroundColor: Theme.colors.success }]} />
                <Text style={styles.summaryTotal}>{formatCurrency(accountTotals.totalAssets, isStealthMode)}</Text>
              </View>
              <View style={[styles.summaryBadge, { marginLeft: 6 }]}>
                <View style={[styles.dot, { backgroundColor: Theme.colors.error }]} />
                <Text style={styles.summaryTotal}>{formatCurrency(accountTotals.totalDebts, isStealthMode)}</Text>
              </View>
          </View>
        </View>
        <View style={styles.headerActions}>
            {isFilterActive && (
                <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={24} color={Theme.colors.error} />
                </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.configBtn} onPress={() => setShowConfig(true)}>
                <Ionicons name="options-outline" size={22} color={Theme.colors.text} />
            </TouchableOpacity>
        </View>
      </View>

      <Animated.View entering={FadeInDown.springify()} style={styles.filteredSummaryCard}>
           <View style={styles.summaryTop}>
              <Text style={styles.filteredSummaryLabel}>{isFilterActive ? 'Results Total' : 'Period Summary'}</Text>
              <Text style={styles.filteredSummaryValue}>
                {formatCurrency(filteredInc - filteredExp, isStealthMode)}
              </Text>
           </View>
           
           <View style={styles.summaryStats}>
              <View style={styles.statBox}>
                 <Text style={[styles.statValue, { color: Theme.colors.success }]}>+{formatCurrency(filteredInc, isStealthMode)}</Text>
                 <Text style={styles.statLabel}>Income</Text>
              </View>
              <View style={styles.statBoxRight}>
                 <Text style={[styles.statValue, { color: Theme.colors.error }]}>-{formatCurrency(filteredExp, isStealthMode)}</Text>
                 <Text style={styles.statLabel}>Spent</Text>
              </View>
           </View>

           {isFilterActive && (
              <View style={styles.activeFiltersList}>
                 <Ionicons name="filter" size={12} color={Theme.colors.primary} />
                 <Text style={styles.activeFiltersText}>
                   Active: {[
                     categoryName && `Category: ${categoryName}`,
                     paymentMode && `Pay: ${paymentMode.replace('_', ' ')}`,
                     startDate && `Since: ${startDate.toLocaleDateString()}`
                   ].filter(Boolean).join(' • ')}
                 </Text>
              </View>
           )}
      </Animated.View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTransactions(); }} />}
      >
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={() => navigation.navigate('AddExpenseModal')}>
            <LinearGradient colors={['#FF6B6B', '#EE5253']} style={styles.actionGradient}>
              <View style={styles.actionIcon}><Ionicons name="remove-circle-outline" size={22} color="#FFF" /></View>
              <Text style={styles.actionTitle}>Expense</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={() => navigation.navigate('AddIncomeModal')}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
              <View style={styles.actionIcon}><Ionicons name="add-circle-outline" size={22} color="#FFF" /></View>
              <Text style={styles.actionTitle}>Income</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(opt => (
            <TouchableOpacity 
              key={opt.id} 
              style={[styles.filterChip, filter === opt.id && styles.filterChipActive]}
              onPress={() => setFilter(opt.id)}
            >
              <Text style={[styles.filterText, filter === opt.id && styles.filterTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {topCategory && (
            <Animated.View entering={FadeInDown.delay(200)} style={styles.insightCard}>
                 <View style={styles.insightIcon}><Ionicons name="analytics" size={18} color={Theme.colors.primary} /></View>
                 <View style={{ flex: 1 }}>
                    <Text style={styles.insightLabel}>Highest Spend</Text>
                    <Text style={styles.insightValue}>{topCategory.name} • {formatCurrency(topCategory.amount, isStealthMode)}</Text>
                 </View>
                 <TouchableOpacity onPress={() => navigation.navigate('AnalyticsMain')}>
                    <Ionicons name="chevron-forward" size={18} color={Theme.colors.textMuted} />
                 </TouchableOpacity>
            </Animated.View>
        )}

        {loading ? <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: 40 }} /> :
         transactions.length === 0 ? <View style={styles.emptyState}><Ionicons name="receipt-outline" size={64} color={Theme.colors.border} /><Text style={styles.emptyText}>No records found</Text></View> :
         groupedTransactions.map(([dateLabel, items]) => (
            <View key={dateLabel} style={styles.dateGroup}>
                <View style={styles.dateHeader}><Text style={styles.dateLabel}>{dateLabel}</Text><View style={styles.dateLine} /></View>
                {items.map((tx) => (
                    <TouchableOpacity key={tx.id} style={styles.txnCard} onPress={() => navigation.navigate('ExpenseDetail', { [tx.type === 'income' ? 'income' : 'expense']: tx })} onLongPress={() => handleDelete(tx)}>
                        <View style={[styles.txnIcon, { backgroundColor: tx.type === 'income' ? Theme.colors.success + '15' : Theme.colors.error + '15' }]}>{renderIcon(tx)}</View>
                        <View style={styles.txnMain}><Text style={styles.txnTitle} numberOfLines={1}>{tx.type === 'income' ? tx.sourceName : tx.categoryName}</Text><Text style={styles.txnSub}>{tx.note || (tx.type === 'income' ? 'Income' : tx.paymentMode)} • {tx.accountName}</Text></View>
                        <View style={styles.txnRight}><Text style={[styles.txnAmount, { color: tx.type === 'income' ? Theme.colors.success : Theme.colors.text }]}>{tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount, isStealthMode)}</Text><Text style={styles.txnTime}>{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>
                    </TouchableOpacity>
                ))}
            </View>
         ))}

        {/* Weekly Chart - Always Visible */}
        {!loading && (
            <Animated.View entering={FadeInUp.delay(500)} style={styles.chartBlock}>
                <Text style={styles.chartTitle}>Weekly Velocity</Text>
                <Text style={styles.chartSub}>7-day flow analysis</Text>
                <BarChart
                   data={chartData} width={SCREEN_WIDTH - 40} height={180} yAxisLabel="₹" fromZero
                   chartConfig={{ backgroundColor: '#FFF', backgroundGradientFrom: '#FFF', backgroundGradientTo: '#FFF', color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`, labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, barPercentage: 0.5, propsForLabels: { fontSize: 8 }, decimalPlaces: 0 }}
                   style={styles.chart} showValuesOnTopOfBars
                />
            </Animated.View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Advanced Filter Modal */}
      <Modal visible={showConfig} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}><Text style={styles.modalTitle}>Advanced Filters</Text><TouchableOpacity onPress={() => setShowConfig(false)}><Ionicons name="close" size={24} color={Theme.colors.text} /></TouchableOpacity></View>
                  
                  <View style={styles.filterSection}>
                      <Text style={styles.sectionTitle}>Filter by Category</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalScroll}>
                          <TouchableOpacity style={[styles.modalChip, !categoryId && styles.modalChipActive]} onPress={() => { setCategoryId(null); setCategoryName(null); }}>
                              <Text style={[styles.modalChipText, !categoryId && styles.modalChipTextActive]}>All</Text>
                          </TouchableOpacity>
                          {categories.map(cat => (
                              <TouchableOpacity key={cat.id} style={[styles.modalChip, categoryId === cat.id && styles.modalChipActive]} onPress={() => { setCategoryId(cat.id); setCategoryName(cat.name); }}>
                                  <Text style={[styles.modalChipText, categoryId === cat.id && styles.modalChipTextActive]}>{cat.name}</Text>
                              </TouchableOpacity>
                          ))}
                      </ScrollView>

                      <Text style={styles.sectionTitle}>Payment Type</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalScroll}>
                          {['UPI', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD'].map(mode => (
                              <TouchableOpacity key={mode} style={[styles.modalChip, paymentMode === mode && styles.modalChipActive]} onPress={() => setPaymentMode(paymentMode === mode ? null : mode)}>
                                  <Text style={[styles.modalChipText, paymentMode === mode && styles.modalChipTextActive]}>{mode.replace('_', ' ')}</Text>
                              </TouchableOpacity>
                          ))}
                      </ScrollView>

                      <Text style={styles.sectionTitle}>Custom Date Range</Text>
                      <View style={styles.dateRow}>
                          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                              <Ionicons name="calendar-outline" size={16} color={Theme.colors.primary} />
                              <Text style={styles.dateBtnText}>{startDate ? startDate.toLocaleDateString() : 'Start Date'}</Text>
                          </TouchableOpacity>
                      </View>
                  </View>

                  <TouchableOpacity style={styles.applyBtn} onPress={() => setShowConfig(false)}>
                      <Text style={styles.applyBtnText}>Apply Filters</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearAllBtn} onPress={clearFilters}>
                      <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      {showDatePicker && (
          <DateTimePicker
            value={startDate || new Date()} mode="date" display="default"
            onChange={(e, date) => { setShowDatePicker(false); if (date) setStartDate(date); }}
          />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerChips: { flexDirection: 'row', marginTop: 4 },
  title: { fontSize: 24, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text, letterSpacing: -0.8 },
  summaryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Theme.radius.md, ...Theme.shadows.soft },
  dot: { width: 4, height: 4, borderRadius: 2, marginRight: 5 },
  summaryTotal: { fontSize: 11, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  clearBtn: { marginRight: 10 },
  configBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Theme.colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.border + '50', ...Theme.shadows.soft },
  scrollContent: { paddingHorizontal: 20 },
  actionGrid: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  actionCard: { flex: 1, height: 80, borderRadius: 20, overflow: 'hidden', ...Theme.shadows.card },
  actionGradient: { flex: 1, padding: 14, justifyContent: 'center' },
  actionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionTitle: { color: '#FFF', fontSize: 13, fontWeight: Theme.typography.weight.extrabold },
  filterRow: { flexDirection: 'row', marginBottom: 15, gap: 6 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border + '20' },
  filterChipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  filterText: { fontSize: 12, fontWeight: Theme.typography.weight.bold, color: Theme.colors.textMuted },
  filterTextActive: { color: '#FFF' },
  insightCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surface, padding: 12, borderRadius: 18, marginBottom: 15, ...Theme.shadows.soft },
  insightIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Theme.colors.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  insightLabel: { fontSize: 9, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.textLight, textTransform: 'uppercase' },
  insightValue: { fontSize: 12, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text, marginTop: 1 },
  dateGroup: { marginBottom: 12 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dateLabel: { fontSize: 11, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.textLight, letterSpacing: 0.5, marginRight: 8 },
  dateLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border + '30' },
  txnCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surface, padding: 12, borderRadius: 16, marginBottom: 8, ...Theme.shadows.soft },
  txnIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  txnMain: { flex: 1 },
  txnTitle: { fontSize: 14, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text },
  txnSub: { fontSize: 10, color: Theme.colors.textLight, marginTop: 1 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 14, fontWeight: Theme.typography.weight.extrabold },
  txnTime: { fontSize: 9, color: Theme.colors.textLight, marginTop: 1 },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { marginTop: 10, color: Theme.colors.textLight, fontWeight: Theme.typography.weight.bold },
  chartBlock: { backgroundColor: Theme.colors.surface, padding: 16, borderRadius: 24, marginTop: 10, ...Theme.shadows.soft },
  chartTitle: { fontSize: 15, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text },
  chartSub: { fontSize: 10, color: Theme.colors.textLight, marginBottom: 12 },
  chart: { marginLeft: -15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1A1A2E' },
  filterSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 12, marginTop: 15 },
  modalScroll: { marginBottom: 5 },
  modalChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  modalChipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  modalChipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  modalChipTextActive: { color: '#FFF' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  dateBtnText: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginLeft: 8 },
  applyBtn: { backgroundColor: Theme.colors.primary, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  applyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  clearAllBtn: { padding: 12, alignItems: 'center', marginTop: 5 },
  clearAllText: { fontSize: 14, color: Theme.colors.error, fontWeight: '700' },
  filteredSummaryCard: {
    backgroundColor: Theme.colors.surface,
    padding: 16,
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '15',
    ...Theme.shadows.card,
  },
  summaryTop: { alignItems: 'center', marginBottom: 15 },
  filteredSummaryLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  filteredSummaryValue: { fontSize: 28, fontWeight: '900', color: Theme.colors.text, marginTop: 2 },
  summaryStats: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  statBox: { flex: 1, alignItems: 'flex-start' },
  statBoxRight: { flex: 1, alignItems: 'flex-end' },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginTop: 1 },
  activeFiltersList: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 15, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9',
    gap: 5
  },
  activeFiltersText: { fontSize: 10, fontWeight: '700', color: Theme.colors.primary, opacity: 0.8 }
});

export default ExpenseListScreen;
