import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { INVESTMENT_TYPES } from "../../../services/investmentService";
import { formatCurrency } from "../../../utils/format";

const AssetAllocationBar = ({
  breakdown = [],
  selectedCategory,
  onSelectCategory,
  isStealthMode,
  currencySymbol = "₹",
}) => {
  if (!breakdown || breakdown.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Asset Allocation</Text>
        {selectedCategory && (
          <TouchableOpacity
            onPress={() => onSelectCategory(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearFilter}>Show All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Proportional Segmented Progress Bar */}
      <View style={styles.progressBar}>
        {breakdown.map((item) => {
          const typeConfig = INVESTMENT_TYPES.find((t) => t.id === item.type);
          const color = item.color || typeConfig?.color || (item.isForeign ? "#0EA5E9" : "#134E4A");
          const pct = Math.max(item.percentage || 0, 2); // Minimum 2% so small slices show visually
          return (
            <View
              key={item.type}
              style={[
                styles.progressSegment,
                {
                  flex: pct,
                  backgroundColor: color,
                  opacity: selectedCategory && selectedCategory !== item.type ? 0.35 : 1,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Interactive Category Chips */}
      <View style={styles.chipsRow}>
        {breakdown.map((item) => {
          const typeConfig = INVESTMENT_TYPES.find((t) => t.id === item.type);
          const color = item.color || typeConfig?.color || (item.isForeign ? "#0EA5E9" : "#134E4A");
          const isSelected = selectedCategory === item.type;

          return (
            <TouchableOpacity
              key={item.type}
              style={[
                styles.chip,
                isSelected && { borderColor: color, backgroundColor: `${color}15` },
              ]}
              onPress={() => onSelectCategory(isSelected ? null : item.type)}
              activeOpacity={0.7}
            >
              {item.typeIcon ? (
                <Text style={{ marginRight: 4, fontSize: 11 }}>{item.typeIcon}</Text>
              ) : (
                <View style={[styles.dot, { backgroundColor: color }]} />
              )}
              <Text
                style={[
                  styles.chipName,
                  isSelected && { color: "#18181B", fontFamily: 'Manrope_700Bold' },
                ]}
                numberOfLines={1}
              >
                {item.typeName}
              </Text>
              <Text style={styles.chipPct}>{Math.round(item.percentage)}%</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ECEAE4",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearFilter: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },
  progressBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#E5E2DC",
    marginBottom: 12,
  },
  progressSegment: {
    height: "100%",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  chipName: {
    fontSize: 11,
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
    marginRight: 4,
  },
  chipPct: {
    fontSize: 11,
    color: "#0F172A",
    fontFamily: 'Manrope_700Bold',
  },
});

export default AssetAllocationBar;
