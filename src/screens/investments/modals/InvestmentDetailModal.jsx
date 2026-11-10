import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getCurrencySymbol } from "../../../constants/currencies";
import { formatCurrency } from "../../../utils/format";
import {
  calculateInvestmentReturns,
  getMaturityCountdown,
} from "../../../utils/portfolioMath";

const InvestmentDetailModal = ({
  visible,
  investment,
  isStealthMode,
  currencySymbol = "₹",
  onClose,
  onOpenQuickUpdate,
  onOpenAddAmount,
  onOpenEditDetails,
  onOpenWithdraw,
  onOpenHistory,
  onDelete,
  onPayRd,
  onConfirmSip,
}) => {
  if (!investment) return null;

  const inv = investment;
  const returns = calculateInvestmentReturns(inv);
  const isPos = returns.absoluteReturn >= 0;
  const hasSip = inv.type === "mutual_fund" && inv.sipAmount;
  const isRd = inv.type === "rd";
  const maturityCountdown = getMaturityCountdown(inv.maturityDate);

  const invCurrency = inv.currency || "INR";
  const nativeSymbol = getCurrencySymbol(invCurrency, currencySymbol);
  const exchangeRate = parseFloat(inv.exchangeRate) > 0 ? parseFloat(inv.exchangeRate) : 1;
  const isForeign = !!(inv.currency && (inv.currency !== "INR" || exchangeRate !== 1) && nativeSymbol !== currencySymbol);

  const confirmDelete = () => {
    Alert.alert(
      "Delete Investment",
      `Are you sure you want to permanently delete "${inv.name}" from your portfolio?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onClose();
            onDelete(inv);
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Top Drag Handle / Header */}
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: `${inv.typeColor || "#4F46E5"}15` },
                ]}
              >
                <Text style={styles.icon}>{inv.typeIcon || "💰"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {inv.name}
                </Text>
                <View style={styles.subTitleRow}>
                  <Text style={styles.subTitle}>
                    {inv.typeName || inv.type}
                  </Text>
                  {inv.platform ? (
                    <View style={styles.platformBadge}>
                      <Text style={styles.platformText}>{inv.platform}</Text>
                    </View>
                  ) : null}
                  {inv.isActive === false && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveText}>Inactive</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {isForeign && (
              <View style={styles.foreignBanner}>
                <Ionicons name="globe-outline" size={18} color="#0284C7" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.foreignBannerTitle}>
                    Foreign Asset ({invCurrency})
                  </Text>
                  <Text style={styles.foreignBannerSub}>
                    Exchange Rate: 1 {invCurrency} = {currencySymbol}{exchangeRate}
                  </Text>
                </View>
              </View>
            )}

            {/* Financial Overview Card */}
            <View style={styles.metricsCard}>
              <View style={styles.primaryMetric}>
                <Text style={styles.metricLabel}>Current Valuation</Text>
                <Text style={styles.metricBig}>
                  {formatCurrency(returns.current, isStealthMode, nativeSymbol)}
                </Text>
                {isForeign && (
                  <Text style={styles.metricBigConverted}>
                    ≈ {formatCurrency(returns.convertedCurrent, isStealthMode, currencySymbol)}
                  </Text>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.metricsRow}>
                <View style={styles.metricSubCol}>
                  <Text style={styles.metricSubLabel}>Invested Capital</Text>
                  <Text style={styles.metricSubVal}>
                    {formatCurrency(
                      returns.invested,
                      isStealthMode,
                      nativeSymbol,
                    )}
                  </Text>
                  {isForeign && (
                    <Text style={styles.metricSubValConverted}>
                      ≈ {formatCurrency(returns.convertedInvested, isStealthMode, currencySymbol)}
                    </Text>
                  )}
                </View>

                <View style={styles.metricSubCol}>
                  <Text style={styles.metricSubLabel}>Net Profit / Loss</Text>
                  <Text
                    style={[
                      styles.metricSubVal,
                      { color: isPos ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {isPos ? "+" : ""}
                    {formatCurrency(
                      returns.absoluteReturn,
                      isStealthMode,
                      nativeSymbol,
                    )}
                  </Text>
                  {isForeign && (
                    <Text
                      style={[
                        styles.metricSubValConverted,
                        { color: isPos ? "#10B981" : "#EF4444" },
                      ]}
                    >
                      ≈ {isPos ? "+" : ""}{formatCurrency(returns.convertedReturn, isStealthMode, currencySymbol)}
                    </Text>
                  )}
                </View>

                <View style={styles.metricSubColRight}>
                  <Text style={styles.metricSubLabel}>Return Rate</Text>
                  <View
                    style={[
                      styles.returnBadge,
                      { backgroundColor: returns.badgeBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.returnBadgeText,
                        { color: returns.badgeColor },
                      ]}
                    >
                      {returns.displayRate} {returns.rateLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Special notices: SIP, RD Progress, Maturity */}
            {hasSip && (
              <View style={styles.infoBanner}>
                <Ionicons name="repeat" size={16} color="#6366F1" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.infoBannerTitle}>Active SIP</Text>
                  <Text style={styles.infoBannerText}>
                    {formatCurrency(inv.sipAmount, isStealthMode, currencySymbol)}{" "}
                    on the {inv.sipDate}th of every month
                  </Text>
                </View>
                {onConfirmSip && (
                  <TouchableOpacity
                    style={styles.sipActionBtn}
                    onPress={() => {
                      onClose();
                      onConfirmSip(inv);
                    }}
                  >
                    <Text style={styles.sipActionText}>Pay Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isRd && inv.rdTotalMonths && (
              <View style={styles.infoBanner}>
                <Ionicons name="sync" size={16} color="#14B8A6" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.infoBannerTitle}>
                    Recurring Deposit Progress
                  </Text>
                  <Text style={styles.infoBannerText}>
                    {inv.rdCompletedMonths || 0} of {inv.rdTotalMonths} months
                    paid (
                    {formatCurrency(
                      inv.rdMonthlyAmount,
                      isStealthMode,
                      currencySymbol,
                    )}
                    /mo)
                  </Text>
                </View>
                {onPayRd &&
                  (!inv.rdCompletedMonths ||
                    inv.rdCompletedMonths < inv.rdTotalMonths) && (
                    <TouchableOpacity
                      style={[styles.sipActionBtn, { backgroundColor: "#14B8A6" }]}
                      onPress={() => {
                        onClose();
                        onPayRd(inv);
                      }}
                    >
                      <Text style={styles.sipActionText}>
                        Pay Month {(inv.rdCompletedMonths || 0) + 1}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
            )}

            {maturityCountdown && (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: `${maturityCountdown.color}15` },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={maturityCountdown.color}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text
                    style={[
                      styles.infoBannerTitle,
                      { color: maturityCountdown.color },
                    ]}
                  >
                    Maturity Countdown: {maturityCountdown.text}
                  </Text>
                  {inv.maturityAmount ? (
                    <Text style={styles.infoBannerText}>
                      Expected Maturity Payout:{" "}
                      {formatCurrency(
                        inv.maturityAmount,
                        isStealthMode,
                        currencySymbol,
                      )}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Note if available */}
            {inv.note ? (
              <View style={styles.noteBox}>
                <Ionicons name="document-text-outline" size={15} color="#64748B" />
                <Text style={styles.noteText}>{inv.note}</Text>
              </View>
            ) : null}

            {/* Operations Section */}
            <Text style={styles.sectionHeading}>Manage Investment</Text>

            <View style={styles.actionGrid}>
              {/* 1. Update Values */}
              <TouchableOpacity
                style={[styles.actionGridItem, { borderColor: "#0D9488" }]}
                onPress={() => {
                  onClose();
                  onOpenQuickUpdate(inv);
                }}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: "#CCFBF1" },
                  ]}
                >
                  <Ionicons name="trending-up" size={20} color="#0D9488" />
                </View>
                <Text style={styles.actionGridTitle}>Update Values</Text>
                <Text style={styles.actionGridSub}>
                  Change invested or market value
                </Text>
              </TouchableOpacity>

              {/* 2. Add Investment */}
              <TouchableOpacity
                style={[styles.actionGridItem, { borderColor: "#6366F1" }]}
                onPress={() => {
                  onClose();
                  onOpenAddAmount(inv);
                }}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: "#EEF2FF" },
                  ]}
                >
                  <Ionicons name="add-circle" size={20} color="#4F46E5" />
                </View>
                <Text style={styles.actionGridTitle}>Add Funds</Text>
                <Text style={styles.actionGridSub}>Invest more capital</Text>
              </TouchableOpacity>

              {/* 3. Edit All Details */}
              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => {
                  onClose();
                  onOpenEditDetails(inv);
                }}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: "#F1F5F9" },
                  ]}
                >
                  <Ionicons name="create-outline" size={20} color="#475569" />
                </View>
                <Text style={styles.actionGridTitle}>Edit Details</Text>
                <Text style={styles.actionGridSub}>Name, rates, dates, SIP</Text>
              </TouchableOpacity>

              {/* 4. Redeem / Withdraw */}
              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => {
                  onClose();
                  onOpenWithdraw(inv);
                }}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: "#FEF3C7" },
                  ]}
                >
                  <Ionicons name="cash-outline" size={20} color="#D97706" />
                </View>
                <Text style={styles.actionGridTitle}>Redeem / Withdraw</Text>
                <Text style={styles.actionGridSub}>Sell or cash out</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Actions Row: History & Delete */}
            <View style={styles.bottomActionsRow}>
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => {
                  onClose();
                  onOpenHistory(inv);
                }}
              >
                <Ionicons name="time-outline" size={17} color="#4F46E5" />
                <Text style={styles.historyBtnText}>View Transaction History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={confirmDelete}
              >
                <Ionicons name="trash-outline" size={17} color="#EF4444" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
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
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  subTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  subTitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  platformBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  platformText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },
  inactiveBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inactiveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#DC2626",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  metricsCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  primaryMetric: {
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricBig: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  metricBigConverted: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  foreignBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  foreignBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0369A1",
  },
  foreignBannerSub: {
    fontSize: 11,
    color: "#0284C7",
    marginTop: 2,
  },
  metricSubValConverted: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricSubCol: {
    flex: 1,
  },
  metricSubColRight: {
    alignItems: "flex-end",
  },
  metricSubLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 2,
  },
  metricSubVal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  returnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  returnBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  infoBannerText: {
    fontSize: 11,
    color: "#475569",
    marginTop: 1,
  },
  sipActionBtn: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sipActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  noteText: {
    fontSize: 12,
    color: "#475569",
    flex: 1,
    fontStyle: "italic",
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginVertical: 10,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionGridItem: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  actionGridTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionGridSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  bottomActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 10,
  },
  historyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  historyBtnText: {
    color: "#4F46E5",
    fontSize: 13,
    fontWeight: "700",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  deleteBtnText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default InvestmentDetailModal;
