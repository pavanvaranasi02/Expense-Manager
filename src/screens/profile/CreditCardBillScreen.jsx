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
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ModernToggle from '../../components/ModernToggle';
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
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bill Payments</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Payments</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {creditCards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="card-outline" size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>Secure Your Cards</Text>
            <Text style={styles.emptyText}>Add your credit cards to track billing cycles and never miss a payment.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddAccount')}>
              <LinearGradient colors={['#6366F1', '#4338CA']} style={styles.emptyBtnGradient}>
                <Text style={styles.emptyBtnText}>Link First Card</Text>
              </LinearGradient>
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
                {/* Card Visual - High Fidelity */}
                <LinearGradient
                  colors={[card.color || '#F59E0B', (card.color || '#F59E0B') + 'DD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.creditCard}
                >
                  <View style={styles.cardUpper}>
                    <View>
                      <Text style={styles.cardBank}>{card.bankName || 'Premium Card'}</Text>
                      <Text style={styles.cardName}>{card.name}</Text>
                    </View>
                    <View style={styles.chipView} />
                  </View>
                  
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.cardLabel}>CURRENT OUTSTANDING</Text>
                      <Text style={styles.cardAmount}>
                        ₹{(card.currentUsage || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardLabel}>LIMIT</Text>
                      <Text style={styles.cardLimit}>
                        ₹{(card.creditLimit || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.usageContainer}>
                    <View style={styles.usageBarBg}>
                      <View
                        style={[
                          styles.usageBarFill,
                          {
                            width: `${Math.min(usagePercent, 100)}%`,
                            backgroundColor: usagePercent > 80 ? '#FEE2E2' : '#FFFFFF',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.usageText}>{usagePercent}% OF LIMIT USED</Text>
                  </View>
                </LinearGradient>

                {/* Bill Info */}
                <View style={styles.billInfo}>
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>BILL DATE</Text>
                      <Text style={styles.statValue}>{card.billGenerationDate || 1}th</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>DUE DATE</Text>
                      <Text style={styles.statValue}>{card.billDueDate || 15}th</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>DAYS TO GO</Text>
                      <Text style={[styles.statValue, { color: statusColor }]}>{daysLeft}D</Text>
                    </View>
                  </View>

                  {/* Reminder Row with ModernToggle */}
                  {hasOutstanding && (
                    <View style={styles.reminderCard}>
                      <View style={styles.reminderIconBox}>
                        <Ionicons name="notifications-outline" size={20} color="#6366F1" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.reminderLabel}>Smart Reminder</Text>
                        <Text style={styles.reminderSub}>Alert me before due date</Text>
                      </View>
                      <ModernToggle
                        value={card.billPaymentReminder || false}
                        onValueChange={() => handleSetReminder(card.id, !card.billPaymentReminder)}
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
                        <LinearGradient
                          colors={['#6366F1', '#4338CA']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.payBtnGradient}
                        >
                          <Ionicons name="flash" size={18} color="#FFFFFF" />
                          <Text style={styles.payBtnText}>PAY NOW</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    {(card.billPaymentHistory || []).length > 0 && (
                      <TouchableOpacity
                        style={styles.historyBtn}
                        onPress={() => openHistory(card)}
                      >
                        <Ionicons name="time" size={18} color="#6366F1" />
                        <Text style={styles.historyBtnText}>HISTORY</Text>
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
      <Modal visible={showPayModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismiss} 
            activeOpacity={1} 
            onPress={() => setShowPayModal(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Clear Balance</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Card Summary Mini */}
              <View style={[styles.payCardInfo, { borderLeftColor: selectedCard?.color || '#F59E0B' }]}>
                <Text style={styles.payCardName}>{selectedCard?.name}</Text>
                <Text style={styles.payCardOutstanding}>
                  Outstanding: ₹{(selectedCard?.currentUsage || 0).toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Quick Select Grid */}
              <Text style={styles.modalLabel}>QUICK SELECT</Text>
              <View style={styles.quickAmountRow}>
                <TouchableOpacity
                  style={[styles.quickAmountBtn, payAmount === (selectedCard?.currentUsage || 0).toString() && styles.activeQuickBtn]}
                  onPress={() => setQuickAmount(selectedCard, 'full')}
                >
                  <Text style={styles.quickAmountLabel}>FULL</Text>
                  <Text style={styles.quickAmountValue}>
                    ₹{(selectedCard?.currentUsage || 0).toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickAmountBtn, payAmount === Math.round((selectedCard?.currentUsage || 0) / 2).toString() && styles.activeQuickBtn]}
                  onPress={() => setQuickAmount(selectedCard, 'half')}
                >
                  <Text style={styles.quickAmountLabel}>HALF</Text>
                  <Text style={styles.quickAmountValue}>
                    ₹{Math.round((selectedCard?.currentUsage || 0) / 2).toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickAmountBtn, payAmount === Math.max(Math.round((selectedCard?.currentUsage || 0) * 0.05), 100).toString() && styles.activeQuickBtn]}
                  onPress={() => setQuickAmount(selectedCard, 'minimum')}
                >
                  <Text style={styles.quickAmountLabel}>MIN DUE</Text>
                  <Text style={styles.quickAmountValue}>
                    ₹{Math.max(Math.round((selectedCard?.currentUsage || 0) * 0.05), 100).toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount Input */}
              <Text style={styles.modalLabel}>CUSTOM AMOUNT</Text>
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

              {/* Source Account */}
              <Text style={styles.modalLabel}>PAY FROM ACCOUNT</Text>
              <TouchableOpacity
                style={styles.accountSelector}
                onPress={() => setShowAccountPicker(true)}
              >
                {payFromAccount ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={styles.accTypeIconBox}>
                      <Text style={{ fontSize: 16 }}>{payFromAccount.type === 'CASH' ? '💵' : '🏦'}</Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.accSelectorName}>{payFromAccount.name}</Text>
                      <Text style={styles.accSelectorBal}>
                        Available: ₹{(payFromAccount.balance || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.accSelectorPlaceholder}>Select payout account</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.payModalBtnCont, (paying || !payAmount) && { opacity: 0.6 }]}
                onPress={handlePayBill}
                disabled={paying || !payAmount}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.payModalBtn}
                >
                  {paying ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.payModalBtnText}>
                      CONFIRM PAYMENT (₹{payAmount ? parseFloat(payAmount).toLocaleString('en-IN') : '0'})
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
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
      <Modal visible={showHistoryModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismiss} 
            activeOpacity={1} 
            onPress={() => setShowHistoryModal(false)} 
          />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.historyHeaderInfo}>
              <Text style={styles.historyCardName}>{selectedCard?.name}</Text>
              <Text style={styles.historyCardSub}>{selectedCard?.bankName}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {(selectedCard?.billPaymentHistory || []).reverse().map((entry, idx) => (
                <View key={entry.id || idx} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={[styles.historyIconBox, { backgroundColor: entry.isFullPayment ? '#D1FAE5' : '#FEF3C7' }]}>
                      <Ionicons
                        name={entry.isFullPayment ? 'checkmark' : 'remove'}
                        size={16}
                        color={entry.isFullPayment ? '#10B981' : '#D97706'}
                      />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.historyAmountText}>
                        ₹{(entry.amount || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.historyDateText}>
                        {new Date(entry.date).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
                      <Text style={[styles.historyTypeBadge, { color: entry.isFullPayment ? '#10B981' : '#D97706' }]}>
                        {entry.isFullPayment ? 'FULL' : 'PARTIAL'}
                      </Text>
                      {!entry.isFullPayment && (
                        <Text style={styles.historyBalText}>₹{(entry.remainingAfter || 0).toLocaleString('en-IN')} left</Text>
                      )}
                    </View>
                    <TouchableOpacity 
                      onPress={() => handleUndoPayment(entry.id)}
                      style={styles.historyUndoBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {(selectedCard?.billPaymentHistory || []).length === 0 && (
                <View style={styles.noHistoryBox}>
                  <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
                  <Text style={styles.noHistoryText}>No records found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },

  cardContainer: { marginTop: 24, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 8 } },
  creditCard: { borderRadius: 24, padding: 24, height: 200, justifyContent: 'space-between', overflow: 'hidden' },
  cardUpper: { flexDirection: 'row', justifyContent: 'space-between' },
  cardBank: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
  cardName: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  chipView: { width: 44, height: 32, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  cardAmount: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  cardLimit: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginTop: 6, opacity: 0.9 },
  usageContainer: { marginTop: 12 },
  usageBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  usageBarFill: { height: 4, borderRadius: 2 },
  usageText: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.8)', marginTop: 8, textAlign: 'right', letterSpacing: 0.5 },

  billInfo: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 20,
    marginTop: -4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1 },
  statValue: { fontSize: 16, fontWeight: '900', color: '#111827', marginTop: 6 },

  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reminderIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  reminderLabel: { fontSize: 14, fontWeight: '800', color: '#111827' },
  reminderSub: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },

  alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 14, borderRadius: 16, marginBottom: 12 },
  alertText: { fontSize: 12, color: '#991B1B', fontWeight: '700', marginLeft: 10, flex: 1, lineHeight: 16 },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  payBtn: { flex: 1, height: 52, borderRadius: 18, overflow: 'hidden' },
  payBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  historyBtn: { flex: 0.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF', borderRadius: 18, gap: 8 },
  historyBtnText: { color: '#6366F1', fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },

  paidBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', padding: 16, borderRadius: 20, marginTop: 8, gap: 10 },
  paidText: { fontSize: 14, fontWeight: '900', color: '#059669' },

  emptyContainer: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  emptyBtn: { width: '100%', borderRadius: 20, overflow: 'hidden', marginTop: 32 },
  emptyBtnGradient: { height: 56, justifyContent: 'center', alignItems: 'center' },
  emptyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 8 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, marginBottom: 12, marginTop: 12, paddingLeft: 4 },

  payCardInfo: { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 16, marginBottom: 16, borderLeftWidth: 4 },
  payCardName: { fontSize: 16, fontWeight: '900', color: '#111827' },
  payCardOutstanding: { fontSize: 14, color: '#EF4444', fontWeight: '800', marginTop: 4 },

  quickAmountRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quickAmountBtn: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  activeQuickBtn: { borderColor: '#6366F1', backgroundColor: '#EEF2FF', elevation: 0 },
  quickAmountLabel: { fontSize: 9, fontWeight: '900', color: '#9CA3AF' },
  quickAmountValue: { fontSize: 14, fontWeight: '900', color: '#111827', marginTop: 4 },

  amountInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', paddingLeft: 20, marginBottom: 8 },
  rupeeSign: { fontSize: 24, fontWeight: '900', color: '#111827' },
  amountInput: { flex: 1, height: 64, fontSize: 22, fontWeight: '900', color: '#111827', paddingLeft: 12 },

  accountSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  accTypeIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  accSelectorName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  accSelectorBal: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },
  accSelectorPlaceholder: { fontSize: 15, color: '#9CA3AF', fontWeight: '700' },

  payModalBtnCont: { borderRadius: 24, overflow: 'hidden', marginTop: 32, marginBottom: 20, elevation: 6, shadowColor: '#10B981', shadowOpacity: 0.3 },
  payModalBtn: { height: 64, justifyContent: 'center', alignItems: 'center' },
  payModalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  historyHeaderInfo: { marginBottom: 20, paddingLeft: 4 },
  historyCardName: { fontSize: 18, fontWeight: '900', color: '#111827' },
  historyCardSub: { fontSize: 12, color: '#9CA3AF', fontWeight: '700', marginTop: 2 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  historyLeft: { flexDirection: 'row', alignItems: 'center' },
  historyIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  historyAmountText: { fontSize: 16, fontWeight: '900', color: '#111827' },
  historyDateText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  historyTypeBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textAlign: 'right' },
  historyBalText: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', textAlign: 'right', marginTop: 2 },
  historyUndoBtn: { padding: 10, backgroundColor: '#FEF2F2', borderRadius: 12 },
  noHistoryBox: { alignItems: 'center', paddingVertical: 40 },
  noHistoryText: { fontSize: 14, color: '#D1D5DB', fontWeight: '700', marginTop: 12 },
});

export default CreditCardBillScreen;