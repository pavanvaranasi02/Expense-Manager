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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CURRENCIES,
  cleanDecimal,
  detectForeignInvestment,
  getDefaultExchangeRate,
  getCurrencySymbol,
  isForeignInvestment,
} from "../../../constants/currencies";
import { updateInvestmentDetails } from "../../../services/investmentService";

const InvestmentEditModal = ({
  visible,
  investment,
  currencySymbol = "₹",
  onClose,
  onSuccessUpdate,
  onDelete,
}) => {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [investedAmount, setInvestedAmount] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [sipAmount, setSipAmount] = useState("");
  const [sipDate, setSipDate] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [maturityAmount, setMaturityAmount] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (investment) {
      setName(investment.name || "");
      setPlatform(investment.platform || "");
      setCurrency(investment.currency || "INR");
      setExchangeRate(
        investment.exchangeRate !== undefined && investment.exchangeRate !== null
          ? investment.exchangeRate.toString()
          : "1"
      );
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
      setSipAmount(investment.sipAmount ? investment.sipAmount.toString() : "");
      setSipDate(investment.sipDate ? investment.sipDate.toString() : "");
      setInterestRate(
        investment.interestRate ? investment.interestRate.toString() : "",
      );
      setMaturityDate(
        investment.maturityDate
          ? new Date(investment.maturityDate).toLocaleDateString("en-IN")
          : "",
      );
      setMaturityAmount(
        investment.maturityAmount ? investment.maturityAmount.toString() : "",
      );
      setNote(investment.note || "");
      setIsActive(investment.isActive !== false);
    }
  }, [investment, visible]);

  const numInvested = parseFloat(investedAmount) || 0;
  const numCurrent = parseFloat(currentValue) || 0;
  const numRate = parseFloat(exchangeRate) > 0 ? parseFloat(exchangeRate) : 1;
  const absoluteGain = numCurrent - numInvested;
  const gainPercent = numInvested > 0 ? ((absoluteGain / numInvested) * 100).toFixed(2) : "0.00";
  const isGain = absoluteGain >= 0;
  const currentInvSymbol = getCurrencySymbol(currency, currencySymbol);
  const isForeign = isForeignInvestment(currency, "INR") || numRate !== 1;
  const detectedAsset = (!isForeign || currency === "INR") ? detectForeignInvestment(name, platform) : null;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter an investment name");
      return;
    }

    if (investedAmount === "" || isNaN(numInvested) || numInvested < 0) {
      Alert.alert("Required", "Please enter a valid invested amount");
      return;
    }

    if (isForeign && (!exchangeRate || isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0)) {
      Alert.alert("Required", "Please enter a valid positive exchange rate");
      return;
    }

    setSaving(true);
    let parsedMatDate = null;
    if (maturityDate.includes("/")) {
      const [d, m, y] = maturityDate.split("/");
      if (d && m && y) {
        parsedMatDate = new Date(`${y}-${m}-${d}`).toISOString();
      }
    } else if (maturityDate.trim()) {
      parsedMatDate = new Date(maturityDate.trim()).toISOString();
    }

    const res = await updateInvestmentDetails(investment.id, {
      name,
      platform,
      currency,
      exchangeRate: isForeign ? parseFloat(exchangeRate) : 1,
      investedAmount: numInvested,
      currentValue: numCurrent,
      sipAmount: sipAmount ? parseFloat(sipAmount) : null,
      sipDate: sipDate ? parseInt(sipDate) : null,
      interestRate: interestRate ? parseFloat(interestRate) : null,
      maturityDate: parsedMatDate,
      maturityAmount: maturityAmount ? parseFloat(maturityAmount) : null,
      note,
      isActive,
    });

    setSaving(false);
    if (res.success) {
      Alert.alert("✅ Saved", "Investment details updated successfully.");
      onSuccessUpdate();
      onClose();
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const isMutualFund = investment?.type === "mutual_fund";
  const isFixedIncome = ["fd", "rd", "ppf", "nps", "bonds"].includes(
    investment?.type,
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Edit Investment Details</Text>
              <Text style={styles.subTitle}>
                {investment?.typeName || "Investment"} • Edit parameters
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Investment Name */}
            <Text style={styles.label}>Investment Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Parag Parikh Flexi Cap"
              placeholderTextColor="#94A3B8"
            />

            {/* Platform */}
            <Text style={styles.label}>Platform / Broker (Optional)</Text>
            <TextInput
              style={styles.input}
              value={platform}
              onChangeText={setPlatform}
              placeholder="e.g. Groww, Zerodha, HDFC Bank"
              placeholderTextColor="#94A3B8"
            />

            {/* Early Foreign Asset Detection Suggestion */}
            {detectedAsset?.isForeign && currency === "INR" && (
              <TouchableOpacity
                style={styles.suggestionBanner}
                onPress={() => {
                  setCurrency(detectedAsset.currency);
                  setExchangeRate(detectedAsset.defaultRate.toString());
                }}
              >
                <Ionicons name="globe-outline" size={16} color="#0284C7" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.suggestionTitle}>
                    Foreign Asset Detected ({detectedAsset.currency})
                  </Text>
                  <Text style={styles.suggestionSub}>
                    {detectedAsset.reason} • Tap to switch to {detectedAsset.currency} ({getCurrencySymbol(detectedAsset.currency)}) @ ₹{detectedAsset.defaultRate}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#0284C7" />
              </TouchableOpacity>
            )}

            {/* Currency & Exchange Rate */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Asset Currency</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginVertical: 8 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => {
                      setCurrency(c.code);
                      if (c.code === "INR") {
                        setExchangeRate("1");
                      } else {
                        setExchangeRate(getDefaultExchangeRate(c.code).toString());
                      }
                    }}
                    style={[
                      styles.currencyChip,
                      currency === c.code && styles.activeCurrencyChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyChipText,
                        currency === c.code && styles.activeCurrencyChipText,
                      ]}
                    >
                      {c.code} ({c.symbol})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {isForeign && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.label}>
                    Exchange Rate (1 {currency} = ? {currencySymbol}) *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={exchangeRate}
                    onChangeText={(v) => setExchangeRate(cleanDecimal(v))}
                    keyboardType="numeric"
                    placeholder="e.g. 86.5"
                    placeholderTextColor="#94A3B8"
                  />
                  {numRate > 0 && numInvested > 0 && (
                    <Text style={styles.ratePreviewText}>
                      ≈ {currencySymbol}{(numInvested * numRate).toLocaleString("en-IN")} invested • {currencySymbol}{(numCurrent * numRate).toLocaleString("en-IN")} current
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Financial Capital & Valuation */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Capital & Valuation</Text>
                {numInvested > 0 && (
                  <View style={[styles.gainBadge, { backgroundColor: isGain ? "#ECFDF5" : "#FEF2F2" }]}>
                    <Text style={[styles.gainBadgeText, { color: isGain ? "#10B981" : "#EF4444" }]}>
                      {isGain ? "+" : ""}{gainPercent}% ({isGain ? "+" : ""}{currentInvSymbol}{Math.abs(Math.round(absoluteGain)).toLocaleString("en-IN")})
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Invested Amount ({currentInvSymbol}) *</Text>
                  <TextInput
                    style={styles.input}
                    value={investedAmount}
                    onChangeText={(v) => setInvestedAmount(cleanDecimal(v))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                  {isForeign && numInvested > 0 && (
                    <Text style={styles.convertedMiniText}>
                      ≈ {currencySymbol}{(numInvested * numRate).toLocaleString("en-IN")}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Current Value ({currentInvSymbol})</Text>
                  <TextInput
                    style={styles.input}
                    value={currentValue}
                    onChangeText={(v) => setCurrentValue(cleanDecimal(v))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                  {isForeign && numCurrent > 0 && (
                    <Text style={styles.convertedMiniText}>
                      ≈ {currencySymbol}{(numCurrent * numRate).toLocaleString("en-IN")}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* SIP Details if Mutual Fund */}
            {isMutualFund && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>SIP Settings</Text>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Monthly SIP ({currencySymbol})</Text>
                    <TextInput
                      style={styles.input}
                      value={sipAmount}
                      onChangeText={(v) => setSipAmount(v.replace(/[^0-9]/g, ""))}
                      keyboardType="numeric"
                      placeholder="5000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Day of Month</Text>
                    <TextInput
                      style={styles.input}
                      value={sipDate}
                      onChangeText={(v) => setSipDate(v.replace(/[^0-9]/g, ""))}
                      keyboardType="numeric"
                      placeholder="e.g. 5"
                      placeholderTextColor="#94A3B8"
                      maxLength={2}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Interest Rate */}
            {isFixedIncome && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>Return & Maturity</Text>
                <Text style={styles.label}>Interest Rate (% p.a.)</Text>
                <TextInput
                  style={styles.input}
                  value={interestRate}
                  onChangeText={setInterestRate}
                  keyboardType="numeric"
                  placeholder="e.g. 7.1"
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Maturity Amount ({currencySymbol})</Text>
                    <TextInput
                      style={styles.input}
                      value={maturityAmount}
                      onChangeText={(v) =>
                        setMaturityAmount(v.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      placeholder="Maturity payoff"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>Maturity Date</Text>
                    <TextInput
                      style={styles.input}
                      value={maturityDate}
                      onChangeText={setMaturityDate}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Notes */}
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="Investment goals, folio number, etc."
              placeholderTextColor="#94A3B8"
              multiline
            />

            {/* Active Status Switch */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Active Holding</Text>
                <Text style={styles.switchSub}>
                  Inactive investments are kept for history but omitted from
                  active totals.
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                thumbColor={isActive ? "#4F46E5" : "#F8FAFC"}
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
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {/* Delete Option */}
            {onDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  onClose();
                  onDelete(investment);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={styles.deleteBtnText}>Delete Investment</Text>
              </TouchableOpacity>
            )}
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
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  sectionBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gainBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  switchSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    marginRight: 10,
  },
  saveBtn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 10,
    gap: 6,
  },
  deleteBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  activeCurrencyChip: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1",
  },
  currencyChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  activeCurrencyChipText: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  ratePreviewText: {
    fontSize: 11,
    color: "#0284C7",
    fontWeight: "600",
    marginTop: 4,
  },
  convertedMiniText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  suggestionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0369A1",
  },
  suggestionSub: {
    fontSize: 11,
    color: "#0284C7",
    marginTop: 2,
  },
});

export default InvestmentEditModal;
