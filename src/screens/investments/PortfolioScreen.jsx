import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAccounts } from "../../services/accountService";
import { addExpense } from "../../services/expenseService";
import {
  addInvestment,
  addInvestmentAmount,
  calculateInvestmentTotals,
  confirmRdPayment,
  confirmSip,
  deleteInvestment,
  getInvestments,
  INVESTMENT_TYPES,
  processMaturedInvestments,
  skipSip,
  updateInvestment,
} from "../../services/investmentService";
import { getPendingSips, getPendingRdPayments } from "../../services/investmentService";

const PortfolioScreen = ({ navigation }) => {
  const [investments, setInvestments] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSips, setPendingSips] = useState([]);
  const [pendingRds, setPendingRds] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [saving, setSaving] = useState(false);

  // Modal visibility
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showSipModal, setShowSipModal] = useState(false);
  const [showAddAmountModal, setShowAddAmountModal] = useState(false);
  const [showRdPayModal, setShowRdPayModal] = useState(false);
  const [showTxnHistoryModal, setShowTxnHistoryModal] = useState(false);
  const [showEditInvestedModal, setShowEditInvestedModal] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showEditRdProgressModal, setShowEditRdProgressModal] = useState(false);
  const [pickerType, setPickerType] = useState("add"); // add, addAmount, sip, rd

  // Selected investment for modals
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [currentSipInvestment, setCurrentSipInvestment] = useState(null);

  // Add form state
  const [invName, setInvName] = useState("");
  const [invType, setInvType] = useState(INVESTMENT_TYPES[0]);
  const [invPlatform, setInvPlatform] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invCurrentValue, setInvCurrentValue] = useState("");
  const [invInterestRate, setInvInterestRate] = useState("");
  const [invNote, setInvNote] = useState("");
  const [invSipAmount, setInvSipAmount] = useState("");
  const [invSipDate, setInvSipDate] = useState("");
  const [invMaturityAmount, setInvMaturityAmount] = useState("");
  const [invMaturityDate, setInvMaturityDate] = useState("");
  // RD specific
  const [invRdMonthly, setInvRdMonthly] = useState("");
  const [invRdMonths, setInvRdMonths] = useState("");
  const [invRdPaymentDate, setInvRdPaymentDate] = useState("");
  const [invRdCompletedMonths, setInvRdCompletedMonths] = useState("0");

  // Account Selection
  const [payFromAccount, setPayFromAccount] = useState(null);

  // Update value form
  const [updateValue, setUpdateValue] = useState("");
  const [editInvestedValue, setEditInvestedValue] = useState("");

  // SIP confirmation
  const [sipConfirmAmount, setSipConfirmAmount] = useState("");

  // Universal add amount form
  const [addAmtValue, setAddAmtValue] = useState("");
  const [addAmtCurrentValue, setAddAmtCurrentValue] = useState("");
  const [addAmtNote, setAddAmtNote] = useState("");

  // RD payment form
  const [rdPayAmount, setRdPayAmount] = useState("");
  const [editRdProgressValue, setEditRdProgressValue] = useState("");

  const fetchInvestments = async () => {
    try {
      const [invResult, accResult] = await Promise.all([
        getInvestments(),
        getAccounts(),
      ]);

      if (invResult.success) {
        setInvestments(invResult.investments);
        setTotals(calculateInvestmentTotals(invResult.investments));
        setPendingSips(getPendingSips(invResult.investments));
        setPendingRds(getPendingRdPayments(invResult.investments));

        // Process automatic maturity credits if any
        const maturityRes = await processMaturedInvestments(
          invResult.investments,
        );
        if (maturityRes.success && maturityRes.processed > 0) {
          // Refresh investments if any were matured/credited
          const refreshedInv = await getInvestments();
          if (refreshedInv.success) {
            setInvestments(refreshedInv.investments);
            setTotals(calculateInvestmentTotals(refreshedInv.investments));
          }
          Alert.alert(
            "🎉 Maturity Credited",
            `${maturityRes.processed} investment(s) matured and credited to your account.`,
          );
        }
      }

      if (accResult.success) {
        setBankAccounts(
          accResult.accounts.filter(
            (a) => a.type === "BANK" || a.type === "CASH",
          ),
        );
      }
    } catch (error) {
      console.log("❌ Fetch investments error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Watch for maturity calculation changes
  useEffect(() => {
    if (invType.id === "rd" && invRdMonthly && invInterestRate && invRdMonths) {
      const matureVal = getCalculatedMaturity(
        "rd",
        invRdMonthly,
        invInterestRate,
        invRdMonths,
      );
      if (matureVal) setInvMaturityAmount(matureVal);
    } else if (
      invType.id === "fd" &&
      invAmount &&
      invInterestRate &&
      invRdMonths
    ) {
      // invRdMonths used for tenure in months
      const matureVal = getCalculatedMaturity(
        "fd",
        invAmount,
        invInterestRate,
        invRdMonths,
      );
      if (matureVal) setInvMaturityAmount(matureVal);
    }
  }, [invType, invRdMonthly, invAmount, invInterestRate, invRdMonths]);

  useFocusEffect(
    useCallback(() => {
      fetchInvestments();
    }, []),
  );

  const resetForm = () => {
    setInvName("");
    setInvPlatform("");
    setInvAmount("");
    setInvCurrentValue("");
    setInvInterestRate("");
    setInvNote("");
    setInvSipAmount("");
    setInvSipDate("");
    setInvMaturityAmount("");
    setInvMaturityDate("");
    setInvRdMonthly("");
    setInvRdMonths("");
    setInvRdPaymentDate("");
    setInvRdCompletedMonths("0");
    setInvType(INVESTMENT_TYPES[0]);
    setPayFromAccount(null);
  };

  const parseMaturityDate = (ddmmyyyy) => {
    if (!ddmmyyyy || !ddmmyyyy.includes("/")) return ddmmyyyy;
    const [d, m, y] = ddmmyyyy.split("/");
    if (!d || !m || !y) return ddmmyyyy;
    return new Date(`${y}-${m}-${d}`).toISOString();
  };

  // ── ADD INVESTMENT ──
  const handleAdd = async () => {
    if (!invName.trim()) {
      Alert.alert("Required", "Enter investment name");
      return;
    }

    // RD validation
    if (invType.id === "rd") {
      if (!invRdMonthly || parseFloat(invRdMonthly) <= 0) {
        Alert.alert("Required", "Enter monthly RD amount");
        return;
      }
      if (!invRdMonths || parseInt(invRdMonths) <= 0) {
        Alert.alert("Required", "Enter total number of months");
        return;
      }
    } else {
      if (!invAmount || parseFloat(invAmount) <= 0) {
        Alert.alert("Required", "Enter invested amount");
        return;
      }
    }

    setSaving(true);
    try {
      let expenseId = null;
      const amountToPay =
        invType.id === "rd"
          ? 0 // Already paid months of RD are not deducted on initial creation
          : parseFloat(invAmount) || 0;

      // 1. Record expense if paying from account
      if (payFromAccount && amountToPay > 0) {
        const expRes = await addExpense({
          amount: amountToPay,
          categoryId: "investment",
          categoryName: "Investment",
          categoryIcon: invType.icon,
          accountId: payFromAccount.id,
          accountName: payFromAccount.name,
          paymentMode: payFromAccount.type,
          note: `Investment: ${invName}`,
          date: new Date().toISOString(),
        });
        if (expRes.success) expenseId = expRes.id;
      }

      // 2. Add investment
      const result = await addInvestment({
        name: invName,
        type: invType.id,
        typeName: invType.name,
        typeIcon: invType.icon,
        platform: invPlatform,
        investedAmount:
          invType.id === "rd"
            ? parseFloat(invRdMonthly) * (parseInt(invRdCompletedMonths) || 0)
            : invAmount,
        currentValue:
          invType.id === "rd"
            ? parseFloat(invRdMonthly) * (parseInt(invRdCompletedMonths) || 0)
            : invCurrentValue || invAmount,
        interestRate: invInterestRate,
        note: invNote,
        sipAmount: invSipAmount,
        sipDate: invSipDate,
        maturityAmount: invMaturityAmount,
        maturityDate: parseMaturityDate(invMaturityDate),
        rdMonthlyAmount: invRdMonthly,
        rdTotalMonths: invRdMonths,
        rdPaymentDate: invRdPaymentDate || "1",
        rdCompletedMonths: parseInt(invRdCompletedMonths) || 0,
        expenseId,
        paidFromAccountId: payFromAccount?.id,
      });

      if (result.success) {
        setShowAddModal(false);
        resetForm();
        fetchInvestments();
      } else {
        Alert.alert("Error", result.error);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  // ── HELPER: CALCULATE MATURITY ──
  const getCalculatedMaturity = (type, amount, rate, tenure) => {
    if (!amount || !rate || !tenure) return "";
    const P = parseFloat(amount);
    const r = parseFloat(rate) / 100;
    const n = 4; // Quarterly compounding
    const t = parseInt(tenure);

    if (type === "fd") {
      // FD: A = P(1+r/n)^(n*t/12)
      const A = P * Math.pow(1 + r / n, (n * t) / 12);
      return Math.round(A).toString();
    } else if (type === "rd") {
      // RD: M = P * ((1+r/n)^(n*t/12) - 1) / (1 - (1+r/n)^(-1/3))
      const i = r / n;
      const M =
        (P * (Math.pow(1 + i, (n * t) / 12) - 1)) /
        (1 - Math.pow(1 + i, -1 / 3));
      return Math.round(M).toString();
    }
    return "";
  };

  // ── UPDATE CURRENT VALUE ──
  const handleUpdateValue = async () => {
    if (!updateValue || parseFloat(updateValue) < 0) {
      Alert.alert("Required", "Enter valid current value");
      return;
    }
    setSaving(true);
    const result = await updateInvestment(editingInvestment.id, {
      currentValue: updateValue,
    });
    if (result.success) {
      setShowUpdateModal(false);
      setEditingInvestment(null);
      fetchInvestments();
    } else {
      Alert.alert("Error", result.error);
    }
    setSaving(false);
  };

  // ── EDIT INVESTED AMOUNT ──
  const handleEditInvested = async () => {
    if (!editInvestedValue || parseFloat(editInvestedValue) < 0) {
      Alert.alert("Required", "Enter valid invested amount");
      return;
    }
    setSaving(true);
    const result = await updateInvestment(editingInvestment.id, {
      investedAmount: editInvestedValue,
    });
    if (result.success) {
      setShowEditInvestedModal(false);
      setEditingInvestment(null);
      fetchInvestments();
    } else {
      Alert.alert("Error", result.error);
    }
    setSaving(false);
  };

  // ── EDIT RD PROGRESS ──
  const handleEditRdProgress = async () => {
    if (!editRdProgressValue || parseInt(editRdProgressValue) < 0) {
      Alert.alert("Required", "Enter valid month count");
      return;
    }
    setSaving(true);
    const newMonths = parseInt(editRdProgressValue);
    const newInvested = (editingInvestment.rdMonthlyAmount || 0) * newMonths;

    const result = await updateInvestment(editingInvestment.id, {
      rdCompletedMonths: newMonths,
      investedAmount: newInvested,
      currentValue: newInvested,
    });
    if (result.success) {
      setShowEditRdProgressModal(false);
      setEditingInvestment(null);
      fetchInvestments();
    } else {
      Alert.alert("Error", result.error);
    }
    setSaving(false);
  };

  // ── ADD INVESTMENT AMOUNT (UNIVERSAL) ──
  const handleAddAmount = async () => {
    if (!addAmtValue || parseFloat(addAmtValue) <= 0) {
      Alert.alert("Required", "Enter amount invested");
      return;
    }
    setSaving(true);
    try {
      let expenseId = null;
      if (payFromAccount) {
        const expRes = await addExpense({
          amount: addAmtValue,
          categoryId: "investment",
          categoryName: "Investment",
          categoryIcon: editingInvestment.typeIcon || "💰",
          accountId: payFromAccount.id,
          accountName: payFromAccount.name,
          paymentMode: payFromAccount.type,
          note: `Top-up: ${editingInvestment.name}`,
          date: new Date().toISOString(),
        });
        if (expRes.success) expenseId = expRes.id;
      }

      const result = await addInvestmentAmount(
        editingInvestment.id,
        addAmtValue,
        addAmtCurrentValue || null,
        addAmtNote,
      );
      if (result.success) {
        setShowAddAmountModal(false);
        setAddAmtValue("");
        setAddAmtCurrentValue("");
        setAddAmtNote("");
        setEditingInvestment(null);
        setPayFromAccount(null);
        fetchInvestments();
        Alert.alert(
          "✅ Amount Added",
          `₹${parseFloat(addAmtValue).toLocaleString("en-IN")} added`,
        );
      } else {
        Alert.alert("Error", result.error);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  // ── CONFIRM SIP ──
  const handleSipConfirm = async () => {
    if (!sipConfirmAmount || parseFloat(sipConfirmAmount) <= 0) {
      Alert.alert("Required", "Enter SIP amount");
      return;
    }
    setSaving(true);
    try {
      if (payFromAccount) {
        await addExpense({
          amount: sipConfirmAmount,
          categoryId: "investment",
          categoryName: "Investment",
          categoryIcon: "📊",
          accountId: payFromAccount.id,
          accountName: payFromAccount.name,
          paymentMode: payFromAccount.type,
          note: `SIP: ${currentSipInvestment.name}`,
          date: new Date().toISOString(),
        });
      }

      const result = await confirmSip(
        currentSipInvestment.id,
        sipConfirmAmount,
        currentSipInvestment.investedAmount,
      );
      if (result.success) {
        setShowSipModal(false);
        setCurrentSipInvestment(null);
        setSipConfirmAmount("");
        setPayFromAccount(null);
        fetchInvestments();
        Alert.alert(
          "✅ SIP Confirmed",
          `₹${parseFloat(sipConfirmAmount).toLocaleString("en-IN")} added`,
        );
      } else {
        Alert.alert("Error", result.error);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSipSkip = () => {
    Alert.alert(
      "Skip SIP",
      `Skip this month's SIP for "${currentSipInvestment.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            const result = await skipSip(currentSipInvestment.id);
            if (result.success) {
              setShowSipModal(false);
              setCurrentSipInvestment(null);
              setSipConfirmAmount("");
              fetchInvestments();
            }
            setSaving(false);
          },
        },
      ],
    );
  };

  // ── CONFIRM RD PAYMENT ──
  const handleRdPayment = async () => {
    if (!rdPayAmount || parseFloat(rdPayAmount) <= 0) {
      Alert.alert("Required", "Enter payment amount");
      return;
    }
    setSaving(true);
    try {
      if (payFromAccount) {
        await addExpense({
          amount: rdPayAmount,
          categoryId: "other",
          categoryName: "Investment",
          categoryIcon: "🔄",
          accountId: payFromAccount.id,
          accountName: payFromAccount.name,
          paymentMode: payFromAccount.type,
          note: `RD Payment: ${editingInvestment.name}`,
          date: new Date().toISOString(),
        });
      }

      const result = await confirmRdPayment(editingInvestment.id, rdPayAmount);
      if (result.success) {
        setShowRdPayModal(false);
        setRdPayAmount("");
        setEditingInvestment(null);
        setPayFromAccount(null);
        fetchInvestments();
        if (result.isComplete) {
          Alert.alert(
            "🎉 RD Complete!",
            `All ${result.totalMonths} months completed! Your RD has matured.`,
          );
        } else {
          Alert.alert(
            "✅ RD Payment",
            `Month ${result.completedMonths}/${result.totalMonths} paid successfully`,
          );
        }
      } else {
        Alert.alert("Error", result.error);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE ──
  const handleDelete = (inv) => {
    Alert.alert("Delete", `Remove "${inv.name}" from portfolio?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await deleteInvestment(inv.id);
          if (result.success) fetchInvestments();
        },
      },
    ]);
  };

  // ── OPEN MODALS ──
  const openInvestmentActions = (inv) => {
    setEditingInvestment(inv);
    // Show action sheet based on type
    const actions = [
      { text: "Cancel", style: "cancel" },
      {
        text: "📈 Update Current Value",
        onPress: () => {
          setUpdateValue(inv.currentValue?.toString() || "");
          setShowUpdateModal(true);
        },
      },
      {
        text: "💰 Add Investment Amount",
        onPress: () => {
          setAddAmtValue("");
          setAddAmtCurrentValue("");
          setAddAmtNote("");
          setShowAddAmountModal(true);
        },
      },
      {
        text: "✏️ Edit Invested Amount",
        onPress: () => {
          setEditInvestedValue(inv.investedAmount?.toString() || "");
          setShowEditInvestedModal(true);
        },
      },
    ];

    if (inv.type === "rd") {
      actions.push({
        text: "🔃 Update RD Progress",
        onPress: () => {
          setEditRdProgressValue((inv.rdCompletedMonths || 0).toString());
          setShowEditRdProgressModal(true);
        },
      });

      const completed = inv.rdCompletedMonths || 0;
      const total = inv.rdTotalMonths || 0;
      if (!total || completed < total) {
        actions.push({
          text: `🔄 Pay RD Month ${completed + 1}`,
          onPress: () => {
            setRdPayAmount((inv.rdMonthlyAmount || "").toString());
            setShowRdPayModal(true);
          },
        });
      }
    }

    if ((inv.transactions || []).length > 0) {
      actions.push({
        text: "📋 View Transaction History",
        onPress: () => setShowTxnHistoryModal(true),
      });
    }

    Alert.alert(
      inv.name,
      `${inv.typeName} • ${inv.platform || "No platform"}`,
      actions,
    );
  };

  const openSipConfirmation = (inv) => {
    setCurrentSipInvestment(inv);
    setSipConfirmAmount(inv.sipAmount?.toString() || "");
    setShowSipModal(true);
  };

  const openRdPayment = (inv) => {
    setEditingInvestment(inv);
    setRdPayAmount((inv.rdMonthlyAmount || "").toString());
    setShowRdPayModal(true);
  };

  const getReturnsColor = (invested, current) => {
    if (current > invested) return "#10B981";
    if (current < invested) return "#EF4444";
    return "#6B7280";
  };

  const formatMaturityDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Field visibility based on type
  const showSipFields = invType.id === "mutual_fund";
  const showRdFields = invType.id === "rd";
  const showFdFields = invType.id === "fd";
  const showMaturityCalculationSection = ["fd", "rd"].includes(invType.id);
  const showGenericInterestRate = ["ppf", "nps", "bonds"].includes(invType.id);
  const showMaturityDateOnly = ["ppf", "nps", "bonds"].includes(invType.id);
  const showInvestedAmount = invType.id !== "rd";
  const showCurrentValue = invType.id !== "rd";

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portfolio</Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={24} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchInvestments();
            }}
            colors={["#6C63FF"]}
          />
        }
      >
        {investments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>No investments tracked</Text>
            <Text style={styles.emptyText}>
              Add your mutual funds, FDs, stocks & more
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyBtnText}>+ Add Investment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ===== PENDING ALERTS ===== */}
            {(pendingSips.length > 0 || pendingRds.length > 0) && (
              <View style={styles.alertContainer}>
                <View style={styles.alertHeader}>
                  <Ionicons name="notifications" size={18} color="#F59E0B" />
                  <Text style={styles.alertTitle}>
                    Actions Due ({pendingSips.length + pendingRds.length})
                  </Text>
                </View>

                {/* Pending SIPs */}
                {pendingSips.map((inv) => (
                  <TouchableOpacity
                    key={`sip-${inv.id}`}
                    style={styles.alertItem}
                    onPress={() => openSipConfirmation(inv)}
                  >
                    <View style={styles.alertItemIcon}>
                      <Text style={{ fontSize: 16 }}>📊</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertItemName}>{inv.name}</Text>
                      <Text style={styles.alertItemSub}>
                        SIP: ₹{(inv.sipAmount || 0).toLocaleString("en-IN")} •
                        Due on {inv.sipDate}th
                      </Text>
                    </View>
                    <View style={styles.alertActionBtn}>
                      <Text style={styles.alertActionText}>Confirm</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Pending RD Payments */}
                {pendingRds.map((inv) => (
                  <TouchableOpacity
                    key={`rd-${inv.id}`}
                    style={styles.alertItem}
                    onPress={() => openRdPayment(inv)}
                  >
                    <View style={styles.alertItemIcon}>
                      <Text style={{ fontSize: 16 }}>🔄</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertItemName}>{inv.name}</Text>
                      <Text style={styles.alertItemSub}>
                        RD: ₹
                        {(inv.rdMonthlyAmount || 0).toLocaleString("en-IN")} •
                        Month {(inv.rdCompletedMonths || 0) + 1}/
                        {inv.rdTotalMonths || "?"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.alertActionBtn,
                        { backgroundColor: "#14B8A6" },
                      ]}
                    >
                      <Text style={styles.alertActionText}>Pay</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
              <Text style={styles.summaryAmount}>
                ₹{(totals?.totalCurrentValue || 0).toLocaleString("en-IN")}
              </Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Invested</Text>
                  <Text style={styles.summaryItemValue}>
                    ₹{(totals?.totalInvested || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Returns</Text>
                  <Text
                    style={[
                      styles.summaryItemValue,
                      {
                        color:
                          (totals?.totalReturns || 0) >= 0
                            ? "#10B981"
                            : "#EF4444",
                      },
                    ]}
                  >
                    {(totals?.totalReturns || 0) >= 0 ? "+" : ""}₹
                    {(totals?.totalReturns || 0).toLocaleString("en-IN")} (
                    {totals?.returnPercent || 0}%)
                  </Text>
                </View>
              </View>
            </View>

            {/* Type Breakdown */}
            {totals?.byType?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>By Type</Text>
                {totals.byType.map((t) => {
                  const percent =
                    totals.totalCurrentValue > 0
                      ? (t.currentValue / totals.totalCurrentValue) * 100
                      : 0;
                  return (
                    <View key={t.type} style={styles.typeRow}>
                      <Text style={styles.typeIcon}>{t.typeIcon}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={styles.typeNameRow}>
                          <Text style={styles.typeName} numberOfLines={1}>
                            {t.typeName}
                          </Text>
                          <Text style={styles.typeAmount}>
                            ₹{t.currentValue.toLocaleString("en-IN")}
                          </Text>
                        </View>
                        <View style={styles.typeBarBg}>
                          <View
                            style={[
                              styles.typeBarFill,
                              { width: `${Math.min(percent, 100)}%` },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.typePercent}>
                        {Math.round(percent)}%
                      </Text>
                    </View>
                  );
                })}
              </>
            )}

            {/* All Investments */}
            <Text style={styles.sectionTitle}>
              All Investments ({investments.length})
            </Text>
            {investments.map((inv) => {
              const returns =
                (inv.currentValue || 0) - (inv.investedAmount || 0);
              const returnPct =
                inv.investedAmount > 0
                  ? ((returns / inv.investedAmount) * 100).toFixed(1)
                  : 0;
              const retColor = getReturnsColor(
                inv.investedAmount,
                inv.currentValue,
              );
              const hasSip = inv.type === "mutual_fund" && inv.sipAmount;
              const isRd = inv.type === "rd";
              const hasMaturity =
                ["fd", "rd"].includes(inv.type) &&
                (inv.maturityAmount || inv.maturityDate);
              const txnCount = (inv.transactions || []).length;

              return (
                <TouchableOpacity
                  key={inv.id}
                  style={styles.invCard}
                  onPress={() => openInvestmentActions(inv)}
                  onLongPress={() => handleDelete(inv)}
                >
                  <View style={styles.invHeader}>
                    <Text style={styles.invIcon}>{inv.typeIcon || "📊"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invName}>{inv.name}</Text>
                      <Text style={styles.invMeta}>
                        {inv.typeName}
                        {inv.platform ? ` • ${inv.platform}` : ""}
                      </Text>
                    </View>
                    {!inv.isActive && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Completed</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.invBody}>
                    <TouchableOpacity
                      style={styles.invCol}
                      onPress={() => {
                        setEditingInvestment(inv);
                        setEditInvestedValue(
                          inv.investedAmount?.toString() || "",
                        );
                        setShowEditInvestedModal(true);
                      }}
                    >
                      <Text style={styles.invColLabel}>Invested</Text>
                      <Text style={styles.invColValue}>
                        ₹{(inv.investedAmount || 0).toLocaleString("en-IN")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.invCol}
                      onPress={() => {
                        setEditingInvestment(inv);
                        setUpdateValue(inv.currentValue?.toString() || "");
                        setShowUpdateModal(true);
                      }}
                    >
                      <Text style={styles.invColLabel}>Current</Text>
                      <Text style={styles.invColValue}>
                        ₹{(inv.currentValue || 0).toLocaleString("en-IN")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.invCol, { alignItems: "flex-end" }]}>
                      <Text style={styles.invColLabel}>Returns</Text>
                      <Text style={[styles.invColValue, { color: retColor }]}>
                        {returns >= 0 ? "+" : ""}₹
                        {returns.toLocaleString("en-IN")}
                      </Text>
                      <Text style={[styles.invReturnPct, { color: retColor }]}>
                        ({returnPct}%)
                      </Text>
                    </View>
                  </View>

                  {/* SIP Info */}
                  {hasSip && (
                    <View style={styles.extraInfoRow}>
                      <Ionicons name="repeat" size={14} color="#6C63FF" />
                      <Text style={styles.extraInfoText}>
                        SIP: ₹{(inv.sipAmount || 0).toLocaleString("en-IN")} on{" "}
                        {inv.sipDate}th monthly
                      </Text>
                    </View>
                  )}

                  {/* RD Progress */}
                  {isRd && inv.rdTotalMonths && (
                    <View style={styles.extraInfoRow}>
                      <Ionicons name="calendar" size={14} color="#14B8A6" />
                      <Text style={styles.extraInfoText}>
                        RD: ₹
                        {(inv.rdMonthlyAmount || 0).toLocaleString("en-IN")}
                        /month • {inv.rdCompletedMonths || 0}/
                        {inv.rdTotalMonths} months
                      </Text>
                      <View style={styles.rdProgressBg}>
                        <View
                          style={[
                            styles.rdProgressFill,
                            {
                              width: `${Math.min(((inv.rdCompletedMonths || 0) / inv.rdTotalMonths) * 100, 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Maturity Info */}
                  {hasMaturity && (
                    <View style={styles.extraInfoRow}>
                      <Ionicons name="flag" size={14} color="#3B82F6" />
                      <Text style={styles.extraInfoText}>
                        {inv.maturityAmount
                          ? `Maturity: ₹${parseFloat(inv.maturityAmount).toLocaleString("en-IN")}`
                          : ""}
                        {inv.maturityAmount && inv.maturityDate ? " • " : ""}
                        {inv.maturityDate
                          ? `Due: ${formatMaturityDate(inv.maturityDate)}`
                          : ""}
                      </Text>
                    </View>
                  )}

                  {/* Interest Rate */}
                  {inv.interestRate && (
                    <View style={styles.extraInfoRow}>
                      <Ionicons name="trending-up" size={14} color="#10B981" />
                      <Text style={styles.extraInfoText}>
                        Interest: {inv.interestRate}% p.a.
                      </Text>
                    </View>
                  )}

                  {/* Transaction count */}
                  {txnCount > 0 && (
                    <View style={styles.extraInfoRow}>
                      <Ionicons name="list" size={14} color="#9CA3AF" />
                      <Text style={styles.extraInfoText}>
                        {txnCount} transaction(s) recorded
                      </Text>
                    </View>
                  )}

                  {inv.note ? (
                    <Text style={styles.invNote}>{inv.note}</Text>
                  ) : null}

                  {/* Quick Action Buttons on Card */}
                  <View style={styles.invActions}>
                    <TouchableOpacity
                      style={styles.invActionBtn}
                      onPress={() => {
                        setEditingInvestment(inv);
                        setEditInvestedValue(
                          inv.investedAmount?.toString() || "",
                        );
                        setShowEditInvestedModal(true);
                      }}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={16}
                        color="#3B82F6"
                      />
                      <Text
                        style={[styles.invActionText, { color: "#3B82F6" }]}
                      >
                        Edit Invested
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.invActionBtn}
                      onPress={() => {
                        setEditingInvestment(inv);
                        setAddAmtValue("");
                        setAddAmtCurrentValue("");
                        setAddAmtNote("");
                        setShowAddAmountModal(true);
                      }}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={16}
                        color="#6C63FF"
                      />
                      <Text style={styles.invActionText}>Add Amount</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.invActionBtn}
                      onPress={() => {
                        setEditingInvestment(inv);
                        setUpdateValue(inv.currentValue?.toString() || "");
                        setShowUpdateModal(true);
                      }}
                    >
                      <Ionicons
                        name="create-outline"
                        size={16}
                        color="#10B981"
                      />
                      <Text
                        style={[styles.invActionText, { color: "#10B981" }]}
                      >
                        Update Value
                      </Text>
                    </TouchableOpacity>

                    {isRd &&
                      inv.rdTotalMonths &&
                      (inv.rdCompletedMonths || 0) < inv.rdTotalMonths && (
                        <TouchableOpacity
                          style={[
                            styles.invActionBtn,
                            { backgroundColor: "#F0FDFA" },
                          ]}
                          onPress={() => openRdPayment(inv)}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color="#14B8A6"
                          />
                          <Text
                            style={[styles.invActionText, { color: "#14B8A6" }]}
                          >
                            Pay RD
                          </Text>
                        </TouchableOpacity>
                      )}
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.hint}>
              Tap for actions • Long press to delete
            </Text>
          </>
        )}
      </ScrollView>

      {/* ============ ADD INVESTMENT MODAL ============ */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 30 }}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Add Investment</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowAddModal(false);
                        resetForm();
                      }}
                    >
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {/* Type */}
                  <Text style={styles.modalLabel}>Type</Text>
                  <TouchableOpacity
                    style={styles.typeSelector}
                    onPress={() => setShowTypeModal(true)}
                  >
                    <Text style={styles.typeSelectorIcon}>{invType.icon}</Text>
                    <Text style={styles.typeSelectorText} numberOfLines={1}>
                      {invType.name}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  {/* Name */}
                  <Text style={styles.modalLabel}>Investment Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., HDFC Midcap Fund, SBI FD"
                    placeholderTextColor="#9CA3AF"
                    value={invName}
                    onChangeText={setInvName}
                  />

                  {/* Platform */}
                  <Text style={styles.modalLabel}>Platform (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Groww, Zerodha, Bank"
                    placeholderTextColor="#9CA3AF"
                    value={invPlatform}
                    onChangeText={setInvPlatform}
                  />

                  {/* === RD SPECIFIC FIELDS === */}
                  {showRdFields && (
                    <>
                      <View style={styles.sectionDivider}>
                        <View style={styles.sectionDividerLine} />
                        <Text style={styles.sectionDividerText}>
                          RD Details
                        </Text>
                        <View style={styles.sectionDividerLine} />
                      </View>

                      <Text style={styles.modalLabel}>Monthly Amount *</Text>
                      <View style={styles.modalAmountRow}>
                        <Text style={styles.modalRupee}>₹</Text>
                        <TextInput
                          style={styles.modalAmountInput}
                          placeholder="5000"
                          placeholderTextColor="#D1D5DB"
                          value={invRdMonthly}
                          onChangeText={(v) =>
                            setInvRdMonthly(v.replace(/[^0-9]/g, ""))
                          }
                          keyboardType="numeric"
                        />
                      </View>

                      <Text style={styles.modalLabel}>Total Months *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g., 12, 24, 36, 60"
                        placeholderTextColor="#9CA3AF"
                        value={invRdMonths}
                        onChangeText={(v) =>
                          setInvRdMonths(v.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="numeric"
                        maxLength={3}
                      />

                      <Text style={styles.modalLabel}>
                        Already Completed Months
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={invRdCompletedMonths}
                        onChangeText={(v) =>
                          setInvRdCompletedMonths(v.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="numeric"
                        maxLength={3}
                      />

                      <Text style={styles.modalLabel}>
                        Payment Date (Day of month)
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g., 5 (for 5th of every month)"
                        placeholderTextColor="#9CA3AF"
                        value={invRdPaymentDate}
                        onChangeText={(v) => {
                          const cleaned = v.replace(/[^0-9]/g, "");
                          if (
                            cleaned === "" ||
                            (parseInt(cleaned) >= 1 && parseInt(cleaned) <= 31)
                          )
                            setInvRdPaymentDate(cleaned);
                        }}
                        keyboardType="numeric"
                        maxLength={2}
                      />

                      {invRdMonthly && invRdMonths && (
                        <View style={styles.rdSummaryBox}>
                          <Text style={styles.rdSummaryText}>
                            Total deposit: ₹
                            {(
                              parseFloat(invRdMonthly) * parseInt(invRdMonths)
                            ).toLocaleString("en-IN")}{" "}
                            over {invRdMonths} months
                          </Text>
                          {parseInt(invRdCompletedMonths) > 0 && (
                            <Text
                              style={[
                                styles.rdSummaryText,
                                { marginTop: 4, color: "#0369A1" },
                              ]}
                            >
                              Initial Invested: ₹
                              {(
                                parseFloat(invRdMonthly) *
                                parseInt(invRdCompletedMonths)
                              ).toLocaleString("en-IN")}{" "}
                              ({invRdCompletedMonths} months)
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  )}

                  {/* Invested Amount (non-RD) */}
                  {showInvestedAmount && (
                    <>
                      <Text style={styles.modalLabel}>Invested Amount *</Text>
                      <View style={styles.modalAmountRow}>
                        <Text style={styles.modalRupee}>₹</Text>
                        <TextInput
                          style={styles.modalAmountInput}
                          placeholder="50000"
                          placeholderTextColor="#D1D5DB"
                          value={invAmount}
                          onChangeText={(v) =>
                            setInvAmount(v.replace(/[^0-9]/g, ""))
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    </>
                  )}

                  {/* Current Value (non-RD) */}
                  {showCurrentValue && (
                    <>
                      <Text style={styles.modalLabel}>Current Value</Text>
                      <View style={styles.modalAmountRow}>
                        <Text style={styles.modalRupee}>₹</Text>
                        <TextInput
                          style={styles.modalAmountInput}
                          placeholder="Same as invested"
                          placeholderTextColor="#D1D5DB"
                          value={invCurrentValue}
                          onChangeText={(v) =>
                            setInvCurrentValue(v.replace(/[^0-9]/g, ""))
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    </>
                  )}

                  {/* SIP Fields (Mutual Funds) */}
                  {showSipFields && (
                    <>
                      <View style={styles.sectionDivider}>
                        <View style={styles.sectionDividerLine} />
                        <Text style={styles.sectionDividerText}>
                          SIP Details
                        </Text>
                        <View style={styles.sectionDividerLine} />
                      </View>
                      <Text style={styles.modalLabel}>Monthly SIP Amount</Text>
                      <View style={styles.modalAmountRow}>
                        <Text style={styles.modalRupee}>₹</Text>
                        <TextInput
                          style={styles.modalAmountInput}
                          placeholder="5000"
                          placeholderTextColor="#D1D5DB"
                          value={invSipAmount}
                          onChangeText={(v) =>
                            setInvSipAmount(v.replace(/[^0-9]/g, ""))
                          }
                          keyboardType="numeric"
                        />
                      </View>
                      <Text style={styles.modalLabel}>
                        SIP Date (Day of month)
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g., 5"
                        placeholderTextColor="#9CA3AF"
                        value={invSipDate}
                        onChangeText={(v) => {
                          const cleaned = v.replace(/[^0-9]/g, "");
                          if (
                            cleaned === "" ||
                            (parseInt(cleaned) >= 1 && parseInt(cleaned) <= 31)
                          )
                            setInvSipDate(cleaned);
                        }}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                      <Text style={styles.fieldHint}>
                        You'll be reminded to confirm your SIP on this date each
                        month
                      </Text>
                    </>
                  )}

                  {/* Generic Interest Rate & Maturity (for PPF, NPS, Bonds, etc.) */}
                  {showGenericInterestRate && (
                    <>
                      <Text style={styles.modalLabel}>
                        Interest Rate (% p.a.)
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="7.5"
                        placeholderTextColor="#9CA3AF"
                        value={invInterestRate}
                        onChangeText={setInvInterestRate}
                        keyboardType="numeric"
                      />

                      {showMaturityDateOnly && (
                        <>
                          <Text style={styles.modalLabel}>
                            {invType.id === "nps"
                              ? "Retirement / Maturity Date"
                              : "Maturity Date"}
                          </Text>
                          <TextInput
                            style={styles.modalInput}
                            placeholder="DD/MM/YYYY"
                            placeholderTextColor="#9CA3AF"
                            value={invMaturityDate}
                            onChangeText={setInvMaturityDate}
                          />
                        </>
                      )}
                    </>
                  )}

                  {/* Maturity & Calculation Section (FD/RD) */}
                  {showMaturityCalculationSection && (
                    <>
                      <View style={styles.sectionDivider}>
                        <View style={styles.sectionDividerLine} />
                        <Text style={styles.sectionDividerText}>
                          Maturity Details
                        </Text>
                        <View style={styles.sectionDividerLine} />
                      </View>

                      <Text style={styles.modalLabel}>
                        Interest Rate (% p.a.) *
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g., 7.1"
                        placeholderTextColor="#9CA3AF"
                        value={invInterestRate}
                        onChangeText={setInvInterestRate}
                        keyboardType="numeric"
                      />

                      {invType.id === "fd" && (
                        <>
                          <Text style={styles.modalLabel}>
                            Tenure (Months) *
                          </Text>
                          <TextInput
                            style={styles.modalInput}
                            placeholder="e.g., 12, 24"
                            placeholderTextColor="#9CA3AF"
                            value={invRdMonths}
                            onChangeText={(v) =>
                              setInvRdMonths(v.replace(/[^0-9]/g, ""))
                            }
                            keyboardType="numeric"
                          />
                        </>
                      )}

                      <Text style={styles.modalLabel}>
                        Estimated Maturity Amount
                      </Text>
                      <View style={styles.modalAmountRow}>
                        <Text style={styles.modalRupee}>₹</Text>
                        <TextInput
                          style={styles.modalAmountInput}
                          placeholder="Expected payoff"
                          placeholderTextColor="#D1D5DB"
                          value={invMaturityAmount}
                          onChangeText={(v) =>
                            setInvMaturityAmount(v.replace(/[^0-9]/g, ""))
                          }
                          keyboardType="numeric"
                        />
                      </View>
                      {invInterestRate && invMaturityAmount && (
                        <Text
                          style={[
                            styles.fieldHint,
                            { color: "#059669", marginBottom: 10 },
                          ]}
                        >
                          Auto-calculated based on interest rate
                        </Text>
                      )}

                      <Text style={styles.modalLabel}>
                        Maturity Date (optional)
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="DD/MM/YYYY"
                        placeholderTextColor="#9CA3AF"
                        value={invMaturityDate}
                        onChangeText={setInvMaturityDate}
                      />
                    </>
                  )}

                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} />
                    <Text style={styles.sectionDividerText}>
                      Payment Source
                    </Text>
                    <View style={styles.sectionDividerLine} />
                  </View>
                  <Text style={styles.modalLabel}>Deduct from Asset</Text>
                  <TouchableOpacity
                    style={styles.typeSelector}
                    onPress={() => {
                      setPickerType("add");
                      setShowAccountPicker(true);
                    }}
                  >
                    <Ionicons
                      name={payFromAccount ? "wallet" : "business"}
                      size={20}
                      color={payFromAccount ? "#6C63FF" : "#9CA3AF"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeSelectorText,
                        !payFromAccount && { color: "#9CA3AF" },
                      ]}
                      numberOfLines={1}
                    >
                      {payFromAccount
                        ? payFromAccount.name
                        : "Select bank or cash (optional)"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                  {payFromAccount && (
                    <View>
                      <Text style={styles.fieldHint}>
                        {invType.id === "rd"
                          ? "Source saved for future payments (initial progress is not deducted)."
                          : "Balance will be deducted and an expense will be recorded."}
                      </Text>
                      {showMaturityCalculationSection && (
                        <Text
                          style={[
                            styles.fieldHint,
                            { color: "#059669", marginTop: 4 },
                          ]}
                        >
                          💡 On completion of maturity, ₹
                          {invMaturityAmount || "the amount"} will be
                          automatically credited to {payFromAccount.name}.
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Note */}
                  <Text style={styles.modalLabel}>Note (optional)</Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { height: 60, textAlignVertical: "top" },
                    ]}
                    placeholder="Any details..."
                    placeholderTextColor="#9CA3AF"
                    value={invNote}
                    onChangeText={setInvNote}
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleAdd}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSaveBtnText}>
                        Add Investment
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ TYPE PICKER ============ */}
      <Modal visible={showTypeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Investment Type</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {INVESTMENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typeOption,
                    invType.id === t.id && {
                      backgroundColor: t.color + "15",
                      borderColor: t.color,
                    },
                  ]}
                  onPress={() => {
                    setInvType(t);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={styles.typeOptionIcon}>{t.icon}</Text>
                  <Text style={styles.typeOptionName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  {invType.id === t.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={t.color}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============ UPDATE VALUE MODAL ============ */}
      <Modal visible={showUpdateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: "45%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Update Current Value</Text>
                    <TouchableOpacity onPress={() => setShowUpdateModal(false)}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.updateInvName}>
                    {editingInvestment?.name}
                  </Text>
                  <Text style={styles.updateInvMeta}>
                    Invested: ₹
                    {(editingInvestment?.investedAmount || 0).toLocaleString(
                      "en-IN",
                    )}
                  </Text>

                  <Text style={styles.modalLabel}>Current Market Value</Text>
                  <View style={styles.modalAmountRow}>
                    <Text style={styles.modalRupee}>₹</Text>
                    <TextInput
                      style={styles.modalAmountInput}
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                      value={updateValue}
                      onChangeText={(v) =>
                        setUpdateValue(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleUpdateValue}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSaveBtnText}>Update Value</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ EDIT INVESTED AMOUNT MODAL ============ */}
      <Modal visible={showEditInvestedModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: "45%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      Edit Invested Amount (Correction)
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowEditInvestedModal(false)}
                    >
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.updateInvName}>
                    {editingInvestment?.name}
                  </Text>
                  <Text style={styles.updateInvMeta}>
                    Current Value: ₹
                    {(editingInvestment?.currentValue || 0).toLocaleString(
                      "en-IN",
                    )}
                  </Text>

                  <Text style={styles.modalLabel}>Correct Invested Amount</Text>
                  <View style={styles.modalAmountRow}>
                    <Text style={styles.modalRupee}>₹</Text>
                    <TextInput
                      style={styles.modalAmountInput}
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                      value={editInvestedValue}
                      onChangeText={(v) =>
                        setEditInvestedValue(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                  <Text style={styles.fieldHint}>
                    Warning: This overwrites the original invested amount
                  </Text>

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleEditInvested}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ ADD AMOUNT MODAL (UNIVERSAL) ============ */}
      <Modal visible={showAddAmountModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: "65%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Add Investment Amount</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowAddAmountModal(false);
                        setEditingInvestment(null);
                      }}
                    >
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.addAmtInfoCard}>
                    <Text style={{ fontSize: 24, marginRight: 10 }}>
                      {editingInvestment?.typeIcon || "📊"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addAmtName}>
                        {editingInvestment?.name}
                      </Text>
                      <Text style={styles.addAmtMeta}>
                        Currently invested: ₹
                        {(
                          editingInvestment?.investedAmount || 0
                        ).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalLabel}>Amount Invested *</Text>
                  <View style={styles.modalAmountRow}>
                    <Text style={styles.modalRupee}>₹</Text>
                    <TextInput
                      style={styles.modalAmountInput}
                      placeholder="10000"
                      placeholderTextColor="#D1D5DB"
                      value={addAmtValue}
                      onChangeText={(v) =>
                        setAddAmtValue(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                  <Text style={styles.fieldHint}>
                    This amount will be added to your total invested amount
                  </Text>

                  <Text style={styles.modalLabel}>
                    Current Total Value (optional)
                  </Text>
                  <View style={styles.modalAmountRow}>
                    <Text style={styles.modalRupee}>₹</Text>
                    <TextInput
                      style={styles.modalAmountInput}
                      placeholder={`Leave empty to auto-calculate`}
                      placeholderTextColor="#D1D5DB"
                      value={addAmtCurrentValue}
                      onChangeText={(v) =>
                        setAddAmtCurrentValue(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={styles.fieldHint}>
                    The total current market value of this entire investment
                  </Text>

                  <Text style={styles.modalLabel}>Note (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Additional lumpsum, top-up"
                    placeholderTextColor="#9CA3AF"
                    value={addAmtNote}
                    onChangeText={setAddAmtNote}
                  />

                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} />
                    <Text style={styles.sectionDividerText}>
                      Payment Source
                    </Text>
                    <View style={styles.sectionDividerLine} />
                  </View>
                  <Text style={styles.modalLabel}>Deduct from Asset</Text>
                  <TouchableOpacity
                    style={styles.typeSelector}
                    onPress={() => {
                      setPickerType("addAmount");
                      setShowAccountPicker(true);
                    }}
                  >
                    <Ionicons
                      name={payFromAccount ? "wallet" : "business"}
                      size={20}
                      color={payFromAccount ? "#6C63FF" : "#9CA3AF"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeSelectorText,
                        !payFromAccount && { color: "#9CA3AF" },
                      ]}
                      numberOfLines={1}
                    >
                      {payFromAccount
                        ? payFromAccount.name
                        : "Select bank or cash (optional)"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                  {payFromAccount && (
                    <Text style={styles.fieldHint}>
                      Balance will be deducted and an expense will be recorded.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleAddAmount}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSaveBtnText}>
                        Add ₹
                        {addAmtValue
                          ? parseFloat(addAmtValue).toLocaleString("en-IN")
                          : "0"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ SIP CONFIRMATION MODAL ============ */}
      <Modal visible={showSipModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: "55%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Confirm SIP</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowSipModal(false);
                        setCurrentSipInvestment(null);
                      }}
                    >
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sipInfoBox}>
                    <View style={styles.sipInfoItem}>
                      <Text style={styles.sipInfoLabel}>Invested</Text>
                      <Text style={styles.sipInfoValue}>
                        ₹
                        {(
                          currentSipInvestment?.investedAmount || 0
                        ).toLocaleString("en-IN")}
                      </Text>
                    </View>
                    <View style={styles.sipInfoItem}>
                      <Text style={styles.sipInfoLabel}>Current</Text>
                      <Text style={styles.sipInfoValue}>
                        ₹
                        {(
                          currentSipInvestment?.currentValue || 0
                        ).toLocaleString("en-IN")}
                      </Text>
                    </View>
                    <View style={styles.sipInfoItem}>
                      <Text style={styles.sipInfoLabel}>SIP</Text>
                      <Text style={styles.sipInfoValue}>
                        ₹
                        {(currentSipInvestment?.sipAmount || 0).toLocaleString(
                          "en-IN",
                        )}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalLabel}>SIP Amount</Text>
                  <View style={styles.modalAmountRow}>
                    <Text style={styles.modalRupee}>₹</Text>
                    <TextInput
                      style={styles.modalAmountInput}
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                      value={sipConfirmAmount}
                      onChangeText={(v) =>
                        setSipConfirmAmount(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                  <Text style={styles.fieldHint}>
                    Edit if different from regular SIP
                  </Text>

                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} />
                    <Text style={styles.sectionDividerText}>
                      Payment Source
                    </Text>
                    <View style={styles.sectionDividerLine} />
                  </View>
                  <Text style={styles.modalLabel}>Deduct from Asset</Text>
                  <TouchableOpacity
                    style={styles.typeSelector}
                    onPress={() => {
                      setPickerType("sip");
                      setShowAccountPicker(true);
                    }}
                  >
                    <Ionicons
                      name={payFromAccount ? "wallet" : "business"}
                      size={20}
                      color={payFromAccount ? "#6C63FF" : "#9CA3AF"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeSelectorText,
                        !payFromAccount && { color: "#9CA3AF" },
                      ]}
                      numberOfLines={1}
                    >
                      {payFromAccount
                        ? payFromAccount.name
                        : "Select bank or cash (optional)"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                  {payFromAccount && (
                    <Text style={styles.fieldHint}>
                      Balance will be deducted and an expense will be recorded.
                    </Text>
                  )}

                  <View style={styles.sipActionRow}>
                    <TouchableOpacity
                      style={styles.sipSkipBtn}
                      onPress={handleSipSkip}
                      disabled={saving}
                    >
                      <Text style={styles.sipSkipBtnText}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sipConfirmActionBtn,
                        saving && { opacity: 0.6 },
                      ]}
                      onPress={handleSipConfirm}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.sipConfirmActionBtnText}>
                          Confirm SIP
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ RD PAYMENT MODAL ============ */}
      <Modal visible={showRdPayModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: "55%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>RD Monthly Payment</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowRdPayModal(false);
                        setEditingInvestment(null);
                      }}
                    >
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.addAmtInfoCard}>
                    <Text style={{ fontSize: 24, marginRight: 10 }}>🔄</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addAmtName}>
                        {editingInvestment?.name}
                      </Text>
                      <Text style={styles.addAmtMeta}>
                        Month {(editingInvestment?.rdCompletedMonths || 0) + 1}{" "}
                        of {editingInvestment?.rdTotalMonths || "?"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sipInfoBox}>
                    <View style={styles.sipInfoItem}>
                      <Text style={styles.sipInfoLabel}>Deposited</Text>
                      <Text style={styles.sipInfoValue}>
                        ₹
                        {(
                          editingInvestment?.investedAmount || 0
                        ).toLocaleString("en-IN")}
                      </Text>
                    </View>
                    <View style={styles.sipInfoItem}>
                      <Text style={styles.sipInfoLabel}>Completed</Text>
                      <Text style={styles.sipInfoValue}>
                        {editingInvestment?.rdCompletedMonths || 0} months
                      </Text>
                    </View>
                    <View style={styles.sipInfoItem}>
                      <Text style={styles.sipInfoLabel}>Remaining</Text>
                      <Text style={styles.sipInfoValue}>
                        {(editingInvestment?.rdTotalMonths || 0) -
                          (editingInvestment?.rdCompletedMonths || 0)}{" "}
                        months
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalLabel}>Payment Amount</Text>
                  <View style={styles.modalAmountRow}>
                    <Text style={styles.modalRupee}>₹</Text>
                    <TextInput
                      style={styles.modalAmountInput}
                      placeholder="0"
                      placeholderTextColor="#D1D5DB"
                      value={rdPayAmount}
                      onChangeText={(v) =>
                        setRdPayAmount(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                  <Text style={styles.fieldHint}>
                    Default: ₹
                    {(editingInvestment?.rdMonthlyAmount || 0).toLocaleString(
                      "en-IN",
                    )}
                    /month
                  </Text>

                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} />
                    <Text style={styles.sectionDividerText}>
                      Payment Source
                    </Text>
                    <View style={styles.sectionDividerLine} />
                  </View>
                  <Text style={styles.modalLabel}>Deduct from Asset</Text>
                  <TouchableOpacity
                    style={styles.typeSelector}
                    onPress={() => {
                      setPickerType("rd");
                      setShowAccountPicker(true);
                    }}
                  >
                    <Ionicons
                      name={payFromAccount ? "wallet" : "business"}
                      size={20}
                      color={payFromAccount ? "#6C63FF" : "#9CA3AF"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeSelectorText,
                        !payFromAccount && { color: "#9CA3AF" },
                      ]}
                      numberOfLines={1}
                    >
                      {payFromAccount
                        ? payFromAccount.name
                        : "Select bank or cash (optional)"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                  {payFromAccount && (
                    <Text style={styles.fieldHint}>
                      Balance will be deducted and an expense will be recorded.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.rdPayBtn, saving && { opacity: 0.6 }]}
                    onPress={handleRdPayment}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.rdPayBtnText}>Confirm Payment</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ TRANSACTION HISTORY MODAL ============ */}
      <Modal visible={showTxnHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "65%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction History</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTxnHistoryModal(false);
                  setEditingInvestment(null);
                }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.updateInvName}>{editingInvestment?.name}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(editingInvestment?.transactions || [])
                .slice()
                .reverse()
                .map((txn, idx) => (
                  <View key={txn.id || idx} style={styles.txnHistoryItem}>
                    <View style={styles.txnHistoryLeft}>
                      <Ionicons
                        name={
                          txn.type === "SIP"
                            ? "repeat"
                            : txn.type === "RD_PAYMENT"
                              ? "calendar"
                              : "add-circle"
                        }
                        size={20}
                        color={
                          txn.type === "SIP"
                            ? "#6C63FF"
                            : txn.type === "RD_PAYMENT"
                              ? "#14B8A6"
                              : "#10B981"
                        }
                      />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.txnHistoryAmount}>
                          ₹{(txn.amount || 0).toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.txnHistoryDate}>
                          {new Date(txn.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                    </View>
                    <View>
                      <Text style={styles.txnHistoryType}>
                        {txn.type === "SIP"
                          ? "SIP"
                          : txn.type === "RD_PAYMENT"
                            ? "RD"
                            : "Invest"}
                      </Text>
                      {txn.note ? (
                        <Text style={styles.txnHistoryNote} numberOfLines={1}>
                          {txn.note}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              {(editingInvestment?.transactions || []).length === 0 && (
                <Text
                  style={{ textAlign: "center", color: "#9CA3AF", padding: 20 }}
                >
                  No transactions yet
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============ EDIT RD PROGRESS MODAL ============ */}
      <Modal
        visible={showEditRdProgressModal}
        animationType="slide"
        transparent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: "45%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Update RD Progress</Text>
                    <TouchableOpacity
                      onPress={() => setShowEditRdProgressModal(false)}
                    >
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.updateInvName}>
                    {editingInvestment?.name}
                  </Text>
                  <Text style={styles.updateInvMeta}>
                    Monthly: ₹
                    {(editingInvestment?.rdMonthlyAmount || 0).toLocaleString(
                      "en-IN",
                    )}
                  </Text>

                  <Text style={styles.modalLabel}>Total Months Paid</Text>
                  <View style={styles.modalAmountRow}>
                    <TextInput
                      style={styles.modalAmountInput}
                      placeholder="e.g., 6"
                      placeholderTextColor="#D1D5DB"
                      value={editRdProgressValue}
                      onChangeText={(v) =>
                        setEditRdProgressValue(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      autoFocus
                    />
                    <Text
                      style={[
                        styles.modalRupee,
                        { marginRight: 20, fontSize: 16 },
                      ]}
                    >
                      months
                    </Text>
                  </View>
                  <Text style={styles.fieldHint}>
                    Updating this will auto-adjust the "Invested Amount" based
                    on the monthly installment.
                  </Text>

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleEditRdProgress}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSaveBtnText}>
                        Update Progress
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ ACCOUNT PICKER (UNIVERSAL) ============ */}
      <Modal visible={showAccountPicker} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "60%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Source</Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.accountOption,
                  !payFromAccount && styles.accountOptionSelected,
                ]}
                onPress={() => {
                  setPayFromAccount(null);
                  setShowAccountPicker(false);
                }}
              >
                <View
                  style={[styles.accountIcon, { backgroundColor: "#F3F4F6" }]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#6B7280"
                  />
                </View>
                <Text style={styles.accountName}>None (Skip subtraction)</Text>
              </TouchableOpacity>

              {bankAccounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountOption,
                    payFromAccount?.id === acc.id &&
                      styles.accountOptionSelected,
                  ]}
                  onPress={() => {
                    setPayFromAccount(acc);
                    setShowAccountPicker(false);
                  }}
                >
                  <View
                    style={[
                      styles.accountIcon,
                      {
                        backgroundColor:
                          acc.type === "BANK" ? "#F0EFFF" : "#FEF3C7",
                      },
                    ]}
                  >
                    <Ionicons
                      name={acc.type === "BANK" ? "business" : "cash"}
                      size={20}
                      color={acc.type === "BANK" ? "#6C63FF" : "#D97706"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text style={styles.accountBalance}>
                      Balance: ₹{(acc.balance || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  {payFromAccount?.id === acc.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#6C63FF"
                    />
                  )}
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
  container: { flex: 1, backgroundColor: "#F8F9FE" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1A1A2E" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0EFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Alerts
  alertContainer: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  alertTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#92400E",
    marginLeft: 8,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  alertItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F0EFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  alertItemName: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  alertItemSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  alertActionBtn: {
    backgroundColor: "#6C63FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  alertActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },

  // Summary
  summaryCard: {
    backgroundColor: "#6C63FF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  summaryAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  summaryRow: { flexDirection: "row", marginTop: 16 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  summaryItemLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  summaryItemValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1A1A2E",
    marginTop: 16,
    marginBottom: 10,
  },

  // Type breakdown
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  typeIcon: { fontSize: 22, marginRight: 10 },
  typeNameRow: { flexDirection: "row", justifyContent: "space-between" },
  typeName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1A1A2E",
    flex: 1,
    marginRight: 8,
  },
  typeAmount: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  typeBarBg: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginTop: 6,
  },
  typeBarFill: { height: 4, backgroundColor: "#6C63FF", borderRadius: 2 },
  typePercent: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 8,
    width: 35,
    textAlign: "right",
  },

  // Investment cards
  invCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  invHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  invIcon: { fontSize: 28, marginRight: 10 },
  invName: { fontSize: 16, fontWeight: "600", color: "#1A1A2E" },
  invMeta: { fontSize: 12, color: "#9CA3AF", marginTop: 1 },
  inactiveBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inactiveBadgeText: { fontSize: 10, color: "#065F46", fontWeight: "600" },
  invBody: { flexDirection: "row", justifyContent: "space-between" },
  invCol: {},
  invColLabel: { fontSize: 11, color: "#9CA3AF" },
  invColValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A2E",
    marginTop: 2,
  },
  invReturnPct: { fontSize: 11, fontWeight: "500", marginTop: 1 },

  extraInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexWrap: "wrap",
  },
  extraInfoText: { fontSize: 12, color: "#6B7280", marginLeft: 6, flex: 1 },

  rdProgressBg: {
    height: 4,
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginLeft: 8,
    marginTop: 2,
  },
  rdProgressFill: { height: 4, backgroundColor: "#14B8A6", borderRadius: 2 },

  invNote: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    fontStyle: "italic",
  },

  // Quick action buttons on each card
  invActions: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 8,
    flexWrap: "wrap",
  },
  invActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0EFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  invActionText: { fontSize: 12, fontWeight: "500", color: "#6C63FF" },

  hint: { textAlign: "center", fontSize: 11, color: "#D1D5DB", marginTop: 12 },

  // Account Selection
  accountOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  accountOptionSelected: { borderColor: "#6C63FF", backgroundColor: "#F0EFFF" },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  accountName: { fontSize: 15, fontWeight: "600", color: "#1A1A2E" },
  accountBalance: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#1A1A2E" },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  emptyBtn: {
    backgroundColor: "#6C63FF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
  },
  emptyBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A2E" },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
    marginTop: 14,
  },
  modalInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: "#1A1A2E",
  },
  modalAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingLeft: 14,
  },
  modalRupee: { fontSize: 20, fontWeight: "600", color: "#374151" },
  modalAmountInput: {
    flex: 1,
    height: 48,
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A2E",
    paddingLeft: 8,
  },
  modalSaveBtn: {
    backgroundColor: "#6C63FF",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  modalSaveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  fieldHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 4,
  },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  sectionDividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    marginHorizontal: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  typeSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  typeSelectorIcon: { fontSize: 20, marginRight: 8 },
  typeSelectorText: { flex: 1, fontSize: 15, color: "#1A1A2E" },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
  },
  typeOptionIcon: { fontSize: 20, marginRight: 10 },
  typeOptionName: { flex: 1, fontSize: 15, color: "#1A1A2E" },

  updateInvName: { fontSize: 18, fontWeight: "600", color: "#1A1A2E" },
  updateInvMeta: { fontSize: 13, color: "#6B7280", marginTop: 4 },

  // Add Amount Modal
  addAmtInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  addAmtName: { fontSize: 16, fontWeight: "600", color: "#1A1A2E" },
  addAmtMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  // RD Summary
  rdSummaryBox: {
    backgroundColor: "#F0FDFA",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  rdSummaryText: { fontSize: 13, color: "#0D9488", fontWeight: "500" },

  // SIP
  sipInfoBox: {
    flexDirection: "row",
    backgroundColor: "#F0EFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  sipInfoItem: { flex: 1, alignItems: "center" },
  sipInfoLabel: { fontSize: 10, color: "#6B7280", textTransform: "uppercase" },
  sipInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A2E",
    marginTop: 4,
  },
  sipActionRow: {
    flexDirection: "row",
    marginTop: 16,
    marginBottom: 20,
    gap: 12,
  },
  sipSkipBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  sipSkipBtnText: { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  sipConfirmActionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  sipConfirmActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  // RD Payment
  rdPayBtn: {
    backgroundColor: "#14B8A6",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  rdPayBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  // Transaction History
  txnHistoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  txnHistoryLeft: { flexDirection: "row", alignItems: "center" },
  txnHistoryAmount: { fontSize: 16, fontWeight: "600", color: "#1A1A2E" },
  txnHistoryDate: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  txnHistoryType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C63FF",
    textAlign: "right",
  },
  txnHistoryNote: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 2,
    maxWidth: 120,
  },
});

export default PortfolioScreen;
