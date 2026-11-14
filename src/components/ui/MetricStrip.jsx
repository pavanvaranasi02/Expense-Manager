import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Reusable 3-column financial metric strip with optional proportion bar.
 * Differentiates flow/period metrics from boxed ledger lists.
 */
const MetricStrip = ({
  items = [],
  leftWeight = 0,
  rightWeight = 0,
  showProportionBar = false,
  boxed = false,
  omitTopBorder = false,
  headerTitle,
  headerRight,
  style,
}) => {
  const showBar = showProportionBar && (leftWeight > 0 || rightWeight > 0);

  return (
    <View
      style={[
        boxed ? styles.boxed : styles.inlineStrip,
        omitTopBorder && !boxed && { borderTopWidth: 0 },
        style,
      ]}
    >
      {headerTitle ? (
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {headerRight ? <Text style={styles.headerSub}>{headerRight}</Text> : null}
        </View>
      ) : null}

      {showBar ? (
        <View style={styles.proportionBar}>
          <View
            style={{
              flex: Math.max(leftWeight, 1),
              backgroundColor: Theme.colors.primary,
              height: '100%',
              borderRadius: 2,
            }}
          />
          <View
            style={{
              flex: Math.max(rightWeight, 1),
              backgroundColor: '#C2786B',
              height: '100%',
              borderRadius: 2,
            }}
          />
        </View>
      ) : null}

      <View style={styles.row}>
        {items.map((item, idx) => (
          <View key={item.label} style={styles.itemWrap}>
            {idx > 0 ? <View style={styles.divider} /> : null}
            <View
              style={[
                styles.col,
                item.align === 'right' && { alignItems: 'flex-end' },
              ]}
            >
              <Text style={styles.label}>{item.label}</Text>
              <Text
                style={[
                  styles.value,
                  item.color ? { color: item.color } : null,
                ]}
              >
                {item.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inlineStrip: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  boxed: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 14,
    color: Theme.colors.text,
  },
  headerSub: {
    fontFamily: Theme.typography.fontFamily.medium,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  proportionBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Theme.colors.border,
    marginHorizontal: 10,
  },
  col: {
    flex: 1,
  },
  label: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 10,
    color: Theme.colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 14,
    color: Theme.colors.text,
    marginTop: 2,
    ...Theme.typography.tabularNums,
  },
});

export default MetricStrip;

