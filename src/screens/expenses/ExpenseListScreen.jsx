import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Analytics } from '../../config/firebase';
import { deleteExpense, getExpenses } from '../../services/expenseService';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

const ExpenseListScreen = ({ navigation }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('month');
  const [search, setSearch] = useState('');

  // FIX: Don't mutate Date — create fresh instances each time
  const getDateRange = (filterType) => {
    switch (filterType) {
      case 'today': {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { startDate: start, endDate: end };
      }
      case 'week': {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: end };
      }
      case 'month': {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { startDate: start, endDate: end };
      }
      default:
        return {}; // 'all' — no date filter
    }
  };

  const fetchExpenses = async () => {
    try {
      const filters = { ...getDateRange(filter) };
      if (search.trim()) filters.searchText = search.trim();

      const result = await getExpenses(filters);
      if (result.success) {
        setExpenses(result.expenses);
      } else {
        console.log('❌ Fetch expenses error:', result.error);
      }
    } catch (error) {
      console.log('❌ Fetch expenses error:', error);
    }
    setLoading(false);
    setRefreshing(false);
  };

  // FIX: Always refetch fresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('ExpenseList');
      setLoading(true);
      fetchExpenses();
    }, [filter, search])
  );

  const handleDelete = (expense) => {
    Alert.alert(
      'Delete',
      `Delete this ${expense.categoryName} expense of ₹${expense.amount}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteExpense(expense.id, expense);
            if (result.success) {
              setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  // FIX: Handle ISO strings properly
  const formatDate = (d) => {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d instanceof Date ? d : new Date(d);

    if (isNaN(date.getTime())) return '';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Group by date
  const grouped = {};
  expenses.forEach((exp) => {
    const key = formatDate(exp.date);
    if (!key) return; // skip invalid dates
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(exp);
  });

  const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.total}>
          ₹{totalAmount.toLocaleString('en-IN')}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search expenses..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
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
                filter === f.id && { color: '#FFF' },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchExpenses();
            }}
            colors={['#6C63FF']}
          />
        }
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#6C63FF"
            style={{ marginTop: 40 }}
          />
        ) : expenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No expenses found</Text>
            <Text style={styles.emptyText}>
              {search
                ? 'Try a different search'
                : 'Tap + to add an expense'}
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([dateLabel, items]) => (
            <View key={dateLabel}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateLabel}>{dateLabel}</Text>
                <Text style={styles.dateTotal}>
                  ₹
                  {items
                    .reduce((s, e) => s + e.amount, 0)
                    .toLocaleString('en-IN')}
                </Text>
              </View>
              {items.map((exp) => (
                <TouchableOpacity
                  key={exp.id}
                  style={styles.txnCard}
                  onPress={() =>
                    // FIX: expense.date is already an ISO string — fully serializable
                    navigation.navigate('ExpenseDetail', { expense: exp })
                  }
                  onLongPress={() => handleDelete(exp)}
                >
                  <Text style={styles.txnIcon}>
                    {exp.categoryIcon || '📦'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnCategory}>
                      {exp.categoryName}
                    </Text>
                    <Text style={styles.txnNote} numberOfLines={1}>
                      {exp.note || exp.paymentMode} • {exp.accountName}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.txnAmount}>
                      -₹{exp.amount.toLocaleString('en-IN')}
                    </Text>
                    {exp.isCredit && (
                      <Text style={styles.txnCredit}>Credit</Text>
                    )}
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
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  total: { fontSize: 18, fontWeight: '700', color: '#EF4444' },

  searchRow: { paddingHorizontal: 20, paddingVertical: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A2E', marginLeft: 8 },

  filterRow: { paddingHorizontal: 20, marginBottom: 8, maxHeight: 40 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#374151' },

  content: { paddingHorizontal: 20, paddingBottom: 100 },

  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  dateTotal: { fontSize: 13, fontWeight: '600', color: '#EF4444' },

  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  txnIcon: { fontSize: 24, marginRight: 12 },
  txnCategory: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  txnNote: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  txnCredit: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
    marginTop: 16,
  },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
});

export default ExpenseListScreen;