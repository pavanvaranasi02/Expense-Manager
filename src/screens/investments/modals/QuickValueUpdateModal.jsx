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
import {
  cleanDecimal,
  getCurrencySymbol,
  isForeignInvestment,
} from "../../../constants/currencies";
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
  const [exchangeRate, setExchangeRate] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const invCurrency = investment?.currency || "INR";
  const nativeSymbol = getCurrencySymbol(invCurrency, currencySymbol);
  const isForeign = isForeignInvestment(investment, "INR") || (investment?.exchangeRate && investment.exchangeRate !== 1);

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
      setExchangeRate(
        investment.exchangeRate !== undefined && investment.exchangeRate !== null
          ? investment.exchangeRate.toString()
          : "1"
      );
      setNote("");
    }
  }, [investment, visible]);

  const numInvested = parseFloat(investedAmount) || 0;
  const numCurrent = parseFloat(currentValue) || 0;
  const numRate = parseFloat(exchangeRate) > 0 ? parseFloat(exchangeRate) : 1;
  const absoluteGain = numCurrent - numInvested;
  const gainPercent = numInvested > 0 ? ((absoluteGain / numInvested) * 100).toFixed(2) : "0.00";
  const isGain = absoluteGain >= 0;

  const applyPercentageGain = (pct) => {
    if (numInvested > 0) {
      const rawVal = numInvested * (1 + pct / 100);
      const newVal = isForeign ? rawVal.toFixed(2) : Math.round(rawVal).toString();
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
    if (isForeign && (!exchangeRate || isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0)) {
      Alert.alert("Required", "Please enter a valid positive exchange rate");
      return;
    }

    setSaving(true);
    const updatePayload = {
      investedAmount: numInvested,
      currentValue: numCurrent,
    };
    if (isForeign) {
      updatePayload.exchangeRate = parseFloat(exchangeRate);
    }
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
              <Ionicons name="close" size={22} color="#71717A" />
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
                    { color: isGain ? "#047857" : "#DC2626" },
                  ]}
                >
                  {isGain ? "+" : ""}
                  {formatCurrency(absoluteGain, false, nativeSymbol)}
                </Text>
                {isForeign && (
                  <Text style={{ fontSize: 11, color: isGain ? "#047857" : "#DC2626", marginTop: 2, fontFamily: 'Manrope_600SemiBold' }}>
                    ≈ {isGain ? "+" : ""}{formatCurrency(absoluteGain * numRate, false, currencySymbol)}
                  </Text>
                )}
              </View>
              <View style={styles.previewColRight}>
                <View
                  style={[
                    styles.returnPill,
                    { backgroundColor: isGain ? "#047857" : "#B91C1C" },
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
                <Text style={styles.label}>Invested Amount ({nativeSymbol})</Text>
                <Text style={styles.subLabel}>Total capital invested</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>{nativeSymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={investedAmount}
                  onChangeText={(v) => setInvestedAmount(cleanDecimal(v))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#71717A"
                />
              </View>
              {isForeign && numInvested > 0 && (
                <Text style={{ fontSize: 11, color: "#71717A", marginTop: 2, fontFamily: 'Manrope_500Medium' }}>
                  ≈ {currencySymbol}{(numInvested * numRate).toLocaleString("en-IN")} in base currency
                </Text>
              )}
            </View>

            {/* Input 2: Current Market Value */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Current Value ({nativeSymbol})</Text>
                <Text style={styles.subLabel}>Current market valuation</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>{nativeSymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={currentValue}
                  onChangeText={(v) => setCurrentValue(cleanDecimal(v))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#71717A"
                />
              </View>
              {isForeign && numCurrent > 0 && (
                <Text style={{ fontSize: 11, color: "#71717A", marginTop: 2, fontFamily: 'Manrope_500Medium' }}>
                  ≈ {currencySymbol}{(numCurrent * numRate).toLocaleString("en-IN")} in base currency
                </Text>
              )}

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

            {/* Foreign Exchange Rate Update if applicable */}
            {isForeign && (
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    Exchange Rate (1 {invCurrency} = ? {currencySymbol})
                  </Text>
                  <Text style={styles.subLabel}>Update forex conversion</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={exchangeRate}
                    onChangeText={(v) => setExchangeRate(cleanDecimal(v))}
                    keyboardType="numeric"
                    placeholder="e.g. 86.5"
                    placeholderTextColor="#71717A"
                  />
                </View>
              </View>
            )}

            {/* Note / Reason (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Update Note (Optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Monthly statement revaluation"
                placeholderTextColor="#71717A"
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
    backgroundColor: "#E6F2F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  subTitle: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECEAE4",
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
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
    textTransform: "uppercase",
  },
  previewValue: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
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
    fontFamily: 'Manrope_700Bold',
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
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  subLabel: {
    fontSize: 11,
    color: "#71717A",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E5E2DC",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#71717A",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: "#ECEAE4",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: "#475569",
  },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    marginTop: 6,
  },
  saveBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    elevation: 2,
    shadowColor: "#0F766E",
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
    fontFamily: 'Manrope_700Bold',
  },
});

export default QuickValueUpdateModal;
