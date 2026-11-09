import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { formatCurrency } from "../../../utils/format";

const FILTER_TYPES = [
  { id: "ALL", label: "All Activity" },
  { id: "SIP", label: "SIPs", icon: "repeat" },
  { id: "RD_PAYMENT", label: "RD Payments", icon: "calendar" },
  { id: "INVEST", label: "Investments", icon: "add-circle" },
  { id: "WITHDRAW", label: "Withdrawals", icon: "arrow-down-circle" },
  { id: "MATURED", label: "Maturities", icon: "flag" },
];

const PortfolioHistoryView = ({
  transactions = [],
  isStealthMode,
  currencySymbol = "₹",
  onExportHistory,
}) => {
  const [activeFilter, setActiveFilter] = useState("ALL");

  const filtered = transactions.filter((t) => {
    if (activeFilter === "ALL") return true;
    return t.type === activeFilter;
  });

  const getTypeColor = (type) => {
    switch (type) {
      case "SIP":
        return "#6366F1";
      case "RD_PAYMENT":
        return "#14B8A6";
      case "WITHDRAW":
        return "#F59E0B";
      case "MATURED":
        return "#10B981";
      default:
        return "#3B82F6";
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "SIP":
        return "repeat";
      case "RD_PAYMENT":
        return "calendar";
      case "WITHDRAW":
        return "arrow-down-circle";
      case "MATURED":
        return "flag";
      default:
        return "add-circle";
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar with Export Action */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Activity & Transaction History</Text>
          <Text style={styles.subTitle}>
            {filtered.length} event{filtered.length === 1 ? "" : "s"} recorded
          </Text>
        </View>

        {transactions.length > 0 && (
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={onExportHistory}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={14} color="#4F46E5" />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTER_TYPES.map((f) => {
          const isSelected = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterChip,
                isSelected && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(f.id)}
              activeOpacity={0.7}
            >
              {f.icon && (
                <Ionicons
                  name={f.icon}
                  size={13}
                  color={isSelected ? "#FFFFFF" : "#64748B"}
                />
              )}
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Transaction List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="time-outline" size={40} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No transactions recorded</Text>
          <Text style={styles.emptySub}>
            Activities such as SIP payments, lumpsum top-ups, and maturities
            will show up here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((item, idx) => {
            const color = getTypeColor(item.type);
            const iconName = getTypeIcon(item.type);
            const dateStr = item.date
              ? new Date(item.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "-";

            const isCredit = item.type === "WITHDRAW" || item.type === "MATURED";

            return (
              <View key={item.id || idx} style={styles.itemCard}>
                <View
                  style={[styles.typeIconBox, { backgroundColor: `${color}15` }]}
                >
                  <Ionicons name={iconName} size={18} color={color} />
                </View>

                <View style={styles.detailsCol}>
                  <Text style={styles.invName} numberOfLines={1}>
                    {item.investmentName}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.dateText}>{dateStr}</Text>
                    {item.note ? (
                      <>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Text style={styles.noteText} numberOfLines={1}>
                          {item.note}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>

                <View style={styles.amountCol}>
                  <Text
                    style={[
                      styles.amountText,
                      { color: isCredit ? "#10B981" : "#0F172A" },
                    ]}
                  >
                    {isCredit ? "+" : "-"}
                    {formatCurrency(item.amount, isStealthMode, currencySymbol)}
                  </Text>
                  <Text style={styles.typeBadgeText}>
                    {item.type === "SIP"
                      ? "SIP Payment"
                      : item.type === "RD_PAYMENT"
                        ? "RD Month"
                        : item.type === "WITHDRAW"
                          ? "Withdrawal"
                          : item.type === "MATURED"
                            ? "Matured"
                            : "Invested"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 30,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  subTitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
  },
  filterScroll: {
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  filterChipText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  list: {
    marginTop: 4,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailsCol: {
    flex: 1,
  },
  invName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: "#64748B",
  },
  dotSeparator: {
    fontSize: 11,
    color: "#CBD5E1",
    marginHorizontal: 5,
  },
  noteText: {
    fontSize: 11,
    color: "#94A3B8",
    flex: 1,
  },
  amountCol: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 14,
    fontWeight: "700",
  },
  typeBadgeText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 240,
  },
});

export default PortfolioHistoryView;
