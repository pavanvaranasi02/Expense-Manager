import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccounts } from '../../services/accountService';
import { getAllCategories } from '../../services/categoryService';
import { addExpense, updateExpense } from '../../services/expenseService';
import { Theme } from '../../theme/theme';

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
  const [date, setDate] = useState(editData?.date ? new Date(editData.date) : new Date());
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
    editData ? { id: editData.accountId, name: editData.accountName, type: editData.accountType } : null
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAccount(account);
    if (account.type === 'CREDIT_CARD') setPaymentMode('CREDIT_CARD');
    else if (account.type === 'CASH') setPaymentMode('CASH');
    else setPaymentMode('UPI');
    setShowAccountModal(false);
  };

  const getFormattedDate = useCallback(() => {
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
  }, [date]);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const validate = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Required', 'Please enter a valid amount');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    if (!selectedCategory) {
      Alert.alert('Required', 'Please select a category');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const expenseData = {
      amount: parseFloat(amount),
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      categoryIcon: selectedCategory.icon,
      accountId: selectedAccount?.id || null,
      accountName: selectedAccount?.name || 'Unknown',
      accountType: selectedAccount?.type || null,
      paymentMode,
      note: note.trim(),
      date: date.toISOString(),
    };

    let result;
    if (isEdit) {
      result = await updateExpense(editData.id, expenseData, editData);
    } else {
      result = await addExpense(expenseData);
    }

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } else {
      Alert.alert('Error', result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setLoading(false);
  };

  const currentMode = PAYMENT_MODES.find(m => m.id === paymentMode) || PAYMENT_MODES[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Transaction' : 'Add Expense'}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtnWrapper, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          <LinearGradient
            colors={[Theme.colors.primary, Theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{isEdit ? 'Update' : 'Save'}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Amount Section */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.amountSection}>
              <Text style={styles.amountLabel}>You spent</Text>
              <View style={styles.amountRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Theme.colors.textLight}
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v.replace(/[^0-9.]/g, ''));
                  }}
                  keyboardType="numeric"
                  autoFocus={!isEdit}
                />
              </View>
            </Animated.View>

            {/* Form Fields */}
            <Animated.View entering={FadeInUp.delay(300)}>
              {/* Category selector */}
              <Text style={styles.fieldLabel}>Category</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCategoryModal(true);
                }}
              >
                {selectedCategory ? (
                  <View style={styles.selectorMain}>
                    <View style={styles.selectorIconContainer}>
                      <Text style={styles.selectorEmoji}>{selectedCategory.icon}</Text>
                    </View>
                    <Text style={styles.selectorText}>{selectedCategory.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Choose a category...</Text>
                )}
                <Ionicons name="chevron-forward" size={20} color={Theme.colors.textLight} />
              </TouchableOpacity>

              {/* Account selector */}
              <Text style={styles.fieldLabel}>Paid From</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAccountModal(true);
                }}
              >
                {selectedAccount ? (
                  <View style={styles.selectorMain}>
                    <View style={[styles.selectorIconContainer, { backgroundColor: Theme.colors.primaryBackground }]}>
                      <Ionicons 
                        name={selectedAccount.type === 'CREDIT_CARD' ? "card" : "wallet"} 
                        size={18} 
                        color={Theme.colors.primary} 
                      />
                    </View>
                    <View>
                      <Text style={styles.selectorText}>{selectedAccount.name}</Text>
                      <Text style={styles.selectorSub}>
                        {selectedAccount.type === 'CREDIT_CARD' ? 'Credit Card' : 'Direct Account'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select an account...</Text>
                )}
                <Ionicons name="chevron-forward" size={20} color={Theme.colors.textLight} />
              </TouchableOpacity>

              {/* Payment Mode */}
              <Text style={styles.fieldLabel}>Payment Mode</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.modeScroll}
                contentContainerStyle={styles.modeScrollContent}
              >
                {PAYMENT_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode.id}
                    style={[
                      styles.modeChip,
                      paymentMode === mode.id && styles.modeChipActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPaymentMode(mode.id);
                    }}
                  >
                    <Text style={styles.modeEmoji}>{mode.icon}</Text>
                    <Text style={[styles.modeLabel, paymentMode === mode.id && styles.modeLabelActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Date */}
              <Text style={styles.fieldLabel}>Date</Text>
              <View style={styles.dateLayout}>
                <TouchableOpacity
                  style={[styles.dateChip, getFormattedDate() === 'Today' && styles.dateChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDate(new Date());
                  }}
                >
                  <Text style={[styles.dateChipText, getFormattedDate() === 'Today' && styles.dateChipTextActive]}>Today</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.dateChip, getFormattedDate() === 'Yesterday' && styles.dateChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setDate(d);
                  }}
                >
                  <Text style={[styles.dateChipText, getFormattedDate() === 'Yesterday' && styles.dateChipTextActive]}>Yesterday</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.customDateBtn, (getFormattedDate() !== 'Today' && getFormattedDate() !== 'Yesterday') && styles.dateChipActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDatePicker(true);
                  }}
                >
                  <Ionicons 
                    name="calendar" 
                    size={16} 
                    color={(getFormattedDate() !== 'Today' && getFormattedDate() !== 'Yesterday') ? '#FFF' : Theme.colors.primary} 
                  />
                  <Text style={[styles.customDateText, (getFormattedDate() !== 'Today' && getFormattedDate() !== 'Yesterday') && { color: '#FFF' }]}>
                    {getFormattedDate()}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              <Text style={styles.fieldLabel}>Note (Optional)</Text>
              <TextInput
                style={styles.noteBox}
                placeholder="What was this for? (e.g. Starbucks Coffee)"
                placeholderTextColor={Theme.colors.textLight}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </Animated.View>

            {/* Bottom cushioning */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Modals & Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close-circle" size={28} color={Theme.colors.textLight} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories}
              numColumns={3}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.catGrid}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.catItem,
                    selectedCategory?.id === item.id && styles.catItemActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedCategory(item);
                    setShowCategoryModal(false);
                  }}
                >
                  <View style={styles.catIconBox}>
                    <Text style={styles.catEmoji}>{item.icon}</Text>
                  </View>
                  <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Account Modal */}
      <Modal visible={showAccountModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Source Account</Text>
              <TouchableOpacity onPress={() => setShowAccountModal(false)}>
                <Ionicons name="close-circle" size={28} color={Theme.colors.textLight} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.accList} showsVerticalScrollIndicator={false}>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accItem,
                    selectedAccount?.id === acc.id && styles.accItemActive,
                  ]}
                  onPress={() => handleAccountSelect(acc)}
                >
                  <View style={[styles.accIcon, { backgroundColor: acc.type === 'CREDIT_CARD' ? Theme.colors.errorBackground : Theme.colors.successBackground }]}>
                    <Ionicons 
                      name={acc.type === 'CREDIT_CARD' ? "card" : "wallet"} 
                      size={20} 
                      color={acc.type === 'CREDIT_CARD' ? Theme.colors.error : Theme.colors.success} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accTitle}>{acc.name}</Text>
                    <Text style={styles.accLabel}>
                      {acc.type === 'CREDIT_CARD' ? 'Credit Line' : 'Savings/Cash'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.accVal}>
                      ₹{(acc.type === 'CREDIT_CARD' ? (acc.creditLimit - acc.currentUsage) : acc.balance).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.accDesc}>Available</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.soft,
  },
  headerTitle: { fontSize: 18, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text },
  saveBtnWrapper: { borderRadius: 12, overflow: 'hidden', ...Theme.shadows.elevated },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: Theme.typography.weight.bold },
  
  content: { paddingHorizontal: 20 },

  // Amount
  amountSection: { alignItems: 'center', paddingVertical: 40 },
  amountLabel: { fontSize: 13, color: Theme.colors.textLight, fontWeight: Theme.typography.weight.bold, textTransform: 'uppercase', marginBottom: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupee: { fontSize: 42, color: Theme.colors.text, fontWeight: Theme.typography.weight.normal, marginRight: 10 },
  amountInput: {
    fontSize: 64,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    minWidth: 100,
    textAlign: 'center',
  },

  // Form
  fieldLabel: {
    fontSize: 12,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.textLight,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 1,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    padding: 16,
    ...Theme.shadows.soft,
  },
  selectorMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  selectorIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  selectorEmoji: { fontSize: 20 },
  selectorText: { fontSize: 16, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text },
  selectorSub: { fontSize: 12, color: Theme.colors.textLight, marginTop: 2 },
  selectorPlaceholder: { fontSize: 16, color: Theme.colors.textLight, flex: 1 },

  // Payment Modes
  modeScroll: { 
    marginHorizontal: -20, 
    paddingVertical: 12, // Ensure shadows aren't clipped
  },
  modeScrollContent: {
    paddingHorizontal: 20,
    paddingRight: 40, // Extra cushioning for the last item
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Theme.colors.surface,
    marginRight: 10,
    ...Theme.shadows.soft,
  },
  modeChipActive: { backgroundColor: Theme.colors.primary },
  modeEmoji: { fontSize: 16, marginRight: 10 },
  modeLabel: { fontSize: 14, fontWeight: Theme.typography.weight.bold, color: Theme.colors.textMuted },
  modeLabelActive: { color: '#FFF' },

  // Date
  dateLayout: { flexDirection: 'row', gap: 10 },
  dateChip: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.soft,
  },
  dateChipActive: { backgroundColor: Theme.colors.primary },
  dateChipText: { fontSize: 14, fontWeight: Theme.typography.weight.bold, color: Theme.colors.textMuted },
  dateChipTextActive: { color: '#FFF' },
  customDateBtn: {
    flex: 1.5,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Theme.colors.primaryBackground,
    paddingHorizontal: 10,
  },
  customDateText: { fontSize: 13, fontWeight: Theme.typography.weight.bold, color: Theme.colors.primary, marginLeft: 8 },

  // Note
  noteBox: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: Theme.colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    ...Theme.shadows.soft,
  },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: Theme.colors.border,
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text },
  
  catGrid: { paddingBottom: 40 },
  catItem: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    margin: 6,
    ...Theme.shadows.soft,
  },
  catItemActive: { backgroundColor: Theme.colors.primaryBackground, borderColor: Theme.colors.primary, borderWidth: 1 },
  catIconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: Theme.colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  catEmoji: { fontSize: 28 },
  catName: { fontSize: 12, fontWeight: Theme.typography.weight.bold, color: Theme.colors.textMuted },

  accList: { paddingBottom: 30 },
  accItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    marginBottom: 12,
    ...Theme.shadows.soft,
  },
  accItemActive: { borderColor: Theme.colors.primary, borderWidth: 1.5 },
  accIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  accTitle: { fontSize: 16, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text },
  accLabel: { fontSize: 12, color: Theme.colors.textLight, marginTop: 2 },
  accVal: { fontSize: 15, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text },
  accDesc: { fontSize: 10, color: Theme.colors.textLight, textAlign: 'right' },
});

export default AddExpenseScreen;