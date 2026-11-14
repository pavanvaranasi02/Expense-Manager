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
import AppButton from '../../components/ui/AppButton';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { deleteExpense } from '../../services/expenseService';
import { deleteIncome } from '../../services/incomeService';
import { Theme } from '../../theme/theme';

const getOutlineIcon = (rawIcon, isIncome) => {
  if (rawIcon && rawIcon.length > 2 && !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(rawIcon)) {
    return rawIcon;
  }
  return isIncome ? 'arrow-down-circle-outline' : 'receipt-outline';
};

const TransactionDetailScreen = ({ navigation, route }) => {
  const txn = route?.params?.expense || route?.params?.income;
  if (!txn) return null;

  const isIncome = txn.type === 'income' || !!txn.sourceName;
  const isTransfer = txn.type === 'transfer' || txn.isTransfer === true;

  const formatDate = (d) => {
    if (!d) return '';
    let date;
    if (typeof d === 'string') {
      date = new Date(d);
    } else if (d instanceof Date) {
      date = d;
    } else if (d.toDate && typeof d.toDate === 'function') {
      date = d.toDate();
    } else if (d.seconds) {
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

  const iconName = getOutlineIcon(isIncome ? txn.sourceIcon : txn.categoryIcon, isIncome);
  const accentColor = isIncome
    ? Theme.colors.success
    : isTransfer
    ? Theme.colors.primary
    : Theme.colors.error;

  const rows = [
    { label: 'Date', value: formatDate(txn.date), icon: 'calendar-outline' },
    { label: 'Account', value: txn.accountName || 'Unknown', icon: 'card-outline' },
    !isIncome && {
      label: 'Payment',
      value: txn.paymentMode?.replace('_', ' ') || 'Other',
      icon: 'wallet-outline',
    },
    !isIncome && {
      label: 'Classification',
      value: isTransfer ? 'Transfer / Bill Payment' : txn.isCredit ? 'Credit Card (Debt)' : 'Direct Payment',
      icon: 'swap-horizontal-outline',
    },
    txn.note && {
      label: 'Note',
      value: txn.note,
      icon: 'document-text-outline',
    },
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={isIncome ? 'Income Detail' : isTransfer ? 'Transfer Detail' : 'Expense Detail'}
        showBack
        navigation={navigation}
        rightActions={
          <TouchableOpacity onPress={handleDelete} style={styles.trashBtn} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.amountSection}>
          <View style={styles.iconBadge}>
            <Ionicons name={iconName} size={26} color={accentColor} />
          </View>
          <Text style={[styles.amount, { color: accentColor }]}>
            {isIncome ? '+' : '-'}₹{(txn.amount || 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.category}>
            {isIncome ? txn.sourceName : txn.categoryName}
          </Text>
        </View>

        <SurfaceCard padding={0} style={styles.detailCard}>
          {rows.map((item, i) => (
            <View
              key={item.label}
              style={[styles.detailRow, i > 0 && styles.detailBorder]}
            >
              <View style={styles.detailLeft}>
                <Ionicons name={item.icon} size={17} color={Theme.colors.textMuted} />
                <Text style={styles.detailLabel}>{item.label}</Text>
              </View>
              <Text style={styles.detailValue}>{item.value}</Text>
            </View>
          ))}
        </SurfaceCard>

        <AppButton
          title={`Edit ${isIncome ? 'Income' : 'Expense'}`}
          icon="create-outline"
          onPress={handleEdit}
          style={{ marginBottom: 10 }}
        />

        <AppButton
          title={`Delete ${isIncome ? 'Income' : 'Expense'}`}
          icon="trash-outline"
          variant="danger"
          onPress={handleDelete}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Theme.layout.screenPaddingHorizontal,
    paddingBottom: 40,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 28,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    marginBottom: 20,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  amount: {
    ...Theme.typography.presets.heroAmount,
  },
  category: {
    ...Theme.typography.presets.bodyMedium,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  detailCard: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  detailBorder: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: {
    ...Theme.typography.presets.body,
    color: Theme.colors.textMuted,
  },
  detailValue: {
    ...Theme.typography.presets.rowTitle,
    color: Theme.colors.text,
    maxWidth: '58%',
    textAlign: 'right',
  },
});

export default TransactionDetailScreen;
