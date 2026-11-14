import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Consistent section header with optional right action link.
 */
const SectionHeader = ({ title, actionLabel, onAction, style }) => (
  <View style={[styles.row, style]}>
    <Text style={styles.title}>{title}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.action}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
  },
  action: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.primary,
  },
});

export default SectionHeader;

