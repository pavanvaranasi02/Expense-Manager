import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { addIncome, INCOME_SOURCES } from '../../services/incomeService';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '../../utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AddIncomeScreen = ({ navigation }) => {
  const [amount, setAmount] = useState('');
  const [selectedSource, setSelectedSource] = useState(INCOME_SOURCES[0]);
  const [note, setNote] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const result = await getAccounts();
      if (result.success) {
        const liquidAccounts = result.accounts.filter(a => a.type === 'BANK' || a.type === 'CASH');
        setAccounts(liquidAccounts);
        if (liquidAccounts.length > 0) {
          setSelectedAccount(liquidAccounts.find(a => a.isDefault) || liquidAccounts[0]);
        }
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Required', 'Please enter a valid amount');
      return;
    }
    if (!selectedAccount) {
      Alert.alert('Required', 'Please select a deposit account');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const result = await addIncome({
      amount: parseFloat(amount),
      source: selectedSource.id,
      sourceName: selectedSource.name,
      sourceIcon: selectedSource.icon,
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      note: note.trim(),
      date: new Date().toISOString(),
      paymentMode: selectedAccount.type === 'CASH' ? 'CASH' : 'UPI',
    });

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity 
           style={styles.closeBtn} 
           onPress={() => {
               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
               navigation.goBack();
           }}
        >
          <Ionicons name="close" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive Funds</Text>
        <TouchableOpacity 
           style={[styles.saveBtnWrapper, loading && { opacity: 0.6 }]} 
           onPress={handleSave}
           disabled={loading}
        >
           <LinearGradient
             colors={[Theme.colors.success, '#059669']}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 0 }}
             style={styles.saveBtn}
           >
             {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
           </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount Section */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.amountSection}>
              <Text style={styles.amountLabel}>Credit Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Theme.colors.textLight}
                  value={amount}
                  onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  autoFocus
                  selectionColor={Theme.colors.success}
                />
              </View>
            </Animated.View>

            {/* Income Source Grid */}
            <Animated.View entering={FadeInUp.delay(300)}>
                <Text style={styles.fieldLabel}>Income Source</Text>
                <View style={styles.sourceGrid}>
                    {INCOME_SOURCES.map((item, index) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.sourceCard,
                                selectedSource.id === item.id && styles.sourceCardActive
                            ]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedSource(item);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.sourceIconBox, selectedSource.id === item.id && { backgroundColor: '#FFF' }]}>
                                <Text style={styles.sourceEmoji}>{item.icon}</Text>
                            </View>
                            <Text style={[styles.sourceName, selectedSource.id === item.id && styles.sourceNameActive]} numberOfLines={1}>
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Deposit Account */}
                <Text style={styles.fieldLabel}>Deposit Into</Text>
                <TouchableOpacity
                    style={styles.selector}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowAccountModal(true);
                    }}
                >
                    {selectedAccount ? (
                        <View style={styles.selectorMain}>
                            <View style={[styles.selectorIconContainer, { backgroundColor: Theme.colors.success + '15' }]}>
                                <Ionicons name={selectedAccount.type === 'CASH' ? "cash-outline" : "business-outline"} size={20} color={Theme.colors.success} />
                            </View>
                            <View>
                                <Text style={styles.selectorText}>{selectedAccount.name}</Text>
                                <Text style={styles.selectorSub}>Balance: {formatCurrency(selectedAccount.balance, false)}</Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.selectorPlaceholder}>Select an account...</Text>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={Theme.colors.textLight} />
                </TouchableOpacity>

                {/* Note */}
                <Text style={styles.fieldLabel}>Note (Optional)</Text>
                <TextInput
                    style={styles.noteBox}
                    placeholder="e.g. June Salary, Birthday Gift"
                    placeholderTextColor={Theme.colors.textLight}
                    value={note}
                    onChangeText={setNote}
                    multiline
                />
            </Animated.View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Account Selection Modal */}
      <Modal visible={showAccountModal} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Choose Account</Text>
                      <TouchableOpacity onPress={() => setShowAccountModal(false)}>
                          <Ionicons name="close-circle" size={28} color={Theme.colors.textLight} />
                      </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.accList} showsVerticalScrollIndicator={false}>
                      {accounts.map((acc) => (
                          <TouchableOpacity 
                              key={acc.id} 
                              style={[styles.accItem, selectedAccount?.id === acc.id && styles.accItemActive]}
                              onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setSelectedAccount(acc);
                                  setShowAccountModal(false);
                              }}
                          >
                              <View style={[styles.accIcon, { backgroundColor: Theme.colors.success + '15' }]}>
                                  <Ionicons name={acc.type === 'CASH' ? "cash-outline" : "business-outline"} size={22} color={Theme.colors.success} />
                              </View>
                              <View style={{ flex: 1 }}>
                                  <Text style={styles.accTitle}>{acc.name}</Text>
                                  <Text style={styles.accLabel}>{acc.type === 'CASH' ? 'Liquid Cash' : 'Savings Account'}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.accVal}>{formatCurrency(acc.balance, false)}</Text>
                                  <Text style={styles.accDesc}>Current Balance</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.soft,
  },
  saveBtnWrapper: { borderRadius: 12, overflow: 'hidden', ...Theme.shadows.elevated },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, minWidth: 80, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: Theme.typography.weight.bold },

  content: { paddingHorizontal: 20 },

  amountSection: { alignItems: 'center', paddingVertical: 40 },
  amountLabel: { fontSize: 13, color: Theme.colors.textLight, fontWeight: Theme.typography.weight.bold, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupee: { fontSize: 42, color: Theme.colors.success, fontWeight: Theme.typography.weight.normal, marginRight: 10 },
  amountInput: {
    fontSize: 64,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    minWidth: 100,
    textAlign: 'center',
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.textLight,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 12,
    letterSpacing: 1,
  },

  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  sourceCard: {
    width: (SCREEN_WIDTH - 40 - 30) / 3, // 3 columns with gap
    alignItems: 'center',
    padding: 16,
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    margin: 5,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Theme.shadows.soft,
  },
  sourceCardActive: {
    backgroundColor: Theme.colors.success,
    borderColor: Theme.colors.success,
    ...Theme.shadows.elevated,
  },
  sourceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  sourceEmoji: { fontSize: 24 },
  sourceName: { fontSize: 11, fontWeight: Theme.typography.weight.bold, color: Theme.colors.textMuted },
  sourceNameActive: { color: '#FFF' },

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
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  selectorText: { fontSize: 16, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text },
  selectorSub: { fontSize: 12, color: Theme.colors.textLight, marginTop: 2 },
  selectorPlaceholder: { fontSize: 16, color: Theme.colors.textLight, flex: 1 },

  noteBox: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    padding: 18,
    fontSize: 16,
    color: Theme.colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    ...Theme.shadows.soft,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    maxHeight: '80%',
  },
  modalHandle: { width: 40, height: 5, backgroundColor: Theme.colors.border, borderRadius: 10, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text },
  accList: { paddingBottom: 30 },
  accItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    marginBottom: 12,
    ...Theme.shadows.soft,
  },
  accItemActive: { borderColor: Theme.colors.success, borderWidth: 1.5 },
  accIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  accTitle: { fontSize: 16, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text },
  accLabel: { fontSize: 12, color: Theme.colors.textLight, marginTop: 2 },
  accVal: { fontSize: 16, fontWeight: Theme.typography.weight.extrabold, color: Theme.colors.text },
  accDesc: { fontSize: 10, color: Theme.colors.textLight, textAlign: 'right' },
});

export default AddIncomeScreen;