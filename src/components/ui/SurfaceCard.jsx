import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Flat, crisp fintech surface card with 1px hairline border and restrained elevation.
 */
const SurfaceCard = ({
  children,
  style,
  onPress,
  activeOpacity = 0.78,
  variant = 'default',
  padding = Theme.spacing.md,
}) => {
  const containerStyle = [
    styles.base,
    variant === 'subtle' && styles.subtle,
    variant === 'accent' && styles.accent,
    { padding },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={activeOpacity}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  subtle: {
    backgroundColor: Theme.colors.surfaceSubtle,
    borderColor: Theme.colors.border,
  },
  accent: {
    backgroundColor: Theme.colors.primaryLight,
    borderColor: 'rgba(19, 78, 74, 0.16)',
  },
});

export default SurfaceCard;

