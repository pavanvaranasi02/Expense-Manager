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
import { addIncome } from "../../../services/incomeService";
import { withdrawInvestmentAmount } from "../../../services/investmentService";

const WithdrawModal = ({
  visible,
  investment,
  bankAccounts = [],
  onClose,
  onSuccessWithdraw,
}) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [creditAccount, setCreditAccount] = useState(null);
  const [showAccountList, setShowAccountList] = useState(false);
  const [saving, setSaving] = useState(false);

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
        `You cannot withdraw more than the current market value (₹${currentVal.toLocaleString("en-IN")}).`,
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
        await addIncome({
          amount: withdrawAmt,
          source: "investment_return",
          sourceName: "Investment Redemption",
          sourceIcon: investment.typeIcon || "📈",
          accountId: creditAccount.id,
          accountName: creditAccount.name,
          note: `Redeemed: ${investment.name}`,
          date: new Date().toISOString(),
        });
      }

      Alert.alert(
        "✅ Redemption Recorded",
        `₹${withdrawAmt.toLocaleString("en-IN")} redeemed from ${investment.name}.`,
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
              <Ionicons name="close" size={22} color="#64748B" />
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
                  ₹{(investment?.currentValue || 0).toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invested Amount</Text>
                <Text style={styles.infoVal}>
                  ₹{(investment?.investedAmount || 0).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>

            {/* Withdrawal Amount */}
            <Text style={styles.label}>Amount to Withdraw *</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                autoFocus
              />
            </View>

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
                color={creditAccount ? "#4F46E5" : "#64748B"}
              />
              <Text
                style={[
                  styles.accountSelectorText,
                  !creditAccount && { color: "#94A3B8" },
                ]}
              >
                {creditAccount ? creditAccount.name : "None (Do not credit bank)"}
              </Text>
              <Ionicons
                name={showAccountList ? "chevron-up" : "chevron-down"}
                size={16}
                color="#94A3B8"
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
              placeholderTextColor="#94A3B8"
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
  infoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
    marginTop: 10,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rupee: {
    fontSize: 22,
    fontWeight: "700",
    color: "#4F46E5",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
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
    backgroundColor: "#EEF2FF",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4F46E5",
  },
  accountSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  accountSelectorText: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  accountDropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    borderBottomColor: "#F1F5F9",
  },
  accountOptionSelected: {
    backgroundColor: "#EEF2FF",
  },
  accountOptionText: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  accountBalanceText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    fontWeight: "700",
  },
});

export default WithdrawModal;
