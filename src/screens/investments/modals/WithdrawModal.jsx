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
import { cleanDecimal, getCurrencySymbol, isForeignInvestment } from "../../../constants/currencies";
import { addIncome } from "../../../services/incomeService";
import { withdrawInvestmentAmount } from "../../../services/investmentService";

const WithdrawModal = ({
  visible,
  investment,
  bankAccounts = [],
  currencySymbol = "₹",
  onClose,
  onSuccessWithdraw,
}) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [creditAccount, setCreditAccount] = useState(null);
  const [showAccountList, setShowAccountList] = useState(false);
  const [saving, setSaving] = useState(false);

  const invCurrency = investment?.currency || "INR";
  const nativeSymbol = getCurrencySymbol(invCurrency, currencySymbol);
  const rate = parseFloat(investment?.exchangeRate) > 0 ? parseFloat(investment.exchangeRate) : 1;
  const isForeign = isForeignInvestment(investment, "INR") || rate !== 1;

  useEffect(() => {
    setAmount("");
    setNote("");
    setCreditAccount(null);
    setShowAccountList(false);
  }, [investment, visible]);

  const handleWithdraw = async () => {
    const withdrawAmt = parseFloat(amount);
    if (!withdrawAmt || withdrawAmt <= 0) {
      Alert.alert("Required", "Please enter a valid withdrawal amount");
      return;
    }

    const currentVal = investment?.currentValue || 0;
    if (withdrawAmt > currentVal) {
      Alert.alert(
        "Amount Exceeds Value",
        `You cannot withdraw more than the current market value (${nativeSymbol}${currentVal.toLocaleString("en-IN")}).`,
      );
      return;
    }

    setSaving(true);
    try {
      // 1. Record withdrawal in investment
      const newCurrentVal = Math.max(0, currentVal - withdrawAmt);
      const res = await withdrawInvestmentAmount(
        investment.id,
        withdrawAmt,
        newCurrentVal,
        note || `Redemption from ${investment.name}`,
      );

      if (!res.success) {
        Alert.alert("Error", res.error);
        setSaving(false);
        return;
      }

      // 2. If user chose to credit to account, record as income
      if (creditAccount) {
        const creditAmt = isForeign ? withdrawAmt * rate : withdrawAmt;
        await addIncome({
          amount: creditAmt,
          source: "investment_return",
          sourceName: "Investment Redemption",
          sourceIcon: investment.typeIcon || "📈",
          accountId: creditAccount.id,
          accountName: creditAccount.name,
          note: `Redeemed: ${investment.name}${isForeign ? ` (${nativeSymbol}${withdrawAmt} @ ${rate})` : ""}`,
          date: new Date().toISOString(),
        });
      }

      Alert.alert(
        "✅ Redemption Recorded",
        `${nativeSymbol}${withdrawAmt.toLocaleString("en-IN")}${isForeign ? ` (≈ ${currencySymbol}${(withdrawAmt * rate).toLocaleString("en-IN")})` : ""} redeemed from ${investment.name}.`,
      );
      onSuccessWithdraw();
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Redeem / Withdraw Funds</Text>
              <Text style={styles.subTitle}>
                Sell or withdraw from {investment?.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#71717A" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Investment Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Market Value</Text>
                <Text style={styles.infoVal}>
                  {nativeSymbol}{(investment?.currentValue || 0).toLocaleString("en-IN")}
                  {isForeign ? ` (≈ ${currencySymbol}${((investment?.currentValue || 0) * rate).toLocaleString("en-IN")})` : ""}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invested Amount</Text>
                <Text style={styles.infoVal}>
                  {nativeSymbol}{(investment?.investedAmount || 0).toLocaleString("en-IN")}
                  {isForeign ? ` (≈ ${currencySymbol}${((investment?.investedAmount || 0) * rate).toLocaleString("en-IN")})` : ""}
                </Text>
              </View>
            </View>

            {/* Withdrawal Amount */}
            <Text style={styles.label}>Amount to Withdraw ({nativeSymbol}) *</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.rupee}>{nativeSymbol}</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                value={amount}
                onChangeText={(v) => setAmount(cleanDecimal(v))}
                keyboardType="numeric"
                autoFocus
              />
            </View>
            {isForeign && parseFloat(amount) > 0 && (
              <Text style={{ fontSize: 12, color: "#0284C7", fontFamily: 'Manrope_600SemiBold', marginTop: 4, marginBottom: 8 }}>
                ≈ {currencySymbol}{(parseFloat(amount) * rate).toLocaleString("en-IN")} credited in base currency
              </Text>
            )}

            {/* Quick amount shortcuts */}
            <View style={styles.shortcutRow}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() =>
                  setAmount(
                    Math.round(
                      (investment?.currentValue || 0) * 0.25,
                    ).toString(),
                  )
                }
              >
                <Text style={styles.shortcutText}>25%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() =>
                  setAmount(
                    Math.round(
                      (investment?.currentValue || 0) * 0.5,
                    ).toString(),
                  )
                }
              >
                <Text style={styles.shortcutText}>50%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() =>
                  setAmount(
                    Math.round(
                      (investment?.currentValue || 0) * 0.75,
                    ).toString(),
                  )
                }
              >
                <Text style={styles.shortcutText}>75%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() =>
                  setAmount(Math.round(investment?.currentValue || 0).toString())
                }
              >
                <Text style={styles.shortcutText}>100% (All)</Text>
              </TouchableOpacity>
            </View>

            {/* Credit Account Picker */}
            <Text style={styles.label}>Credit to Account (Optional)</Text>
            <TouchableOpacity
              style={styles.accountSelector}
              onPress={() => setShowAccountList(!showAccountList)}
            >
              <Ionicons
                name={creditAccount ? "wallet" : "business-outline"}
                size={18}
                color={creditAccount ? "#0F766E" : "#71717A"}
              />
              <Text
                style={[
                  styles.accountSelectorText,
                  !creditAccount && { color: "#71717A" },
                ]}
              >
                {creditAccount ? creditAccount.name : "None (Do not credit bank)"}
              </Text>
              <Ionicons
                name={showAccountList ? "chevron-up" : "chevron-down"}
                size={16}
                color="#71717A"
              />
            </TouchableOpacity>

            {showAccountList && (
              <View style={styles.accountDropdown}>
                <TouchableOpacity
                  style={[
                    styles.accountOption,
                    !creditAccount && styles.accountOptionSelected,
                  ]}
                  onPress={() => {
                    setCreditAccount(null);
                    setShowAccountList(false);
                  }}
                >
                  <Text style={styles.accountOptionText}>
                    None (Do not credit bank)
                  </Text>
                </TouchableOpacity>
                {bankAccounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.accountOption,
                      creditAccount?.id === acc.id &&
                        styles.accountOptionSelected,
                    ]}
                    onPress={() => {
                      setCreditAccount(acc);
                      setShowAccountList(false);
                    }}
                  >
                    <Text style={styles.accountOptionText}>{acc.name}</Text>
                    <Text style={styles.accountBalanceText}>
                      ₹{(acc.balance || 0).toLocaleString("en-IN")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Note */}
            <Text style={styles.label}>Note (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Partial profit booking, emergency cash"
              placeholderTextColor="#71717A"
              value={note}
              onChangeText={setNote}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
              onPress={handleWithdraw}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Redemption</Text>
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
  infoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: "#71717A",
    fontFamily: 'Manrope_500Medium',
  },
  infoVal: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  label: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: "#475569",
    marginBottom: 6,
    marginTop: 10,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E5E2DC",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rupee: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
    paddingVertical: 10,
  },
  shortcutRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: "#E6F2F0",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  shortcutText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },
  accountSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  accountSelectorText: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontFamily: 'Manrope_600SemiBold',
  },
  accountDropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 10,
    marginTop: 6,
    overflow: "hidden",
  },
  accountOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  accountOptionSelected: {
    backgroundColor: "#E6F2F0",
  },
  accountOptionText: {
    fontSize: 13,
    color: "#0F172A",
    fontFamily: 'Manrope_500Medium',
  },
  accountBalanceText: {
    fontSize: 12,
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
  },
  confirmBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
  },
});

export default WithdrawModal;
