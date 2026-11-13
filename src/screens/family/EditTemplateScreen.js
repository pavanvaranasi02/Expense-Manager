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
import { logAnalyticsEvent } from "../../config/firebase";
import { FAMILY_CATEGORIES } from "../../constants/familyCategories";
import {
  getFamilyTemplates,
  updateFamilyTemplate,
} from "../../services/familyTemplateService";
import useAuthStore from "../../store/useAuthStore";
import useFamilyStore from "../../store/useFamilyStore";

const RECURRENCE_TYPES = [
  { id: "WEEKLY", label: "Weekly" },
  { id: "MONTHLY", label: "Monthly" },
  { id: "YEARLY", label: "Yearly" },
];

const EditTemplateScreen = ({ navigation, route }) => {
  const { templateId } = route.params;
  const userId = useAuthStore((s) => s.user?.uid);
  const { family, members } = useFamilyStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(FAMILY_CATEGORIES[0]);
  const [selectedPayer, setSelectedPayer] = useState(null);
  const [note, setNote] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("MONTHLY");
  const [frequency, setFrequency] = useState(1);
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [autoCreate, setAutoCreate] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const result = await getFamilyTemplates(family.id);
      
      if (result.success) {
        const template = result.templates.find((t) => t.id === templateId);
        
        if (template) {
          setName(template.name || "");
          setAmount(String(template.amount || ""));
          setSelectedCategory({
            id: template.category || "miscellaneous",
            name: template.categoryName || "Miscellaneous",
            icon: template.categoryIcon || "ellipsis-horizontal",
          });
          setSelectedPayer({
            userId: template.paidBy || "",
            displayName: template.paidByName || "",
          });
          setNote(template.note || "");
          setRecurrenceType(template.recurrence?.type || "MONTHLY");
          setFrequency(template.recurrence?.frequency || 1);
          setAutoCreate(template.autoCreate ?? true);
          
          if (template.recurrence?.startDate) {
            setStartDate(new Date(template.recurrence.startDate));
          }
        } else {
          Toast.show({
            type: "error",
            text1: "Template not found",
          });
          navigation.goBack();
        }
      }
    } catch (error) {
      console.log("❌ Load template error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

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

    setSaving(true);

    try {
      const updates = {
        name: name.trim(),
        amount: parseFloat(amount),
        category: selectedCategory.id,
        categoryIcon: selectedCategory.icon,
        categoryName: selectedCategory.name,
        paidBy: selectedPayer.userId,
        paidByName: selectedPayer.displayName,
        note: note.trim(),
        recurrence: {
          type: recurrenceType,
          frequency: parseInt(frequency) || 1,
          startDate: startDate.toISOString(),
        },
        autoCreate,
      };

      const result = await updateFamilyTemplate(family.id, templateId, updates);

      if (result.success) {
        Toast.show({
          type: "success",
          text1: "Template Updated",
          text2: "Recurring expense template saved",
          visibilityTime: 2000,
        });
        logAnalyticsEvent("edit_family_template");
        setTimeout(() => {
          navigation.goBack();
        }, 500);
      } else {
        Toast.show({
          type: "error",
          text1: "Failed to update",
          text2: result.error,
        });
      }
    } catch (error) {
      console.log("❌ Template update error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Recurring Expense</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Recurring Expense</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#6C63FF" />
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
              placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
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
              <View style={[styles.categoryIcon, { backgroundColor: selectedCategory.icon + "15" || "#F1F5F9" }]}>
                <Ionicons name={selectedCategory.icon || "ellipsis-horizontal"} size={20} color="#6C63FF" />
              </View>
              <Text style={styles.categoryBtnText}>{selectedCategory.name}</Text>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
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
                    selectedPayer?.userId === member.userId && styles.payerBtnActive,
                  ]}
                  onPress={() => setSelectedPayer(member)}
                >
                  <Text
                    style={[
                      styles.payerBtnText,
                      selectedPayer?.userId === member.userId && styles.payerBtnTextActive,
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
                      recurrenceType === type.id && styles.recurrenceBtnTextActive,
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
              <Ionicons name="calendar-outline" size={20} color="#6C63FF" />
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
                <View style={[styles.toggleKnob, autoCreate && styles.toggleKnobActive]} />
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
              placeholderTextColor="#94A3B8"
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
                <Ionicons name="close" size={24} color="#1E293B" />
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
                  <View style={[styles.modalItemIcon, { backgroundColor: cat.color + "15" }]}>
                    <Ionicons name={cat.icon} size={20} color={cat.color} />
                  </View>
                  <Text style={styles.modalItemText}>{cat.name}</Text>
                  {selectedCategory.id === cat.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#6C63FF" />
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
          minimumDate={new Date()}
        />
      )}

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FE" },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F8F9FE", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#6C63FF" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  currencySymbol: { fontSize: 20, fontWeight: "700", color: "#6C63FF", marginRight: 8 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: "700", color: "#1E293B" },
  categoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 12 },
  categoryBtnText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1E293B" },
  payerContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  payerBtnActive: { backgroundColor: "#6C63FF", borderColor: "#6C63FF" },
  payerBtnText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  payerBtnTextActive: { color: "#FFFFFF" },
  recurrenceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  recurrenceBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  recurrenceBtnActive: { backgroundColor: "#6C63FF", borderColor: "#6C63FF" },
  recurrenceBtnText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  recurrenceBtnTextActive: { color: "#FFFFFF" },
  frequencyRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  frequencyLabel: { fontSize: 15, color: "#64748B", marginRight: 8 },
  frequencyInput: { fontSize: 15, fontWeight: "700", color: "#1E293B", width: 50, textAlign: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingVertical: 6 },
  frequencyUnit: { fontSize: 15, color: "#64748B", marginLeft: 8 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  dateBtnText: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  autoCreateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  autoCreateTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  autoCreateDesc: { fontSize: 13, color: "#94A3B8", marginTop: 4 },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0", padding: 2 },
  toggleActive: { backgroundColor: "#6C63FF" },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
  toggleKnobActive: { transform: [{ translateX: 22 }] },
  noteInput: { minHeight: 80 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  modalList: { padding: 16 },
  modalItem: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 4 },
  modalItemActive: { backgroundColor: "#F0EFFF" },
  modalItemIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
  modalItemText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1E293B" },
});

export default EditTemplateScreen;
