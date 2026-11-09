import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
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
} from "react-native";
import { updateInvestment } from "../../../services/investmentService";
import { formatCurrency } from "../../../utils/format";

const QuickValueUpdateModal = ({
  visible,
  investment,
  currencySymbol = "₹",
  onClose,
  onSuccessUpdate,
}) => {
  const [investedAmount, setInvestedAmount] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (investment) {
      setInvestedAmount(
        investment.investedAmount !== undefined && investment.investedAmount !== null
          ? investment.investedAmount.toString()
          : ""
      );
      setCurrentValue(
        investment.currentValue !== undefined && investment.currentValue !== null
          ? investment.currentValue.toString()
          : ""
      );
      setNote("");
    }
  }, [investment, visible]);

  const numInvested = parseFloat(investedAmount) || 0;
  const numCurrent = parseFloat(currentValue) || 0;
  const absoluteGain = numCurrent - numInvested;
  const gainPercent = numInvested > 0 ? ((absoluteGain / numInvested) * 100).toFixed(2) : "0.00";
  const isGain = absoluteGain >= 0;

  const applyPercentageGain = (pct) => {
    if (numInvested > 0) {
      const newVal = Math.round(numInvested * (1 + pct / 100));
      setCurrentValue(newVal.toString());
    }
  };

  const handleSave = async () => {
    if (!investedAmount || isNaN(numInvested) || numInvested < 0) {
      Alert.alert("Required", "Please enter a valid invested amount");
      return;
    }
    if (currentValue === "" || isNaN(numCurrent) || numCurrent < 0) {
      Alert.alert("Required", "Please enter a valid current value");
      return;
    }

    setSaving(true);
    const updatePayload = {
      investedAmount: numInvested,
      currentValue: numCurrent,
    };
    if (note.trim()) {
      updatePayload.note = note.trim();
    }

    const res = await updateInvestment(investment.id, updatePayload);
    setSaving(false);

    if (res.success) {
      onSuccessUpdate();
      onClose();
    } else {
      Alert.alert("Error", res.error || "Failed to update values");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Text style={styles.icon}>{investment?.typeIcon || "📈"}</Text>
              </View>
              <View>
                <Text style={styles.title} numberOfLines={1}>
                  Update Values
                </Text>
                <Text style={styles.subTitle} numberOfLines={1}>
                  {investment?.name} • {investment?.typeName || investment?.type}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Live Profit & Loss Preview Banner */}
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: isGain ? "#ECFDF5" : "#FEF2F2",
                  borderColor: isGain ? "#A7F3D0" : "#FECACA",
                },
              ]}
            >
              <View style={styles.previewCol}>
                <Text style={styles.previewLabel}>Estimated Gain / Loss</Text>
                <Text
                  style={[
                    styles.previewValue,
                    { color: isGain ? "#059669" : "#DC2626" },
                  ]}
                >
                  {isGain ? "+" : ""}
                  {formatCurrency(absoluteGain, false, currencySymbol)}
                </Text>
              </View>
              <View style={styles.previewColRight}>
                <View
                  style={[
                    styles.returnPill,
                    { backgroundColor: isGain ? "#10B981" : "#EF4444" },
                  ]}
                >
                  <Ionicons
                    name={isGain ? "trending-up" : "trending-down"}
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.returnPillText}>
                    {isGain ? "+" : ""}
                    {gainPercent}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Input 1: Invested Amount */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Invested Amount ({currencySymbol})</Text>
                <Text style={styles.subLabel}>Total capital invested</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={investedAmount}
                  onChangeText={setInvestedAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Input 2: Current Market Value */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Current Value ({currencySymbol})</Text>
                <Text style={styles.subLabel}>Current market valuation</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={currentValue}
                  onChangeText={setCurrentValue}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Quick valuation presets */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => applyPercentageGain(5)}
                >
                  <Text style={styles.presetText}>+5%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => applyPercentageGain(10)}
                >
                  <Text style={styles.presetText}>+10%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => applyPercentageGain(20)}
                >
                  <Text style={styles.presetText}>+20%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => applyPercentageGain(-5)}
                >
                  <Text style={styles.presetText}>-5%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.presetBtn, { flex: 1.3 }]}
                  onPress={() => setCurrentValue(investedAmount)}
                >
                  <Text style={styles.presetText}>Match Invested</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Note / Reason (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Update Note (Optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Monthly statement revaluation"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.saveBtnContent}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Update Portfolio Values</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  subTitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewCol: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  previewValue: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  previewColRight: {
    alignItems: "flex-end",
  },
  returnPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  returnPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  subLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: "700",
    color: "#64748B",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    marginTop: 6,
  },
  saveBtn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    elevation: 2,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  saveBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default QuickValueUpdateModal;
