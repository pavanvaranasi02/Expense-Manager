import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccounts } from '../../services/accountService';
import { getAllCategories } from '../../services/categoryService';
import { addExpense, updateExpense } from '../../services/expenseService';

const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI', icon: '📱' },
  { id: 'DEBIT_CARD', label: 'Debit Card', icon: '💳' },
  { id: 'CREDIT_CARD', label: 'Credit Card', icon: '🔴' },
  { id: 'CASH', label: 'Cash', icon: '💵' },
  { id: 'NET_BANKING', label: 'Net Banking', icon: '🏦' },
  { id: 'OTHER', label: 'Other', icon: '📦' },
];

const AddExpenseScreen = ({ navigation, route }) => {
  const editData = route?.params?.expense;
  const isEdit = !!editData;

  const [amount, setAmount] = useState(editData?.amount?.toString() || '');
  const [note, setNote] = useState(editData?.note || '');
  const [date, setDate] = useState(editData?.date || new Date());
  const [selectedCategory, setSelectedCategory] = useState(
    editData
      ? {
          id: editData.categoryId,
          name: editData.categoryName,
          icon: editData.categoryIcon,
        }
      : null
  );
  const [selectedAccount, setSelectedAccount] = useState(
    editData ? { id: editData.accountId, name: editData.accountName } : null
  );
  const [paymentMode, setPaymentMode] = useState(editData?.paymentMode || 'UPI');

  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [catResult, accResult] = await Promise.all([
      getAllCategories(),
      getAccounts(),
    ]);
    if (catResult.success) setCategories(catResult.categories);
    if (accResult.success) {
      setAccounts(accResult.accounts);
      if (!selectedAccount && accResult.accounts.length > 0) {
        const defaultAcc =
          accResult.accounts.find((a) => a.isDefault) || accResult.accounts[0];
        setSelectedAccount(defaultAcc);
        if (defaultAcc.type === 'CREDIT_CARD') setPaymentMode('CREDIT_CARD');
        else if (defaultAcc.type === 'CASH') setPaymentMode('CASH');
      }
    }
  };

  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
    if (account.type === 'CREDIT_CARD') setPaymentMode('CREDIT_CARD');
    else if (account.type === 'CASH') setPaymentMode('CASH');
    else setPaymentMode('UPI');
    setShowAccountModal(false);
  };

  const getDateText = () => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const setQuickDate = (type) => {
    const d = new Date();
    if (type === 'yesterday') d.setDate(d.getDate() - 1);
    setDate(d);
  };

  const validate = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Required', 'Please enter amount');
      return false;
    }
    if (!selectedCategory) {
      Alert.alert('Required', 'Please select a category');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);

    const expenseData = {
      amount,
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      categoryIcon: selectedCategory.icon,
      accountId: selectedAccount?.id || null,
      accountName: selectedAccount?.name || 'Unknown',
      paymentMode,
      note,
      date,
    };

    let result;
    if (isEdit) {
      result = await updateExpense(editData.id, expenseData, editData);
    } else {
      result = await addExpense(expenseData);
    }

    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  const creditWarning = selectedAccount?.type === 'CREDIT_CARD' && amount;
  const creditUsageAfter =
    (selectedAccount?.currentUsage || 0) + (parseFloat(amount) || 0);
  const creditPercent = selectedAccount?.creditLimit
    ? Math.round((creditUsageAfter / selectedAccount.creditLimit) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Expense' : 'Add Expense'}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEdit ? 'Update' : 'Save'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Amount */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="#D1D5DB"
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  autoFocus={!isEdit}
                />
              </View>
            </View>

            {/* Credit Card Warning */}
            {creditWarning && creditPercent > 70 && (
              <View
                style={[
                  styles.warningBanner,
                  creditPercent > 90 && { backgroundColor: '#FEE2E2' },
                ]}
              >
                <Ionicons
                  name={creditPercent > 90 ? 'alert-circle' : 'warning'}
                  size={18}
                  color={creditPercent > 90 ? '#EF4444' : '#F59E0B'}
                />
                <Text
                  style={[
                    styles.warningText,
                    creditPercent > 90 && { color: '#991B1B' },
                  ]}
                >
                  {creditPercent}% credit used after this. Available: ₹
                  {(
                    (selectedAccount?.creditLimit || 0) - creditUsageAfter
                  ).toLocaleString('en-IN')}
                </Text>
              </View>
            )}

            {/* Category */}
            <Text style={styles.fieldLabel}>Category *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowCategoryModal(true)}
            >
              {selectedCategory ? (
                <View style={styles.selectorContent}>
                  <Text style={styles.selectorIcon}>
                    {selectedCategory.icon}
                  </Text>
                  <Text style={styles.selectorText}>
                    {selectedCategory.name}
                  </Text>
                </View>
              ) : (
                <Text style={styles.selectorPlaceholder}>Select category</Text>
              )}
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Account */}
            <Text style={styles.fieldLabel}>Account</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowAccountModal(true)}
            >
              {selectedAccount ? (
                <View style={styles.selectorContent}>
                  <Text style={styles.selectorIcon}>
                    {selectedAccount.type === 'BANK'
                      ? '🏦'
                      : selectedAccount.type === 'CREDIT_CARD'
                      ? '💳'
                      : '💵'}
                  </Text>
                  <View>
                    <Text style={styles.selectorText}>
                      {selectedAccount.name}
                    </Text>
                    <Text style={styles.selectorSub}>
                      {selectedAccount.type === 'CREDIT_CARD'
                        ? `Available: ₹${(
                            (selectedAccount.creditLimit || 0) -
                            (selectedAccount.currentUsage || 0)
                          ).toLocaleString('en-IN')}`
                        : `Balance: ₹${(
                            selectedAccount.balance || 0
                          ).toLocaleString('en-IN')}`}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.selectorPlaceholder}>Select account</Text>
              )}
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Payment Mode */}
            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {PAYMENT_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.modeChip,
                    paymentMode === mode.id && styles.modeChipActive,
                  ]}
                  onPress={() => setPaymentMode(mode.id)}
                >
                  <Text style={styles.modeIcon}>{mode.icon}</Text>
                  <Text
                    style={[
                      styles.modeLabel,
                      paymentMode === mode.id && { color: '#FFF' },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Date */}
            <Text style={styles.fieldLabel}>Date</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  getDateText() === 'Today' && styles.dateChipActive,
                ]}
                onPress={() => setQuickDate('today')}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    getDateText() === 'Today' && { color: '#FFF' },
                  ]}
                >
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  getDateText() === 'Yesterday' && styles.dateChipActive,
                ]}
                onPress={() => setQuickDate('yesterday')}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    getDateText() === 'Yesterday' && { color: '#FFF' },
                  ]}
                >
                  Yesterday
                </Text>
              </TouchableOpacity>
              <View style={styles.dateDisplay}>
                <Ionicons name="calendar-outline" size={16} color="#6C63FF" />
                <Text style={styles.dateText}>{getDateText()}</Text>
              </View>
            </View>

            {/* Note */}
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="What was this expense for?"
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={2}
            />

            {/* Extra bottom spacing for keyboard */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories}
              numColumns={3}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.catGridItem,
                    selectedCategory?.id === item.id &&
                      styles.catGridItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(item);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.catGridIcon}>{item.icon}</Text>
                  <Text style={styles.catGridName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Account Modal */}
      <Modal visible={showAccountModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Account</Text>
              <TouchableOpacity
                onPress={() => setShowAccountModal(false)}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {accounts.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={[
                  styles.accOption,
                  selectedAccount?.id === acc.id && styles.accOptionActive,
                ]}
                onPress={() => handleAccountSelect(acc)}
              >
                <Text style={styles.accEmoji}>
                  {acc.type === 'BANK'
                    ? '🏦'
                    : acc.type === 'CREDIT_CARD'
                    ? '💳'
                    : '💵'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName}>{acc.name}</Text>
                  <Text style={styles.accBalance}>
                    {acc.type === 'CREDIT_CARD'
                      ? `Used: ₹${(acc.currentUsage || 0).toLocaleString(
                          'en-IN'
                        )} / ₹${(acc.creditLimit || 0).toLocaleString('en-IN')}`
                      : `₹${(acc.balance || 0).toLocaleString('en-IN')}`}
                  </Text>
                </View>
                {selectedAccount?.id === acc.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#6C63FF"
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  saveBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  amountSection: { alignItems: 'center', paddingVertical: 24 },
  amountLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupee: { fontSize: 36, fontWeight: '300', color: '#374151' },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1A1A2E',
    minWidth: 80,
    textAlign: 'center',
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  warningText: { fontSize: 13, color: '#92400E', marginLeft: 8, flex: 1 },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },

  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 16,
  },
  selectorContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorIcon: { fontSize: 22, marginRight: 10 },
  selectorText: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  selectorSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  selectorPlaceholder: { fontSize: 15, color: '#9CA3AF' },

  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  modeChipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  modeIcon: { fontSize: 16, marginRight: 6 },
  modeLabel: { fontSize: 13, fontWeight: '500', color: '#374151' },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  dateChipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  dateChipText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F0EFFF',
    borderRadius: 10,
  },
  dateText: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '500',
    marginLeft: 6,
  },

  noteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 15,
    color: '#1A1A2E',
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },

  catGridItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    margin: 4,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  catGridItemActive: { backgroundColor: '#F0EFFF', borderColor: '#6C63FF' },
  catGridIcon: { fontSize: 24, marginBottom: 4 },
  catGridName: { fontSize: 11, color: '#374151', textAlign: 'center' },

  accOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  accOptionActive: {
    backgroundColor: '#F0EFFF',
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  accEmoji: { fontSize: 24, marginRight: 12 },
  accName: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  accBalance: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});

export default AddExpenseScreen;