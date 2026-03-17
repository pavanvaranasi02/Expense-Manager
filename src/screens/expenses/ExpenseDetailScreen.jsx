import { Ionicons } from '@expo/vector-icons';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteExpense } from '../../services/expenseService';
import { deleteIncome } from '../../services/incomeService';

const TransactionDetailScreen = ({ navigation, route }) => {
  const txn = route?.params?.expense || route?.params?.income;
  if (!txn) return null;

  const isIncome = txn.type === 'income' || !!txn.sourceName;

  // FIX: Handle ISO strings, Date objects, and Firestore Timestamps
  const formatDate = (d) => {
    if (!d) return '';
    let date;

    if (typeof d === 'string') {
      // ISO string from serialized data
      date = new Date(d);
    } else if (d instanceof Date) {
      date = d;
    } else if (d.toDate && typeof d.toDate === 'function') {
      // Firestore Timestamp
      date = d.toDate();
    } else if (d.seconds) {
      // Raw Firestore timestamp object
      date = new Date(d.seconds * 1000);
    } else {
      date = new Date(d);
    }

    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleEdit = () => {
    if (isIncome) {
      navigation.navigate('AddIncomeModal', { income: txn });
    } else {
      navigation.navigate('AddExpenseModal', { expense: txn });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete ${isIncome ? 'Income' : 'Expense'}`,
      'Are you sure? This will restore the account balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = isIncome
              ? await deleteIncome(txn.id, txn)
              : await deleteExpense(txn.id, txn);
            if (result.success) navigation.goBack();
            else Alert.alert('Error', result.error);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isIncome ? 'Income' : 'Expense'} Detail</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Amount */}
        <View style={styles.amountSection}>
          {isIncome ? (
            txn.sourceIcon && txn.sourceIcon.length > 2 ? (
              <Ionicons name={txn.sourceIcon} size={48} color="#10B981" style={{ marginBottom: 12 }} />
            ) : (
              <Text style={styles.icon}>{txn.sourceIcon || '💰'}</Text>
            )
          ) : txn.categoryIcon && txn.categoryIcon.length > 2 ? (
            <Ionicons name={txn.categoryIcon} size={48} color="#EF4444" style={{ marginBottom: 12 }} />
          ) : (
            <Text style={styles.icon}>{txn.categoryIcon || '📦'}</Text>
          )}
          <Text style={[styles.amount, isIncome && { color: '#10B981' }]}>
            {isIncome ? '+' : '-'}₹{(txn.amount || 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.category}>
            {isIncome ? txn.sourceName : txn.categoryName}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.detailCard}>
          {[
            {
              label: 'Date',
              value: formatDate(txn.date),
              icon: 'calendar-outline',
            },
            {
              label: 'Account',
              value: txn.accountName,
              icon: 'card-outline',
            },
            !isIncome && {
              label: 'Payment',
              value: txn.paymentMode?.replace('_', ' '),
              icon: 'wallet-outline',
            },
            !isIncome && {
              label: 'Type',
              value: txn.isCredit
                ? '🔴 Credit Card (Debt)'
                : '🟢 Direct Payment',
              icon: 'swap-horizontal',
            },
            txn.note && {
              label: 'Note',
              value: txn.note,
              icon: 'document-text-outline',
            },
          ]
            .filter(Boolean)
            .map((item, i) => (
              <View
                key={i}
                style={[styles.detailRow, i > 0 && styles.detailBorder]}
              >
                <View style={styles.detailLeft}>
                  <Ionicons name={item.icon} size={18} color="#6B7280" />
                  <Text style={styles.detailLabel}>{item.label}</Text>
                </View>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
        </View>

        {/* Actions */}
        <TouchableOpacity style={[styles.editBtn, isIncome && { backgroundColor: '#10B981' }]} onPress={handleEdit}>
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.editBtnText}>Edit {isIncome ? 'Income' : 'Expense'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={styles.deleteBtnText}>Delete {isIncome ? 'Income' : 'Expense'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  amountSection: { alignItems: 'center', paddingVertical: 32 },
  icon: { fontSize: 48, marginBottom: 12 },
  amount: { fontSize: 36, fontWeight: '700', color: '#EF4444' },
  category: { fontSize: 16, color: '#6B7280', marginTop: 4 },

  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  detailBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  detailLeft: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { fontSize: 14, color: '#6B7280', marginLeft: 10 },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A2E',
    maxWidth: '50%',
    textAlign: 'right',
  },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    height: 50,
    borderRadius: 12,
    marginBottom: 10,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    height: 50,
    borderRadius: 12,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TransactionDetailScreen;