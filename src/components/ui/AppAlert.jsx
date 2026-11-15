import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Theme } from '../../theme/theme';

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}✅❌⚠️🎉🗑️🔥💳🏦💵💰📊📈📉🚀✨🔔🔒🔓]/gu;

const stripEmojis = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(EMOJI_REGEX, '').replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
};

const inferAlertMeta = (title = '', message = '', buttons = []) => {
  const lower = `${title} ${message}`.toLowerCase();
  const hasDestructive = buttons.some((b) => b?.style === 'destructive');

  if (hasDestructive || lower.includes('delete') || lower.includes('remove') || lower.includes('clear')) {
    return {
      icon: 'trash-outline',
      color: Theme.colors.error,
      bg: Theme.colors.errorLight,
    };
  }
  if (lower.includes('error') || lower.includes('failed') || lower.includes('invalid') || lower.includes('insufficient')) {
    return {
      icon: 'alert-circle-outline',
      color: Theme.colors.error,
      bg: Theme.colors.errorLight,
    };
  }
  if (lower.includes('required') || lower.includes('warning') || lower.includes('limit') || lower.includes('alert')) {
    return {
      icon: 'warning-outline',
      color: Theme.colors.warning,
      bg: Theme.colors.warningLight,
    };
  }
  if (
    lower.includes('success') ||
    lower.includes('paid') ||
    lower.includes('saved') ||
    lower.includes('added') ||
    lower.includes('updated') ||
    lower.includes('restored') ||
    lower.includes('complete') ||
    lower.includes('copied') ||
    lower.includes('imported')
  ) {
    return {
      icon: 'checkmark-circle-outline',
      color: Theme.colors.success,
      bg: Theme.colors.successLight,
    };
  }
  return {
    icon: 'information-circle-outline',
    color: Theme.colors.primary,
    bg: Theme.colors.primaryLight,
  };
};

let listener = null;

export const AppAlert = {
  alert: (title, message = '', buttons = [{ text: 'OK' }], options = {}) => {
    const normalizedButtons =
      Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    const payload = {
      title: stripEmojis(title),
      message: stripEmojis(message),
      buttons: normalizedButtons,
      cancelable: options?.cancelable !== false,
    };
    if (listener) {
      listener(payload);
    }
  },
};

export const AppAlertHost = () => {
  const [alertState, setAlertState] = useState(null);

  useEffect(() => {
    listener = (payload) => setAlertState(payload);
    return () => {
      listener = null;
    };
  }, []);

  if (!alertState) return null;

  const { title, message, buttons, cancelable } = alertState;
  const meta = inferAlertMeta(title, message, buttons);

  const handleDismiss = () => {
    if (!cancelable) return;
    const cancelBtn = buttons.find((b) => b?.style === 'cancel');
    setAlertState(null);
    cancelBtn?.onPress?.();
  };

  const handlePressButton = (btn) => {
    setAlertState(null);
    btn?.onPress?.();
  };

  const isVertical = buttons.length > 2;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={24} color={meta.color} />
          </View>

          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={[styles.actions, isVertical && styles.actionsVertical]}>
            {buttons.map((btn, idx) => {
              const isCancel = btn?.style === 'cancel';
              const isDestructive = btn?.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${btn?.text || 'btn'}_${idx}`}
                  style={[
                    styles.button,
                    !isVertical && buttons.length === 2 && styles.buttonHalf,
                    isCancel && styles.buttonCancel,
                    isDestructive && styles.buttonDestructive,
                    !isCancel && !isDestructive && styles.buttonPrimary,
                  ]}
                  onPress={() => handlePressButton(btn)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                      (isDestructive || (!isCancel && !isDestructive)) && styles.buttonTextLight,
                    ]}
                    numberOfLines={1}
                  >
                    {stripEmojis(btn?.text || 'OK')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontFamily: Theme.typography.fontFamily.bold,
    color: Theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: Theme.typography.fontFamily.regular,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  actionsVertical: {
    flexDirection: 'column',
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: Theme.colors.primary,
  },
  buttonDestructive: {
    backgroundColor: Theme.colors.error,
  },
  buttonCancel: {
    backgroundColor: Theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: Theme.typography.fontFamily.semibold,
  },
  buttonTextLight: {
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: Theme.colors.textSecondary,
  },
});

export default AppAlert;
