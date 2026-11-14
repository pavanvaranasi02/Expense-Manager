import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
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
import { logAnalyticsEvent } from "../../config/firebase";
import { FAMILY_CATEGORIES } from "../../constants/familyCategories";
import { addFamilyExpense } from "../../services/familyExpenseService";
import { createFamilyTemplate } from "../../services/familyTemplateService";
import useAuthStore from "../../store/useAuthStore";
import useFamilyStore from "../../store/useFamilyStore";

const RECURRENCE_TYPES = [
  { id: "WEEKLY", label: "Weekly" },
  { id: "MONTHLY", label: "Monthly" },
  { id: "YEARLY", label: "Yearly" },
];

const AddTemplateScreen = ({ navigation }) => {
  const userId = useAuthStore((s) => s.user?.uid);
  const userProfile = useAuthStore((s) => s.userProfile);
  const { family, members } = useFamilyStore();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    FAMILY_CATEGORIES[0],
  );
  const [selectedPayer, setSelectedPayer] = useState(
    members.find((m) => m.userId === userId) || members[0],
  );
  const [note, setNote] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("MONTHLY");
  const [frequency, setFrequency] = useState(1);
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [autoCreate, setAutoCreate] = useState(true);
  const [createNow, setCreateNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Check if past dates are allowed
  const allowPastRecurring =
    userProfile?.settings?.family?.allowPastRecurring ?? false;

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Name required",
        text2: "Please enter a name for this template",
      });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid amount",
        text2: "Please enter a valid amount",
      });
      return;
    }
    if (!family?.id) {
      Toast.show({
        type: "error",
        text1: "Family not found",
        text2: "Please try again",
      });
      return;
    }

    setLoading(true);

    try {
      console.log("📝 Creating template:", {
        name: name.trim(),
        familyId: family.id,
        createNow,
      });

      const templateData = {
        name: name.trim(),
        amount: parseFloat(amount),
        category: selectedCategory.id,
        categoryIcon: selectedCategory.icon,
        categoryName: selectedCategory.name,
        paidBy: selectedPayer.userId,
        paidByName: selectedPayer.displayName,
        splitType: "PAID_FOR_ALL",
        splitDetails: {},
        note: note.trim(),
        recurrence: {
          type: recurrenceType,
          frequency: parseInt(frequency) || 1,
          startDate: startDate.toISOString(),
        },
        autoCreate,
      };

      // First, create the template
      const templateResult = await createFamilyTemplate(
        family.id,
        templateData,
      );

      console.log("📝 Template result:", templateResult);

      if (templateResult.success) {
        // If createNow is enabled, also create an expense
        if (createNow) {
          // Determine the expense date based on settings and start date
          const expenseDate = allowPastRecurring
            ? startDate // Use selected start date if past dates allowed
            : new Date(); // Use today's date if past dates not allowed

          const expenseData = {
            amount: parseFloat(amount),
            category: selectedCategory.id,
            categoryIcon: selectedCategory.icon,
            categoryName: selectedCategory.name,
            paidBy: selectedPayer.userId,
            paidByName: selectedPayer.displayName,
            splitType: "PAID_FOR_ALL",
            splitDetails: {},
            date: expenseDate.toISOString(),
            note: `${name.trim()} (Recurring - ${allowPastRecurring && startDate < new Date() ? "Backdated" : "Created now"})`,
          };

          const syncToPersonal = selectedPayer.userId === userId;
          const expenseResult = await addFamilyExpense(
            family.id,
            expenseData,
            syncToPersonal,
          );

          if (expenseResult.success) {
            console.log(
              "✅ Immediate expense created:",
              expenseResult.expenseId,
            );
          } else {
            console.log(
              "⚠️ Failed to create immediate expense:",
              expenseResult.error,
            );
          }
        }

        Toast.show({
          type: "success",
          text1: "Template Created",
          text2: createNow
            ? "Template & expense created successfully"
            : "Recurring expense template saved",
          visibilityTime: 2000,
        });
        logAnalyticsEvent("create_family_template");
        // Delay navigation to show toast
        setTimeout(() => {
          navigation.goBack();
        }, 500);
      } else {
        Toast.show({
          type: "error",
          text1: "Failed to create",
          text2: templateResult.error,
        });
      }
    } catch (error) {
      console.log("❌ Template error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Recurring Expense</Text>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#134E4A" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Template Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Template Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Monthly Rent, Netflix Subscription"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#71717A"
            />
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountInputWrapper}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor="#71717A"
              />
            </View>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <TouchableOpacity
              style={styles.categoryBtn}
              onPress={() => setShowCategoryModal(true)}
            >
              <View
                style={[
                  styles.categoryIcon,
                  {
                    backgroundColor: selectedCategory.icon + "15" || "#ECEAE4",
                  },
                ]}
              >
                <Ionicons
                  name={selectedCategory.icon || "ellipsis-horizontal"}
                  size={20}
                  color="#134E4A"
                />
              </View>
              <Text style={styles.categoryBtnText}>
                {selectedCategory.name}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#71717A" />
            </TouchableOpacity>
          </View>

          {/* Paid By */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Paid By</Text>
            <View style={styles.payerContainer}>
              {members.map((member) => (
                <TouchableOpacity
                  key={member.userId}
                  style={[
                    styles.payerBtn,
                    selectedPayer.userId === member.userId &&
                      styles.payerBtnActive,
                  ]}
                  onPress={() => setSelectedPayer(member)}
                >
                  <Text
                    style={[
                      styles.payerBtnText,
                      selectedPayer.userId === member.userId &&
                        styles.payerBtnTextActive,
                    ]}
                  >
                    {member.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recurrence */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recurrence</Text>
            <View style={styles.recurrenceRow}>
              {RECURRENCE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.recurrenceBtn,
                    recurrenceType === type.id && styles.recurrenceBtnActive,
                  ]}
                  onPress={() => setRecurrenceType(type.id)}
                >
                  <Text
                    style={[
                      styles.recurrenceBtnText,
                      recurrenceType === type.id &&
                        styles.recurrenceBtnTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.frequencyRow}>
              <Text style={styles.frequencyLabel}>Every</Text>
              <TextInput
                style={styles.frequencyInput}
                keyboardType="number-pad"
                value={String(frequency)}
                onChangeText={(val) => setFrequency(parseInt(val) || 1)}
              />
              <Text style={styles.frequencyUnit}>
                {recurrenceType.toLowerCase()}
                {frequency > 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {/* Start Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start Date</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#134E4A" />
              <Text style={styles.dateBtnText}>
                {startDate.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auto Create */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.autoCreateRow}
              onPress={() => setAutoCreate(!autoCreate)}
            >
              <View>
                <Text style={styles.autoCreateTitle}>Auto-create expenses</Text>
                <Text style={styles.autoCreateDesc}>
                  Automatically add expenses when due
                </Text>
              </View>
              <View style={[styles.toggle, autoCreate && styles.toggleActive]}>
                <View
                  style={[
                    styles.toggleKnob,
                    autoCreate && styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Create Expense Now */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.autoCreateRow}
              onPress={() => setCreateNow(!createNow)}
            >
              <View>
                <Text style={styles.autoCreateTitle}>
                  Create expense immediately
                </Text>
                <Text style={styles.autoCreateDesc}>
                  {allowPastRecurring
                    ? `Expense will be created at the selected start date`
                    : `Expense will be created at today's date`}
                </Text>
              </View>
              <View style={[styles.toggle, createNow && styles.toggleActive]}>
                <View
                  style={[
                    styles.toggleKnob,
                    createNow && styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note (Optional)</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Add a note..."
              value={note}
              onChangeText={setNote}
              placeholderTextColor="#71717A"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#18181B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {FAMILY_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.modalItem,
                    selectedCategory.id === cat.id && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <View
                    style={[
                      styles.modalItemIcon,
                      { backgroundColor: cat.color + "15" },
                    ]}
                  >
                    <Ionicons name={cat.icon} size={20} color={cat.color} />
                  </View>
                  <Text style={styles.modalItemText}>{cat.name}</Text>
                  {selectedCategory.id === cat.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#134E4A"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selectedDate) setStartDate(selectedDate);
          }}
          minimumDate={allowPastRecurring ? undefined : new Date()}
        />
      )}

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F6F2" },
  keyboardView: { flex: 1 },
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
  headerTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: "#18181B" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: "#134E4A" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#18181B",
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  currencySymbol: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    color: "#134E4A",
    marginRight: 8,
  },
  amountInput: { flex: 1, fontSize: 20, fontFamily: 'Manrope_700Bold', color: "#18181B" },
  categoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  payerContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  payerBtnActive: { backgroundColor: "#134E4A", borderColor: "#134E4A" },
  payerBtnText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: "#71717A" },
  payerBtnTextActive: { color: "#FFFFFF" },
  recurrenceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  recurrenceBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    alignItems: "center",
  },
  recurrenceBtnActive: { backgroundColor: "#134E4A", borderColor: "#134E4A" },
  recurrenceBtnText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: "#71717A" },
  recurrenceBtnTextActive: { color: "#FFFFFF" },
  frequencyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  frequencyLabel: { fontSize: 15, color: "#71717A", marginRight: 8 },
  frequencyInput: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    width: 50,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 8,
    paddingVertical: 6,
  },
  frequencyUnit: { fontSize: 15, color: "#71717A", marginLeft: 8 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E2DC",
    gap: 10,
  },
  dateBtnText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: "#18181B" },
  autoCreateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  autoCreateTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: "#18181B" },
  autoCreateDesc: { fontSize: 13, color: "#71717A", marginTop: 4 },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E2DC",
    padding: 2,
  },
  toggleActive: { backgroundColor: "#134E4A" },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobActive: { transform: [{ translateX: 22 }] },
  noteInput: { minHeight: 80 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  modalTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: "#18181B" },
  modalList: { padding: 16 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalItemActive: { backgroundColor: "#E6F2F0" },
  modalItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalItemText: { flex: 1, fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: "#18181B" },
});

export default AddTemplateScreen;
