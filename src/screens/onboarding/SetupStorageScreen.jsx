import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import {
  saveLocalProfile,
  saveStorageMode,
} from '../../services/localStorageService';
import useAuthStore from '../../store/useAuthStore';
import useStorageStore from '../../store/useStorageStore';
import { Theme } from '../../theme/theme';

const STORAGE_OPTIONS = [
  {
    id: 'cloud',
    title: 'Cloud Storage',
    subtitle: 'Synced & backed up automatically',
    icon: 'cloud-outline',
    color: Theme.colors.primary,
    bg: Theme.colors.primaryLight,
    points: [
      'Automatic cloud backup across devices',
      'Offline queue syncs when back online',
      'Supports Family Sharing & sync',
    ],
  },
  {
    id: 'local',
    title: 'Local Storage',
    subtitle: 'Private on this device only',
    icon: 'phone-portrait-outline',
    color: Theme.colors.primary,
    bg: Theme.colors.primaryLight,
    points: [
      'All personal data stays strictly on-device',
      'Instant speed, works completely offline',
      'Switch to Cloud anytime in Settings',
    ],
  },
];

const SetupStorageScreen = ({ navigation }) => {
  const initialMode = useStorageStore((s) => s.storageMode) || 'cloud';
  const userProfile = useAuthStore((s) => s.userProfile);
  const updateProfileStore = useAuthStore((s) => s.updateProfile);

  const [selectedMode, setSelectedMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      if (userId) {
        await saveStorageMode(userId, selectedMode);
        if (selectedMode === 'local') {
          await saveLocalProfile(
            userId,
            {
              name: auth.currentUser?.displayName || userProfile?.name || '',
              email: auth.currentUser?.email || userProfile?.email || '',
              currency: userProfile?.currency || 'INR',
              onboardingComplete: false,
              storageMode: 'local',
            },
            true
          );
        }
        updateProfileStore({ storageMode: selectedMode });
      }
      navigation.navigate('SetupProfile');
    } catch (error) {
      console.log('❌ SetupStorage error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, styles.progressActive]} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
        </View>

        <Text style={styles.step}>Step 1 of 4</Text>
        <Text style={styles.title}>Storage Preference</Text>
        <Text style={styles.subtitle}>
          Choose where your expenses, accounts, and budgets are saved. You can
          switch anytime in Settings.
        </Text>

        <View style={styles.cards}>
          {STORAGE_OPTIONS.map((opt) => {
            const isSelected = selectedMode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.card,
                  isSelected && [styles.cardSelected, { borderColor: opt.color }],
                ]}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${opt.title}: ${opt.subtitle}`}
                onPress={() => setSelectedMode(opt.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: opt.bg }]}>
                    <Ionicons name={opt.icon} size={22} color={opt.color} />
                  </View>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{opt.title}</Text>
                    <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      isSelected && {
                        borderColor: opt.color,
                        backgroundColor: opt.color,
                      },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={Theme.colors.surface}
                      />
                    )}
                  </View>
                </View>

                <View style={styles.points}>
                  {opt.points.map((pt, idx) => (
                    <View key={idx} style={styles.pointRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isSelected ? opt.color : Theme.colors.textLight}
                      />
                      <Text style={styles.pointText}>{pt}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue to profile setup"
        >
          {loading ? (
            <ActivityIndicator color={Theme.colors.surface} />
          ) : (
            <>
              <Text style={styles.btnText}>Continue</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={Theme.colors.surface}
              />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.lg,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.primaryLight,
  },
  progressActive: {
    backgroundColor: Theme.colors.primary,
    width: 24,
  },
  progressLine: {
    width: 28,
    height: 2,
    backgroundColor: Theme.colors.primaryLight,
    marginHorizontal: Theme.spacing.xs,
  },
  step: {
    fontSize: Theme.typography.size.xs,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Theme.spacing.xs,
  },
  title: {
    fontSize: Theme.typography.size.xxl,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
  },
  subtitle: {
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.xs,
    lineHeight: 20,
    marginBottom: Theme.spacing.lg,
  },
  cards: {
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },
  cardSelected: {
    ...Theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  cardTitle: {
    fontSize: Theme.typography.size.base,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
  },
  cardSubtitle: {
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Theme.colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  points: {
    marginTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.divider,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  pointText: {
    fontSize: Theme.typography.size.xs,
    color: Theme.colors.textMuted,
    flex: 1,
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
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: Theme.colors.surface,
    fontSize: Theme.typography.size.base,
    fontWeight: Theme.typography.weight.semibold,
  },
});

export default SetupStorageScreen;
