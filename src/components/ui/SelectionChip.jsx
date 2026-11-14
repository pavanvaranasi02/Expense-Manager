import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Standardized KOSH selection chip (used for filters, modes, and quick picks).
 */
const SelectionChip = ({ label, selected = false, icon, onPress, style }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected, style]}
    onPress={onPress}
    activeOpacity={0.78}
  >
    {icon ? (
      <Ionicons
        name={icon}
        size={14}
        color={selected ? '#FFFFFF' : Theme.colors.textSecondary}
        style={styles.icon}
      />
    ) : null}
    <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  chipSelected: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    ...Theme.typography.presets.pillLabel,
    color: Theme.colors.textSecondary,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});

export default SelectionChip;

