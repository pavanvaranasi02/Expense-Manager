import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getCurrencySymbol } from "../../../constants/currencies";
import { INVESTMENT_TYPES } from "../../../services/investmentService";
import { formatCurrency } from "../../../utils/format";
import {
  calculateInvestmentReturns,
  getMaturityCountdown,
} from "../../../utils/portfolioMath";

const InvestmentCard = ({
  investment,
  isStealthMode,
  currencySymbol = "₹",
  onPress,
  onAddAmount,
  onUpdateValue,
  onViewHistory,
  onOpenActions,
}) => {
  const inv = investment;
  const returns = calculateInvestmentReturns(inv);
  const typeConfig = INVESTMENT_TYPES.find((t) => t.id === inv.type);
  const typeColor = typeConfig?.color || "#134E4A";

  const invCurrency = inv.currency || "INR";
  const nativeSymbol = getCurrencySymbol(invCurrency, currencySymbol);
  const exchangeRate = parseFloat(inv.exchangeRate) > 0 ? parseFloat(inv.exchangeRate) : 1;
  const isForeign = !!(inv.currency && (inv.currency !== "INR" || exchangeRate !== 1) && nativeSymbol !== currencySymbol);

  const isPos = returns.absoluteReturn >= 0;
  const hasSip = inv.type === "mutual_fund" && inv.sipAmount;
  const isRd = inv.type === "rd";
  const maturityCountdown = getMaturityCountdown(inv.maturityDate);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: `${typeColor}15` }]}>
          <Text style={styles.icon}>{inv.typeIcon || "💰"}</Text>
        </View>

        <View style={styles.titleCol}>
          <Text style={styles.name} numberOfLines={1}>
            {inv.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.typeText}>{inv.typeName || inv.type}</Text>
            {inv.platform ? (
              <View style={styles.platformBadge}>
                <Text style={styles.platformText}>{inv.platform}</Text>
              </View>
            ) : null}
            {isForeign && (
              <View style={styles.foreignBadge}>
                <Ionicons name="globe-outline" size={10} color="#0284C7" />
                <Text style={styles.foreignBadgeText}>
                  {invCurrency} • 1 = {currencySymbol}{exchangeRate}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Prominent XIRR / Interest Pill */}
        <View
          style={[
            styles.rateBadge,
            {
              backgroundColor: returns.badgeBg,
              borderColor: `${returns.badgeColor}40`,
            },
          ]}
        >
          <Ionicons
            name={
              returns.rateType === "FIXED"
                ? "shield-checkmark"
                : returns.rateType === "XIRR"
                  ? "flash"
                  : "trending-up"
            }
            size={12}
            color={returns.badgeColor}
          />
          <Text style={[styles.rateText, { color: returns.badgeColor }]}>
            {returns.displayRate} {returns.rateLabel}
          </Text>
        </View>
      </View>

      {/* Values Grid */}
      <View style={styles.valuesGrid}>
        <View style={styles.valCol}>
          <Text style={styles.valLabel}>Invested</Text>
          <Text style={styles.valNum}>
            {formatCurrency(returns.invested, isStealthMode, nativeSymbol)}
          </Text>
          {isForeign && (
            <Text style={styles.convertedSub}>
              ≈ {formatCurrency(returns.convertedInvested, isStealthMode, currencySymbol)}
            </Text>
          )}
        </View>

        <View style={styles.valCol}>
          <Text style={styles.valLabel}>Current Value</Text>
          <Text style={styles.valNum}>
            {formatCurrency(returns.current, isStealthMode, nativeSymbol)}
          </Text>
          {isForeign && (
            <Text style={styles.convertedSub}>
              ≈ {formatCurrency(returns.convertedCurrent, isStealthMode, currencySymbol)}
            </Text>
          )}
        </View>

        <View style={[styles.valCol, { alignItems: "flex-end" }]}>
          <Text style={styles.valLabel}>Gain / Loss</Text>
          <Text
            style={[
              styles.valNum,
              { color: isPos ? "#047857" : "#B91C1C" },
            ]}
          >
            {isPos ? "+" : ""}
            {formatCurrency(
              returns.absoluteReturn,
              isStealthMode,
              nativeSymbol,
            )}
          </Text>
          {!isStealthMode && (
            <Text
              style={[
                styles.retPct,
                { color: isPos ? "#047857" : "#B91C1C" },
              ]}
            >
              ({isPos ? "+" : ""}
              {returns.returnPercent}%)
            </Text>
          )}
          {isForeign && (
            <Text
              style={[
                styles.convertedSub,
                { color: isPos ? "#047857" : "#B91C1C" },
              ]}
            >
              ≈ {isPos ? "+" : ""}{formatCurrency(returns.convertedReturn, isStealthMode, currencySymbol)}
            </Text>
          )}
        </View>
      </View>

      {/* Extra Info (SIP / RD progress / Maturity) */}
      {hasSip && (
        <View style={styles.infoRow}>
          <Ionicons name="repeat" size={13} color="#134E4A" />
          <Text style={styles.infoText}>
            SIP:{" "}
            {formatCurrency(inv.sipAmount, isStealthMode, currencySymbol)} on{" "}
            {inv.sipDate}th monthly
          </Text>
        </View>
      )}

      {isRd && inv.rdTotalMonths && (
        <View style={styles.rdSection}>
          <View style={styles.rdTextRow}>
            <Text style={styles.infoText}>
              RD: {inv.rdCompletedMonths || 0}/{inv.rdTotalMonths} months paid
            </Text>
            <Text style={styles.rdMonthlyText}>
              {formatCurrency(
                inv.rdMonthlyAmount,
                isStealthMode,
                currencySymbol,
              )}
              /mo
            </Text>
          </View>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    ((inv.rdCompletedMonths || 0) / inv.rdTotalMonths) * 100,
                    100,
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {maturityCountdown && (
        <View style={styles.infoRow}>
          <Ionicons name="flag-outline" size={13} color={maturityCountdown.color} />
          <Text style={[styles.infoText, { color: maturityCountdown.color, fontFamily: 'Manrope_600SemiBold' }]}>
            {maturityCountdown.text}
            {inv.maturityAmount
              ? ` • Expected: ${formatCurrency(inv.maturityAmount, isStealthMode, currencySymbol)}`
              : ""}
          </Text>
        </View>
      )}

      {/* Quick Action Footer */}
      <View style={styles.footerActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAddAmount}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={15} color="#0F766E" />
          <Text style={styles.actionBtnText}>Add Funds</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onUpdateValue}
          activeOpacity={0.7}
        >
          <Ionicons name="trending-up" size={15} color="#0D9488" />
          <Text style={[styles.actionBtnText, { color: "#0D9488" }]}>
            Update Values
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.manageBtn]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={14} color="#475569" />
          <Text style={[styles.actionBtnText, { color: "#475569" }]}>
            Manage
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECEAE4",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  titleCol: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  typeText: {
    fontSize: 12,
    color: "#71717A",
    fontFamily: 'Manrope_500Medium',
  },
  platformBadge: {
    backgroundColor: "#ECEAE4",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  platformText: {
    fontSize: 10,
    color: "#475569",
    fontFamily: 'Manrope_600SemiBold',
  },
  foreignBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  foreignBadgeText: {
    fontSize: 10,
    color: "#0369A1",
    fontFamily: 'Manrope_600SemiBold',
  },
  convertedSub: {
    fontSize: 10,
    color: "#71717A",
    marginTop: 1,
    fontFamily: 'Manrope_500Medium',
  },
  rateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  rateText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
  },
  valuesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  valCol: {
    flex: 1,
  },
  valLabel: {
    fontSize: 10,
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  valNum: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
    marginTop: 2,
  },
  retPct: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    marginTop: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#475569",
  },
  rdSection: {
    marginBottom: 10,
  },
  rdTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  rdMonthlyText: {
    fontSize: 11,
    color: "#0D9488",
    fontFamily: 'Manrope_600SemiBold',
  },
  progressBg: {
    height: 5,
    backgroundColor: "#E5E2DC",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#14B8A6",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#ECEAE4",
    paddingTop: 10,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },
  manageBtn: {
    marginLeft: "auto",
    backgroundColor: "#ECEAE4",
  },
});

export default InvestmentCard;
