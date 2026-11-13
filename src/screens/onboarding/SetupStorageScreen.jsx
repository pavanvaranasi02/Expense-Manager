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

const STORAGE_OPTIONS = [
  {
    id: 'cloud',
    title: 'Cloud Storage',
    subtitle: 'Synced & backed up automatically',
    icon: 'cloud-outline',
    color: '#6366F1',
    bg: '#EEF2FF',
    points: [
      'Automatic cloud backup across devices',
      'Offline queue syncs when back online',
      'Supports Family Sharing & sync',
    ],
  },
  {
    id: 'local',
    title: 'Local Storage',
    subtitle: '100% private on this device',
    icon: 'phone-portrait-outline',
    color: '#10B981',
    bg: '#ECFDF5',
    points: [
      'All data stays strictly on your device',
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
        <Text style={styles.badge}>STORAGE PREFERENCE</Text>
        <Text style={styles.title}>Where should we store your data?</Text>
        <Text style={styles.subtitle}>
          Choose how your expenses, accounts, and budgets are saved. You can
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
                  isSelected && {
                    borderColor: opt.color,
                    backgroundColor: '#FFFFFF',
                    shadowColor: opt.color,
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    elevation: 4,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => setSelectedMode(opt.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: opt.bg }]}>
                    <Ionicons name={opt.icon} size={24} color={opt.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
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
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                </View>

                <View style={styles.points}>
                  {opt.points.map((pt, idx) => (
                    <View key={idx} style={styles.pointRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isSelected ? opt.color : '#9CA3AF'}
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
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>Continue →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  content: { padding: 24, paddingTop: 32, paddingBottom: 40 },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C63FF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E', lineHeight: 32 },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 24,
  },
  cards: { gap: 16, marginBottom: 28 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  cardSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  points: { marginTop: 14, gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointText: { fontSize: 13, color: '#4B5563', flex: 1 },
  btn: {
    backgroundColor: '#6C63FF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default SetupStorageScreen;
