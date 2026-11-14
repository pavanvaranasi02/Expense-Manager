import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';

/**
 * Consistent top bar across KOSH screens with optional back button,
 * right actions, and top-right Profile Avatar entry point.
 */
const ScreenHeader = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  navigation,
  rightActions,
  showAvatar = false,
  style,
}) => {
  const userName = useAuthStore((s) => s.getUserName());
  const initials = (userName || 'K')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'K';

  const handleBack = () => {
    if (onBack) return onBack();
    if (navigation?.canGoBack?.()) navigation.goBack();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={Theme.colors.text} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        {rightActions}
        {showAvatar && navigation ? (
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
            accessibilityLabel="Open profile and settings"
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: 12,
    backgroundColor: Theme.colors.background,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    ...Theme.typography.presets.title,
    color: Theme.colors.text,
  },
  subtitle: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(19, 78, 74, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
});

export default ScreenHeader;

