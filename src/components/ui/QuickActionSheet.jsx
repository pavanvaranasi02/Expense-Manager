import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../../store/useAuthStore';
import useStorageStore from '../../store/useStorageStore';
import { Theme } from '../../theme/theme';

const ACTIONS = [
  {
    id: 'expense',
    label: 'Expense',
    subtitle: 'Record a payment or purchase',
    icon: 'arrow-up-circle-outline',
    color: Theme.colors.error,
    bg: Theme.colors.errorLight,
  },
  {
    id: 'income',
    label: 'Income',
    subtitle: 'Log salary, refund or inflow',
    icon: 'arrow-down-circle-outline',
    color: Theme.colors.success,
    bg: Theme.colors.successLight,
  },
  {
    id: 'account',
    label: 'Account',
    subtitle: 'Add bank, card or cash wallet',
    icon: 'wallet-outline',
    color: Theme.colors.primary,
    bg: Theme.colors.primaryLight,
  },
  {
    id: 'investment',
    label: 'Investment',
    subtitle: 'Track mutual fund, SIP or FD',
    icon: 'trending-up-outline',
    color: Theme.colors.info,
    bg: Theme.colors.infoLight,
  },
  {
    id: 'bill',
    label: 'Bill / EMI',
    subtitle: 'Pay card bill or manage dues',
    icon: 'card-outline',
    color: Theme.colors.warning,
    bg: Theme.colors.warningLight,
  },
  {
    id: 'family',
    label: 'Family',
    subtitle: 'Add a shared family expense',
    icon: 'people-outline',
    color: Theme.colors.secondary,
    bg: Theme.colors.secondaryLight,
  },
];

/**
 * Contextual Action Sheet triggered by the central + button from anywhere.
 */
const QuickActionSheet = ({ visible, onClose, navigation }) => {
  const insets = useSafeAreaInsets();
  const storageMode = useStorageStore((s) => s.storageMode);
  const familyId = useAuthStore((s) => s.userProfile?.familyId);
  const isLocalMode = storageMode === 'local';

  const handleSelect = (actionId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();

    switch (actionId) {
      case 'expense':
        navigation.navigate('AddExpenseModal');
        break;
      case 'income':
        navigation.navigate('AddIncomeModal');
        break;
      case 'account':
        navigation.navigate('Main', {
          screen: 'Wealth',
          params: { screen: 'AddAccount', initial: false },
        });
        break;
      case 'investment':
        navigation.navigate('Main', {
          screen: 'Wealth',
          params: { screen: 'Portfolio', initial: false },
        });
        break;
      case 'bill':
        navigation.navigate('Main', {
          screen: 'Plan',
          params: { screen: 'CreditCardBill', initial: false },
        });
        break;
      case 'family':
        if (isLocalMode) {
          Alert.alert(
            'Family Disabled in Local Mode',
            'Family sharing requires Cloud Storage. Switch to Cloud Storage in Settings to use Family features.'
          );
          return;
        }
        if (familyId) {
          navigation.navigate('Family', { screen: 'AddFamilyExpense' });
        } else {
          navigation.navigate('Family');
        }
        break;
      default:
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>What would you like to add?</Text>
              <Text style={styles.subtitle}>Quickly record or set up anything in KOSH</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {ACTIONS.map((item) => {
              const disabled = item.id === 'family' && isLocalMode;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.actionCard, disabled && styles.actionDisabled]}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text style={styles.actionLabel}>{item.label}</Text>
                  <Text style={styles.actionSub} numberOfLines={2}>
                    {item.subtitle}
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.radius.xxl,
    borderTopRightRadius: Theme.radius.xxl,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: Theme.typography.size.lg,
    fontFamily: Theme.typography.fontFamily.bold,
    color: Theme.colors.text,
  },
  subtitle: {
    fontSize: Theme.typography.size.xs,
    fontFamily: Theme.typography.fontFamily.regular,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '48.4%',
    backgroundColor: Theme.colors.surfaceSubtle,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.borderSubtle,
    padding: 14,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: Theme.typography.size.sm,
    fontFamily: Theme.typography.fontFamily.bold,
    color: Theme.colors.text,
  },
  actionSub: {
    fontSize: Theme.typography.size.xxs,
    fontFamily: Theme.typography.fontFamily.regular,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
});

export default QuickActionSheet;

