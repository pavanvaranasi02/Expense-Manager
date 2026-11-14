import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Restrained EmptyState primitive.
 * When `compact` is true, renders a horizontal single-row banner (~60px tall)
 * instead of an oversized vertical box.
 */
const EmptyState = ({
  icon = 'document-text-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  style,
}) => {
  if (compact) {
    return (
      <View style={[styles.compactRow, style]}>
        <View style={styles.compactIcon}>
          <Ionicons name={icon} size={18} color={Theme.colors.textSecondary} />
        </View>
        <View style={styles.compactTextWrap}>
          <Text style={styles.compactTitle}>{title}</Text>
          {description ? (
            <Text style={styles.compactDesc} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
        {actionLabel && onAction ? (
          <TouchableOpacity
            style={styles.compactBtn}
            onPress={onAction}
            activeOpacity={0.8}
          >
            <Text style={styles.compactBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={Theme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  compactIcon: {
    width: 34,
    height: 34,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTextWrap: {
    flex: 1,
  },
  compactTitle: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 13,
    color: Theme.colors.text,
  },
  compactDesc: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
    lineHeight: 15,
  },
  compactBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Theme.radius.sm,
  },
  compactBtnText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  container: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 14,
    color: Theme.colors.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 17,
    maxWidth: 250,
  },
  button: {
    marginTop: 10,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.radius.md,
  },
  buttonText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    color: '#FFFFFF',
    fontSize: 12,
  },
});

export default EmptyState;
