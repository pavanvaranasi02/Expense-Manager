import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAccounts,
  payCreditCardBill,
  revertCreditCardPayment,
  setBillReminder,
} from '../../services/accountService';
import { addExpense, deleteExpense, getExpense } from '../../services/expenseService';

const CreditCardBillScreen = ({ navigation }) => {
  const [creditCards, setCreditCards] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payFromAccount, setPayFromAccount] = useState(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [paying, setPaying] = useState(false);

  const fetchCards = async () => {
    const result = await getAccounts();
    if (result.success) {
      setCreditCards(result.accounts.filter((a) => a.type === 'CREDIT_CARD'));
      setBankAccounts(result.accounts.filter((a) => a.type === 'BANK' || a.type === 'CASH'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const getDaysUntilDue = (dueDate) => {
    const now = new Date();
    const currentDay = now.getDate();
    let daysLeft = (dueDate || 15) - currentDay;
    if (daysLeft < 0) daysLeft += 30;
    return daysLeft;
  };

  const getStatusColor = (daysLeft) => {
    if (daysLeft <= 3) return '#EF4444';
    if (daysLeft <= 7) return '#F59E0B';
    return '#10B981';
  };

  const openPayModal = (card) => {
    setSelectedCard(card);
    setPayAmount((card.currentUsage || 0).toString());
    setPayFromAccount(bankAccounts.length > 0 ? bankAccounts[0] : null);
    setShowPayModal(true);
  };

  const handlePayBill = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      Alert.alert('Invalid', 'Enter a valid payment amount');
      return;
    }

    if (parseFloat(payAmount) > (selectedCard.currentUsage || 0)) {
      Alert.alert('Invalid', 'Payment amount cannot exceed outstanding balance');
      return;
    }

    setPaying(true);
    try {
      let expenseId = null;

      // 1. If paying from an account, record it as an expense first
      if (payFromAccount) {
        const expenseResult = await addExpense({
          amount: payAmount,
          categoryId: 'bills',
          categoryName: 'Bills & Utilities',
          categoryIcon: '📱',
          accountId: payFromAccount.id,
          accountName: payFromAccount.name,
          paymentMode: payFromAccount.type,
          note: `Credit Card Bill: ${selectedCard.name}`,
          date: new Date().toISOString(),
        });

        if (expenseResult.success) {
          expenseId = expenseResult.id;
        } else {
          Alert.alert('Warning', 'Bill marked as paid but failed to record expense: ' + expenseResult.error);
        }
      }

      // 2. Update credit card usage and history
      const result = await payCreditCardBill(
        selectedCard.id,
        payAmount,
        payFromAccount?.id,
        expenseId
      );

      if (result.success) {
        setShowPayModal(false);
        fetchCards();

        if (result.isFullPayment) {
          Alert.alert(
            '✅ Bill Paid in Full!',
            `₹${result.amountPaid.toLocaleString('en-IN')} paid successfully. Your balance is now ₹0.`
          );
        } else {
          Alert.alert(
            '💳 Partial Payment',
            `₹${result.amountPaid.toLocaleString('en-IN')} paid. Remaining balance: ₹${result.remainingBill.toLocaleString('en-IN')}`,
            [
              { text: 'OK' },
              {
                text: 'Set Reminder',
                onPress: () => handleSetReminder(selectedCard.id, true),
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setPaying(false);
    }
  };

  const handleUndoPayment = async (paymentId) => {
    Alert.alert(
      'Undo Payment?',
      'This will revert the credit card balance and delete the associated expense.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await revertCreditCardPayment(selectedCard.id, paymentId);
              if (result.success) {
                // If there was an associated expense, delete it
                if (result.expenseId) {
                  const expRes = await getExpense(result.expenseId);
                  if (expRes.success) {
                    await deleteExpense(result.expenseId, expRes.expense);
                  }
                }
                
                // Refresh data
                await fetchCards();
                // Find and update selected card to refresh history modal
                const result2 = await getAccounts();
                if (result2.success) {
                  const updatedCard = result2.accounts.find(a => a.id === selectedCard.id);
                  if (updatedCard) setSelectedCard(updatedCard);
                }
                
                Alert.alert('Success', 'Payment undone successfully');
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetReminder = async (cardId, value) => {
    await setBillReminder(cardId, value);
    fetchCards();
  };

  const openHistory = (card) => {
    setSelectedCard(card);
    setShowHistoryModal(true);
  };

  const setQuickAmount = (card, type) => {
    switch (type) {
      case 'full':
        setPayAmount((card.currentUsage || 0).toString());
        break;
      case 'minimum':
        const min = Math.max(Math.round((card.currentUsage || 0) * 0.05), 100);
        setPayAmount(min.toString());
        break;
      case 'half':
        setPayAmount(Math.round((card.currentUsage || 0) / 2).toString());
        break;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Credit Card Bills</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Credit Card Bills</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {creditCards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💳</Text>
            <Text style={styles.emptyTitle}>No credit cards</Text>
            <Text style={styles.emptyText}>Add a credit card from "My Accounts" to track bills</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddAccount')}>
              <Text style={styles.emptyBtnText}>+ Add Credit Card</Text>
            </TouchableOpacity>
          </View>
        ) : (
          creditCards.map((card) => {
            const usagePercent = Math.round(
              ((card.currentUsage || 0) / (card.creditLimit || 1)) * 100
            );
            const daysLeft = getDaysUntilDue(card.billDueDate);
            const statusColor = getStatusColor(daysLeft);
            const hasOutstanding = (card.currentUsage || 0) > 0;

            return (
              <View key={card.id} style={styles.cardContainer}>
                {/* Card Visual */}
                <View style={[styles.creditCard, { backgroundColor: card.color || '#F59E0B' }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{card.name}</Text>
                    <Text style={styles.cardBank}>{card.bankName || 'Credit Card'}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View>
                      <Text style={styles.cardLabel}>Outstanding</Text>
                      <Text style={styles.cardAmount}>
                        ₹{(card.currentUsage || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardLabel}>Limit</Text>
                      <Text style={styles.cardLimit}>
                        ₹{(card.creditLimit || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.usageBarBg}>
                    <View
                      style={[
                        styles.usageBarFill,
                        {
                          width: `${Math.min(usagePercent, 100)}%`,
                          backgroundColor: usagePercent > 80 ? '#FEE2E2' : 'rgba(255,255,255,0.4)',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.usageText}>{usagePercent}% used</Text>
                </View>

                {/* Bill Info */}
                <View style={styles.billInfo}>
                  <View style={styles.billRow}>
                    <View style={styles.billItem}>
                      <Text style={styles.billLabel}>Bill Date</Text>
                      <Text style={styles.billValue}>{card.billGenerationDate || 1}th</Text>
                    </View>
                    <View style={styles.billItem}>
                      <Text style={styles.billLabel}>Due Date</Text>
                      <Text style={styles.billValue}>{card.billDueDate || 15}th</Text>
                    </View>
                    <View style={styles.billItem}>
                      <Text style={styles.billLabel}>Days Left</Text>
                      <Text style={[styles.billValue, { color: statusColor }]}>{daysLeft} days</Text>
                    </View>
                  </View>

                  <View style={styles.billRow}>
                    <View style={styles.billItem}>
                      <Text style={styles.billLabel}>Available</Text>
                      <Text style={[styles.billValue, { color: '#10B981' }]}>
                        ₹{((card.creditLimit || 0) - (card.currentUsage || 0)).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={styles.billItem}>
                      <Text style={styles.billLabel}>Interest</Text>
                      <Text style={styles.billValue}>{card.interestRate || 36}% p.a.</Text>
                    </View>
                  </View>

                  {/* Last Payment Info */}
                  {card.lastBillPaidDate && (
                    <View style={styles.lastPaymentRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.lastPaymentText}>
                        Last paid ₹{(card.lastBillPaidAmount || 0).toLocaleString('en-IN')} on{' '}
                        {new Date(card.lastBillPaidDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                  )}

                  {/* Reminder Toggle */}
                  {hasOutstanding && (
                    <View style={styles.reminderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reminderLabel}>Bill Payment Reminder</Text>
                        <Text style={styles.reminderSub}>Show on Dashboard</Text>
                      </View>
                      <Switch
                        value={card.billPaymentReminder || false}
                        onValueChange={(val) => handleSetReminder(card.id, val)}
                        trackColor={{ false: '#E5E7EB', true: '#6C63FF' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  )}

                  {/* Alerts */}
                  {usagePercent >= 80 && (
                    <View style={styles.alertBanner}>
                      <Ionicons name="warning" size={16} color="#EF4444" />
                      <Text style={styles.alertText}>
                        High usage! {usagePercent}% of your limit is used.
                      </Text>
                    </View>
                  )}

                  {daysLeft <= 5 && hasOutstanding && (
                    <View style={[styles.alertBanner, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="time" size={16} color="#F59E0B" />
                      <Text style={[styles.alertText, { color: '#92400E' }]}>
                        Bill due in {daysLeft} days! Pay ₹{(card.currentUsage || 0).toLocaleString('en-IN')} to avoid interest.
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionRow}>
                    {hasOutstanding && (
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => openPayModal(card)}
                      >
                        <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.payBtnText}>Pay Bill</Text>
                      </TouchableOpacity>
                    )}
                    {(card.billPaymentHistory || []).length > 0 && (
                      <TouchableOpacity
                        style={styles.historyBtn}
                        onPress={() => openHistory(card)}
                      >
                        <Ionicons name="time-outline" size={18} color="#6C63FF" />
                        <Text style={styles.historyBtnText}>History</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {!hasOutstanding && (
                    <View style={styles.paidBanner}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <Text style={styles.paidText}>All Clear! No outstanding balance</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ============ PAY BILL MODAL ============ */}
      <Modal visible={showPayModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Pay Bill</Text>
                    <TouchableOpacity onPress={() => setShowPayModal(false)}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {/* Card Info */}
                  <View style={styles.payCardInfo}>
                    <Text style={styles.payCardName}>{selectedCard?.name}</Text>
                    <Text style={styles.payCardOutstanding}>
                      Outstanding: ₹{(selectedCard?.currentUsage || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  {/* Quick Amount Buttons */}
                  <Text style={styles.modalLabel}>Quick Select</Text>
                  <View style={styles.quickAmountRow}>
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setQuickAmount(selectedCard, 'full')}
                    >
                      <Text style={styles.quickAmountLabel}>Full</Text>
                      <Text style={styles.quickAmountValue}>
                        ₹{(selectedCard?.currentUsage || 0).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setQuickAmount(selectedCard, 'half')}
                    >
                      <Text style={styles.quickAmountLabel}>Half</Text>
                      <Text style={styles.quickAmountValue}>
                        ₹{Math.round((selectedCard?.currentUsage || 0) / 2).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setQuickAmount(selectedCard, 'minimum')}
                    >
                      <Text style={styles.quickAmountLabel}>Min Due</Text>
                      <Text style={styles.quickAmountValue}>
                        ₹{Math.max(Math.round((selectedCard?.currentUsage || 0) * 0.05), 100).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Custom Amount */}
                  <Text style={styles.modalLabel}>Payment Amount</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.rupeeSign}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={payAmount}
                      onChangeText={(v) => setPayAmount(v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                    />
                  </View>

                  {/* Pay From Account */}
                  <Text style={styles.modalLabel}>Pay From (optional)</Text>
                  <TouchableOpacity
                    style={styles.accountSelector}
                    onPress={() => setShowAccountPicker(true)}
                  >
                    {payFromAccount ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>
                          {payFromAccount.type === 'CASH' ? '💵' : '🏦'}
                        </Text>
                        <View>
                          <Text style={styles.accSelectorName}>{payFromAccount.name}</Text>
                          <Text style={styles.accSelectorBal}>
                            Balance: ₹{(payFromAccount.balance || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.accSelectorPlaceholder}>
                        Select account (balance will be deducted)
                      </Text>
                    )}
                    <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  {/* Warning for partial payment */}
                  {payAmount &&
                    parseFloat(payAmount) < (selectedCard?.currentUsage || 0) &&
                    parseFloat(payAmount) > 0 && (
                      <View style={[styles.alertBanner, { backgroundColor: '#FEF3C7', marginTop: 12 }]}>
                        <Ionicons name="information-circle" size={16} color="#F59E0B" />
                        <Text style={[styles.alertText, { color: '#92400E' }]}>
                          Partial payment. ₹
                          {((selectedCard?.currentUsage || 0) - parseFloat(payAmount)).toLocaleString('en-IN')}{' '}
                          will remain and may attract {selectedCard?.interestRate || 36}% interest.
                        </Text>
                      </View>
                    )}

                  <TouchableOpacity
                    style={[styles.payModalBtn, paying && { opacity: 0.6 }]}
                    onPress={handlePayBill}
                    disabled={paying}
                  >
                    {paying ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.payModalBtnText}>
                        Pay ₹{payAmount ? parseFloat(payAmount).toLocaleString('en-IN') : '0'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ ACCOUNT PICKER MODAL ============ */}
      <Modal visible={showAccountPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay From</Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.accPickerItem, !payFromAccount && styles.accPickerActive]}
              onPress={() => { setPayFromAccount(null); setShowAccountPicker(false); }}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>💰</Text>
              <Text style={styles.accPickerName}>Don't deduct from any account</Text>
            </TouchableOpacity>
            {bankAccounts.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={[styles.accPickerItem, payFromAccount?.id === acc.id && styles.accPickerActive]}
                onPress={() => { setPayFromAccount(acc); setShowAccountPicker(false); }}
              >
                <Text style={{ fontSize: 18, marginRight: 10 }}>
                  {acc.type === 'CASH' ? '💵' : '🏦'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accPickerName}>{acc.name}</Text>
                  <Text style={styles.accPickerBal}>
                    ₹{(acc.balance || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                {payFromAccount?.id === acc.id && (
                  <Ionicons name="checkmark-circle" size={22} color="#6C63FF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ============ PAYMENT HISTORY MODAL ============ */}
      <Modal visible={showHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.historyCardName}>{selectedCard?.name}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(selectedCard?.billPaymentHistory || []).reverse().map((entry, idx) => (
                <View key={entry.id || idx} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <Ionicons
                      name={entry.isFullPayment ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={entry.isFullPayment ? '#10B981' : '#F59E0B'}
                    />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.historyAmount}>
                        ₹{(entry.amount || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(entry.date).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                      <Text
                        style={[
                          styles.historyBadge,
                          { color: entry.isFullPayment ? '#10B981' : '#F59E0B' },
                        ]}
                      >
                        {entry.isFullPayment ? 'Full' : 'Partial'}
                      </Text>
                      {!entry.isFullPayment && (
                        <Text style={styles.historyRemaining}>
                          ₹{(entry.remainingAfter || 0).toLocaleString('en-IN')} left
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity 
                      onPress={() => handleUndoPayment(entry.id)}
                      style={styles.undoBtn}
                    >
                      <Ionicons name="arrow-undo" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {(selectedCard?.billPaymentHistory || []).length === 0 && (
                <Text style={styles.noHistoryText}>No payment history yet</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  cardContainer: { marginTop: 16 },
  creditCard: { borderRadius: 16, padding: 20 },
  cardHeader: { marginBottom: 20 },
  cardName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  cardBank: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  cardAmount: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  cardLimit: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  usageBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
  usageBarFill: { height: 6, borderRadius: 3 },
  usageText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6, textAlign: 'right' },

  billInfo: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: -8, paddingTop: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  billItem: { flex: 1, alignItems: 'center' },
  billLabel: { fontSize: 11, color: '#9CA3AF' },
  billValue: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginTop: 4 },

  lastPaymentRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5',
    padding: 10, borderRadius: 8, marginBottom: 10,
  },
  lastPaymentText: { fontSize: 12, color: '#065F46', marginLeft: 6 },

  reminderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 10,
  },
  reminderLabel: { fontSize: 14, fontWeight: '500', color: '#1A1A2E' },
  reminderSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2',
    padding: 12, borderRadius: 10, marginBottom: 8,
  },
  alertText: { fontSize: 12, color: '#991B1B', marginLeft: 8, flex: 1, lineHeight: 16 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  payBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6C63FF', height: 46, borderRadius: 12, gap: 6,
  },
  payBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0EFFF', height: 46, borderRadius: 12, paddingHorizontal: 16, gap: 6,
  },
  historyBtnText: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },

  paidBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#D1FAE5', padding: 14, borderRadius: 10, marginTop: 8, gap: 8,
  },
  paidText: { fontSize: 14, fontWeight: '600', color: '#065F46' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  modalLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, marginTop: 14 },

  payCardInfo: { backgroundColor: '#F0EFFF', borderRadius: 12, padding: 14, marginBottom: 8 },
  payCardName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  payCardOutstanding: { fontSize: 14, color: '#EF4444', fontWeight: '600', marginTop: 4 },

  quickAmountRow: { flexDirection: 'row', gap: 8 },
  quickAmountBtn: {
    flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', padding: 10,
  },
  quickAmountLabel: { fontSize: 11, color: '#6B7280' },
  quickAmountValue: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginTop: 2 },

  amountInputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', paddingLeft: 14,
  },
  rupeeSign: { fontSize: 20, fontWeight: '600', color: '#374151' },
  amountInput: { flex: 1, height: 50, fontSize: 20, fontWeight: '600', color: '#1A1A2E', paddingLeft: 8 },

  accountSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 12,
  },
  accSelectorName: { fontSize: 14, fontWeight: '500', color: '#1A1A2E' },
  accSelectorBal: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  accSelectorPlaceholder: { fontSize: 14, color: '#9CA3AF' },

  payModalBtn: {
    backgroundColor: '#6C63FF', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 20,
  },
  payModalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  // Account Picker
  accPickerItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
    marginBottom: 6, backgroundColor: '#F9FAFB',
  },
  accPickerActive: { backgroundColor: '#F0EFFF', borderWidth: 1.5, borderColor: '#6C63FF' },
  accPickerName: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  accPickerBal: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // History
  historyCardName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 12 },
  historyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center' },
  historyAmount: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  historyDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  historyBadge: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  historyRemaining: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 2 },
  undoBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    marginLeft: 4,
  },
  noHistoryText: { textAlign: 'center', color: '#9CA3AF', padding: 20 },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  emptyBtn: { backgroundColor: '#6C63FF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, marginTop: 20 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});

export default CreditCardBillScreen;