import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
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
import { Analytics } from "../../config/firebase";
import { deleteExpense, getExpenses } from "../../services/expenseService";
import { deleteIncome, getIncomes } from "../../services/incomeService";
import useAuthStore from "../../store/useAuthStore";
import { formatCurrency } from "../../utils/format";

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom" },
];

const ExpenseListScreen = ({ navigation }) => {
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("month");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState({ totalExpense: 0, totalIncome: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeRangeLabel, setActiveRangeLabel] = useState("This Month");
  // Custom Range State
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
  });
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // 'start' or 'end'
  const [categoryId, setCategoryId] = useState(null);
  const [categoryName, setCategoryName] = useState(null);

  // FIX: Don't mutate Date — create fresh instances each time
  const getDateRange = (filterType, baseDate = new Date()) => {
    switch (filterType) {
      case "today": {
        const start = new Date(baseDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(baseDate);
        end.setHours(23, 59, 59, 999);
        return {
          startDate: start,
          endDate: end,
          label:
            baseDate.toDateString() === new Date().toDateString()
              ? "Today"
              : baseDate.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                }),
        };
      }
      case "week": {
        const end = new Date(baseDate);
        end.setHours(23, 59, 59, 999);
        const start = new Date(baseDate);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: end, label: "Last 7 Days" };
      }
      case "month": {
        const start = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          1,
          0,
          0,
          0,
          0,
        );
        const end = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        const isCurrentMonth =
          baseDate.getMonth() === new Date().getMonth() &&
          baseDate.getFullYear() === new Date().getFullYear();
        return {
          startDate: start,
          endDate: end,
          label: isCurrentMonth
            ? "This Month"
            : baseDate.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              }),
        };
      }
      case "custom": {
        const start = new Date(customRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customRange.end);
        end.setHours(23, 59, 59, 999);
        const label = `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
        return { startDate: start, endDate: end, label };
      }
      default:
        return { label: "All Time" };
    }
  };

  const fetchTransactions = async () => {
    try {
      const { startDate, endDate, label } = getDateRange(filter, selectedDate);
      setActiveRangeLabel(label);
      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search.trim()) filters.searchText = search.trim();
      if (categoryId) filters.categoryId = categoryId;

      const [expResult, incResult] = await Promise.all([
        getExpenses(filters),
        getIncomes(filters),
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

      // Sort by date desc
      allTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

      setTransactions(allTxns);
      setSummary({ totalExpense: totalEx, totalIncome: totalIn });
    } catch (error) {
      console.log("❌ Fetch transactions error:", error);
    }
    setLoading(false);
    setRefreshing(false);
  };

  // FIX: Always refetch fresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      Analytics.screenView("TransactionList");
      // Check for navigation params
      const routes = navigation.getState()?.routes;
      const params = routes?.find((r) => r.name === "Transactions")?.params;

      if (params?.categoryId) {
        setCategoryId(params.categoryId);
        setCategoryName(params.categoryName || "Category");
        if (params.searchText) setSearch(params.searchText);

        if (params.startDate && params.endDate) {
          setCustomRange({
            start: new Date(params.startDate),
            end: new Date(params.endDate),
          });
          setFilter("custom");
        } else {
          setFilter("all");
        }
      }

      setLoading(true);
      fetchTransactions();
    }, [filter, search, selectedDate, customRange, categoryId, navigation]),
  );

  const onDateChange = (event, date) => {
    setPickerTarget(null);
    if (date) {
      if (pickerTarget === "start") {
        setCustomRange((prev) => ({ ...prev, start: date }));
      } else if (pickerTarget === "end") {
        const finalEnd = date < customRange.start ? customRange.start : date;
        setCustomRange((prev) => ({ ...prev, end: finalEnd }));
      }
    }
  };

  const handleApplyRange = () => {
    setShowRangeModal(false);
    setFilter("custom");
  };

  const handleCalendarPress = () => {
    setShowRangeModal(true);
  };

  const handleDelete = (tx) => {
    const isIncome = tx.type === "income";
    Alert.alert(
      "Delete",
      `Delete this ${isIncome ? tx.sourceName : tx.categoryName} ${isIncome ? "income" : "expense"} of ₹${tx.amount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = isIncome
              ? await deleteIncome(tx.id, tx)
              : await deleteExpense(tx.id, tx);
            if (result.success) {
              setTransactions((prev) => prev.filter((e) => e.id !== tx.id));
              setSummary((prev) => ({
                ...prev,
                [isIncome ? "totalIncome" : "totalExpense"]:
                  prev[isIncome ? "totalIncome" : "totalExpense"] - tx.amount,
              }));
            } else {
              Alert.alert("Error", result.error);
            }
          },
        },
      ],
    );
  };

  // FIX: Handle ISO strings properly
  const formatDate = (d) => {
    if (!d) return "";
    const date =
      typeof d === "string" ? new Date(d) : d instanceof Date ? d : new Date(d);

    if (isNaN(date.getTime())) return "";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Group by date
  const grouped = {};
  transactions.forEach((tx) => {
    const key = formatDate(tx.date);
    if (!key) return; // skip invalid dates
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  });

  const balance = summary.totalIncome - summary.totalExpense;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.rangeLabel}>{activeRangeLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={handleCalendarPress}
        >
          <Ionicons name="calendar" size={20} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {/* Custom Range Selection Modal */}
      <Modal
        visible={showRangeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRangeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rangeModalContent}>
            <Text style={styles.modalTitle}>Select Custom Range</Text>

            <View style={styles.rangePickersRow}>
              <TouchableOpacity
                style={styles.rangePickerBtn}
                onPress={() => setPickerTarget("start")}
              >
                <Text style={styles.rangePickerLabel}>Start Date</Text>
                <Text style={styles.rangePickerValue}>
                  {customRange.start.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </TouchableOpacity>

              <View style={styles.rangePickerArrow}>
                <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
              </View>

              <TouchableOpacity
                style={styles.rangePickerBtn}
                onPress={() => setPickerTarget("end")}
              >
                <Text style={styles.rangePickerLabel}>End Date</Text>
                <Text style={styles.rangePickerValue}>
                  {customRange.end.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowRangeModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnApply]}
                onPress={handleApplyRange}
              >
                <Text style={styles.modalBtnApplyText}>Apply Range</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {pickerTarget && (
        <DateTimePicker
          value={pickerTarget === "start" ? customRange.start : customRange.end}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContainer}
        >
          {FILTER_OPTIONS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterChip,
                filter === f.id && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f.id && { color: "#FFF" },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {categoryId && (
          <View style={styles.catFilterContainer}>
            <View style={styles.catChip}>
              <Ionicons name="pricetag" size={14} color="#6C63FF" />
              <Text style={styles.catChipText}>{categoryName}</Text>
              <TouchableOpacity
                onPress={() => {
                  setCategoryId(null);
                  setCategoryName(null);
                }}
              >
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.catFilterNote}>Filtering by category</Text>
          </View>
        )}
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTransactions();
            }}
            colors={["#6C63FF"]}
          />
        }
      >
        {/* Summary Card */}
        {!loading && transactions.length > 0 && (
          <LinearGradient
            colors={["#6C63FF", "#4F46E5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.summaryBanner}
          >
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.totalIncome, isStealthMode)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expense</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.totalExpense, isStealthMode)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance</Text>
              <Text style={[styles.summaryValue, { fontWeight: "800" }]}>
                {balance < 0 ? "-" : "+"}
                {formatCurrency(Math.abs(balance), isStealthMode)}
              </Text>
            </View>
          </LinearGradient>
        )}
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#6C63FF"
            style={{ marginTop: 40 }}
          />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptyText}>
              {search ? "Try a different search" : "Tap + to add a transaction"}
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([dateLabel, items], index) => (
            <View key={dateLabel}>
              <View
                style={[styles.dateHeader, index === 0 && { marginTop: 8 }]}
              >
                <Text style={styles.dateLabel}>{dateLabel}</Text>
                <Text style={styles.dateTotal}>
                  {(() => {
                    const dayEx = items
                      .filter((i) => i.type === "expense")
                      .reduce((s, e) => s + e.amount, 0);
                    const dayIn = items
                      .filter((i) => i.type === "income")
                      .reduce((s, i) => s + i.amount, 0);
                    const dayBal = dayIn - dayEx;
                    return (
                      <Text
                        style={{ color: dayBal < 0 ? "#EF4444" : "#10B981" }}
                      >
                        {dayBal < 0 ? "-" : "+"}
                        {formatCurrency(Math.abs(dayBal), isStealthMode)}
                      </Text>
                    );
                  })()}
                </Text>
              </View>
              {items.map((tx) => (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.txnCard}
                  onPress={() => {
                    navigation.navigate("ExpenseDetail", {
                      [tx.type === "income" ? "income" : "expense"]: tx,
                    });
                  }}
                  onLongPress={() => handleDelete(tx)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.txnIconContainer,
                      {
                        backgroundColor:
                          tx.type === "income" ? "#D1FAE5" : "#FEE2E2",
                      },
                    ]}
                  >
                    {tx.type === "income" ? (
                      tx.sourceIcon && tx.sourceIcon.length > 2 ? (
                        <Ionicons
                          name={tx.sourceIcon}
                          size={20}
                          color="#059669"
                        />
                      ) : (
                        <Text style={styles.txnIcon}>
                          {tx.sourceIcon || "💰"}
                        </Text>
                      )
                    ) : tx.categoryIcon && tx.categoryIcon.length > 2 ? (
                      <Ionicons
                        name={tx.categoryIcon}
                        size={20}
                        color="#DC2626"
                      />
                    ) : (
                      <Text style={styles.txnIcon}>
                        {tx.categoryIcon || "📦"}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnCategory} numberOfLines={1}>
                      {tx.type === "income" ? tx.sourceName : tx.categoryName}
                    </Text>
                    <Text style={styles.txnNote} numberOfLines={1}>
                      {tx.note ||
                        (tx.type === "income" ? "Income" : tx.paymentMode)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.txnAmount,
                        tx.type === "income"
                          ? { color: "#059669" }
                          : { color: "#DC2626" },
                      ]}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount, isStealthMode)}
                    </Text>
                    <Text style={styles.txnAccount}>{tx.accountName}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FE" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.5,
  },
  rangeLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: -2,
  },
  calendarBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0EFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  searchRow: { paddingHorizontal: 20, paddingVertical: 8 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1A1A2E", marginLeft: 8 },

  filterRow: { marginBottom: 8, height: 48 },
  filterContainer: {
    paddingHorizontal: 20,
    paddingRight: 40,
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    height: 40,
  },
  filterChipActive: {
    backgroundColor: "#6C63FF",
    borderColor: "#6C63FF",
    elevation: 4,
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  filterText: { fontSize: 13, fontWeight: "600", color: "#64748B" },

  content: { paddingHorizontal: 20, paddingBottom: 120 },

  summaryBanner: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  dateLabel: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  dateTotal: { fontSize: 13, fontWeight: "600" },

  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  txnIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txnIcon: { fontSize: 24 },
  txnCategory: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 2,
  },
  txnNote: { fontSize: 12, color: "#94A3B8" },
  txnAmount: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  txnAccount: { fontSize: 10, color: "#94A3B8", fontWeight: "500" },

  emptyText: { fontSize: 14, color: "#9CA3AF", marginTop: 4 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  rangeModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 20,
    textAlign: "center",
  },
  rangePickersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  rangePickerBtn: {
    flex: 1,
    backgroundColor: "#F8F9FE",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  rangePickerLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  rangePickerValue: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "700",
  },
  rangePickerArrow: {
    paddingHorizontal: 10,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: "#F1F5F9",
  },
  modalBtnCancelText: {
    color: "#64748B",
    fontWeight: "700",
  },
  modalBtnApply: {
    backgroundColor: "#6C63FF",
  },
  modalBtnApplyText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  catFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0EFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#6C63FF40",
  },
  catChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6C63FF",
  },
  catFilterNote: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
  },
});

export default ExpenseListScreen;
