import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Reusable Open Editorial Balance Sheet / Net Worth Hero Module.
 * Sits directly on the warm alabaster canvas with a 1px bottom rule (never a boxed gradient card).
 */
const BalanceHero = ({
  eyebrow = 'NET WORTH',
  amountText,
  badgeText,
  leftLabel = 'TOTAL ASSETS',
  leftValue,
  rightLabel = 'TOTAL LIABILITIES',
  rightValue,
  rightHighlightError = false,
  leftWeight = 0,
  rightWeight = 0,
  showRatioBar = false,
  isStealthMode,
  onToggleStealth,
  style,
}) => {
  const hasBar = showRatioBar && (leftWeight > 0 || rightWeight > 0);
  return (
    <View style={[styles.container, style]}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {typeof onToggleStealth === 'function' ? (
          <TouchableOpacity
            onPress={onToggleStealth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Toggle stealth mode"
          >
            <Ionicons
              name={isStealthMode ? 'eye-off-outline' : 'eye-outline'}
              size={15}
              color={Theme.colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
        {badgeText ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.amount}>{amountText}</Text>

      {hasBar ? (
        <View style={styles.ratioTrack}>
          <View
            style={[
              styles.ratioFillLeft,
              { flex: Math.max(leftWeight, 1) },
            ]}
          />
          {rightWeight > 0 ? (
            <View
              style={[
                styles.ratioFillRight,
                { flex: Math.max(rightWeight, 0.2) },
              ]}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.equationRow}>
        <View style={styles.col}>
          <View style={styles.colLabelRow}>
            <View style={[styles.dot, { backgroundColor: Theme.colors.primary }]} />
            <Text style={styles.colLabel}>{leftLabel}</Text>
          </View>
          <Text style={styles.colValue}>{leftValue}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.col}>
          <View style={styles.colLabelRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: rightHighlightError
                    ? Theme.colors.error
                    : Theme.colors.textLight,
                },
              ]}
            />
            <Text style={styles.colLabel}>{rightLabel}</Text>
          </View>
          <Text
            style={[
              styles.colValue,
              rightHighlightError && { color: Theme.colors.error },
            ]}
          >
            {rightValue}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
  },
  badge: {
    marginLeft: 'auto',
    backgroundColor: Theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  badgeText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 10,
    color: Theme.colors.primary,
    letterSpacing: 0.3,
  },
  amount: {
    ...Theme.typography.presets.heroAmount,
    color: Theme.colors.text,
    marginTop: 6,
    marginBottom: 12,
  },
  ratioTrack: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 14,
  },
  ratioFillLeft: {
    backgroundColor: Theme.colors.primary,
    height: '100%',
    borderRadius: 2,
  },
  ratioFillRight: {
    backgroundColor: Theme.colors.error,
    height: '100%',
    borderRadius: 2,
  },
  equationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    flex: 1,
  },
  colLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: Theme.colors.border,
    marginHorizontal: 14,
  },
  colLabel: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  colValue: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 15,
    color: Theme.colors.text,
    ...Theme.typography.tabularNums,
  },
});

export default BalanceHero;

