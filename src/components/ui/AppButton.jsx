import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Standardized KOSH button component (primary, secondary, danger, ghost).
 */
const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;
  const fgColor =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'danger'
      ? Theme.colors.error
      : variant === 'secondary'
      ? Theme.colors.text
      : Theme.colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant] || styles.primary,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fgColor} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={18} color={fgColor} style={styles.icon} />
          ) : null}
          <Text style={[styles.label, { color: fgColor }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: Theme.layout.buttonHeight,
    borderRadius: Theme.radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  primary: {
    backgroundColor: Theme.colors.primary,
  },
  secondary: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  danger: {
    backgroundColor: Theme.colors.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.18)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.55,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    ...Theme.typography.presets.buttonLabel,
  },
});

export default AppButton;

