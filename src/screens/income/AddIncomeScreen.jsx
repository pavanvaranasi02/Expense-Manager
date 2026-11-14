import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { addIncome, INCOME_SOURCES, updateIncome } from '../../services/incomeService';
import { generateStableId } from '../../services/transactionValidation';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '../../utils/format';

const QUICK_INCOME_AMOUNTS = [1000, 5000, 10000];

const getSourceIcon = (id) => {
  switch (id) {
    case 'salary':
      return 'briefcase-outline';
    case 'freelance':
      return 'laptop-outline';
    case 'business':
      return 'business-outline';
    case 'investment':
      return 'trending-up-outline';
    case 'dividend':
      return 'stats-chart-outline';
    case 'interest':
      return 'cash-outline';
    case 'rental':
      return 'home-outline';
    case 'gift':
      return 'gift-outline';
    case 'cashback':
      return 'sparkles-outline';
    case 'refund':
      return 'refresh-outline';
    case 'sold':
      return 'pricetag-outline';
    case 'bonus':
      return 'ribbon-outline';
    default:
      return 'wallet-outline';
  }
};

const AddIncomeScreen = ({ navigation, route }) => {
  const editData = route?.params?.income;
  const isEdit = !!editData;

  const parseInitialDate = () => {
    const raw = editData?.date;
    if (!raw) return new Date();
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [amount, setAmount] = useState(editData?.amount ? String(editData.amount) : '');
  const [selectedSource, setSelectedSource] = useState(
    INCOME_SOURCES.find((s) => s.id === editData?.source) || INCOME_SOURCES[0]
  );
  const [note, setNote] = useState(editData?.note || '');
  const [date, setDate] = useState(parseInitialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef(generateStableId('inc_req'));
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const result = await getAccounts();
      if (result.success) {
        const liquidAccounts = result.accounts.filter(
          (a) => a.type === 'BANK' || a.type === 'CASH'
        );
        setAccounts(liquidAccounts);
        if (liquidAccounts.length > 0) {
          const matched = editData?.accountId
            ? liquidAccounts.find((a) => a.id === editData.accountId)
            : null;
          setSelectedAccount(
            matched || liquidAccounts.find((a) => a.isDefault) || liquidAccounts[0]
          );
        }
      }
    };
    load();
  }, [editData?.accountId]);

  const quickSources = useMemo(() => {
    const base = INCOME_SOURCES.slice(0, 3);
    if (selectedSource && !base.some((s) => s.id === selectedSource.id)) {
      return [selectedSource, ...base.slice(0, 2)];
    }
    return base;
  }, [selectedSource]);

  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    if (!q) return INCOME_SOURCES;
    return INCOME_SOURCES.filter((s) => s.name.toLowerCase().includes(q));
  }, [sourceSearch]);

  const getFormattedDate = useCallback(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  }, [date]);

  const handleQuickAdd = (delta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = parseFloat(amount) || 0;
    setAmount(String(current + delta));
  };

  const handleSave = async () => {
    if (submittingRef.current || loading) return;
    if (!amount || parseFloat(amount) <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Required', 'Please enter a valid amount');
      return;
    }
    if (!selectedAccount) {
      Alert.alert('Required', 'Please select a deposit account');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const incomePayload = {
        amount: parseFloat(amount),
        source: selectedSource.id,
        sourceName: selectedSource.name,
        sourceIcon: selectedSource.icon,
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        note: note.trim(),
        date: date.toISOString(),
        paymentMode: selectedAccount.type === 'CASH' ? 'CASH' : 'UPI',
        idempotencyKey: isEdit ? undefined : idempotencyKeyRef.current,
      };

      const result = isEdit
        ? await updateIncome(editData.id, incomePayload, editData)
        : await addIncome(incomePayload);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.goBack();
      } else {
        Alert.alert('Error', result.error);
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Consistent Editorial Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Ionicons name="close" size={20} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Income' : 'New Income'}</Text>
        <TouchableOpacity
          style={styles.datePill}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowDatePicker(true);
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={14} color={Theme.colors.textSecondary} />
          <Text style={styles.datePillText}>{getFormattedDate()}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Primary Amount Focus */}
            <View style={styles.amountSection}>
              <Text style={styles.amountEyebrow}>AMOUNT</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Theme.colors.textLight}
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  autoFocus={!isEdit}
                  selectionColor={Theme.colors.primary}
                />
              </View>

              <View style={styles.quickAmtRow}>
                {QUICK_INCOME_AMOUNTS.map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={styles.quickAmtChip}
                    onPress={() => handleQuickAdd(val)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.quickAmtText}>+₹{val.toLocaleString('en-IN')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (e.g. Monthly salary, client invoice)..."
                placeholderTextColor={Theme.colors.textLight}
                value={note}
                onChangeText={setNote}
                returnKeyType="done"
              />
            </View>

            {/* Hairline-separated Form Sections matching AddExpenseScreen */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.fieldLabel}>INCOME SOURCE</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSourceSearch('');
                    setShowSourceModal(true);
                  }}
                >
                  <Text style={styles.browseAllText}>All ({INCOME_SOURCES.length})</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.chipsWrap}>
                {quickSources.map((item) => {
                  const active = selectedSource?.id === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSource(item);
                      }}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={getSourceIcon(item.id)}
                        size={14}
                        color={active ? '#FFFFFF' : Theme.colors.textSecondary}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.fieldLabel}>DEPOSIT INTO</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAccountModal(true);
                  }}
                >
                  <Text style={styles.browseAllText}>Switch</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.selectorRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAccountModal(true);
                }}
                activeOpacity={0.75}
              >
                {selectedAccount ? (
                  <View style={styles.selectorLeft}>
                    <View style={styles.selectorIcon}>
                      <Ionicons
                        name={selectedAccount.type === 'CASH' ? 'cash-outline' : 'business-outline'}
                        size={17}
                        color={Theme.colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectorTitle} numberOfLines={1}>
                        {selectedAccount.name}
                      </Text>
                      <Text style={styles.selectorSub}>
                        {selectedAccount.type === 'CASH' ? 'Cash' : 'Bank'} ·{' '}
                        {formatCurrency(selectedAccount.balance || 0, false)} balance
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select deposit account...</Text>
                )}
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 96 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Fixed Bottom Primary Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, loading && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {isEdit ? 'Update Income' : 'Save Income'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      {/* Searchable Income Source Modal */}
      <Modal
        visible={showSourceModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSourceModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Income Source</Text>
              <TouchableOpacity onPress={() => setShowSourceModal(false)}>
                <Ionicons name="close" size={22} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={Theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search income source..."
                placeholderTextColor={Theme.colors.textLight}
                value={sourceSearch}
                onChangeText={setSourceSearch}
              />
            </View>

            <ScrollView style={styles.accList} showsVerticalScrollIndicator={false}>
              {filteredSources.map((src) => {
                const active = selectedSource?.id === src.id;
                return (
                  <TouchableOpacity
                    key={src.id}
                    style={[styles.accItem, active && styles.accItemActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedSource(src);
                      setShowSourceModal(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.accIcon}>
                      <Ionicons
                        name={getSourceIcon(src.id)}
                        size={18}
                        color={active ? Theme.colors.primary : Theme.colors.textSecondary}
                      />
                    </View>
                    <Text style={[styles.accTitle, { flex: 1 }]}>{src.name}</Text>
                    {active ? (
                      <Ionicons name="checkmark" size={18} color={Theme.colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Account Selection Modal */}
      <Modal
        visible={showAccountModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAccountModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Into</Text>
              <TouchableOpacity onPress={() => setShowAccountModal(false)}>
                <Ionicons name="close" size={22} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.accList} showsVerticalScrollIndicator={false}>
              {accounts.map((acc) => {
                const active = selectedAccount?.id === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accItem, active && styles.accItemActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedAccount(acc);
                      setShowAccountModal(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.accIcon}>
                      <Ionicons
                        name={acc.type === 'CASH' ? 'cash-outline' : 'business-outline'}
                        size={18}
                        color={active ? Theme.colors.primary : Theme.colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accTitle}>{acc.name}</Text>
                      <Text style={styles.accLabel}>
                        {acc.type === 'CASH' ? 'Cash Wallet' : 'Bank Account'}
                      </Text>
                    </View>
                    <Text style={styles.accVal}>{formatCurrency(acc.balance || 0, false)}</Text>
                  </TouchableOpacity>
                );
              })}
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
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 16,
    color: Theme.colors.text,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  datePillText: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 12,
    color: Theme.colors.text,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.md,
  },
  amountSection: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  amountEyebrow: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 28,
    color: Theme.colors.textMuted,
    marginRight: 4,
  },
  amountInput: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 44,
    color: Theme.colors.text,
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: 0,
    ...Theme.typography.tabularNums,
  },
  quickAmtRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickAmtChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  quickAmtText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 12,
    color: Theme.colors.textSecondary,
    ...Theme.typography.tabularNums,
  },
  noteInput: {
    width: '100%',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 14,
    color: Theme.colors.text,
  },
  formSection: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  fieldLabel: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
  },
  browseAllText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  chipActive: {
    backgroundColor: Theme.colors.inkSurface,
    borderColor: Theme.colors.inkSurface,
  },
  chipText: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectorIcon: {
    width: 34,
    height: 34,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorTitle: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 14,
    color: Theme.colors.text,
  },
  selectorSub: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  selectorPlaceholder: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 14,
    color: Theme.colors.textLight,
  },
  bottomBar: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  primaryBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 17,
    color: Theme.colors.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 14,
    color: Theme.colors.text,
    paddingVertical: 0,
  },
  accList: {
    paddingBottom: 24,
  },
  accItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 8,
    gap: 12,
  },
  accItemActive: {
    borderColor: Theme.colors.primary,
  },
  accIcon: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accTitle: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 14,
    color: Theme.colors.text,
  },
  accLabel: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  accVal: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 14,
    color: Theme.colors.text,
    ...Theme.typography.tabularNums,
  },
});

export default AddIncomeScreen;
