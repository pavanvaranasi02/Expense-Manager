import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import ModernToggle from '../../components/ModernToggle';
import {
  getAccounts,
  payCreditCardBill,
  revertCreditCardPayment,
  setBillReminder,
} from '../../services/accountService';
import { addExpense, deleteExpense, getExpense } from '../../services/expenseService';
import {
  getEmis,
  addEmi,
  recordEmiPayment,
  closeEmi,
  deleteEmi,
  calculateEmiTotals,
} from '../../services/emiService';

const QUICK_TENURES = [3, 6, 9, 12, 18, 24, 36];

const CreditCardBillScreen = ({ navigation }) => {
  // Navigation tabs: 'bills' | 'emis'
  const [activeTab, setActiveTab] = useState('bills');

  // Credit Card Bill States
  const [creditCards, setCreditCards] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payFromAccount, setPayFromAccount] = useState(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountPickerTarget, setAccountPickerTarget] = useState('cardPay'); // 'cardPay' | 'emiLink' | 'emiPay'
  const [paying, setPaying] = useState(false);

  // EMI States
  const [emis, setEmis] = useState([]);
  const [emiFilter, setEmiFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [showAddEmiModal, setShowAddEmiModal] = useState(false);
  const [showRecordEmiModal, setShowRecordEmiModal] = useState(false);
  const [showEmiHistoryModal, setShowEmiHistoryModal] = useState(false);
  const [selectedEmi, setSelectedEmi] = useState(null);
  const [savingEmi, setSavingEmi] = useState(false);
  const [recordingEmiPay, setRecordingEmiPay] = useState(false);

  // Add EMI Form State
  const [emiName, setEmiName] = useState('');
  const [emiMonthlyAmount, setEmiMonthlyAmount] = useState('');
  const [emiTotalMonths, setEmiTotalMonths] = useState('12');
  const [emiCompletedMonths, setEmiCompletedMonths] = useState('0');
  const [emiDebitDay, setEmiDebitDay] = useState('5');
  const [emiStartDate, setEmiStartDate] = useState(new Date());
  const [showEmiStartDatePicker, setShowEmiStartDatePicker] = useState(false);
  const [emiLinkedAccount, setEmiLinkedAccount] = useState(null);
  const [emiTotalAmount, setEmiTotalAmount] = useState('');
  const [emiInterestRate, setEmiInterestRate] = useState('');
  const [emiProcessingFee, setEmiProcessingFee] = useState('');
  const [emiNote, setEmiNote] = useState('');
  const [showOptionalEmiFields, setShowOptionalEmiFields] = useState(false);

  // Record EMI Payment Form State
  const [payEmiAmount, setPayEmiAmount] = useState('');
  const [payEmiDate, setPayEmiDate] = useState(new Date());
  const [showPayEmiDatePicker, setShowPayEmiDatePicker] = useState(false);
  const [payEmiAccount, setPayEmiAccount] = useState(null);
  const [payEmiNote, setPayEmiNote] = useState('');

  const fetchData = async () => {
    const [accResult, emiResult] = await Promise.all([
      getAccounts(),
      getEmis(),
    ]);

    if (accResult.success) {
      setCreditCards(accResult.accounts.filter((a) => a.type === 'CREDIT_CARD'));
      setBankAccounts(accResult.accounts.filter((a) => a.type === 'BANK' || a.type === 'CASH'));
    }

    if (emiResult.success) {
      setEmis(emiResult.emis || []);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // ============ CREDIT CARD BILL HELPERS ============
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

      const result = await payCreditCardBill(
        selectedCard.id,
        payAmount,
        payFromAccount?.id,
        expenseId
      );

      if (result.success) {
        setShowPayModal(false);
        fetchData();

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
                if (result.expenseId) {
                  const expRes = await getExpense(result.expenseId);
                  if (expRes.success) {
                    await deleteExpense(result.expenseId, expRes.expense);
                  }
                }
                await fetchData();
                const accRes = await getAccounts();
                if (accRes.success) {
                  const updatedCard = accRes.accounts.find((a) => a.id === selectedCard.id);
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
    fetchData();
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

  // ============ EMI HELPERS ============
  const openAddEmiModal = () => {
    setEmiName('');
    setEmiMonthlyAmount('');
    setEmiTotalMonths('12');
    setEmiCompletedMonths('0');
    setEmiDebitDay('5');
    setEmiStartDate(new Date());
    setEmiLinkedAccount(creditCards[0] || bankAccounts[0] || null);
    setEmiTotalAmount('');
    setEmiInterestRate('');
    setEmiProcessingFee('');
    setEmiNote('');
    setShowOptionalEmiFields(false);
    setShowAddEmiModal(true);
  };

  const handleCreateEmi = async () => {
    if (!emiName.trim()) {
      Alert.alert('Required', 'Please enter a name for the EMI');
      return;
    }
    const monthlyAmt = parseFloat(emiMonthlyAmount);
    if (!monthlyAmt || monthlyAmt <= 0) {
      Alert.alert('Required', 'Please enter a valid monthly EMI amount');
      return;
    }
    const months = parseInt(emiTotalMonths, 10);
    if (!months || months <= 0) {
      Alert.alert('Required', 'Please specify the tenure in months');
      return;
    }

    setSavingEmi(true);
    try {
      const result = await addEmi({
        name: emiName,
        monthlyAmount: monthlyAmt,
        totalMonths: months,
        completedMonths: parseInt(emiCompletedMonths, 10) || 0,
        debitDay: parseInt(emiDebitDay, 10) || 5,
        startDate: emiStartDate.toISOString(),
        linkedAccountId: emiLinkedAccount?.id || null,
        linkedAccountName: emiLinkedAccount?.name || 'Credit Card',
        linkedAccountType: emiLinkedAccount?.type || 'CREDIT_CARD',
        totalAmount: emiTotalAmount ? parseFloat(emiTotalAmount) : (monthlyAmt * months),
        interestRate: emiInterestRate ? parseFloat(emiInterestRate) : 0,
        processingFee: emiProcessingFee ? parseFloat(emiProcessingFee) : 0,
        note: emiNote,
      });

      if (result.success) {
        setShowAddEmiModal(false);
        await fetchData();
        Alert.alert('Success', 'EMI added successfully!');
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSavingEmi(false);
    }
  };

  const openRecordEmiPaymentModal = (emi) => {
    setSelectedEmi(emi);
    setPayEmiAmount((emi.monthlyAmount || 0).toString());
    setPayEmiDate(new Date());
    setPayEmiAccount(bankAccounts.length > 0 ? bankAccounts[0] : null);
    setPayEmiNote('');
    setShowRecordEmiModal(true);
  };

  const handleRecordEmiPayment = async () => {
    if (!payEmiAmount || parseFloat(payEmiAmount) <= 0) {
      Alert.alert('Invalid', 'Enter a valid payment amount');
      return;
    }

    setRecordingEmiPay(true);
    try {
      const result = await recordEmiPayment(selectedEmi.id, {
        amount: parseFloat(payEmiAmount),
        date: payEmiDate.toISOString(),
        payFromAccountId: payEmiAccount?.id || null,
        payFromAccountName: payEmiAccount?.name || null,
        paymentMode: payEmiAccount?.type || 'BANK',
        note: payEmiNote,
      });

      if (result.success) {
        setShowRecordEmiModal(false);
        await fetchData();
        if (result.isCompleted) {
          Alert.alert(
            '🎉 EMI Fully Paid & Matured!',
            `Congratulations! All ${selectedEmi.totalMonths} installments have been completed.`
          );
        } else {
          Alert.alert(
            '✅ Payment Recorded',
            `Recorded installment ${result.completedMonths} of ${selectedEmi.totalMonths}.`
          );
        }
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setRecordingEmiPay(false);
    }
  };

  const handleCloseEmi = (emi) => {
    Alert.alert(
      'Close / Foreclose EMI?',
      `Mark "${emi.name}" as fully completed / matured? This will move it to completed history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Completed',
          style: 'default',
          onPress: async () => {
            const res = await closeEmi(emi.id, 'Marked completed / foreclosed early');
            if (res.success) {
              await fetchData();
              if (selectedEmi?.id === emi.id) setShowEmiHistoryModal(false);
              Alert.alert('Success', 'EMI marked as completed!');
            } else {
              Alert.alert('Error', res.error);
            }
          },
        },
      ]
    );
  };

  const handleDeleteEmi = (emi) => {
    Alert.alert(
      'Delete EMI?',
      `Are you sure you want to delete "${emi.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteEmi(emi.id);
            if (res.success) {
              await fetchData();
              if (selectedEmi?.id === emi.id) setShowEmiHistoryModal(false);
              Alert.alert('Deleted', 'EMI removed successfully');
            } else {
              Alert.alert('Error', res.error);
            }
          },
        },
      ]
    );
  };

  const openEmiHistory = (emi) => {
    setSelectedEmi(emi);
    setShowEmiHistoryModal(true);
  };

  // Filter EMIs
  const filteredEmis = emis.filter((e) => {
    if (emiFilter === 'ACTIVE') return e.isActive !== false && e.status !== 'COMPLETED';
    if (emiFilter === 'COMPLETED') return e.isActive === false || e.status === 'COMPLETED';
    return true;
  });

  const emiTotals = calculateEmiTotals(emis);

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bills & EMIs</Text>
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
          <Text style={styles.headerTitle}>Bills & EMIs</Text>
          {activeTab === 'emis' ? (
            <TouchableOpacity onPress={openAddEmiModal} style={styles.addHeaderBtn}>
              <Ionicons name="add" size={22} color="#6366F1" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* ============ SEGMENTED TAB BAR ============ */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'bills' && styles.activeTabBtn]}
            onPress={() => setActiveTab('bills')}
          >
            <Ionicons
              name="card"
              size={16}
              color={activeTab === 'bills' ? '#6366F1' : '#6B7280'}
            />
            <Text style={[styles.tabText, activeTab === 'bills' && styles.activeTabText]}>
              Card Bills ({creditCards.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'emis' && styles.activeTabBtn]}
            onPress={() => setActiveTab('emis')}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={activeTab === 'emis' ? '#6366F1' : '#6B7280'}
            />
            <Text style={[styles.tabText, activeTab === 'emis' && styles.activeTabText]}>
              EMIs & Loans ({emiTotals.activeCount})
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ================================================= */}
        {/* TAB 1: CREDIT CARD BILLS                          */}
        {/* ================================================= */}
        {activeTab === 'bills' && (
          <>
            {creditCards.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="card-outline" size={48} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>No Credit Cards Found</Text>
                <Text style={styles.emptyText}>
                  Add a credit card in your Accounts section to track statement due dates, payments, and limit utilization.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate('Accounts')}
                >
                  <LinearGradient
                    colors={['#6366F1', '#4F46E5']}
                    style={styles.emptyBtnGradient}
                  >
                    <Text style={styles.emptyBtnText}>Add Credit Card</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              creditCards.map((card) => {
                const daysLeft = getDaysUntilDue(card.statementDueDate);
                const statusColor = getStatusColor(daysLeft);
                const hasOutstanding = (card.currentUsage || 0) > 0;
                const usagePercent = card.creditLimit
                  ? Math.min(Math.round(((card.currentUsage || 0) / card.creditLimit) * 100), 100)
                  : 0;

                return (
                  <View key={card.id} style={styles.cardContainer}>
                    {/* Visual Card */}
                    <LinearGradient
                      colors={[card.color || '#374151', '#111827']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.creditCard}
                    >
                      <View style={styles.cardUpper}>
                        <View>
                          <Text style={styles.cardBank}>{card.bankName || 'BANK'}</Text>
                          <Text style={styles.cardName}>{card.name}</Text>
                        </View>
                        <View style={styles.chipView} />
                      </View>

                      <View style={styles.usageContainer}>
                        <View style={styles.usageBarBg}>
                          <View
                            style={[
                              styles.usageBarFill,
                              {
                                width: `${usagePercent}%`,
                                backgroundColor: usagePercent > 80 ? '#EF4444' : usagePercent > 50 ? '#F59E0B' : '#10B981',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.usageText}>
                          {usagePercent}% USED ({`₹${(card.currentUsage || 0).toLocaleString('en-IN')}`})
                        </Text>
                      </View>

                      <View style={styles.cardBottom}>
                        <View>
                          <Text style={styles.cardLabel}>TOTAL OUTSTANDING</Text>
                          <Text style={styles.cardAmount}>
                            ₹{(card.currentUsage || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.cardLabel}>CREDIT LIMIT</Text>
                          <Text style={styles.cardLimit}>
                            ₹{(card.creditLimit || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>

                    {/* Bill Info Card */}
                    <View style={styles.billInfo}>
                      <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>DUE DATE</Text>
                          <Text style={styles.statValue}>
                            {card.statementDueDate || 15}th of month
                          </Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>STATUS</Text>
                          <Text style={[styles.statValue, { color: hasOutstanding ? statusColor : '#10B981' }]}>
                            {hasOutstanding
                              ? daysLeft === 0
                                ? 'Due Today!'
                                : `${daysLeft} days left`
                              : 'Paid Off'}
                          </Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>APR</Text>
                          <Text style={styles.statValue}>
                            {card.interestRate || 42}% p.a.
                          </Text>
                        </View>
                      </View>

                      {hasOutstanding && (
                        <View style={styles.reminderCard}>
                          <View style={styles.reminderIconBox}>
                            <Ionicons name="notifications" size={20} color="#6366F1" />
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
          </>
        )}

        {/* ================================================= */}
        {/* TAB 2: EMIs & LOANS                               */}
        {/* ================================================= */}
        {activeTab === 'emis' && (
          <>
            {/* EMI Summary Metrics Banner */}
            <View style={styles.emiSummaryCard}>
              <View style={styles.emiSummaryRow}>
                <View style={styles.emiSummaryCol}>
                  <Text style={styles.emiSummaryLabel}>MONTHLY COMMITMENT</Text>
                  <Text style={styles.emiSummaryValue}>
                    ₹{emiTotals.totalMonthlyCommitment.toLocaleString('en-IN')}
                    <Text style={styles.emiSummaryPerMonth}>/mo</Text>
                  </Text>
                </View>
                <View style={[styles.emiSummaryCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.emiSummaryLabel}>OUTSTANDING BALANCE</Text>
                  <Text style={[styles.emiSummaryValue, { color: '#EF4444' }]}>
                    ₹{emiTotals.totalRemainingBalance.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <View style={styles.emiSummaryFooter}>
                <View style={styles.emiPillBadge}>
                  <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.emiPillText}>{emiTotals.activeCount} Active</Text>
                </View>
                <View style={[styles.emiPillBadge, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="checkmark-done" size={14} color="#6B7280" />
                  <Text style={[styles.emiPillText, { color: '#4B5563', marginLeft: 4 }]}>
                    {emiTotals.completedCount} Completed / Matured
                  </Text>
                </View>
              </View>
            </View>

            {/* Filter Chips & Add Action */}
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  style={[styles.filterChip, emiFilter === 'ALL' && styles.filterChipActive]}
                  onPress={() => setEmiFilter('ALL')}
                >
                  <Text style={[styles.filterChipText, emiFilter === 'ALL' && styles.filterChipTextActive]}>
                    All ({emis.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, emiFilter === 'ACTIVE' && styles.filterChipActive]}
                  onPress={() => setEmiFilter('ACTIVE')}
                >
                  <Text style={[styles.filterChipText, emiFilter === 'ACTIVE' && styles.filterChipTextActive]}>
                    Active ({emiTotals.activeCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, emiFilter === 'COMPLETED' && styles.filterChipActive]}
                  onPress={() => setEmiFilter('COMPLETED')}
                >
                  <Text style={[styles.filterChipText, emiFilter === 'COMPLETED' && styles.filterChipTextActive]}>
                    Completed / Matured ({emiTotals.completedCount})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* EMI Cards List */}
            {filteredEmis.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>
                  {emiFilter === 'COMPLETED' ? 'No Completed EMIs Yet' : 'No EMIs Recorded'}
                </Text>
                <Text style={styles.emptyText}>
                  {emiFilter === 'COMPLETED'
                    ? 'Completed and foreclosed EMIs will appear here with full installment histories.'
                    : 'Track your credit card, gadget, or personal loan EMIs with payment histories and due date alerts.'}
                </Text>
                {emiFilter !== 'COMPLETED' && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={openAddEmiModal}>
                    <LinearGradient
                      colors={['#6366F1', '#4F46E5']}
                      style={styles.emptyBtnGradient}
                    >
                      <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.emptyBtnText}>Add New EMI</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredEmis.map((emi) => {
                const isCompleted = emi.isActive === false || emi.status === 'COMPLETED';
                const totalMonths = emi.totalMonths || 1;
                const completedMonths = emi.completedMonths || 0;
                const progressPct = Math.min(Math.round((completedMonths / totalMonths) * 100), 100);
                const remainingMonths = Math.max(0, totalMonths - completedMonths);
                const remainingAmount = remainingMonths * (parseFloat(emi.monthlyAmount) || 0);

                return (
                  <View key={emi.id} style={styles.emiCard}>
                    {/* Card Top Header */}
                    <View style={styles.emiCardTop}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.emiCardTitle}>{emi.name}</Text>
                          {isCompleted ? (
                            <View style={styles.completedBadge}>
                              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                              <Text style={styles.completedBadgeText}>COMPLETED</Text>
                            </View>
                          ) : (
                            <View style={styles.activePill}>
                              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                              <Text style={styles.activePillText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.emiLinkedRow}>
                          <Ionicons
                            name={emi.linkedAccountType === 'CREDIT_CARD' ? 'card-outline' : 'business-outline'}
                            size={14}
                            color="#6B7280"
                          />
                          <Text style={styles.emiLinkedText}>
                            {emi.linkedAccountName || 'Credit Card'}
                          </Text>
                          <Text style={styles.emiDotSep}>•</Text>
                          <Text style={styles.emiDebitDayText}>
                            Auto-debits {emi.debitDay || 5}th monthly
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteEmi(emi)}
                        style={styles.emiTrashBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Progress Bar & Tenure */}
                    <View style={styles.emiProgressContainer}>
                      <View style={styles.emiProgressHeader}>
                        <Text style={styles.emiProgressLabel}>
                          Tenure: Month {completedMonths} of {totalMonths}
                        </Text>
                        <Text style={styles.emiProgressPct}>{progressPct}%</Text>
                      </View>
                      <View style={styles.emiProgressBarBg}>
                        <View
                          style={[
                            styles.emiProgressBarFill,
                            {
                              width: `${progressPct}%`,
                              backgroundColor: isCompleted ? '#10B981' : '#6366F1',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Financial Stats Grid */}
                    <View style={styles.emiStatsRow}>
                      <View style={styles.emiStatItem}>
                        <Text style={styles.emiStatLabel}>MONTHLY EMI</Text>
                        <Text style={styles.emiStatValue}>
                          ₹{(emi.monthlyAmount || 0).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={styles.emiStatItem}>
                        <Text style={styles.emiStatLabel}>
                          {isCompleted ? 'FINAL STATUS' : 'REMAINING'}
                        </Text>
                        <Text
                          style={[
                            styles.emiStatValue,
                            { color: isCompleted ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {isCompleted ? 'Matured / Closed' : `₹${remainingAmount.toLocaleString('en-IN')}`}
                        </Text>
                      </View>
                      <View style={styles.emiStatItem}>
                        <Text style={styles.emiStatLabel}>TOTAL AMOUNT</Text>
                        <Text style={styles.emiStatValue}>
                          ₹{(emi.totalAmount || (emi.monthlyAmount * totalMonths)).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>

                    {/* Note if any */}
                    {emi.note ? (
                      <View style={styles.emiNoteBox}>
                        <Ionicons name="document-text-outline" size={14} color="#6B7280" />
                        <Text style={styles.emiNoteText} numberOfLines={2}>
                          {emi.note}
                        </Text>
                      </View>
                    ) : null}

                    {/* Matured info banner if completed */}
                    {isCompleted && emi.maturedDate && (
                      <View style={styles.maturedInfoBanner}>
                        <Ionicons name="ribbon-outline" size={16} color="#059669" />
                        <Text style={styles.maturedInfoText}>
                          Matured on{' '}
                          {new Date(emi.maturedDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.emiActionRow}>
                      {!isCompleted && (
                        <TouchableOpacity
                          style={styles.emiPayBtn}
                          onPress={() => openRecordEmiPaymentModal(emi)}
                        >
                          <LinearGradient
                            colors={['#6366F1', '#4F46E5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.emiPayBtnGradient}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                            <Text style={styles.emiPayBtnText}>PAY MONTH</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.emiHistoryBtn, isCompleted && { flex: 1 }]}
                        onPress={() => openEmiHistory(emi)}
                      >
                        <Ionicons name="time" size={16} color="#6366F1" />
                        <Text style={styles.emiHistoryBtnText}>
                          HISTORY ({(emi.paymentHistory || []).length})
                        </Text>
                      </TouchableOpacity>

                      {!isCompleted && (
                        <TouchableOpacity
                          style={styles.emiCloseBtn}
                          onPress={() => handleCloseEmi(emi)}
                        >
                          <Ionicons name="flag-outline" size={16} color="#6B7280" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* ================================================= */}
      {/* MODAL 1: ADD NEW EMI                              */}
      {/* ================================================= */}
      <Modal visible={showAddEmiModal} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setShowAddEmiModal(false)}
          />
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New EMI</Text>
              <TouchableOpacity
                onPress={() => setShowAddEmiModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Mandatory: Name */}
              <Text style={styles.modalLabel}>EMI / LOAN NAME *</Text>
              <TextInput
                style={styles.textInputBox}
                value={emiName}
                onChangeText={setEmiName}
                placeholder="e.g. iPhone 16 Pro, MacBook, Car Loan"
                placeholderTextColor="#9CA3AF"
              />

              {/* Mandatory: Monthly EMI Amount */}
              <Text style={styles.modalLabel}>MONTHLY EMI AMOUNT *</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.rupeeSign}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={emiMonthlyAmount}
                  onChangeText={(v) => setEmiMonthlyAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#D1D5DB"
                />
              </View>

              {/* Mandatory: Total Tenure */}
              <Text style={styles.modalLabel}>TOTAL TENURE (MONTHS) *</Text>
              <View style={styles.tenureChipsRow}>
                {QUICK_TENURES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tenureChip,
                      emiTotalMonths === t.toString() && styles.tenureChipActive,
                    ]}
                    onPress={() => setEmiTotalMonths(t.toString())}
                  >
                    <Text
                      style={[
                        styles.tenureChipText,
                        emiTotalMonths === t.toString() && styles.tenureChipTextActive,
                      ]}
                    >
                      {t}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.textInputBox, { marginTop: 8 }]}
                value={emiTotalMonths}
                onChangeText={(v) => setEmiTotalMonths(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="Or custom months (e.g. 18)"
                placeholderTextColor="#9CA3AF"
              />

              {/* Mandatory: Linked Card or Bank Account */}
              <Text style={styles.modalLabel}>LINKED CARD / ACCOUNT *</Text>
              <TouchableOpacity
                style={styles.accountSelector}
                onPress={() => {
                  setAccountPickerTarget('emiLink');
                  setShowAccountPicker(true);
                }}
              >
                {emiLinkedAccount ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={styles.accTypeIconBox}>
                      <Text style={{ fontSize: 16 }}>
                        {emiLinkedAccount.type === 'CREDIT_CARD' ? '💳' : '🏦'}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.accSelectorName}>{emiLinkedAccount.name}</Text>
                      <Text style={styles.accSelectorBal}>
                        {emiLinkedAccount.bankName || emiLinkedAccount.type}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.accSelectorPlaceholder}>Select card or account</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Mandatory: Start Date with DateTimePicker (supports past & future) */}
              <Text style={styles.modalLabel}>START DATE * (PAST / PRESENT / FUTURE)</Text>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowEmiStartDatePicker(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={20} color="#6366F1" />
                  <Text style={styles.dateSelectorText}>
                    {emiStartDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.changeDateText}>Change</Text>
              </TouchableOpacity>

              {showEmiStartDatePicker && (
                <DateTimePicker
                  value={emiStartDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowEmiStartDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setEmiStartDate(selectedDate);
                  }}
                />
              )}

              {/* Mandatory: Debit Day */}
              <Text style={styles.modalLabel}>DEBIT DAY OF MONTH * (1-31)</Text>
              <TextInput
                style={styles.textInputBox}
                value={emiDebitDay}
                onChangeText={(v) => {
                  const num = parseInt(v, 10);
                  if (!v || (num >= 1 && num <= 31)) setEmiDebitDay(v);
                }}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor="#9CA3AF"
              />

              {/* Expandable Optional Fields Header */}
              <TouchableOpacity
                style={styles.optionalToggle}
                onPress={() => setShowOptionalEmiFields(!showOptionalEmiFields)}
              >
                <Ionicons
                  name={showOptionalEmiFields ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#6366F1"
                />
                <Text style={styles.optionalToggleText}>
                  {showOptionalEmiFields
                    ? 'Hide Optional Details'
                    : 'Show Optional Details (Past Months, Rate, Notes)'}
                </Text>
              </TouchableOpacity>

              {showOptionalEmiFields && (
                <View style={styles.optionalFieldsContainer}>
                  {/* Already Completed Months */}
                  <Text style={styles.modalLabel}>ALREADY PAID MONTHS (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    value={emiCompletedMonths}
                    onChangeText={(v) => setEmiCompletedMonths(v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="0 (e.g. 3 if started 3 months ago)"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.fieldHelpText}>
                    If entered, the past installment history entries will be auto-created for you.
                  </Text>

                  {/* Total Financed Amount */}
                  <Text style={styles.modalLabel}>TOTAL FINANCED AMOUNT (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    value={emiTotalAmount}
                    onChangeText={(v) => setEmiTotalAmount(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="numeric"
                    placeholder={
                      emiMonthlyAmount && emiTotalMonths
                        ? `Auto: ₹${(parseFloat(emiMonthlyAmount) * parseInt(emiTotalMonths, 10)).toLocaleString('en-IN')}`
                        : 'Total loan value'
                    }
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Interest Rate */}
                  <Text style={styles.modalLabel}>ANNUAL INTEREST RATE % (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    value={emiInterestRate}
                    onChangeText={(v) => setEmiInterestRate(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="numeric"
                    placeholder="e.g. 14 for 14% p.a., 0 for No-Cost EMI"
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Processing Fee */}
                  <Text style={styles.modalLabel}>PROCESSING FEE (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    value={emiProcessingFee}
                    onChangeText={(v) => setEmiProcessingFee(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="numeric"
                    placeholder="e.g. 199"
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Note */}
                  <Text style={styles.modalLabel}>NOTE / REMARKS (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.textInputBox, { height: 70, textAlignVertical: 'top' }]}
                    value={emiNote}
                    onChangeText={setEmiNote}
                    multiline
                    placeholder="e.g. No cost EMI via Amazon on HDFC Credit Card"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.payModalBtnCont, savingEmi && { opacity: 0.6 }]}
                onPress={handleCreateEmi}
                disabled={savingEmi}
              >
                <LinearGradient
                  colors={['#6366F1', '#4F46E5']}
                  style={styles.payModalBtn}
                >
                  {savingEmi ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.payModalBtnText}>SAVE EMI</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================= */}
      {/* MODAL 2: RECORD EMI PAYMENT                       */}
      {/* ================================================= */}
      <Modal visible={showRecordEmiModal} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setShowRecordEmiModal(false)}
          />
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record EMI Payment</Text>
              <TouchableOpacity
                onPress={() => setShowRecordEmiModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* EMI Info */}
              <View style={[styles.payCardInfo, { borderLeftColor: '#6366F1' }]}>
                <Text style={styles.payCardName}>{selectedEmi?.name}</Text>
                <Text style={[styles.payCardOutstanding, { color: '#6366F1' }]}>
                  Paying Month {(selectedEmi?.completedMonths || 0) + 1} of {selectedEmi?.totalMonths}
                </Text>
              </View>

              {/* Amount Input */}
              <Text style={styles.modalLabel}>INSTALLMENT AMOUNT</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.rupeeSign}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={payEmiAmount}
                  onChangeText={(v) => setPayEmiAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#D1D5DB"
                />
              </View>

              {/* Custom Date Picker (Past / Present / Future) */}
              <Text style={styles.modalLabel}>PAYMENT DATE (CUSTOM DATE ALLOWED)</Text>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowPayEmiDatePicker(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={20} color="#6366F1" />
                  <Text style={styles.dateSelectorText}>
                    {payEmiDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.changeDateText}>Change</Text>
              </TouchableOpacity>

              {showPayEmiDatePicker && (
                <DateTimePicker
                  value={payEmiDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowPayEmiDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setPayEmiDate(selectedDate);
                  }}
                />
              )}

              {/* Deduct From Account (Optional) */}
              <Text style={styles.modalLabel}>PAY FROM ACCOUNT (OPTIONAL)</Text>
              <TouchableOpacity
                style={styles.accountSelector}
                onPress={() => {
                  setAccountPickerTarget('emiPay');
                  setShowAccountPicker(true);
                }}
              >
                {payEmiAccount ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={styles.accTypeIconBox}>
                      <Text style={{ fontSize: 16 }}>
                        {payEmiAccount.type === 'CASH' ? '💵' : '🏦'}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.accSelectorName}>{payEmiAccount.name}</Text>
                      <Text style={styles.accSelectorBal}>
                        Available: ₹{(payEmiAccount.balance || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.accSelectorPlaceholder}>{"Don't deduct from balance"}</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Optional Note */}
              <Text style={styles.modalLabel}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={styles.textInputBox}
                value={payEmiNote}
                onChangeText={setPayEmiNote}
                placeholder="e.g. Auto-debited on schedule, paid early"
                placeholderTextColor="#9CA3AF"
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.payModalBtnCont, recordingEmiPay && { opacity: 0.6 }]}
                onPress={handleRecordEmiPayment}
                disabled={recordingEmiPay}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.payModalBtn}
                >
                  {recordingEmiPay ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.payModalBtnText}>CONFIRM PAYMENT</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================= */}
      {/* MODAL 3: EMI PAYMENT HISTORY                      */}
      {/* ================================================= */}
      <Modal visible={showEmiHistoryModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setShowEmiHistoryModal(false)}
          />
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>EMI History</Text>
              <TouchableOpacity
                onPress={() => setShowEmiHistoryModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.historyHeaderInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.historyCardName}>{selectedEmi?.name}</Text>
                {selectedEmi?.isActive === false || selectedEmi?.status === 'COMPLETED' ? (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.completedBadgeText}>COMPLETED</Text>
                  </View>
                ) : (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>
                      Month {selectedEmi?.completedMonths || 0} / {selectedEmi?.totalMonths}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.historyCardSub}>
                Monthly ₹{(selectedEmi?.monthlyAmount || 0).toLocaleString('en-IN')} via{' '}
                {selectedEmi?.linkedAccountName || 'Credit Card'}
              </Text>
            </View>

            {/* Matured info banner if completed */}
            {(selectedEmi?.isActive === false || selectedEmi?.status === 'COMPLETED') && (
              <View style={[styles.maturedInfoBanner, { marginBottom: 16 }]}>
                <Ionicons name="ribbon" size={20} color="#059669" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.maturedInfoText, { fontWeight: '800' }]}>
                    All Installments Completed!
                  </Text>
                  {selectedEmi?.maturedDate && (
                    <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                      Matured on{' '}
                      {new Date(selectedEmi.maturedDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  )}
                  {selectedEmi?.closureNote && (
                    <Text style={{ fontSize: 11, color: '#065F46', marginTop: 1 }}>
                      Note: {selectedEmi.closureNote}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {(selectedEmi?.paymentHistory || [])
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <View key={entry.id || idx} style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                      <View style={[styles.historyIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.historyAmountText}>
                          ₹{(entry.amount || 0).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.historyDateText}>
                          {entry.date
                            ? new Date(entry.date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Recorded'}
                        </Text>
                        {entry.note ? (
                          <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            {entry.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.historyTypeBadge, { color: '#10B981' }]}>
                        Month {entry.monthNumber}
                      </Text>
                      {entry.paidFromAccountName && (
                        <Text style={styles.historyBalText}>
                          via {entry.paidFromAccountName}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}

              {(selectedEmi?.paymentHistory || []).length === 0 && (
                <View style={styles.noHistoryBox}>
                  <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
                  <Text style={styles.noHistoryText}>No payments recorded yet</Text>
                </View>
              )}

              {/* Actions inside History Modal */}
              <View style={{ marginTop: 24, gap: 12 }}>
                {selectedEmi?.isActive !== false && selectedEmi?.status !== 'COMPLETED' && (
                  <TouchableOpacity
                    style={styles.forecloseModalBtn}
                    onPress={() => handleCloseEmi(selectedEmi)}
                  >
                    <Ionicons name="flag-outline" size={16} color="#4B5563" />
                    <Text style={styles.forecloseModalBtnText}>Foreclose / Mark Completed</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.deleteModalBtn}
                  onPress={() => handleDeleteEmi(selectedEmi)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.deleteModalBtnText}>Delete EMI Record</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================= */}
      {/* MODAL 4: PAY CREDIT CARD BILL MODAL               */}
      {/* ================================================= */}
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
              <View style={[styles.payCardInfo, { borderLeftColor: selectedCard?.color || '#F59E0B' }]}>
                <Text style={styles.payCardName}>{selectedCard?.name}</Text>
                <Text style={styles.payCardOutstanding}>
                  Outstanding: ₹{(selectedCard?.currentUsage || 0).toLocaleString('en-IN')}
                </Text>
              </View>

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

              <Text style={styles.modalLabel}>PAY FROM ACCOUNT</Text>
              <TouchableOpacity
                style={styles.accountSelector}
                onPress={() => {
                  setAccountPickerTarget('cardPay');
                  setShowAccountPicker(true);
                }}
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

      {/* ================================================= */}
      {/* MODAL 5: REUSABLE ACCOUNT PICKER MODAL            */}
      {/* ================================================= */}
      <Modal visible={showAccountPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '55%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {accountPickerTarget === 'emiLink' ? 'Select Linked Account' : 'Pay From Account'}
              </Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {accountPickerTarget !== 'emiLink' && (
                <TouchableOpacity
                  style={[
                    styles.accPickerItem,
                    ((accountPickerTarget === 'cardPay' && !payFromAccount) ||
                      (accountPickerTarget === 'emiPay' && !payEmiAccount)) &&
                      styles.accPickerActive,
                  ]}
                  onPress={() => {
                    if (accountPickerTarget === 'cardPay') setPayFromAccount(null);
                    if (accountPickerTarget === 'emiPay') setPayEmiAccount(null);
                    setShowAccountPicker(false);
                  }}
                >
                  <Text style={{ fontSize: 18, marginRight: 10 }}>💰</Text>
                  <Text style={styles.accPickerName}>{"Don't deduct from any account"}</Text>
                </TouchableOpacity>
              )}

              {/* In EMI Link mode, include credit cards as options too */}
              {accountPickerTarget === 'emiLink' && (
                <>
                  <Text style={styles.modalSubHeader}>CREDIT CARDS</Text>
                  {creditCards.map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      style={[
                        styles.accPickerItem,
                        emiLinkedAccount?.id === card.id && styles.accPickerActive,
                      ]}
                      onPress={() => {
                        setEmiLinkedAccount(card);
                        setShowAccountPicker(false);
                      }}
                    >
                      <Text style={{ fontSize: 18, marginRight: 10 }}>💳</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.accPickerName}>{card.name}</Text>
                        <Text style={styles.accPickerBal}>{card.bankName || 'Credit Card'}</Text>
                      </View>
                      {emiLinkedAccount?.id === card.id && (
                        <Ionicons name="checkmark-circle" size={22} color="#6366F1" />
                      )}
                    </TouchableOpacity>
                  ))}
                  <Text style={[styles.modalSubHeader, { marginTop: 12 }]}>BANK ACCOUNTS</Text>
                </>
              )}

              {bankAccounts.map((acc) => {
                const isSelected =
                  accountPickerTarget === 'cardPay'
                    ? payFromAccount?.id === acc.id
                    : accountPickerTarget === 'emiLink'
                    ? emiLinkedAccount?.id === acc.id
                    : payEmiAccount?.id === acc.id;

                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accPickerItem, isSelected && styles.accPickerActive]}
                    onPress={() => {
                      if (accountPickerTarget === 'cardPay') setPayFromAccount(acc);
                      if (accountPickerTarget === 'emiLink') setEmiLinkedAccount(acc);
                      if (accountPickerTarget === 'emiPay') setPayEmiAccount(acc);
                      setShowAccountPicker(false);
                    }}
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
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#6366F1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================= */}
      {/* MODAL 6: CREDIT CARD BILL HISTORY                 */}
      {/* ================================================= */}
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
              {(selectedCard?.billPaymentHistory || [])
                .slice()
                .reverse()
                .map((entry, idx) => (
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
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
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
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  addHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 10 },

  // Segmented Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  activeTabBtn: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
  },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  activeTabText: { color: '#6366F1', fontWeight: '900' },

  // Credit Card View Styles
  cardContainer: { marginTop: 14, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 8 } },
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
  historyBtnText: { color: '#6366F1', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  paidBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', padding: 16, borderRadius: 20, marginTop: 8, gap: 10 },
  paidText: { fontSize: 14, fontWeight: '900', color: '#059669' },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, fontWeight: '500' },
  emptyBtn: { width: '100%', borderRadius: 18, overflow: 'hidden', marginTop: 28 },
  emptyBtnGradient: { height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  // EMI Summary Banner
  emiSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
  },
  emiSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  emiSummaryCol: { flex: 1 },
  emiSummaryLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 0.8 },
  emiSummaryValue: { fontSize: 22, fontWeight: '900', color: '#111827', marginTop: 4 },
  emiSummaryPerMonth: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  emiSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  emiPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  emiPillText: { fontSize: 12, fontWeight: '800', color: '#059669', marginLeft: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  // Filter Row
  filterRow: { marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  filterChipText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF' },

  // EMI Cards
  emiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
  },
  emiCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  emiCardTitle: { fontSize: 17, fontWeight: '900', color: '#111827' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  activePillText: { fontSize: 10, fontWeight: '900', color: '#059669', letterSpacing: 0.5 },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  completedBadgeText: { fontSize: 10, fontWeight: '900', color: '#4B5563', letterSpacing: 0.5 },
  emiLinkedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  emiLinkedText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  emiDotSep: { fontSize: 12, color: '#D1D5DB' },
  emiDebitDayText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  emiTrashBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },

  // Progress Bar
  emiProgressContainer: { marginTop: 16 },
  emiProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  emiProgressLabel: { fontSize: 12, fontWeight: '800', color: '#4B5563' },
  emiProgressPct: { fontSize: 12, fontWeight: '900', color: '#6366F1' },
  emiProgressBarBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  emiProgressBarFill: { height: 6, borderRadius: 3 },

  // Stats Grid
  emiStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
  },
  emiStatItem: { alignItems: 'center', flex: 1 },
  emiStatLabel: { fontSize: 9, fontWeight: '900', color: '#9CA3AF', letterSpacing: 0.5 },
  emiStatValue: { fontSize: 14, fontWeight: '900', color: '#111827', marginTop: 4 },

  emiNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    gap: 6,
  },
  emiNoteText: { fontSize: 11, color: '#6B7280', flex: 1 },

  maturedInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
    gap: 8,
  },
  maturedInfoText: { fontSize: 12, color: '#047857', fontWeight: '700' },

  emiActionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  emiPayBtn: { flex: 1, height: 46, borderRadius: 14, overflow: 'hidden' },
  emiPayBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  emiPayBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  emiHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 46,
    gap: 6,
  },
  emiHistoryBtnText: { color: '#6366F1', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  emiCloseBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 8 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8, marginTop: 14, paddingLeft: 2 },
  modalSubHeader: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, marginVertical: 8, paddingLeft: 4 },

  textInputBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  fieldHelpText: { fontSize: 11, color: '#9CA3AF', marginTop: 4, paddingLeft: 4 },

  tenureChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tenureChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tenureChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  tenureChipText: { fontSize: 13, fontWeight: '800', color: '#4B5563' },
  tenureChipTextActive: { color: '#FFFFFF' },

  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateSelectorText: { fontSize: 15, fontWeight: '800', color: '#111827', marginLeft: 10 },
  changeDateText: { fontSize: 13, fontWeight: '800', color: '#6366F1' },

  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 4,
    paddingVertical: 8,
  },
  optionalToggleText: { fontSize: 13, fontWeight: '800', color: '#6366F1' },
  optionalFieldsContainer: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },

  payCardInfo: { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 16, marginBottom: 16, borderLeftWidth: 4 },
  payCardName: { fontSize: 16, fontWeight: '900', color: '#111827' },
  payCardOutstanding: { fontSize: 14, color: '#EF4444', fontWeight: '800', marginTop: 4 },

  quickAmountRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quickAmountBtn: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  activeQuickBtn: { borderColor: '#6366F1', backgroundColor: '#EEF2FF', elevation: 0 },
  quickAmountLabel: { fontSize: 9, fontWeight: '900', color: '#9CA3AF' },
  quickAmountValue: { fontSize: 14, fontWeight: '900', color: '#111827', marginTop: 4 },

  amountInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', paddingLeft: 18, marginBottom: 4 },
  rupeeSign: { fontSize: 24, fontWeight: '900', color: '#111827' },
  amountInput: { flex: 1, height: 60, fontSize: 22, fontWeight: '900', color: '#111827', paddingLeft: 10 },

  accountSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04 },
  accTypeIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  accSelectorName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  accSelectorBal: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },
  accSelectorPlaceholder: { fontSize: 14, color: '#9CA3AF', fontWeight: '700' },

  payModalBtnCont: { borderRadius: 20, overflow: 'hidden', marginTop: 28, marginBottom: 10, elevation: 4, shadowColor: '#6366F1', shadowOpacity: 0.25 },
  payModalBtn: { height: 58, justifyContent: 'center', alignItems: 'center' },
  payModalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  historyHeaderInfo: { marginBottom: 16, paddingLeft: 2 },
  historyCardName: { fontSize: 18, fontWeight: '900', color: '#111827' },
  historyCardSub: { fontSize: 12, color: '#9CA3AF', fontWeight: '700', marginTop: 2 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  historyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  historyIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  historyAmountText: { fontSize: 15, fontWeight: '900', color: '#111827' },
  historyDateText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  historyTypeBadge: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textAlign: 'right' },
  historyBalText: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', textAlign: 'right', marginTop: 2 },
  historyUndoBtn: { padding: 10, backgroundColor: '#FEF2F2', borderRadius: 12 },
  noHistoryBox: { alignItems: 'center', paddingVertical: 36 },
  noHistoryText: { fontSize: 14, color: '#D1D5DB', fontWeight: '700', marginTop: 10 },

  forecloseModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  forecloseModalBtnText: { fontSize: 13, fontWeight: '800', color: '#4B5563' },
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    gap: 8,
  },
  deleteModalBtnText: { fontSize: 13, fontWeight: '800', color: '#EF4444' },

  accPickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  accPickerActive: { backgroundColor: '#EEF2FF' },
  accPickerName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  accPickerBal: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
});

export default CreditCardBillScreen;
