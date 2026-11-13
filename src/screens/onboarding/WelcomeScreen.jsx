import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';

const ONBOARDING_STEPS = [
  {
    num: '1',
    title: 'Storage Preference',
    desc: 'Choose Cloud sync or private Local storage',
    icon: 'server-outline',
    color: Theme.colors.primary,
    bg: Theme.colors.primaryLight,
  },
  {
    num: '2',
    title: 'Your Profile',
    desc: 'Name and default currency preference',
    icon: 'person-outline',
    color: Theme.colors.info,
    bg: Theme.colors.infoLight,
  },
  {
    num: '3',
    title: 'Your Accounts',
    desc: 'Bank accounts, credit cards, and cash',
    icon: 'wallet-outline',
    color: Theme.colors.success,
    bg: Theme.colors.successLight,
  },
  {
    num: '4',
    title: 'Monthly Budgets',
    desc: 'Set spending limits and stay on track',
    icon: 'pie-chart-outline',
    color: Theme.colors.warning,
    bg: Theme.colors.warningLight,
  },
];

const WelcomeScreen = ({ navigation }) => (
  <SafeAreaView style={styles.container}>
    <View style={styles.content}>
      <View style={styles.heroBadge}>
        <Ionicons name="sparkles" size={32} color={Theme.colors.primary} />
      </View>

      <Text style={styles.title}>Welcome to KOSH</Text>
      <Text style={styles.subtitle}>
        Set up your personal finance workspace in four quick steps
      </Text>

      <View style={styles.stepsCard}>
        {ONBOARDING_STEPS.map((step, index) => (
          <View
            key={step.num}
            style={[
              styles.step,
              index < ONBOARDING_STEPS.length - 1 && styles.stepBorder,
            ]}
          >
            <View style={[styles.stepIcon, { backgroundColor: step.bg }]}>
              <Ionicons name={step.icon} size={20} color={step.color} />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Get started with onboarding"
        onPress={() => navigation.navigate('SetupStorage')}
      >
        <Text style={styles.btnText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={18} color={Theme.colors.surface} />
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.lg,
  },
  heroBadge: {
    width: 68,
    height: 68,
    borderRadius: Theme.radius.xl,
    backgroundColor: Theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: Theme.spacing.md,
  },
  title: {
    fontSize: Theme.typography.size.xxxl,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    lineHeight: 20,
  },
  stepsCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
  },
  stepBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.divider,
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    marginLeft: Theme.spacing.md,
    flex: 1,
  },
  stepTitle: {
    fontSize: Theme.typography.size.base,
    fontWeight: Theme.typography.weight.semibold,
    color: Theme.colors.text,
  },
  stepDesc: {
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  btn: {
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: Theme.radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    ...Theme.shadows.elevated,
  },
  btnText: {
    color: Theme.colors.surface,
    fontSize: Theme.typography.size.base,
    fontWeight: Theme.typography.weight.semibold,
  },
});

export default WelcomeScreen;
