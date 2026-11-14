import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import SplitDetailsModal from "../../components/Family/SplitDetailsModal";
import { Analytics } from "../../config/firebase";
import {
  FAMILY_CATEGORIES,
  SPLIT_TYPES,
  SPLIT_TYPE_LABELS,
} from "../../constants/familyCategories";
import { getAccounts } from "../../services/accountService";
import { addFamilyExpense } from "../../services/familyExpenseService";
import useAuthStore from "../../store/useAuthStore";
import useFamilyStore from "../../store/useFamilyStore";

const AddFamilyExpenseScreen = ({ navigation }) => {
  const userId = useAuthStore((s) => s.user?.uid);
  const userProfile = useAuthStore((s) => s.userProfile);
  const { family, members, addExpenseToStore } = useFamilyStore();

  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    FAMILY_CATEGORIES[0],
  );
  const [selectedPayer, setSelectedPayer] = useState(
    members.find((m) => m.userId === userId) || members[0],
  );
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState("");
  const [syncToPersonal, setSyncToPersonal] = useState(
    userProfile?.settings?.family?.syncFamilyToPersonal ?? true,
  );
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  // Fetch accounts when payer changes to logged-in user
  const fetchAccounts = async () => {
    try {
      const result = await getAccounts();
      if (result.success) {
        // Filter to only bank accounts and credit cards
        const validAccounts = result.accounts.filter(
          (acc) =>
            acc.type === "BANK" ||
            acc.type === "BANK_ACCOUNT" ||
            acc.type === "CREDIT_CARD",
        );
        setAccounts(validAccounts);
        if (validAccounts.length > 0) {
          setSelectedAccount(validAccounts[0]);
        }
        setAccountsLoaded(true);
      }
    } catch (error) {
      console.log("❌ Fetch accounts error:", error);
      setAccountsLoaded(true);
    }
  };

  // Fetch accounts when selected payer changes
  useEffect(() => {
    if (selectedPayer.userId === userId && !accountsLoaded) {
      fetchAccounts();
    }
  }, [selectedPayer]);

  // NEW: Split state
  const [splitType, setSplitType] = useState(SPLIT_TYPES.PAID_FOR_ALL);
  const [splitDetails, setSplitDetails] = useState({});

  // Modals
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPayerPicker, setShowPayerPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);

  const handleSplitSave = (type, details) => {
    setSplitType(type);
    setSplitDetails(details);
  };

  const getSplitSummary = () => {
    if (splitType === SPLIT_TYPES.PAID_FOR_ALL) {
      return "Paid for all members";
    }

    const memberCount = Object.keys(splitDetails).length;
    if (splitType === SPLIT_TYPES.EQUAL) {
      return `Split equally among ${memberCount} member${memberCount !== 1 ? "s" : ""}`;
    }

    if (
      splitType === SPLIT_TYPES.CUSTOM ||
      splitType === SPLIT_TYPES.PERCENTAGE
    ) {
      return `Custom split among ${memberCount} member${memberCount !== 1 ? "s" : ""}`;
    }

    return "Configure split";
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);

    if (!amount || parsedAmount <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid Amount",
        text2: "Please enter a valid amount",
      });
      return;
    }

    // Check if account is selected when payer is logged-in user
    if (
      selectedPayer.userId === userId &&
      !selectedAccount &&
      accounts.length > 0
    ) {
      Toast.show({
        type: "error",
        text1: "Select Account",
        text2: "Please select an account for this expense",
      });
      return;
    }

    setLoading(true);
    try {
      const expenseData = {
        amount: parsedAmount,
        category: selectedCategory.id,
        categoryIcon: selectedCategory.icon,
        categoryName: selectedCategory.name,
        paidBy: selectedPayer.userId,
        paidByName: selectedPayer.displayName,
        splitType,
        splitDetails,
        date: date.toISOString(),
        note: note.trim(),
        // Add account info if payer is logged-in user
        ...(selectedPayer.userId === userId && selectedAccount
          ? {
              accountId: selectedAccount.id,
              accountName: selectedAccount.name,
              accountType: selectedAccount.type,
            }
          : {}),
      };

      const result = await addFamilyExpense(
        family.id,
        expenseData,
        syncToPersonal && selectedPayer.userId === userId,
      );

      if (result.success) {
        Analytics.addFamilyExpense(selectedCategory.id, parsedAmount);

        addExpenseToStore({
          id: result.expenseId,
          ...expenseData,
          date: date.toISOString(),
          createdAt: new Date().toISOString(),
        });

        Toast.show({
          type: "success",
          text1: "Expense Added",
          text2:
            syncToPersonal && selectedPayer.userId === userId
              ? "Synced to your personal expenses"
              : "Added to family expenses",
        });

        navigation.goBack();
      } else {
        Toast.show({
          type: "error",
          text1: "Failed to add expense",
          text2: result.error,
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatDate = (d) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Family Expense</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Amount Input */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
          </View>

          {/* Category */}
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowCategoryPicker(true)}
          >
            <View style={styles.fieldLeft}>
              <View
                style={[
                  styles.fieldIcon,
                  { backgroundColor: selectedCategory.color + "20" },
                ]}
              >
                <Ionicons
                  name={selectedCategory.icon}
                  size={20}
                  color={selectedCategory.color}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Category</Text>
                <Text style={styles.fieldValue}>{selectedCategory.name}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#71717A" />
          </TouchableOpacity>

          {/* Paid By */}
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowPayerPicker(true)}
          >
            <View style={styles.fieldLeft}>
              <View style={[styles.fieldIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="person" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Paid By</Text>
                <Text style={styles.fieldValue}>
                  {selectedPayer.displayName}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#71717A" />
          </TouchableOpacity>

          {/* Account Selection - Only show when logged-in user is the payer */}
          {selectedPayer.userId === userId && (
            <TouchableOpacity
              style={styles.field}
              onPress={() => {
                if (!accountsLoaded) {
                  fetchAccounts();
                }
                setShowAccountPicker(true);
              }}
            >
              <View style={styles.fieldLeft}>
                <View
                  style={[styles.fieldIcon, { backgroundColor: "#D1FAE5" }]}
                >
                  <Ionicons name="wallet" size={20} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Payment Account</Text>
                  {!accountsLoaded ? (
                    <Text style={styles.fieldValue}>Loading accounts...</Text>
                  ) : accounts.length === 0 ? (
                    <Text style={[styles.fieldValue, { color: "#F59E0B" }]}>
                      ⚠️ No bank/credit accounts - defaulting to debt
                    </Text>
                  ) : selectedAccount ? (
                    <Text style={styles.fieldValue}>
                      {selectedAccount.name} (
                      {selectedAccount.type === "CREDIT_CARD"
                        ? "Credit"
                        : "Bank"}
                      )
                    </Text>
                  ) : (
                    <Text style={styles.fieldValue}>Select account</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#71717A" />
            </TouchableOpacity>
          )}

          {/* NEW: Split Details */}
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowSplitModal(true)}
          >
            <View style={styles.fieldLeft}>
              <View style={[styles.fieldIcon, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="people" size={20} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Split Details</Text>
                <Text style={styles.fieldValue} numberOfLines={1}>
                  {getSplitSummary()}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#71717A" />
          </TouchableOpacity>

          {/* Date */}
          <TouchableOpacity
            style={styles.field}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.fieldLeft}>
              <View style={[styles.fieldIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="calendar" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Date</Text>
                <Text style={styles.fieldValue}>{formatDate(date)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#71717A" />
          </TouchableOpacity>

          {/* Note */}
          <View style={styles.noteField}>
            <View style={[styles.fieldIcon, { backgroundColor: "#ECEAE4" }]}>
              <Ionicons name="document-text" size={20} color="#71717A" />
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note (optional)"
              placeholderTextColor="#71717A"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={200}
            />
          </View>

          {/* Sync Toggle */}
          {selectedPayer.userId === userId && (
            <View style={styles.syncCard}>
              <View style={styles.syncLeft}>
                <Ionicons name="sync" size={20} color="#134E4A" />
                <View style={styles.syncText}>
                  <Text style={styles.syncTitle}>Sync to Personal</Text>
                  <Text style={styles.syncDesc}>
                    Also add to your personal expenses
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.toggle, syncToPersonal && styles.toggleActive]}
                onPress={() => setSyncToPersonal(!syncToPersonal)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    syncToPersonal && styles.toggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Info */}
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#134E4A"
            />
            <Text style={styles.infoText}>
              {splitType === SPLIT_TYPES.PAID_FOR_ALL
                ? "This expense will be visible to all family members without split tracking."
                : `This expense will be split using ${SPLIT_TYPE_LABELS[splitType].toLowerCase()} among selected members.`}
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, !amount && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !amount}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Add Expense</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {FAMILY_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    selectedCategory.id === cat.id && styles.categoryItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: cat.color + "20" },
                    ]}
                  >
                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                  </View>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  {selectedCategory.id === cat.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#134E4A"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payer Picker Modal */}
      <Modal visible={showPayerPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Who Paid?</Text>
              <TouchableOpacity onPress={() => setShowPayerPicker(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {members.map((member) => (
                <TouchableOpacity
                  key={member.userId}
                  style={[
                    styles.memberItem,
                    selectedPayer.userId === member.userId &&
                      styles.memberItemActive,
                  ]}
                  onPress={() => {
                    setSelectedPayer(member);
                    setShowPayerPicker(false);
                  }}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>
                      {member.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  {selectedPayer.userId === member.userId && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#134E4A"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Account Picker Modal */}
      <Modal visible={showAccountPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Account</Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            {!accountsLoaded ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#134E4A" />
                <Text style={styles.loadingText}>Loading accounts...</Text>
              </View>
            ) : accounts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="alert-circle-outline"
                  size={48}
                  color="#F59E0B"
                />
                <Text style={styles.emptyTitle}>No Accounts Available</Text>
                <Text style={styles.emptyText}>
                  Please add a bank account or credit card to track payments.
                  {"\n"}
                  Expense will be recorded as debt.
                </Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowAccountPicker(false)}
                >
                  <Text style={styles.closeBtnText}>Continue as Debt</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.accountItem,
                      selectedAccount?.id === account.id &&
                        styles.accountItemActive,
                    ]}
                    onPress={() => {
                      setSelectedAccount(account);
                      setShowAccountPicker(false);
                    }}
                  >
                    <View style={styles.accountLeft}>
                      <View
                        style={[
                          styles.accountIcon,
                          {
                            backgroundColor:
                              account.type === "CREDIT_CARD"
                                ? "#FEE2E2"
                                : "#D1FAE5",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            account.type === "CREDIT_CARD" ? "card" : "business"
                          }
                          size={20}
                          color={
                            account.type === "CREDIT_CARD"
                              ? "#B91C1C"
                              : "#047857"
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.accountName}>{account.name}</Text>
                        <Text style={styles.accountType}>
                          {account.type === "CREDIT_CARD"
                            ? "Credit Card"
                            : "Bank Account"}
                        </Text>
                      </View>
                    </View>
                    {selectedAccount?.id === account.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#134E4A"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* NEW: Split Details Modal */}
      <SplitDetailsModal
        visible={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        members={members}
        amount={amount}
        initialSplitType={splitType}
        initialSplitDetails={splitDetails}
        onSave={handleSplitSave}
      />

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
};

// Styles remain the same as before
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F6F2",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F7F6F2",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  amountSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#71717A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  amountLabel: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: "#71717A",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 32,
    fontFamily: 'Manrope_700Bold',
    color: "#134E4A",
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    minWidth: 100,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECEAE4",
  },
  fieldLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  noteField: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECEAE4",
  },
  noteInput: {
    flex: 1,
    fontSize: 15,
    color: "#18181B",
    marginLeft: 12,
    minHeight: 60,
    textAlignVertical: "top",
  },
  syncCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E6F2F0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  syncLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  syncText: {
    marginLeft: 12,
    flex: 1,
  },
  syncTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
    marginBottom: 2,
  },
  syncDesc: {
    fontSize: 12,
    color: "#71717A",
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E2DC",
    padding: 2,
  },
  toggleActive: {
    backgroundColor: "#134E4A",
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E6F2F0",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#134E4A",
    lineHeight: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#ECEAE4",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#134E4A",
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#134E4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%"
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  modalScroll: {
    padding: 20,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#F7F6F2",
  },
  categoryItemActive: {
    backgroundColor: "#E6F2F0",
    borderWidth: 2,
    borderColor: "#134E4A",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#F7F6F2",
  },
  memberItemActive: {
    backgroundColor: "#E6F2F0",
    borderWidth: 2,
    borderColor: "#134E4A",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E2DC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberInitial: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#71717A",
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  // Account Picker Styles
  loadingState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: "#71717A",
    marginTop: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  closeBtn: {
    backgroundColor: "#134E4A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#FFFFFF",
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#F7F6F2",
  },
  accountItemActive: {
    backgroundColor: "#E6F2F0",
    borderWidth: 2,
    borderColor: "#134E4A",
  },
  accountLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  accountName: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  accountType: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 2,
  },
});

export default AddFamilyExpenseScreen;
