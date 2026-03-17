import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SPLIT_TYPES,
  SPLIT_TYPE_LABELS,
} from "../../constants/familyCategories";

const SplitDetailsModal = ({
  visible,
  onClose,
  members,
  amount,
  initialSplitType,
  initialSplitDetails,
  onSave,
}) => {
  const [splitType, setSplitType] = useState(
    initialSplitType || SPLIT_TYPES.PAID_FOR_ALL,
  );
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [customAmounts, setCustomAmounts] = useState({});
  const [percentages, setPercentages] = useState({});

  useEffect(() => {
    // Initialize from existing data
    if (initialSplitDetails) {
      const memberIds = Object.keys(initialSplitDetails);
      setSelectedMembers(memberIds);

      const amounts = {};
      const percs = {};
      memberIds.forEach((id) => {
        amounts[id] = initialSplitDetails[id].amount?.toString() || "";
        percs[id] = initialSplitDetails[id].percentage?.toString() || "";
      });
      setCustomAmounts(amounts);
      setPercentages(percs);
    } else {
      // Default: all members selected for equal split
      setSelectedMembers(members.map((m) => m.userId));
    }
  }, [initialSplitDetails, members]);

  const toggleMember = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const updateCustomAmount = (userId, value) => {
    setCustomAmounts({ ...customAmounts, [userId]: value });
  };

  const updatePercentage = (userId, value) => {
    setPercentages({ ...percentages, [userId]: value });
  };

  const validateAndSave = () => {
    if (selectedMembers.length === 0) {
      alert("Please select at least one member");
      return;
    }

    let splitDetails = {};

    if (splitType === SPLIT_TYPES.PAID_FOR_ALL) {
      // No split details needed
      onSave(splitType, {});
      onClose();
      return;
    }

    if (splitType === SPLIT_TYPES.EQUAL) {
      const splitAmount = parseFloat(amount) / selectedMembers.length;
      selectedMembers.forEach((userId) => {
        splitDetails[userId] = {
          amount: parseFloat(splitAmount.toFixed(2)),
          percentage: parseFloat(((splitAmount / amount) * 100).toFixed(2)),
        };
      });
    }

    if (splitType === SPLIT_TYPES.CUSTOM) {
      let totalCustom = 0;
      selectedMembers.forEach((userId) => {
        const amt = parseFloat(customAmounts[userId] || 0);
        totalCustom += amt;
        splitDetails[userId] = {
          amount: amt,
          percentage: parseFloat(((amt / amount) * 100).toFixed(2)),
        };
      });

      if (Math.abs(totalCustom - parseFloat(amount)) > 0.01) {
        alert(
          `Custom amounts must total ₹${amount}. Current total: ₹${totalCustom.toFixed(2)}`,
        );
        return;
      }
    }

    if (splitType === SPLIT_TYPES.PERCENTAGE) {
      let totalPercent = 0;
      selectedMembers.forEach((userId) => {
        const perc = parseFloat(percentages[userId] || 0);
        totalPercent += perc;
        const amt = (parseFloat(amount) * perc) / 100;
        splitDetails[userId] = {
          amount: parseFloat(amt.toFixed(2)),
          percentage: perc,
        };
      });

      if (Math.abs(totalPercent - 100) > 0.01) {
        alert(
          `Percentages must total 100%. Current total: ${totalPercent.toFixed(2)}%`,
        );
        return;
      }
    }

    onSave(splitType, splitDetails);
    onClose();
  };

  const calculateEqualSplit = () => {
    if (selectedMembers.length === 0) return 0;
    return (parseFloat(amount) / selectedMembers.length).toFixed(2);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Split Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Split Type Selector */}
            <Text style={styles.sectionLabel}>Split Type</Text>
            {Object.entries(SPLIT_TYPE_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.typeOption,
                  splitType === key && styles.typeOptionActive,
                ]}
                onPress={() => setSplitType(key)}
              >
                <Text
                  style={[
                    styles.typeLabel,
                    splitType === key && styles.typeLabelActive,
                  ]}
                >
                  {label}
                </Text>
                {splitType === key && (
                  <Ionicons name="checkmark-circle" size={20} color="#6C63FF" />
                )}
              </TouchableOpacity>
            ))}

            {/* Member Selection */}
            {splitType !== SPLIT_TYPES.PAID_FOR_ALL && (
              <>
                <Text style={styles.sectionLabel}>Split Among</Text>
                {members.map((member) => (
                  <TouchableOpacity
                    key={member.userId}
                    style={styles.memberRow}
                    onPress={() => toggleMember(member.userId)}
                  >
                    <View style={styles.memberLeft}>
                      <View
                        style={[
                          styles.checkbox,
                          selectedMembers.includes(member.userId) &&
                            styles.checkboxActive,
                        ]}
                      >
                        {selectedMembers.includes(member.userId) && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <Text style={styles.memberName}>
                        {member.displayName}
                      </Text>
                    </View>

                    {/* Equal Split Amount */}
                    {splitType === SPLIT_TYPES.EQUAL &&
                      selectedMembers.includes(member.userId) && (
                        <Text style={styles.splitAmount}>
                          ₹{calculateEqualSplit()}
                        </Text>
                      )}

                    {/* Custom Amount Input */}
                    {splitType === SPLIT_TYPES.CUSTOM &&
                      selectedMembers.includes(member.userId) && (
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputPrefix}>₹</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            value={customAmounts[member.userId] || ""}
                            onChangeText={(value) =>
                              updateCustomAmount(member.userId, value)
                            }
                          />
                        </View>
                      )}

                    {/* Percentage Input */}
                    {splitType === SPLIT_TYPES.PERCENTAGE &&
                      selectedMembers.includes(member.userId) && (
                        <View style={styles.inputContainer}>
                          <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            value={percentages[member.userId] || ""}
                            onChangeText={(value) =>
                              updatePercentage(member.userId, value)
                            }
                          />
                          <Text style={styles.inputSuffix}>%</Text>
                        </View>
                      )}
                  </TouchableOpacity>
                ))}

                {/* Validation Summary */}
                {splitType === SPLIT_TYPES.CUSTOM &&
                  selectedMembers.length > 0 && (
                    <View style={styles.summary}>
                      <Text style={styles.summaryLabel}>Total:</Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          {
                            color:
                              Math.abs(
                                selectedMembers.reduce(
                                  (sum, id) =>
                                    sum + (parseFloat(customAmounts[id]) || 0),
                                  0,
                                ) - parseFloat(amount),
                              ) < 0.01
                                ? "#10B981"
                                : "#EF4444",
                          },
                        ]}
                      >
                        ₹
                        {selectedMembers
                          .reduce(
                            (sum, id) =>
                              sum + (parseFloat(customAmounts[id]) || 0),
                            0,
                          )
                          .toFixed(2)}{" "}
                        / ₹{parseFloat(amount).toFixed(2)}
                      </Text>
                    </View>
                  )}

                {splitType === SPLIT_TYPES.PERCENTAGE &&
                  selectedMembers.length > 0 && (
                    <View style={styles.summary}>
                      <Text style={styles.summaryLabel}>Total:</Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          {
                            color:
                              Math.abs(
                                selectedMembers.reduce(
                                  (sum, id) =>
                                    sum + (parseFloat(percentages[id]) || 0),
                                  0,
                                ) - 100,
                              ) < 0.01
                                ? "#10B981"
                                : "#EF4444",
                          },
                        ]}
                      >
                        {selectedMembers
                          .reduce(
                            (sum, id) =>
                              sum + (parseFloat(percentages[id]) || 0),
                            0,
                          )
                          .toFixed(2)}
                        % / 100%
                      </Text>
                    </View>
                  )}
              </>
            )}
          </ScrollView>

          {/* Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={validateAndSave}>
              <Text style={styles.saveBtnText}>Save Split</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
  },
  content: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 8,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F8F9FE",
    marginBottom: 8,
  },
  typeOptionActive: {
    backgroundColor: "#F0EFFF",
    borderWidth: 2,
    borderColor: "#6C63FF",
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  typeLabelActive: {
    color: "#6C63FF",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8F9FE",
    marginBottom: 8,
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: "#6C63FF",
    borderColor: "#6C63FF",
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  splitAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#10B981",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minWidth: 100,
  },
  inputPrefix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6C63FF",
    marginRight: 4,
  },
  input: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "right",
    flex: 1,
    paddingVertical: 8,
  },
  inputSuffix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6C63FF",
    marginLeft: 4,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#F0EFFF",
    borderRadius: 12,
    marginTop: 12,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  saveBtn: {
    backgroundColor: "#6C63FF",
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default SplitDetailsModal;
