import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrencySymbol } from '../../constants/currencies';
import { getAccounts } from '../../services/accountService';
import { getAllCategories } from '../../services/categoryService';
import { addExpense, updateExpense } from '../../services/expenseService';
import { generateStableId } from '../../services/transactionValidation';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';

const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI', icon: 'phone-portrait-outline' },
  { id: 'DEBIT_CARD', label: 'Debit Card', icon: 'card-outline' },
  { id: 'CREDIT_CARD', label: 'Credit Card', icon: 'card' },
  { id: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { id: 'NET_BANKING', label: 'Net Banking', icon: 'business-outline' },
  { id: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const renderCategoryGlyph = (icon, isSelected) => {
  const color = isSelected ? '#FFFFFF' : Theme.colors.textSecondary;
  if (icon && icon.length > 2 && !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(icon)) {
    return <Ionicons name={icon} size={16} color={color} />;
  }
  return <Ionicons name="pricetag-outline" size={16} color={color} />;
};

const AddExpenseScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const userProfile = useAuthStore((s) => s.userProfile);
  const cs = userProfile?.currencySymbol || getCurrencySymbol(userProfile?.currency, '₹');

  const editData = route?.params?.expense;
  const isEdit = !!editData;

  const [amount, setAmount] = useState(editData?.amount?.toString() || '');
  const [note, setNote] = useState(editData?.note || '');
  const [date, setDate] = useState(() => {
    const raw = editData?.date;
    if (!raw) return new Date();
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  });
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
  const [validationError, setValidationError] = useState('');
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef(generateStableId('exp_req'));

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      const [catResult, accResult] = await Promise.all([
        getAllCategories(),
        getAccounts(),
      ]);
      if (!active) return;
      if (catResult.success) setCategories(catResult.categories || []);
      if (accResult.success) {
        const list = accResult.accounts || [];
        setAccounts(list);
        if (list.length > 0) {
          setSelectedAccount((prev) => {
            if (prev) return prev;
            const defaultAcc = list.find((a) => a.isDefault) || list[0];
            if (defaultAcc.type === 'CREDIT_CARD') setPaymentMode('CREDIT_CARD');
            else if (defaultAcc.type === 'CASH') setPaymentMode('CASH');
            return defaultAcc;
          });
        }
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const handleAccountSelect = (account) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  // Top 6 quick-pick categories + ensure selected category is visible if outside top 6
  const quickCategories = useMemo(() => {
    const top = categories.slice(0, 6);
    if (selectedCategory && !top.some((c) => c.id === selectedCategory.id)) {
      return [selectedCategory, ...top.slice(0, 5)];
    }
    return top;
  }, [categories, selectedCategory]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const validate = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setValidationError('Enter an amount greater than 0.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return false;
    }
    if (!selectedCategory) {
      setValidationError('Select a category for this expense.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSave = async () => {
    if (submittingRef.current || loading) return;
    if (!validate()) return;
    submittingRef.current = true;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
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
        idempotencyKey: isEdit ? undefined : idempotencyKeyRef.current,
      };

      const result = isEdit
        ? await updateExpense(editData.id, expenseData, editData)
        : await addExpense(expenseData);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        navigation.goBack();
      } else {
        Alert.alert('Unable to Save', result.error || 'Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Clean Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            navigation.goBack();
          }}
          style={styles.closeBtn}
          accessibilityLabel="Close add expense"
        >
          <Ionicons name="close" size={20} color={Theme.colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Expense' : 'New Expense'}
        </Text>

        <TouchableOpacity
          style={styles.datePill}
          onPress={() => {
            Keyboard.dismiss();
            setShowDatePicker(true);
          }}
          accessibilityLabel="Change expense date"
        >
          <Ionicons name="calendar-outline" size={14} color={Theme.colors.textSecondary} />
          <Text style={styles.datePillText}>{getFormattedDate()}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Amount Entry */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>AMOUNT</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencyPrefix}>{cs}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(val) => {
                  setAmount(val.replace(/[^0-9.]/g, ''));
                  if (validationError) setValidationError('');
                }}
                placeholder="0"
                placeholderTextColor={Theme.colors.textLight}
                keyboardType="decimal-pad"
                autoFocus={!isEdit}
                returnKeyType="done"
                accessibilityLabel="Expense amount"
              />
            </View>

            <View style={styles.quickAmtRow}>
              {[100, 500, 1000].map((inc) => (
                <TouchableOpacity
                  key={inc}
                  style={styles.quickAmtPill}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    const curr = parseFloat(amount) || 0;
                    setAmount(String(curr + inc));
                    if (validationError) setValidationError('');
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.quickAmtText}>+{cs}{inc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (merchant, item, or context)..."
              placeholderTextColor={Theme.colors.textLight}
              maxLength={120}
              returnKeyType="done"
              accessibilityLabel="Expense note"
            />

            {validationError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={15} color={Theme.colors.error} />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.formSheet}>
          {/* Category Shortcuts + Searchable Complete Selector */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setCategorySearch('');
                  setShowCategoryModal(true);
                }}
              >
                <Text style={styles.fieldAction}>All ({categories.length})</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {quickCategories.map((cat) => {
                const isSelected = selectedCategory?.id === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedCategory(cat);
                      if (validationError) setValidationError('');
                    }}
                    activeOpacity={0.75}
                  >
                    {renderCategoryGlyph(cat.icon, isSelected)}
                    <Text
                      style={[styles.chipText, isSelected && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.moreChip}
                onPress={() => {
                  Keyboard.dismiss();
                  setCategorySearch('');
                  setShowCategoryModal(true);
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="search-outline" size={15} color={Theme.colors.primary} />
                <Text style={styles.moreChipText}>Browse All</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Account Selection */}
          <View style={[styles.fieldGroup, styles.fieldGroupDivider]}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>PAID FROM ACCOUNT</Text>
              {accounts.length > 1 ? (
                <TouchableOpacity onPress={() => setShowAccountModal(true)}>
                  <Text style={styles.fieldAction}>Switch</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.selectorRow}
              onPress={() => {
                Keyboard.dismiss();
                setShowAccountModal(true);
              }}
              activeOpacity={0.75}
            >
              <View style={styles.selectorIcon}>
                <Ionicons
                  name={
                    selectedAccount?.type === 'CREDIT_CARD'
                      ? 'card-outline'
                      : selectedAccount?.type === 'CASH'
                      ? 'cash-outline'
                      : 'business-outline'
                  }
                  size={18}
                  color={Theme.colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectorTitle}>
                  {selectedAccount?.name || 'Select an account'}
                </Text>
                <Text style={styles.selectorSub}>
                  {selectedAccount
                    ? selectedAccount.type === 'CREDIT_CARD'
                      ? `Credit Card • ${cs}${(selectedAccount.currentUsage || 0).toLocaleString('en-IN')} used`
                      : `${selectedAccount.type === 'CASH' ? 'Cash' : 'Bank'} • ${cs}${(selectedAccount.balance || 0).toLocaleString('en-IN')} available`
                    : 'Tap to choose bank, cash or card'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={Theme.colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* Payment Method */}
          <View style={[styles.fieldGroup, styles.fieldGroupDivider, { marginBottom: 0 }]}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>PAYMENT METHOD</Text>
            </View>
            <View style={styles.modeGrid}>
              {PAYMENT_MODES.map((mode) => {
                const active = paymentMode === mode.id;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    style={[styles.modeChip, active && styles.modeChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setPaymentMode(mode.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={mode.icon}
                      size={15}
                      color={active ? '#FFFFFF' : Theme.colors.textSecondary}
                    />
                    <Text style={[styles.modeText, active && styles.modeTextActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          </View>
        </ScrollView>

        {/* Anchored Bottom Save Bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 12) + 4 },
          ]}
        >
          <TouchableOpacity
            style={[styles.primaryCta, loading && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityLabel={isEdit ? 'Update expense' : 'Save expense'}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryCtaText}>
                {isEdit
                  ? 'Update Expense'
                  : parseFloat(amount) > 0
                  ? `Save ${cs}${parseFloat(amount).toLocaleString('en-IN')}`
                  : 'Save Expense'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={onDateChange}
        />
      )}

      {/* Searchable Complete Category Selector Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalClose}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchWrap}>
              <Ionicons name="search-outline" size={17} color={Theme.colors.textLight} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search default or custom categories..."
                placeholderTextColor={Theme.colors.textLight}
                value={categorySearch}
                onChangeText={setCategorySearch}
                autoFocus
              />
              {categorySearch.length > 0 ? (
                <TouchableOpacity onPress={() => setCategorySearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={Theme.colors.textLight} />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyModalText}>No matching categories</Text>
              }
              renderItem={({ item }) => {
                const isSelected = selectedCategory?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.modalRow, isSelected && styles.modalRowActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedCategory(item);
                      if (validationError) setValidationError('');
                      setShowCategoryModal(false);
                    }}
                  >
                    <View style={styles.modalRowIcon}>
                      {renderCategoryGlyph(item.icon, false)}
                    </View>
                    <Text style={styles.modalRowText}>{item.name}</Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={Theme.colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Account Selector Modal */}
      <Modal
        visible={showAccountModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAccountModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Account</Text>
              <TouchableOpacity
                onPress={() => setShowAccountModal(false)}
                style={styles.modalClose}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={accounts}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyModalText}>No accounts available</Text>
              }
              renderItem={({ item }) => {
                const isSelected = selectedAccount?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.modalRow, isSelected && styles.modalRowActive]}
                    onPress={() => handleAccountSelect(item)}
                  >
                    <View style={styles.modalRowIcon}>
                      <Ionicons
                        name={
                          item.type === 'CREDIT_CARD'
                            ? 'card-outline'
                            : item.type === 'CASH'
                            ? 'cash-outline'
                            : 'business-outline'
                        }
                        size={18}
                        color={Theme.colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowText}>{item.name}</Text>
                      <Text style={styles.modalRowSub}>
                        {(item.type || 'ACCOUNT').replace('_', ' ')}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={Theme.colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: Theme.typography.size.base,
    color: Theme.colors.text,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  datePillText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: 20,
  },
  amountSection: {
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    marginBottom: 16,
    alignItems: 'center',
  },
  amountLabel: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
    marginBottom: 4,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  currencyPrefix: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 28,
    color: Theme.colors.textMuted,
    marginRight: 4,
  },
  amountInput: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 42,
    color: Theme.colors.text,
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: 0,
    ...Theme.typography.tabularNums,
  },
  noteInput: {
    width: '100%',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
    textAlign: 'center',
  },
  quickAmtRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickAmtPill: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  quickAmtText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 11,
    color: Theme.colors.textSecondary,
    ...Theme.typography.tabularNums,
  },
  formSheet: {
    backgroundColor: 'transparent',
  },
  fieldGroupDivider: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: Theme.colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Theme.radius.sm,
  },
  errorText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.error,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 11,
    color: Theme.colors.textMuted,
    letterSpacing: 0.8,
  },
  fieldAction: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.primary,
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  chipText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  moreChipText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.primary,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  selectorIcon: {
    width: 34,
    height: 34,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorTitle: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
  },
  selectorSub: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modeChipActive: {
    backgroundColor: Theme.colors.inkSurface,
    borderColor: Theme.colors.inkSurface,
  },
  modeText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textSecondary,
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  bottomBar: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: 10,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  primaryCta: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    fontFamily: Theme.typography.fontFamily.bold,
    color: '#FFFFFF',
    fontSize: Theme.typography.size.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.radius.xxl,
    borderTopRightRadius: Theme.radius.xxl,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '78%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: Theme.typography.size.lg,
    color: Theme.colors.text,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
    paddingVertical: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderSubtle,
    gap: 10,
  },
  modalRowActive: {
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: Theme.radius.md,
  },
  modalRowIcon: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowText: {
    flex: 1,
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
  },
  modalRowSub: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    textTransform: 'capitalize',
    marginTop: 1,
  },
  emptyModalText: {
    textAlign: 'center',
    color: Theme.colors.textMuted,
    paddingVertical: 24,
    fontSize: Theme.typography.size.sm,
  },
});

export default AddExpenseScreen;
