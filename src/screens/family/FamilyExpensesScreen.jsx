import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Analytics } from '../../config/firebase';
import {
    deleteFamilyExpense,
    getMonthlyFamilyExpenses
} from '../../services/familyExpenseService';
import useAuthStore from '../../store/useAuthStore';
import useFamilyStore from '../../store/useFamilyStore';

const FamilyExpensesScreen = ({ navigation }) => {
  const userId = useAuthStore((s) => s.user?.uid);
  const userProfile = useAuthStore((s) => s.userProfile);
  const { family, members, expenses, setExpenses, setExpensesLoading, removeExpenseFromStore } =
    useFamilyStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchExpenses = async () => {
    try {
      setExpensesLoading(true);
      const result = await getMonthlyFamilyExpenses(family.id, selectedMonth, selectedYear);

      if (result.success) {
        setExpenses(result.expenses);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to load expenses',
          text2: result.error,
        });
      }
    } catch (error) {
      console.log('Fetch expenses error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setExpensesLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('FamilyExpenses');
      if (family?.id) {
        fetchExpenses();
      }
    }, [selectedMonth, selectedYear, family?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchExpenses();
  };

  const handleDelete = (expense) => {
    Alert.alert(
      'Delete Expense',
      `Delete ${expense.categoryName} expense of ₹${expense.amount}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const syncOnDelete = userProfile?.settings?.family?.syncOnDelete ?? true;
            const result = await deleteFamilyExpense(family.id, expense.id, syncOnDelete);

            if (result.success) {
              removeExpenseFromStore(expense.id);
              Toast.show({
                type: 'success',
                text1: 'Expense Deleted',
              });
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to delete',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  const canDelete = (expense) => {
    // Owner/Co-Admin can delete any, members can only delete their own
    const isOwnerOrCoAdmin =
      family.ownerId === userId || family.coAdminId === userId;
    return isOwnerOrCoAdmin || expense.addedBy === userId;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const renderExpense = ({ item }) => (
    <View style={styles.expenseCard}>
      <View style={styles.expenseMain}>
        <View style={[styles.expenseIcon, { backgroundColor: item.categoryIcon + '15' || '#F1F5F9' }]}>
          <Ionicons name={item.categoryIcon || 'ellipsis-horizontal'} size={22} color="#6C63FF" />
        </View>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseCategory}>{item.categoryName}</Text>
          <View style={styles.expenseMeta}>
            <Text style={styles.expenseMetaText}>By {item.paidByName}</Text>
            <Text style={styles.expenseMetaDot}>•</Text>
            <Text style={styles.expenseMetaText}>{formatDate(item.date)}</Text>
          </View>
          {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        </View>
        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
          {canDelete(item) && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Family Expenses</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Family Expenses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddFamilyExpense')}
        >
          <Ionicons name="add" size={24} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={styles.summaryValue}>₹{totalSpent.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summaryLabel}>{expenses.length} Expenses</Text>
            <Text style={styles.summaryMonth}>
              {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Expense List */}
      <FlatList
        data={expenses}
        renderItem={renderExpense}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C63FF']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptyText}>
              Tap the + button to add your first family expense
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('AddFamilyExpense')}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0EFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
  },
  summaryMonth: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  expenseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  expenseMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  expenseCategory: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  expenseMetaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  expenseMetaDot: {
    fontSize: 12,
    color: '#CBD5E1',
    marginHorizontal: 6,
  },
  expenseNote: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 6,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FamilyExpensesScreen;