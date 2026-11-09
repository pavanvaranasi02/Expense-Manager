import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  exportPortfolioCSV,
  exportPortfolioHTMLReport,
} from "../../../services/portfolioReportService";
import { formatCurrency } from "../../../utils/format";

const ReportModal = ({
  visible,
  onClose,
  investments = [],
  totals,
  portfolioXirr,
  userProfile,
  isStealthMode,
  currencySymbol = "₹",
}) => {
  const [exporting, setExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleExportCSV = async () => {
    setExporting(true);
    setSuccessMsg("");
    const res = await exportPortfolioCSV(
      investments,
      totals,
      portfolioXirr,
      currencySymbol,
    );
    setExporting(false);
    if (res.success) {
      setSuccessMsg("CSV exported successfully!");
    }
  };

  const handleExportHTML = async () => {
    setExporting(true);
    setSuccessMsg("");
    const res = await exportPortfolioHTMLReport(
      investments,
      totals,
      portfolioXirr,
      userProfile,
      currencySymbol,
    );
    setExporting(false);
    if (res.success) {
      setSuccessMsg("Statement generated and ready to share/print!");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Portfolio Reports & Export</Text>
              <Text style={styles.subTitle}>
                Detailed holdings statement and performance
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Quick Summary Card */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
                <Text style={styles.summaryVal}>
                  {formatCurrency(
                    totals?.totalCurrentValue || 0,
                    isStealthMode,
                    currencySymbol,
                  )}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Invested</Text>
                <Text style={styles.summaryVal}>
                  {formatCurrency(
                    totals?.totalInvested || 0,
                    isStealthMode,
                    currencySymbol,
                  )}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net Returns</Text>
                <Text
                  style={[
                    styles.summaryVal,
                    {
                      color:
                        (totals?.totalReturns || 0) >= 0 ? "#10B981" : "#EF4444",
                    },
                  ]}
                >
                  {(totals?.totalReturns || 0) >= 0 ? "+" : ""}
                  {formatCurrency(
                    totals?.totalReturns || 0,
                    isStealthMode,
                    currencySymbol,
                  )}{" "}
                  ({totals?.returnPercent || 0}%)
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Annualized / XIRR</Text>
                <Text style={[styles.summaryVal, { color: "#4F46E5" }]}>
                  {portfolioXirr !== null && portfolioXirr !== undefined
                    ? `${portfolioXirr}% p.a.`
                    : "N/A"}
                </Text>
              </View>

              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.summaryLabel}>Active Holdings</Text>
                <Text style={styles.summaryVal}>
                  {investments.filter((i) => i.isActive).length} Assets
                </Text>
              </View>
            </View>

            {successMsg ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.successBannerText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <Text style={styles.actionHeader}>Export Options</Text>

            <TouchableOpacity
              style={[styles.exportCard, exporting && { opacity: 0.6 }]}
              onPress={handleExportCSV}
              disabled={exporting}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: "rgba(16, 185, 129, 0.1)" },
                ]}
              >
                <Ionicons name="grid-outline" size={22} color="#10B981" />
              </View>
              <View style={styles.exportCardText}>
                <Text style={styles.exportCardTitle}>Export to CSV / Excel</Text>
                <Text style={styles.exportCardSub}>
                  Raw holding data, dates, invested amount, and XIRR
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportCard, exporting && { opacity: 0.6 }]}
              onPress={handleExportHTML}
              disabled={exporting}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: "rgba(79, 70, 229, 0.1)" },
                ]}
              >
                <Ionicons name="document-text" size={22} color="#4F46E5" />
              </View>
              <View style={styles.exportCardText}>
                <Text style={styles.exportCardTitle}>
                  Formal Statement (HTML / PDF)
                </Text>
                <Text style={styles.exportCardSub}>
                  Formatted report ready to print, share, or save
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            {exporting && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={styles.loadingText}>Generating report...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
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
    maxHeight: "80%",
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
  summaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  exportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  exportCardText: {
    flex: 1,
  },
  exportCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  exportCardSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  successBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065F46",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#4F46E5",
    fontWeight: "600",
  },
});

export default ReportModal;
