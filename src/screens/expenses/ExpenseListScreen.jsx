import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EmptyState from "../../components/ui/EmptyState";
import MetricStrip from "../../components/ui/MetricStrip";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { Analytics } from "../../config/firebase";
import { getAccounts, calculateTotals } from "../../services/accountService";
import { getAllCategories } from "../../services/categoryService";
import { deleteExpense, getExpenses } from "../../services/expenseService";
import {
  calculateCashFlowSummary,
  calculateCategorySpending,
  TRANSACTION_TYPES,
} from "../../services/financialCalculationService";
import { deleteIncome, getIncomes } from "../../services/incomeService";
import useAuthStore from "../../store/useAuthStore";
import { Theme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const ExpenseListScreen = ({ navigation }) => {
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const userName = useAuthStore((s) => s.getUserName());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFlowChart, setShowFlowChart] = useState(false);
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
      
      // Basic Time Filters (aligned with reporting period)
      if (filter === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        filters.startDate = start.toISOString();
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end.toISOString();
      } else if (filter === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        filters.startDate = weekStart.toISOString();
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end.toISOString();
      } else if (filter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        filters.startDate = monthStart.toISOString();
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end.toISOString();
      }

      // Advanced Overrides
      if (startDate) filters.startDate = startDate.toISOString();
      if (endDate) filters.endDate = endDate.toISOString();
      if (categoryId) filters.categoryId = categoryId;
      if (paymentMode) filters.paymentMode = paymentMode;

      const [expResult, incResult, accountsResult, categoriesResult] = await Promise.all([
        getExpenses(filters),
        getIncomes(filters),
        getAccounts(),
        getAllCategories(),
      ]);

      let allTxns = [];
      let totalEx = 0;
      let totalIn = 0;

      if (expResult.success) {
        const exps = expResult.expenses.map((e) => ({
          ...e,
          type:
            e.isTransfer || e.transactionType === TRANSACTION_TYPES.TRANSFER
              ? TRANSACTION_TYPES.TRANSFER
              : TRANSACTION_TYPES.EXPENSE,
        }));
        allTxns = [...allTxns, ...exps];
      }

      if (incResult.success) {
        const incs = incResult.incomes.map((i) => ({ ...i, type: TRANSACTION_TYPES.INCOME }));
        allTxns = [...allTxns, ...incs];
      }

      const flowTotals = calculateCashFlowSummary(allTxns);
      totalEx = flowTotals.totalExpenses;
      totalIn = flowTotals.totalIncome;

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

  const visibleTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!q) return true;
      const hay = [
        tx.categoryName,
        tx.sourceName,
        tx.note,
        tx.accountName,
        tx.paymentMode,
        String(tx.amount ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [transactions, typeFilter, searchQuery]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    visibleTransactions.forEach(tx => {
      const date = new Date(tx.date).toDateString();
      const label = formatDate(date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    });
    return Object.entries(groups);
  }, [visibleTransactions]);

  const { flowTitle, chartData } = useMemo(() => {
    const now = new Date();
    const isCustomRange = Boolean(startDate || endDate);

    if (!isCustomRange && filter === 'today') {
      const buckets = [
        { label: 'Morn', min: 0, max: 11 },
        { label: 'Aft', min: 12, max: 16 },
        { label: 'Eve', min: 17, max: 20 },
        { label: 'Night', min: 21, max: 23 },
      ];
      const spendData = buckets.map((b) =>
        visibleTransactions
          .filter((tx) => {
            const h = new Date(tx.date).getHours();
            return tx.type === 'expense' && h >= b.min && h <= b.max;
          })
          .reduce((s, tx) => s + (tx.amount || 0), 0)
      );
      const incomeData = buckets.map((b) =>
        visibleTransactions
          .filter((tx) => {
            const h = new Date(tx.date).getHours();
            return tx.type === 'income' && h >= b.min && h <= b.max;
          })
          .reduce((s, tx) => s + (tx.amount || 0), 0)
      );
      return {
        flowTitle: "Today's Flow",
        chartData: {
          labels: buckets.map((b) => b.label),
          datasets: [{ data: spendData }, { data: incomeData }],
        },
      };
    }

    if (!isCustomRange && filter === 'week') {
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        return d;
      });
      const labels = last7Days.map((d) =>
        d.toLocaleDateString('en-IN', { weekday: 'narrow' })
      );
      const spendData = last7Days.map((d) =>
        visibleTransactions
          .filter(
            (tx) =>
              tx.type === 'expense' &&
              new Date(tx.date).toDateString() === d.toDateString()
          )
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      );
      const incomeData = last7Days.map((d) =>
        visibleTransactions
          .filter(
            (tx) =>
              tx.type === 'income' &&
              new Date(tx.date).toDateString() === d.toDateString()
          )
          .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      );
      return {
        flowTitle: '7-Day Flow',
        chartData: {
          labels,
          datasets: [{ data: spendData }, { data: incomeData }],
        },
      };
    }

    if (!isCustomRange && filter === 'month') {
      const monthName = now.toLocaleString('default', { month: 'long' });
      const weekBuckets = [
        { label: 'W1', min: 1, max: 7 },
        { label: 'W2', min: 8, max: 14 },
        { label: 'W3', min: 15, max: 21 },
        { label: 'W4', min: 22, max: 31 },
      ];
      const spendData = weekBuckets.map((b) =>
        visibleTransactions
          .filter((tx) => {
            const day = new Date(tx.date).getDate();
            return tx.type === 'expense' && day >= b.min && day <= b.max;
          })
          .reduce((s, tx) => s + (tx.amount || 0), 0)
      );
      const incomeData = weekBuckets.map((b) =>
        visibleTransactions
          .filter((tx) => {
            const day = new Date(tx.date).getDate();
            return tx.type === 'income' && day >= b.min && day <= b.max;
          })
          .reduce((s, tx) => s + (tx.amount || 0), 0)
      );
      return {
        flowTitle: `${monthName} Flow`,
        chartData: {
          labels: weekBuckets.map((b) => b.label),
          datasets: [{ data: spendData }, { data: incomeData }],
        },
      };
    }

    // All-Time or Custom Date Range: group by last 6 months
    const months = [...Array(6)].map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString('en-IN', { month: 'short' }),
      };
    });
    const spendData = months.map((m) =>
      visibleTransactions
        .filter((tx) => {
          const dt = new Date(tx.date);
          return (
            tx.type === 'expense' &&
            dt.getFullYear() === m.year &&
            dt.getMonth() === m.month
          );
        })
        .reduce((s, tx) => s + (tx.amount || 0), 0)
    );
    const incomeData = months.map((m) =>
      visibleTransactions
        .filter((tx) => {
          const dt = new Date(tx.date);
          return (
            tx.type === 'income' &&
            dt.getFullYear() === m.year &&
            dt.getMonth() === m.month
          );
        })
        .reduce((s, tx) => s + (tx.amount || 0), 0)
    );
    return {
      flowTitle: isCustomRange ? 'Period Flow' : 'All-Time Flow',
      chartData: {
        labels: months.map((m) => m.label),
        datasets: [{ data: spendData }, { data: incomeData }],
      },
    };
  }, [visibleTransactions, filter, startDate, endDate]);

  const { filteredInc, filteredExp } = useMemo(() => {
    const summaryTotals = calculateCashFlowSummary(visibleTransactions);
    return {
      filteredInc: summaryTotals.totalIncome,
      filteredExp: summaryTotals.totalExpenses,
    };
  }, [visibleTransactions]);

  const topCategory = useMemo(() => {
    const breakdown = calculateCategorySpending(visibleTransactions);
    return breakdown[0] ? { name: breakdown[0].name, amount: breakdown[0].total } : null;
  }, [visibleTransactions]);

  const renderIcon = (tx) => {
    const isInc = tx.type === 'income';
    const rawIcon = isInc ? tx.sourceIcon : tx.categoryIcon;
    const label = (isInc ? tx.sourceName : tx.categoryName) || '';
    if (rawIcon && rawIcon.length > 2 && !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(rawIcon)) {
      return <Ionicons name={rawIcon} size={18} color={isInc ? Theme.colors.success : Theme.colors.textSecondary} />;
    }
    const fallbackIcon = isInc
      ? 'arrow-down-circle-outline'
      : /food|dining/i.test(label)
      ? 'restaurant-outline'
      : /travel|cab|transport/i.test(label)
      ? 'car-outline'
      : /shop/i.test(label)
      ? 'bag-handle-outline'
      : /bill|utilit/i.test(label)
      ? 'flash-outline'
      : /health/i.test(label)
      ? 'medkit-outline'
      : /rent|home/i.test(label)
      ? 'home-outline'
      : 'receipt-outline';
    return <Ionicons name={fallbackIcon} size={18} color={isInc ? Theme.colors.success : Theme.colors.textSecondary} />;
  };

  const isFilterActive = categoryId || paymentMode || startDate || endDate;
  const userInitials = (userName || 'K').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'K';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Activity"
        subtitle="Unified income & expense ledger"
        navigation={navigation}
        showAvatar
        rightActions={
          <View style={styles.headerActions}>
            {isFilterActive && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={20} color={Theme.colors.error} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.configBtn} onPress={() => setShowConfig(true)}>
              <Ionicons name="options-outline" size={18} color={Theme.colors.text} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search-first input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Theme.colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search category, note, account or amount..."
          placeholderTextColor={Theme.colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Theme.colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Segmented Type Filter */}
      <View style={styles.segmentedRow}>
        {[
          { id: 'all', label: 'All' },
          { id: 'expense', label: 'Expenses' },
          { id: 'income', label: 'Income' },
        ].map((seg) => (
          <TouchableOpacity
            key={seg.id}
            style={[styles.segBtn, typeFilter === seg.id && styles.segBtnActive]}
            onPress={() => setTypeFilter(seg.id)}
          >
            <Text style={[styles.segText, typeFilter === seg.id && styles.segTextActive]}>
              {seg.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reusable Inline Period Summary Strip */}
      <MetricStrip
        style={{ marginHorizontal: 20, marginBottom: 12 }}
        items={[
          {
            label: 'INFLOW',
            value: `+${formatCurrency(filteredInc, isStealthMode)}`,
            color: filteredInc > 0 ? Theme.colors.success : Theme.colors.text,
          },
          {
            label: 'OUTFLOW',
            value: `-${formatCurrency(filteredExp, isStealthMode)}`,
            color: filteredExp > 0 ? Theme.colors.error : Theme.colors.text,
          },
          {
            label: isFilterActive ? 'FILTERED NET' : 'NET',
            value: (() => {
              const net = filteredInc - filteredExp;
              if (net < 0) return `-${formatCurrency(Math.abs(net), isStealthMode)}`;
              return formatCurrency(net, isStealthMode);
            })(),
            align: 'right',
          },
        ]}
      />

      {isFilterActive && (
        <View style={styles.activeFilterBanner}>
          <Ionicons name="filter" size={12} color={Theme.colors.primary} />
          <Text style={styles.activeFiltersText} numberOfLines={1}>
            {[
              categoryName && `Category: ${categoryName}`,
              paymentMode && `Pay: ${paymentMode.replace('_', ' ')}`,
              startDate && `Since: ${startDate.toLocaleDateString()}`,
            ]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTransactions(); }} />}
      >

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

        {/* Compact Supporting Insights Bar (matches selected reporting period) */}
        {(visibleTransactions.length > 0 || topCategory) ? (
          <View style={styles.velocitySection}>
            {(() => {
              const incArr = chartData.datasets?.[1]?.data || [];
              const expArr = chartData.datasets?.[0]?.data || [];
              const maxVal = Math.max(1, ...incArr, ...expArr);
              const fmtCompact = (n) => {
                if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
                if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
                return `₹${Math.round(n)}`;
              };
              return (
                <>
                  <TouchableOpacity
                    style={styles.velocitySummaryRow}
                    onPress={() => setShowFlowChart((v) => !v)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="bar-chart-outline" size={15} color={Theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chartTitle} numberOfLines={1}>
                        {flowTitle} · In {isStealthMode ? '••••' : fmtCompact(filteredInc)} · Out {isStealthMode ? '••••' : fmtCompact(filteredExp)}
                      </Text>
                      {topCategory ? (
                        <Text style={styles.chartSub} numberOfLines={1}>
                          Top spend: {topCategory.name} ({formatCurrency(topCategory.amount, isStealthMode)})
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={showFlowChart ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={Theme.colors.textMuted}
                    />
                  </TouchableOpacity>

                  {showFlowChart ? (
                    <View style={{ marginTop: 12 }}>
                      <View style={styles.velocityLegend}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: Theme.colors.primary }]} />
                          <Text style={styles.legendText}>In</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#C2786B' }]} />
                          <Text style={styles.legendText}>Out</Text>
                        </View>
                      </View>

                      <View style={styles.velocityChartWrap}>
                        <View style={styles.velocityGrid}>
                          <View style={styles.velocityGridLine}>
                            <Text style={styles.velocityScaleText}>{isStealthMode ? '' : fmtCompact(maxVal)}</Text>
                          </View>
                          <View style={styles.velocityGridLine}>
                            <Text style={styles.velocityScaleText}>{isStealthMode ? '' : fmtCompact(maxVal / 2)}</Text>
                          </View>
                        </View>

                        <View style={styles.velocityBarsRow}>
                          {(chartData.labels || []).map((lbl, idx) => {
                            const hasIn = incArr[idx] > 0;
                            const hasOut = expArr[idx] > 0;
                            const incH = hasIn ? Math.max(8, Math.round((incArr[idx] / maxVal) * 68)) : 2;
                            const expH = hasOut ? Math.max(8, Math.round((expArr[idx] / maxVal) * 68)) : 2;
                            return (
                              <View key={`${lbl}-${idx}`} style={styles.velocityCol}>
                                <View style={styles.velocityTrack}>
                                  <View
                                    style={[
                                      styles.velocityBar,
                                      {
                                        height: incH,
                                        backgroundColor: hasIn ? Theme.colors.primary : Theme.colors.border,
                                      },
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.velocityBar,
                                      {
                                        height: expH,
                                        backgroundColor: hasOut ? '#C2786B' : Theme.colors.border,
                                      },
                                    ]}
                                  />
                                </View>
                                <Text
                                  style={[
                                    styles.velocityDayLabel,
                                    (hasIn || hasOut) && { color: Theme.colors.text },
                                  ]}
                                >
                                  {lbl}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  ) : null}
                </>
              );
            })()}
          </View>
        ) : null}

        {loading ? <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: 40 }} /> :
         visibleTransactions.length === 0 ? (
           <EmptyState
             icon="receipt-outline"
             title={isFilterActive || searchQuery.trim() ? 'No matching activity' : 'No activity yet'}
             description={
               isFilterActive || searchQuery.trim()
                 ? 'Try adjusting your search or date filters.'
                 : 'Record an expense or income to see your chronological ledger here.'
             }
             actionLabel={isFilterActive || searchQuery.trim() ? 'Clear Filters' : 'Add Expense'}
             onAction={() => {
               if (isFilterActive || searchQuery.trim()) {
                 setSearchQuery('');
                 setTypeFilter('all');
                 clearFilters();
               } else {
                 navigation.navigate('AddExpenseModal');
               }
             }}
             style={{ marginTop: 8, marginBottom: 14 }}
           />
         ) :
         groupedTransactions.map(([dateLabel, items]) => (
            <View key={dateLabel} style={styles.dateGroup}>
                <View style={styles.dateHeader}><Text style={styles.dateLabel}>{dateLabel}</Text><View style={styles.dateLine} /></View>
                <View style={styles.ledgerGroup}>
                {items.map((tx, idx) => (
                    <TouchableOpacity key={tx.id} style={[styles.txnCard, idx > 0 && styles.txnRowBorder]} onPress={() => navigation.navigate('ExpenseDetail', { [tx.type === 'income' ? 'income' : 'expense']: tx })} onLongPress={() => handleDelete(tx)}>
                        <View style={[styles.txnIcon, { backgroundColor: Theme.colors.surfaceMuted }]}>{renderIcon(tx)}</View>
                        <View style={styles.txnMain}><Text style={styles.txnTitle} numberOfLines={1}>{tx.type === 'income' ? tx.sourceName : tx.categoryName}</Text><Text style={styles.txnSub}>{tx.note || (tx.type === 'income' ? 'Income' : tx.paymentMode)} • {tx.accountName}</Text></View>
                        <View style={styles.txnRight}><Text style={[styles.txnAmount, { color: tx.type === 'income' ? Theme.colors.success : Theme.colors.text }]}>{tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount, isStealthMode)}</Text><Text style={styles.txnTime}>{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>
                    </TouchableOpacity>
                ))}
                </View>
            </View>
         ))}

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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 110 },
  actionGrid: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    gap: 10,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { color: Theme.colors.text, fontSize: 13, fontWeight: Theme.typography.weight.bold },
  actionSub: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: Theme.typography.weight.medium, marginTop: 1 },
  filterRow: { flexDirection: 'row', marginBottom: 12, gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Theme.radius.full, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border },
  filterChipActive: { backgroundColor: Theme.colors.inkSurface, borderColor: Theme.colors.inkSurface },
  filterText: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 12, color: Theme.colors.textMuted },
  filterTextActive: { fontFamily: Theme.typography.fontFamily.semibold, color: '#FFFFFF' },
  insightCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Theme.colors.canvasRecessed, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Theme.radius.md, marginBottom: 14 },
  insightInlineText: { flex: 1 },
  insightLabel: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 10, color: Theme.colors.textMuted, letterSpacing: 0.7 },
  insightValue: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 12, color: Theme.colors.text },
  velocitySection: { backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg, borderWidth: 1, borderColor: Theme.colors.border, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  velocityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  velocityLegend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontFamily: Theme.typography.fontFamily.medium, fontSize: 11, color: Theme.colors.textMuted },
  velocityChartWrap: { position: 'relative', height: 94, justifyContent: 'flex-end' },
  velocityGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 22, justifyContent: 'space-between' },
  velocityGridLine: { borderTopWidth: 1, borderTopColor: Theme.colors.borderSubtle, flexDirection: 'row', justifyContent: 'flex-end' },
  velocityScaleText: { fontFamily: Theme.typography.fontFamily.regular, fontSize: 9, color: Theme.colors.textLight, marginTop: 2, ...Theme.typography.tabularNums },
  velocityBarsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 28 },
  velocityCol: { flex: 1, alignItems: 'center' },
  velocityTrack: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 70, borderBottomWidth: 1, borderBottomColor: Theme.colors.border, paddingHorizontal: 4 },
  velocityBar: { width: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  velocityDayLabel: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 10, color: Theme.colors.textLight, marginTop: 5 },
  dateGroup: { marginBottom: 14 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dateLabel: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 11, color: Theme.colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginRight: 8 },
  dateLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border },
  ledgerGroup: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  txnCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surface, paddingHorizontal: 14, paddingVertical: 12 },
  txnRowBorder: { borderTopWidth: 1, borderTopColor: Theme.colors.borderSubtle },
  txnIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txnMain: { flex: 1 },
  txnTitle: { ...Theme.typography.presets.rowTitle, color: Theme.colors.text },
  txnSub: { ...Theme.typography.presets.rowSubtitle, color: Theme.colors.textMuted, marginTop: 2 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { ...Theme.typography.presets.monoValue },
  txnTime: { fontFamily: Theme.typography.fontFamily.regular, fontSize: 10, color: Theme.colors.textLight, marginTop: 2 },
  emptyState: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { marginTop: 8, fontFamily: Theme.typography.fontFamily.semibold, color: Theme.colors.textMuted },
  chartBlock: { backgroundColor: Theme.colors.surface, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: Theme.colors.border, marginTop: 10, overflow: 'hidden' },
  velocitySummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chartTitle: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 13, color: Theme.colors.text },
  chartSub: { fontFamily: Theme.typography.fontFamily.regular, fontSize: 11, color: Theme.colors.textMuted, marginTop: 2 },
  chart: { marginLeft: -12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(24, 24, 27, 0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: Theme.typography.fontFamily.bold, fontSize: 18, color: Theme.colors.text },
  filterSection: { marginBottom: 20 },
  sectionTitle: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 12, color: Theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, marginTop: 14 },
  modalScroll: { marginBottom: 5 },
  modalChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Theme.radius.md, backgroundColor: Theme.colors.surfaceSubtle, marginRight: 8, borderWidth: 1, borderColor: Theme.colors.border },
  modalChipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  modalChipText: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 13, color: Theme.colors.textSecondary },
  modalChipTextActive: { color: Theme.colors.surface },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surfaceSubtle, padding: 12, borderRadius: Theme.radius.md, borderWidth: 1, borderColor: Theme.colors.border },
  dateBtnText: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 13, color: Theme.colors.text, marginLeft: 8 },
  applyBtn: { backgroundColor: Theme.colors.primary, padding: 15, borderRadius: Theme.radius.lg, alignItems: 'center', marginTop: 10 },
  applyBtnText: { fontFamily: Theme.typography.fontFamily.semibold, color: '#FFFFFF', fontSize: 15 },
  clearAllBtn: { padding: 12, alignItems: 'center', marginTop: 5 },
  clearAllText: { fontFamily: Theme.typography.fontFamily.semibold, fontSize: 14, color: Theme.colors.error },
  periodStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 12,
  },
  periodCol: {
    flex: 1,
  },
  periodDivider: {
    width: 1,
    height: 24,
    backgroundColor: Theme.colors.border,
    marginHorizontal: 10,
  },
  periodLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    letterSpacing: 0.6,
  },
  periodVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: 6,
  },
  filteredSummaryCard: {
    backgroundColor: Theme.colors.surface,
    padding: 14,
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(91, 82, 229, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 14,
    color: Theme.colors.text,
    paddingVertical: 0,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.canvasRecessed,
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.borderSubtle,
  },
  segText: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  segTextActive: {
    fontFamily: Theme.typography.fontFamily.semibold,
    color: Theme.colors.primary,
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
