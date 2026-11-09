import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Theme } from "../../../theme/theme";
import { formatCurrency } from "../../../utils/format";

const PortfolioHeroCard = ({
  totals,
  portfolioXirr,
  isStealthMode,
  currencySymbol = "₹",
  onToggleStealth,
  onAddPress,
  onImportPress,
  onReportPress,
  activeTab,
  onChangeTab,
  historyCount = 0,
}) => {
  const currentValue = totals?.totalCurrentValue || 0;
  const investedValue = totals?.totalInvested || 0;
  const returnsValue = totals?.totalReturns || 0;
  const returnPercent = totals?.returnPercent || 0;
  const isPositive = returnsValue >= 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#4F46E5", "#6366F1", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Top Header Row in Card */}
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View style={styles.portfolioTag}>
              <Ionicons name="trending-up" size={13} color="#FFFFFF" />
              <Text style={styles.portfolioTagText}>PORTFOLIO</Text>
            </View>

            {/* Always-visible Portfolio XIRR / Annualized Return Badge */}
            {portfolioXirr !== null && portfolioXirr !== undefined ? (
              <View style={styles.xirrBadge}>
                <Ionicons name="flash" size={12} color="#FBBF24" />
                <Text style={styles.xirrBadgeText}>{portfolioXirr}% XIRR</Text>
              </View>
            ) : (
              <View style={styles.xirrBadge}>
                <Ionicons name="stats-chart" size={11} color="#A7F3D0" />
                <Text style={[styles.xirrBadgeText, { color: "#A7F3D0" }]}>
                  {returnPercent >= 0 ? "+" : ""}
                  {returnPercent}% Return
                </Text>
              </View>
            )}
          </View>

          {/* Privacy Eye Toggle */}
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleStealth();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isStealthMode ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="rgba(255, 255, 255, 0.85)"
            />
          </TouchableOpacity>
        </View>

        {/* Total Value */}
        <Text style={styles.mainLabel}>Total Portfolio Value</Text>
        <Text style={styles.mainAmount}>
          {formatCurrency(currentValue, isStealthMode, currencySymbol)}
        </Text>

        {/* Invested and Returns Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Total Invested</Text>
            <Text style={styles.statVal}>
              {formatCurrency(investedValue, isStealthMode, currencySymbol)}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Net Returns</Text>
            <View style={styles.returnsRow}>
              <Text
                style={[
                  styles.statVal,
                  { color: isPositive ? "#34D399" : "#F87171" },
                ]}
              >
                {isPositive ? "+" : ""}
                {formatCurrency(returnsValue, isStealthMode, currencySymbol)}
              </Text>
              {!isStealthMode && (
                <View
                  style={[
                    styles.pctPill,
                    {
                      backgroundColor: isPositive
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pctText,
                      { color: isPositive ? "#34D399" : "#F87171" },
                    ]}
                  >
                    {isPositive ? "+" : ""}
                    {returnPercent}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAddPress();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Add</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onImportPress();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={15} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Import</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReportPress();
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={15}
              color="#FFFFFF"
            />
            <Text style={styles.actionBtnText}>Report</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* View Switcher: Holdings vs History */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "holdings" && styles.tabBtnActive,
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onChangeTab("holdings");
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="pie-chart-outline"
            size={16}
            color={activeTab === "holdings" ? "#4F46E5" : "#64748B"}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "holdings" && styles.tabBtnTextActive,
            ]}
          >
            Holdings ({totals?.activeCount || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "history" && styles.tabBtnActive,
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onChangeTab("history");
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === "history" ? "#4F46E5" : "#64748B"}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "history" && styles.tabBtnTextActive,
            ]}
          >
            History {historyCount > 0 ? `(${historyCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    elevation: 6,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  portfolioTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  portfolioTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  xirrBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  xirrBadgeText: {
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  eyeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  mainLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 4,
    fontWeight: "500",
  },
  mainAmount: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    alignItems: "center",
  },
  statCol: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statVal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  returnsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  pctPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pctText: {
    fontSize: 10,
    fontWeight: "800",
  },
  actionsBar: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    marginTop: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#4F46E5",
    fontWeight: "700",
  },
});

export default PortfolioHeroCard;
