import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
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
  getAllInvestmentTransactions,
  getInvestments,
  getPendingRdPayments,
  getPendingSips,
  INVESTMENT_TYPES,
  processMaturedInvestments,
  skipSip,
  updateInvestment,
} from "../../services/investmentService";
import {
  CURRENCIES,
  cleanDecimal,
  detectForeignInvestment,
  getDefaultExchangeRate,
  getCurrencySymbol,
  isForeignInvestment,
} from "../../constants/currencies";
import { exportTransactionHistoryCSV } from "../../services/portfolioReportService";
import useAuthStore from "../../store/useAuthStore";
import { Theme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import {
  calculateInvestmentReturns,
  calculatePortfolioMetrics,
} from "../../utils/portfolioMath";

// Modular Components
import AssetAllocationBar from "./components/AssetAllocationBar";
import InvestmentCard from "./components/InvestmentCard";
import PortfolioHeroCard from "./components/PortfolioHeroCard";
import PortfolioHistoryView from "./components/PortfolioHistoryView";

// Modals
import ImportModal from "./modals/ImportModal";
import InvestmentDetailModal from "./modals/InvestmentDetailModal";
import InvestmentEditModal from "./modals/InvestmentEditModal";
import NotificationSettingsModal from "./modals/NotificationSettingsModal";
import QuickValueUpdateModal from "./modals/QuickValueUpdateModal";
import ReportModal from "./modals/ReportModal";
import WithdrawModal from "./modals/WithdrawModal";

const SORT_OPTIONS = [
  { id: "VALUE_DESC", label: "Highest Value" },
  { id: "VALUE_ASC", label: "Lowest Value" },
  { id: "INVESTED_DESC", label: "Highest Invested" },
  { id: "RETURN_DESC", label: "Top Gainers (%)" },
  { id: "RETURN_ABS_DESC", label: "Highest Profit" },
  { id: "XIRR_DESC", label: "Highest Return / XIRR" },
  { id: "NAME_ASC", label: "Alphabetical (A-Z)" },
  { id: "RECENT", label: "Recently Added" },
];

const PortfolioScreen = ({ navigation }) => {
  // Global Store
  const isStealthMode = useAuthStore((s) => s.isStealthMode);
  const toggleStealthMode = useAuthStore((s) => s.toggleStealthMode);
  const userProfile = useAuthStore((s) => s.userProfile);
  const baseCurrency = userProfile?.currency || "INR";
  const currencySymbol = userProfile?.currencySymbol || getCurrencySymbol(baseCurrency);

  // State
  const [investments, setInvestments] = useState([]);
  const [totals, setTotals] = useState(null);
  const [portfolioMetrics, setPortfolioMetrics] = useState(null);
  const [historyTransactions, setHistoryTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSips, setPendingSips] = useState([]);
  const [pendingRds, setPendingRds] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [saving, setSaving] = useState(false);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState("holdings"); // 'holdings' | 'history'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortOption, setSortOption] = useState("VALUE_DESC");
  const [showSortPicker, setShowSortPicker] = useState(false);

  // Modals Visibility
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQuickUpdateModal, setShowQuickUpdateModal] = useState(false);
  const [showNotificationSettingsModal, setShowNotificationSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
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

  // Selected Investment
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [currentSipInvestment, setCurrentSipInvestment] = useState(null);

  // Add Form State
  const [invName, setInvName] = useState("");
  const [invType, setInvType] = useState(INVESTMENT_TYPES[0]);
  const [invPlatform, setInvPlatform] = useState("");
  const [invCurrency, setInvCurrency] = useState(baseCurrency);
  const [invExchangeRate, setInvExchangeRate] = useState("1");
  const [invAmount, setInvAmount] = useState("");
  const [invCurrentValue, setInvCurrentValue] = useState("");
  const [invInterestRate, setInvInterestRate] = useState("");
  const [invNote, setInvNote] = useState("");
  const [invSipAmount, setInvSipAmount] = useState("");
  const [invSipDate, setInvSipDate] = useState("");
  const [invMaturityAmount, setInvMaturityAmount] = useState("");
  const [invMaturityDate, setInvMaturityDate] = useState("");
  const [invRdMonthly, setInvRdMonthly] = useState("");
  const [invRdMonths, setInvRdMonths] = useState("");
  const [invRdPaymentDate, setInvRdPaymentDate] = useState("");
  const [invRdCompletedMonths, setInvRdCompletedMonths] = useState("0");

  // Account Source
  const [payFromAccount, setPayFromAccount] = useState(null);

  // Foreign Detection and Top-Up Currency State
  const [detectedForeign, setDetectedForeign] = useState(null);
  const [userChangedCurrencyManually, setUserChangedCurrencyManually] = useState(false);
  const [addAmtExchangeRate, setAddAmtExchangeRate] = useState("1");

  // Early Foreign Investment Detection Handlers
  const handleInvNameChange = (text) => {
    setInvName(text);
    if (!userChangedCurrencyManually) {
      const detection = detectForeignInvestment(text, invPlatform);
      if (detection.isForeign) {
        setInvCurrency(detection.suggestedCurrency);
        setInvExchangeRate(detection.defaultRate.toString());
        setDetectedForeign(detection);
      } else if (detectedForeign) {
        const platDetection = detectForeignInvestment("", invPlatform);
        if (platDetection.isForeign) {
          setInvCurrency(platDetection.suggestedCurrency);
          setInvExchangeRate(platDetection.defaultRate.toString());
          setDetectedForeign(platDetection);
        } else {
          setInvCurrency(baseCurrency);
          setInvExchangeRate("1");
          setDetectedForeign(null);
        }
      }
    }
  };

  const handleInvPlatformChange = (text) => {
    setInvPlatform(text);
    if (!userChangedCurrencyManually) {
      const detection = detectForeignInvestment(invName, text);
      if (detection.isForeign) {
        setInvCurrency(detection.suggestedCurrency);
        setInvExchangeRate(detection.defaultRate.toString());
        setDetectedForeign(detection);
      } else if (detectedForeign) {
        const nameDetection = detectForeignInvestment(invName, "");
        if (nameDetection.isForeign) {
          setInvCurrency(nameDetection.suggestedCurrency);
          setInvExchangeRate(nameDetection.defaultRate.toString());
          setDetectedForeign(nameDetection);
        } else {
          setInvCurrency(baseCurrency);
          setInvExchangeRate("1");
          setDetectedForeign(null);
        }
      }
    }
  };

  // Sub-forms
  const [updateValue, setUpdateValue] = useState("");
  const [editInvestedValue, setEditInvestedValue] = useState("");
  const [sipConfirmAmount, setSipConfirmAmount] = useState("");
  const [addAmtValue, setAddAmtValue] = useState("");
  const [addAmtCurrentValue, setAddAmtCurrentValue] = useState("");
  const [addAmtNote, setAddAmtNote] = useState("");
  const [addAmtDate, setAddAmtDate] = useState(new Date());
  const [showAddAmtDatePicker, setShowAddAmtDatePicker] = useState(false);
  const [rdPayAmount, setRdPayAmount] = useState("");
  const [editRdProgressValue, setEditRdProgressValue] = useState("");

  const fetchInvestments = async () => {
    try {
      const [invResult, accResult] = await Promise.all([
        getInvestments(),
        getAccounts(),
      ]);

      if (invResult.success) {
        const invs = invResult.investments || [];
        setInvestments(invs);
        setTotals(calculateInvestmentTotals(invs));
        setPortfolioMetrics(calculatePortfolioMetrics(invs));
        setHistoryTransactions(getAllInvestmentTransactions(invs));
        setPendingSips(getPendingSips(invs));
        setPendingRds(getPendingRdPayments(invs));

        // Process automatic maturity credits
        const maturityRes = await processMaturedInvestments(invs);
        if (maturityRes.success && maturityRes.processed > 0) {
          const refreshedInv = await getInvestments();
          if (refreshedInv.success) {
            setInvestments(refreshedInv.investments);
            setTotals(calculateInvestmentTotals(refreshedInv.investments));
            setPortfolioMetrics(
              calculatePortfolioMetrics(refreshedInv.investments),
            );
            setHistoryTransactions(
              getAllInvestmentTransactions(refreshedInv.investments),
            );
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

  useFocusEffect(
    useCallback(() => {
      fetchInvestments();
    }, []),
  );

  // Watch for maturity calculation changes in Add form
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
      const matureVal = getCalculatedMaturity(
        "fd",
        invAmount,
        invInterestRate,
        invRdMonths,
      );
      if (matureVal) setInvMaturityAmount(matureVal);
    }
  }, [invType, invRdMonthly, invAmount, invInterestRate, invRdMonths]);

  const resetAddForm = () => {
    setInvName("");
    setInvPlatform("");
    setInvCurrency(baseCurrency);
    setInvExchangeRate("1");
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
    setDetectedForeign(null);
    setUserChangedCurrencyManually(false);
  };

  const parseMaturityDate = (ddmmyyyy) => {
    if (!ddmmyyyy || !ddmmyyyy.includes("/")) return ddmmyyyy;
    const [d, m, y] = ddmmyyyy.split("/");
    if (!d || !m || !y) return ddmmyyyy;
    return new Date(`${y}-${m}-${d}`).toISOString();
  };

  const getCalculatedMaturity = (type, amount, rate, tenure) => {
    if (!amount || !rate || !tenure) return "";
    const P = parseFloat(amount);
    const r = parseFloat(rate) / 100;
    const n = 4; // Quarterly compounding
    const t = parseInt(tenure);

    if (type === "fd") {
      const A = P * Math.pow(1 + r / n, (n * t) / 12);
      return Math.round(A).toString();
    } else if (type === "rd") {
      const i = r / n;
      const M =
        (P * (Math.pow(1 + i, (n * t) / 12) - 1)) /
        (1 - Math.pow(1 + i, -1 / 3));
      return Math.round(M).toString();
    }
    return "";
  };

  // ── ADD INVESTMENT ──
  const handleAdd = async () => {
    if (!invName.trim()) {
      Alert.alert("Required", "Enter investment name");
      return;
    }

    const rate = invCurrency === baseCurrency ? 1 : parseFloat(invExchangeRate) || 0;
    if (invCurrency !== baseCurrency && rate <= 0) {
      Alert.alert("Required", `Enter a valid positive exchange rate for ${invCurrency}`);
      return;
    }

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
      const rawAmountToPay =
        invType.id === "rd" ? 0 : parseFloat(invAmount) || 0;
      const amountToPay = rawAmountToPay * rate;

      if (payFromAccount && amountToPay > 0) {
        const expRes = await addExpense({
          amount: amountToPay,
          categoryId: "investment",
          categoryName: "Investment",
          categoryIcon: invType.icon,
          accountId: payFromAccount.id,
          accountName: payFromAccount.name,
          paymentMode: payFromAccount.type,
          note: `Investment: ${invName}${invCurrency !== baseCurrency ? ` (${getCurrencySymbol(invCurrency)}${rawAmountToPay} @ ${rate})` : ""}`,
          date: new Date().toISOString(),
        });
        if (expRes.success) expenseId = expRes.id;
      }

      const result = await addInvestment({
        name: invName,
        type: invType.id,
        typeName: invType.name,
        typeIcon: invType.icon,
        platform: invPlatform,
        currency: invCurrency,
        exchangeRate: rate,
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
        resetAddForm();
        fetchInvestments();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Error", result.error);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
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
    setSaving(false);
    if (result.success) {
      setShowUpdateModal(false);
      setEditingInvestment(null);
      fetchInvestments();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert("Error", result.error);
    }
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
    setSaving(false);
    if (result.success) {
      setShowEditInvestedModal(false);
      setEditingInvestment(null);
      fetchInvestments();
    } else {
      Alert.alert("Error", result.error);
    }
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
    setSaving(false);
    if (result.success) {
      setShowEditRdProgressModal(false);
      setEditingInvestment(null);
      fetchInvestments();
    } else {
      Alert.alert("Error", result.error);
    }
  };

  // ── ADD INVESTMENT AMOUNT (TOP-UP) ──
  const handleAddAmount = async () => {
    if (!addAmtValue || parseFloat(addAmtValue) <= 0) {
      Alert.alert("Required", "Enter amount invested");
      return;
    }
    setSaving(true);
    try {
      const selectedDateIso = (addAmtDate || new Date()).toISOString();
      const isForeign = isForeignInvestment(editingInvestment, baseCurrency);
      const effectiveRate = parseFloat(addAmtExchangeRate) > 0
        ? parseFloat(addAmtExchangeRate)
        : (parseFloat(editingInvestment?.exchangeRate) > 0 ? parseFloat(editingInvestment.exchangeRate) : 1);
      const deductedAmount = (parseFloat(addAmtValue) || 0) * effectiveRate;

      if (payFromAccount) {
        await addExpense({
          amount: deductedAmount,
          categoryId: "investment",
          categoryName: "Investment",
          categoryIcon: editingInvestment.typeIcon || "💰",
          accountId: payFromAccount.id,
          accountName: payFromAccount.name,
          paymentMode: payFromAccount.type,
          note: addAmtNote?.trim()
            ? `Top-up: ${editingInvestment.name} - ${addAmtNote.trim()}`
            : `Top-up: ${editingInvestment.name}`,
          date: selectedDateIso,
        });
      }

      const result = await addInvestmentAmount(
        editingInvestment.id,
        addAmtValue,
        addAmtCurrentValue || null,
        addAmtNote?.trim() || "",
        selectedDateIso,
        isForeign ? effectiveRate : null,
      );

      if (result.success) {
        setShowAddAmountModal(false);
        const invSym = getCurrencySymbol(editingInvestment?.currency, currencySymbol);
        const savedName = editingInvestment?.name;
        const savedAmt = addAmtValue;
        setAddAmtValue("");
        setAddAmtCurrentValue("");
        setAddAmtNote("");
        setAddAmtDate(new Date());
        setAddAmtExchangeRate("1");
        setEditingInvestment(null);
        setPayFromAccount(null);
        fetchInvestments();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "✅ Amount Added",
          `${invSym}${parseFloat(savedAmt).toLocaleString("en-IN")}${
            isForeign ? ` (≈ ${currencySymbol}${deductedAmount.toLocaleString("en-IN")})` : ""
          } added to ${savedName}`,
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "✅ SIP Confirmed",
          `₹${parseFloat(sipConfirmAmount).toLocaleString("en-IN")} added to ${currentSipInvestment.name}`,
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
            setSaving(false);
            if (result.success) {
              setShowSipModal(false);
              setCurrentSipInvestment(null);
              setSipConfirmAmount("");
              fetchInvestments();
            }
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          if (result.success) {
            fetchInvestments();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      },
    ]);
  };

  // ── INVESTMENT DETAILS MODAL ──
  const openInvestmentDetails = (inv) => {
    setEditingInvestment(inv);
    setShowDetailModal(true);
  };

  // ── FILTER & SORT HOLDINGS ──
  const filteredInvestments = investments
    .filter((inv) => {
      // Exclude inactive / matured investments from active holdings tab
      if (inv.isActive === false) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (inv.name || "").toLowerCase().includes(q);
        const matchesPlatform = (inv.platform || "").toLowerCase().includes(q);
        const matchesType = (inv.typeName || "").toLowerCase().includes(q);
        if (!matchesName && !matchesPlatform && !matchesType) return false;
      }
      // Category filter (with separate foreign assets support)
      if (selectedCategory) {
        const isForeignInv = isForeignInvestment(inv, baseCurrency);
        if (selectedCategory === "foreign_stocks" || selectedCategory === "foreign") {
          if (!isForeignInv) return false;
        } else if (selectedCategory.startsWith("foreign_")) {
          const baseType = selectedCategory.replace("foreign_", "");
          if (!isForeignInv || inv.type !== baseType) return false;
        } else {
          // Domestic category: match inv.type AND not foreign
          if (inv.type !== selectedCategory || isForeignInv) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const rateA = parseFloat(a.exchangeRate) > 0 ? parseFloat(a.exchangeRate) : 1;
      const rateB = parseFloat(b.exchangeRate) > 0 ? parseFloat(b.exchangeRate) : 1;
      const valA = (parseFloat(a.currentValue) || 0) * rateA;
      const valB = (parseFloat(b.currentValue) || 0) * rateB;
      const invA = (parseFloat(a.investedAmount) || 0) * rateA;
      const invB = (parseFloat(b.investedAmount) || 0) * rateB;

      if (sortOption === "VALUE_DESC") {
        return valB - valA;
      }
      if (sortOption === "VALUE_ASC") {
        return valA - valB;
      }
      if (sortOption === "INVESTED_DESC") {
        return invB - invA;
      }
      if (sortOption === "RETURN_DESC") {
        const retA = invA > 0 ? ((valA - invA) / invA) * 100 : 0;
        const retB = invB > 0 ? ((valB - invB) / invB) * 100 : 0;
        return retB - retA;
      }
      if (sortOption === "RETURN_ABS_DESC") {
        const gainA = valA - invA;
        const gainB = valB - invB;
        return gainB - gainA;
      }
      if (sortOption === "XIRR_DESC") {
        const rA = calculateInvestmentReturns(a);
        const rB = calculateInvestmentReturns(b);
        const rateNumA = parseFloat(String(rA?.displayRate || 0).replace(/[^0-9.-]/g, "")) || 0;
        const rateNumB = parseFloat(String(rB?.displayRate || 0).replace(/[^0-9.-]/g, "")) || 0;
        return rateNumB - rateNumA;
      }
      if (sortOption === "NAME_ASC") {
        return (a.name || "").localeCompare(b.name || "");
      }
      // RECENT
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  // Loading Screen
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0F766E" />
          <Text style={styles.loadingText}>Loading Portfolio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Portfolio & Wealth</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowNotificationSettingsModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={20} color="#0F766E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowImportModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="download-outline" size={20} color="#0F766E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowReportModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="document-text-outline" size={20} color="#0F766E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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
            colors={["#0F766E"]}
          />
        }
      >
        {/* Hero Card with XIRR, Privacy Toggle, and Tab Switcher */}
        <PortfolioHeroCard
          totals={totals}
          portfolioXirr={portfolioMetrics?.portfolioXirr}
          isStealthMode={isStealthMode}
          currencySymbol={currencySymbol}
          onToggleStealth={toggleStealthMode}
          onAddPress={() => setShowAddModal(true)}
          onImportPress={() => setShowImportModal(true)}
          onReportPress={() => setShowReportModal(true)}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          historyCount={historyTransactions.length}
        />

        {/* ================= HOLDINGS TAB ================= */}
        {activeTab === "holdings" && (
          <>
            {/* Pending Actions Due Alert */}
            {(pendingSips.length > 0 || pendingRds.length > 0) && (
              <View style={styles.alertCard}>
                <View style={styles.alertHead}>
                  <Ionicons name="notifications" size={16} color="#D97706" />
                  <Text style={styles.alertTitle}>
                    Actions Due ({pendingSips.length + pendingRds.length})
                  </Text>
                </View>

                {pendingSips.map((inv) => (
                  <TouchableOpacity
                    key={`sip-${inv.id}`}
                    style={styles.alertItem}
                    onPress={() => {
                      setCurrentSipInvestment(inv);
                      setSipConfirmAmount(inv.sipAmount?.toString() || "");
                      setShowSipModal(true);
                    }}
                  >
                    <View style={styles.alertItemIcon}>
                      <Text style={{ fontSize: 16 }}>📊</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertItemName}>{inv.name}</Text>
                      <Text style={styles.alertItemSub}>
                        SIP:{" "}
                        {formatCurrency(
                          inv.sipAmount,
                          isStealthMode,
                          currencySymbol,
                        )}{" "}
                        • Due on {inv.sipDate}th
                      </Text>
                    </View>
                    <View style={styles.alertConfirmBtn}>
                      <Text style={styles.alertConfirmText}>Confirm</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {pendingRds.map((inv) => (
                  <TouchableOpacity
                    key={`rd-${inv.id}`}
                    style={styles.alertItem}
                    onPress={() => {
                      setEditingInvestment(inv);
                      setRdPayAmount(
                        (inv.rdMonthlyAmount || "").toString(),
                      );
                      setShowRdPayModal(true);
                    }}
                  >
                    <View style={styles.alertItemIcon}>
                      <Text style={{ fontSize: 16 }}>🔄</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertItemName}>{inv.name}</Text>
                      <Text style={styles.alertItemSub}>
                        RD:{" "}
                        {formatCurrency(
                          inv.rdMonthlyAmount,
                          isStealthMode,
                          currencySymbol,
                        )}{" "}
                        • Month {(inv.rdCompletedMonths || 0) + 1}/
                        {inv.rdTotalMonths || "?"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.alertConfirmBtn,
                        { backgroundColor: "#14B8A6" },
                      ]}
                    >
                      <Text style={styles.alertConfirmText}>Pay</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Asset Allocation Proportional Bar */}
            <AssetAllocationBar
              breakdown={portfolioMetrics?.typeBreakdown || []}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              isStealthMode={isStealthMode}
              currencySymbol={currencySymbol}
            />

            {/* Search and Sort Filter Row */}
            <View style={styles.filterRow}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color="#71717A" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search holdings..."
                  placeholderTextColor="#71717A"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#71717A" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.sortBtn}
                onPress={() => setShowSortPicker(true)}
              >
                <Ionicons name="swap-vertical" size={16} color="#0F766E" />
                <Text style={styles.sortBtnText}>Sort</Text>
              </TouchableOpacity>
            </View>

            {/* Holdings Cards List */}
            {investments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="wallet-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No investments tracked</Text>
                <Text style={styles.emptyText}>
                  Track your mutual funds, FDs, stocks, gold, and PPF in one
                  clean portfolio.
                </Text>
                <View style={styles.emptyBtnRow}>
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setShowAddModal(true)}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.emptyAddBtnText}>Add Investment</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emptyImportBtn}
                    onPress={() => setShowImportModal(true)}
                  >
                    <Ionicons
                      name="download-outline"
                      size={16}
                      color="#0F766E"
                    />
                    <Text style={styles.emptyImportBtnText}>Import CSV</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : filteredInvestments.length === 0 ? (
              <View style={styles.emptyFilterBox}>
                <Text style={styles.emptyFilterTitle}>No results found</Text>
                <Text style={styles.emptyFilterSub}>
                  Try clearing your search query or category filter.
                </Text>
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory(null);
                  }}
                >
                  <Text style={styles.resetFilterText}>Reset Filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredInvestments.map((inv) => (
                <InvestmentCard
                  key={inv.id}
                  investment={inv}
                  isStealthMode={isStealthMode}
                  currencySymbol={currencySymbol}
                  onPress={() => openInvestmentDetails(inv)}
                  onAddAmount={() => {
                    setEditingInvestment(inv);
                    setAddAmtValue("");
                    setAddAmtCurrentValue("");
                    setAddAmtNote("");
                    setAddAmtDate(new Date());
                    setAddAmtExchangeRate(
                      inv.exchangeRate !== undefined && inv.exchangeRate !== null
                        ? inv.exchangeRate.toString()
                        : "1"
                    );
                    setShowAddAmtDatePicker(false);
                    setShowAddAmountModal(true);
                  }}
                  onUpdateValue={() => {
                    setEditingInvestment(inv);
                    setShowQuickUpdateModal(true);
                  }}
                  onViewHistory={() => {
                    setEditingInvestment(inv);
                    setShowTxnHistoryModal(true);
                  }}
                  onOpenActions={() => openInvestmentDetails(inv)}
                />
              ))
            )}
          </>
        )}

        {/* ================= HISTORY TAB ================= */}
        {activeTab === "history" && (
          <PortfolioHistoryView
            transactions={historyTransactions}
            isStealthMode={isStealthMode}
            currencySymbol={currencySymbol}
            onExportHistory={() =>
              exportTransactionHistoryCSV(historyTransactions)
            }
          />
        )}
      </ScrollView>

      {/* ================= MODALS ================= */}

      {/* 0. Comprehensive Investment Detail & Actions Modal */}
      <InvestmentDetailModal
        visible={showDetailModal}
        investment={editingInvestment}
        isStealthMode={isStealthMode}
        currencySymbol={currencySymbol}
        onClose={() => setShowDetailModal(false)}
        onOpenQuickUpdate={(inv) => {
          setEditingInvestment(inv);
          setShowQuickUpdateModal(true);
        }}
        onOpenAddAmount={(inv) => {
          setEditingInvestment(inv);
          setAddAmtValue("");
          setAddAmtCurrentValue("");
          setAddAmtNote("");
          setAddAmtDate(new Date());
          setAddAmtExchangeRate(
            inv.exchangeRate !== undefined && inv.exchangeRate !== null
              ? inv.exchangeRate.toString()
              : "1"
          );
          setShowAddAmtDatePicker(false);
          setShowAddAmountModal(true);
        }}
        onOpenEditDetails={(inv) => {
          setEditingInvestment(inv);
          setShowEditDetailsModal(true);
        }}
        onOpenWithdraw={(inv) => {
          setEditingInvestment(inv);
          setShowWithdrawModal(true);
        }}
        onOpenHistory={(inv) => {
          setEditingInvestment(inv);
          setShowTxnHistoryModal(true);
        }}
        onDelete={(inv) => handleDelete(inv)}
        onPayRd={(inv) => {
          setEditingInvestment(inv);
          setRdPayAmount((inv.rdMonthlyAmount || "").toString());
          setShowRdPayModal(true);
        }}
        onConfirmSip={(inv) => {
          setCurrentSipInvestment(inv);
          setSipConfirmAmount((inv.sipAmount || "").toString());
          setShowSipModal(true);
        }}
      />

      {/* 0.1 Quick Value Update Modal (Invested & Current Value) */}
      <QuickValueUpdateModal
        visible={showQuickUpdateModal}
        investment={editingInvestment}
        currencySymbol={currencySymbol}
        onClose={() => {
          setShowQuickUpdateModal(false);
          setEditingInvestment(null);
        }}
        onSuccessUpdate={() => {
          fetchInvestments();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {/* 0.2 Notification Settings Modal */}
      <NotificationSettingsModal
        visible={showNotificationSettingsModal}
        onClose={() => setShowNotificationSettingsModal(false)}
      />

      {/* 1. Report & Statement Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        investments={investments}
        totals={totals}
        portfolioXirr={portfolioMetrics?.portfolioXirr}
        userProfile={userProfile}
        isStealthMode={isStealthMode}
        currencySymbol={currencySymbol}
      />

      {/* 2. Import CSV Modal */}
      <ImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccessImport={fetchInvestments}
      />

      {/* 3. Full Investment Edit Modal */}
      <InvestmentEditModal
        visible={showEditDetailsModal}
        investment={editingInvestment}
        currencySymbol={currencySymbol}
        onClose={() => {
          setShowEditDetailsModal(false);
          setEditingInvestment(null);
        }}
        onSuccessUpdate={fetchInvestments}
        onDelete={(inv) => handleDelete(inv)}
      />

      {/* 4. Withdraw / Redeem Modal */}
      <WithdrawModal
        visible={showWithdrawModal}
        investment={editingInvestment}
        bankAccounts={bankAccounts}
        currencySymbol={currencySymbol}
        onClose={() => {
          setShowWithdrawModal(false);
          setEditingInvestment(null);
        }}
        onSuccessWithdraw={fetchInvestments}
      />

      {/* 5. Sort Picker Modal */}
      <Modal visible={showSortPicker} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSortPicker(false)}
        >
          <View style={styles.sortModalBox}>
            <Text style={styles.sortModalTitle}>Sort Holdings</Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.sortOption,
                  sortOption === opt.id && styles.sortOptionSelected,
                ]}
                onPress={() => {
                  setSortOption(opt.id);
                  setShowSortPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === opt.id && styles.sortOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {sortOption === opt.id && (
                  <Ionicons name="checkmark" size={18} color="#0F766E" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 6. Add Investment Modal */}
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
                        resetAddForm();
                      }}
                    >
                      <Ionicons name="close" size={24} color="#71717A" />
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
                    <Ionicons name="chevron-down" size={18} color="#71717A" />
                  </TouchableOpacity>

                  {/* Name */}
                  <Text style={styles.modalLabel}>Investment Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Vanguard S&P 500 ETF, HDFC Midcap"
                    placeholderTextColor="#71717A"
                    value={invName}
                    onChangeText={handleInvNameChange}
                  />

                  {/* Platform */}
                  <Text style={styles.modalLabel}>Platform / Broker (Optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., INDmoney, Alpaca, Zerodha, Bank"
                    placeholderTextColor="#71717A"
                    value={invPlatform}
                    onChangeText={handleInvPlatformChange}
                  />

                  {/* Early Foreign Asset Detection Banner */}
                  {detectedForeign?.isForeign && (
                    <View style={styles.foreignDetectionBanner}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="globe" size={16} color="#0284C7" />
                        <Text style={styles.foreignDetectionTitle}>
                          Foreign Asset Detected ({detectedForeign.currency})
                        </Text>
                      </View>
                      <Text style={styles.foreignDetectionSubtitle}>
                        {detectedForeign.reason} • Automatically flagged as {detectedForeign.currency} ({getCurrencySymbol(detectedForeign.currency)}) with default exchange rate ₹{detectedForeign.defaultRate}.
                      </Text>
                    </View>
                  )}

                  {/* Currency Selection */}
                  <Text style={styles.modalLabel}>Currency</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginVertical: 6 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {CURRENCIES.map((c) => (
                      <TouchableOpacity
                        key={c.code}
                        onPress={() => {
                          setUserChangedCurrencyManually(true);
                          setInvCurrency(c.code);
                          if (c.code === baseCurrency) {
                            setInvExchangeRate("1");
                          } else {
                            setInvExchangeRate(getDefaultExchangeRate(c.code).toString());
                          }
                        }}
                        style={[
                          styles.currencyChip,
                          invCurrency === c.code && styles.activeCurrencyChip,
                        ]}
                      >
                        <Text
                          style={[
                            styles.currencyChipText,
                            invCurrency === c.code && styles.activeCurrencyChipText,
                          ]}
                        >
                          {c.code} ({c.symbol})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Foreign Currency Exchange Rate Input */}
                  {invCurrency !== baseCurrency && (
                    <View style={styles.foreignRateBox}>
                      <Text style={styles.modalLabel}>
                        Exchange Rate (1 {invCurrency} = ? {currencySymbol}) *
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g., 86.50"
                        placeholderTextColor="#71717A"
                        value={invExchangeRate}
                        onChangeText={(v) => setInvExchangeRate(cleanDecimal(v))}
                        keyboardType="numeric"
                      />
                      {parseFloat(invExchangeRate) > 0 && parseFloat(invAmount) > 0 && (
                        <Text style={styles.conversionHint}>
                          ≈ {currencySymbol}{((parseFloat(invAmount) || 0) * (parseFloat(invExchangeRate) || 1)).toLocaleString("en-IN")} converted to base currency
                        </Text>
                      )}
                    </View>
                  )}

                  {/* RD Specific Fields */}
                  {invType.id === "rd" && (
                    <>
                      <Text style={styles.modalLabel}>
                        Monthly Installment ({getCurrencySymbol(invCurrency, currencySymbol)}) *
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="5000"
                        placeholderTextColor="#71717A"
                        value={invRdMonthly}
                        onChangeText={(v) =>
                          setInvRdMonthly(cleanDecimal(v))
                        }
                        keyboardType="numeric"
                      />

                      <Text style={styles.modalLabel}>Total Months *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g. 12, 24, 36"
                        placeholderTextColor="#71717A"
                        value={invRdMonths}
                        onChangeText={(v) =>
                          setInvRdMonths(v.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="numeric"
                      />

                      <Text style={styles.modalLabel}>Already Completed Months</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor="#71717A"
                        value={invRdCompletedMonths}
                        onChangeText={(v) =>
                          setInvRdCompletedMonths(v.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="numeric"
                      />
                    </>
                  )}

                  {/* Non-RD Invested & Current Value */}
                  {invType.id !== "rd" && (
                    <>
                      <Text style={styles.modalLabel}>
                        Invested Amount ({getCurrencySymbol(invCurrency, currencySymbol)}) *
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder={invCurrency !== baseCurrency ? "100.00" : "50000"}
                        placeholderTextColor="#71717A"
                        value={invAmount}
                        onChangeText={(v) =>
                          setInvAmount(cleanDecimal(v))
                        }
                        keyboardType="numeric"
                      />
                      {invCurrency !== baseCurrency && parseFloat(invAmount) > 0 && parseFloat(invExchangeRate) > 0 && (
                        <Text style={styles.conversionHint}>
                          ≈ {currencySymbol}{((parseFloat(invAmount) || 0) * (parseFloat(invExchangeRate) || 1)).toLocaleString("en-IN")} in base currency
                        </Text>
                      )}

                      <Text style={styles.modalLabel}>
                        Current Market Value ({getCurrencySymbol(invCurrency, currencySymbol)})
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Leave blank if same as invested"
                        placeholderTextColor="#71717A"
                        value={invCurrentValue}
                        onChangeText={(v) =>
                          setInvCurrentValue(cleanDecimal(v))
                        }
                        keyboardType="numeric"
                      />
                      {invCurrency !== baseCurrency && parseFloat(invCurrentValue) > 0 && parseFloat(invExchangeRate) > 0 && (
                        <Text style={styles.conversionHint}>
                          ≈ {currencySymbol}{((parseFloat(invCurrentValue) || 0) * (parseFloat(invExchangeRate) || 1)).toLocaleString("en-IN")} in base currency
                        </Text>
                      )}
                    </>
                  )}

                  {/* SIP Fields */}
                  {invType.id === "mutual_fund" && (
                    <>
                      <Text style={styles.modalLabel}>
                        Monthly SIP Amount (Optional) ({getCurrencySymbol(invCurrency, currencySymbol)})
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="5000"
                        placeholderTextColor="#71717A"
                        value={invSipAmount}
                        onChangeText={(v) =>
                          setInvSipAmount(cleanDecimal(v))
                        }
                        keyboardType="numeric"
                      />

                      <Text style={styles.modalLabel}>SIP Day of Month</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g., 5"
                        placeholderTextColor="#71717A"
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
                    </>
                  )}

                  {/* Fixed Income / FD / RD Interest */}
                  {["fd", "rd", "ppf", "nps", "bonds"].includes(invType.id) && (
                    <>
                      <Text style={styles.modalLabel}>Interest Rate (% p.a.)</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g. 7.1"
                        placeholderTextColor="#71717A"
                        value={invInterestRate}
                        onChangeText={setInvInterestRate}
                        keyboardType="numeric"
                      />

                      <Text style={styles.modalLabel}>Maturity Date (DD/MM/YYYY)</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="DD/MM/YYYY"
                        placeholderTextColor="#71717A"
                        value={invMaturityDate}
                        onChangeText={setInvMaturityDate}
                      />
                    </>
                  )}

                  {/* Payment Source */}
                  <Text style={styles.modalLabel}>Deduct from Asset Account</Text>
                  <TouchableOpacity
                    style={styles.typeSelector}
                    onPress={() => {
                      setPickerType("add");
                      setShowAccountPicker(true);
                    }}
                  >
                    <Ionicons
                      name={payFromAccount ? "wallet" : "business"}
                      size={18}
                      color={payFromAccount ? "#0F766E" : "#71717A"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeSelectorText,
                        !payFromAccount && { color: "#71717A" },
                      ]}
                      numberOfLines={1}
                    >
                      {payFromAccount
                        ? payFromAccount.name
                        : "Select bank or cash (optional)"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#71717A" />
                  </TouchableOpacity>

                  {/* Notes */}
                  <Text style={styles.modalLabel}>Note (Optional)</Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { height: 60, textAlignVertical: "top" },
                    ]}
                    placeholder="Any details..."
                    placeholderTextColor="#71717A"
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
                      <Text style={styles.modalSaveBtnText}>Add Investment</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* 7. Type Picker Modal */}
      <Modal visible={showTypeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Investment Type</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INVESTMENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typeOption,
                    invType.id === t.id && {
                      backgroundColor: `${t.color}15`,
                      borderColor: t.color,
                    },
                  ]}
                  onPress={() => {
                    setInvType(t);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={styles.typeOptionIcon}>{t.icon}</Text>
                  <Text style={styles.typeOptionName}>{t.name}</Text>
                  {invType.id === t.id && (
                    <Ionicons name="checkmark-circle" size={20} color={t.color} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 8. Update Current Value Modal */}
      <Modal visible={showUpdateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: "45%" }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update Current Value</Text>
                <TouchableOpacity onPress={() => setShowUpdateModal(false)}>
                  <Ionicons name="close" size={24} color="#71717A" />
                </TouchableOpacity>
              </View>
              <Text style={styles.subHoldingName}>
                {editingInvestment?.name}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor="#71717A"
                value={updateValue}
                onChangeText={(v) => setUpdateValue(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                onPress={handleUpdateValue}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Value</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 9. Top-Up / Add Amount Modal */}
      <Modal visible={showAddAmountModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { maxHeight: "88%" }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Investment Amount</Text>
                <TouchableOpacity
                  onPress={() => setShowAddAmountModal(false)}
                >
                  <Ionicons name="close" size={24} color="#71717A" />
                </TouchableOpacity>
              </View>

              {/* Holding Info with Foreign Flag */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={styles.subHoldingName}>
                  {editingInvestment?.name}
                </Text>
                {isForeignInvestment(editingInvestment, baseCurrency) && (
                  <View style={styles.foreignBadgeSmall}>
                    <Ionicons name="globe-outline" size={12} color="#0284C7" />
                    <Text style={styles.foreignBadgeSmallText}>
                      {editingInvestment?.currency || "USD"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.modalLabel}>
                Amount to Invest ({getCurrencySymbol(editingInvestment?.currency, currencySymbol)}) *
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={isForeignInvestment(editingInvestment, baseCurrency) ? "100.00" : "10000"}
                placeholderTextColor="#71717A"
                value={addAmtValue}
                onChangeText={(v) =>
                  setAddAmtValue(cleanDecimal(v))
                }
                keyboardType="numeric"
              />

              {/* Foreign Currency Exchange Rate & Conversion for Top-up */}
              {isForeignInvestment(editingInvestment, baseCurrency) && (
                <View style={styles.foreignRateBox}>
                  <Text style={styles.modalLabel}>
                    Exchange Rate (1 {editingInvestment?.currency || "USD"} = ? {currencySymbol}) *
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 86.50"
                    placeholderTextColor="#71717A"
                    value={addAmtExchangeRate}
                    onChangeText={(v) => setAddAmtExchangeRate(cleanDecimal(v))}
                    keyboardType="numeric"
                  />
                  {parseFloat(addAmtValue) > 0 && parseFloat(addAmtExchangeRate) > 0 && (
                    <Text style={styles.conversionHint}>
                      ≈ {currencySymbol}{((parseFloat(addAmtValue) || 0) * (parseFloat(addAmtExchangeRate) || 1)).toLocaleString("en-IN")} converted to base currency
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.modalLabel}>Date of Investment</Text>
              <TouchableOpacity
                style={styles.typeSelector}
                onPress={() => setShowAddAmtDatePicker(true)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="calendar-outline" size={18} color="#0F766E" />
                  <Text style={styles.typeSelectorText}>
                    {addAmtDate.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: "#134E4A", fontFamily: 'Manrope_600SemiBold' }}>Change Date</Text>
              </TouchableOpacity>

              {showAddAmtDatePicker && (
                <DateTimePicker
                  value={addAmtDate || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setShowAddAmtDatePicker(Platform.OS === "ios");
                    if (selectedDate) setAddAmtDate(selectedDate);
                  }}
                />
              )}

              <Text style={styles.modalLabel}>
                Total Market Value After Top-up ({getCurrencySymbol(editingInvestment?.currency, currencySymbol)}) (Optional)
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Leave empty to auto-calculate"
                placeholderTextColor="#71717A"
                value={addAmtCurrentValue}
                onChangeText={(v) =>
                  setAddAmtCurrentValue(cleanDecimal(v))
                }
                keyboardType="numeric"
              />

              <Text style={styles.modalLabel}>Payment Source</Text>
              <TouchableOpacity
                style={styles.typeSelector}
                onPress={() => {
                  setPickerType("addAmount");
                  setShowAccountPicker(true);
                }}
              >
                <Text style={styles.typeSelectorText}>
                  {payFromAccount
                    ? payFromAccount.name
                    : "Select account (optional)"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#71717A" />
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Note (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Monthly top-up, bonus investment, dip buy"
                placeholderTextColor="#71717A"
                value={addAmtNote}
                onChangeText={setAddAmtNote}
              />

              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                onPress={handleAddAmount}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Confirm Add</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 10. SIP Confirmation Modal */}
      <Modal visible={showSipModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "55%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm SIP</Text>
              <TouchableOpacity onPress={() => setShowSipModal(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subHoldingName}>
              {currentSipInvestment?.name}
            </Text>
            <Text style={styles.modalLabel}>SIP Amount</Text>
            <TextInput
              style={styles.modalInput}
              value={sipConfirmAmount}
              onChangeText={(v) =>
                setSipConfirmAmount(v.replace(/[^0-9]/g, ""))
              }
              keyboardType="numeric"
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1, backgroundColor: "#E5E2DC" }]}
                onPress={handleSipSkip}
              >
                <Text style={[styles.modalSaveBtnText, { color: "#475569" }]}>
                  Skip SIP
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 2 }]}
                onPress={handleSipConfirm}
                disabled={saving}
              >
                <Text style={styles.modalSaveBtnText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. RD Payment Modal */}
      <Modal visible={showRdPayModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "55%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay RD Installment</Text>
              <TouchableOpacity onPress={() => setShowRdPayModal(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subHoldingName}>
              {editingInvestment?.name}
            </Text>
            <Text style={styles.modalLabel}>Payment Amount</Text>
            <TextInput
              style={styles.modalInput}
              value={rdPayAmount}
              onChangeText={(v) => setRdPayAmount(v.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[
                styles.modalSaveBtn,
                { backgroundColor: "#14B8A6", marginTop: 16 },
              ]}
              onPress={handleRdPayment}
              disabled={saving}
            >
              <Text style={styles.modalSaveBtnText}>Confirm RD Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 12. Transaction History Modal for Single Holding */}
      <Modal visible={showTxnHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "65%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction History</Text>
              <TouchableOpacity onPress={() => setShowTxnHistoryModal(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subHoldingName}>
              {editingInvestment?.name}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(editingInvestment?.transactions || [])
                .slice()
                .reverse()
                .map((txn, idx) => (
                  <View key={txn.id || idx} style={styles.historyItemRow}>
                    <View>
                      <Text style={styles.historyItemAmount}>
                        ₹{(txn.amount || 0).toLocaleString("en-IN")}
                      </Text>
                      <Text style={styles.historyItemDate}>
                        {new Date(txn.date).toLocaleDateString("en-IN")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.historyItemType}>{txn.type}</Text>
                      {txn.note ? (
                        <Text style={styles.historyItemNote}>{txn.note}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              {(editingInvestment?.transactions || []).length === 0 && (
                <Text style={styles.noTxnsText}>No transactions recorded</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 13. Universal Account Picker Modal */}
      <Modal visible={showAccountPicker} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "60%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Account</Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
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
                <Text style={styles.accountName}>None (Do not deduct)</Text>
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
                  <Text style={styles.accountName}>{acc.name}</Text>
                  <Text style={styles.accountBalance}>
                    Balance: ₹{(acc.balance || 0).toLocaleString("en-IN")}
                  </Text>
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
  container: {
    flex: 1,
    backgroundColor: "#F7F6F2",
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ECEAE4",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E6F2F0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0F766E",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Alert
  alertCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#92400E",
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  alertItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  alertItemName: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  alertItemSub: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 2,
  },
  alertConfirmBtn: {
    backgroundColor: "#0F766E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alertConfirmText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
  },

  // Filter & Search
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    padding: 0,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  sortBtnText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ECEAE4",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#71717A",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F766E",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
  },
  emptyImportBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F2F0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  emptyImportBtnText: {
    color: "#0F766E",
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
  },
  emptyFilterBox: {
    alignItems: "center",
    padding: 30,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginTop: 10,
  },
  emptyFilterTitle: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  emptyFilterSub: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 4,
  },
  resetFilterBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#E6F2F0",
  },
  resetFilterText: {
    fontSize: 12,
    color: "#0F766E",
    fontFamily: 'Manrope_700Bold',
  },

  // Modals generic
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  modalLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: "#475569",
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ECEAE4",
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  activeCurrencyChip: {
    backgroundColor: "#E6F2F0",
    borderColor: "#134E4A",
  },
  currencyChipText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: "#475569",
  },
  activeCurrencyChipText: {
    color: "#0F766E",
    fontFamily: 'Manrope_700Bold',
  },
  foreignRateBox: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  foreignDetectionBanner: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  foreignDetectionTitle: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: "#0369A1",
  },
  foreignDetectionSubtitle: {
    fontSize: 11,
    color: "#0284C7",
    marginTop: 3,
    lineHeight: 15,
  },
  foreignBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  foreignBadgeSmallText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: "#0284C7",
  },
  conversionHint: {
    fontSize: 11,
    color: "#0284C7",
    fontFamily: 'Manrope_600SemiBold',
    marginTop: 4,
  },
  subHoldingName: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
    marginBottom: 10,
  },
  modalSaveBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
  },
  typeSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeSelectorIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  typeSelectorText: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontFamily: 'Manrope_600SemiBold',
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E2DC",
    marginBottom: 6,
  },
  typeOptionIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  typeOptionName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: "#0F172A",
  },
  accountOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  accountOptionSelected: {
    backgroundColor: "#E6F2F0",
  },
  accountName: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: "#0F172A",
  },
  accountBalance: {
    fontSize: 12,
    color: "#71717A",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  sortModalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  sortModalTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  sortOptionSelected: {
    backgroundColor: "#F8FAFC",
  },
  sortOptionText: {
    fontSize: 14,
    color: "#475569",
    fontFamily: 'Manrope_500Medium',
  },
  sortOptionTextSelected: {
    color: "#0F766E",
    fontFamily: 'Manrope_700Bold',
  },
  historyItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  historyItemAmount: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  historyItemDate: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 2,
  },
  historyItemType: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },
  historyItemNote: {
    fontSize: 10,
    color: "#71717A",
    marginTop: 2,
  },
  noTxnsText: {
    textAlign: "center",
    color: "#71717A",
    padding: 20,
    fontSize: 13,
  },
});

export default PortfolioScreen;
