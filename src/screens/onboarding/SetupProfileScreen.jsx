import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import { updateUserProfile } from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const SetupProfileScreen = ({ navigation }) => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const updateProfileStore = useAuthStore((state) => state.updateProfile);

  const [name, setName] = useState(
    auth.currentUser?.displayName || userProfile?.name || ''
  );
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [currency, setCurrency] = useState(userProfile?.currency || 'INR');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }

    setLoading(true);

    try {
      const userId = auth.currentUser.uid;

      const profileData = {
        name: name.trim(),
        phone: phone.trim() || null,
        currency,
      };

      const result = await updateUserProfile(userId, profileData);

      if (result.success) {
        // Update local store
        updateProfileStore(profileData);
        console.log('✅ Profile saved to Firebase');
        navigation.navigate('SetupAccounts');
      } else {
        Alert.alert('Error', 'Failed to save profile: ' + result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.log('❌ Profile save error:', error);
    }

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress */}
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, styles.progressLineDone]} />
            <View style={[styles.progressDot, styles.progressActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>

          <Text style={styles.step}>Step 2 of 4</Text>
          <Text style={styles.title}>Your Profile</Text>
          <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#71717A" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#71717A"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number (Optional)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#71717A" style={styles.inputIcon} />
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor="#71717A"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* Currency */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Currency</Text>
            <View style={styles.currencyRow}>
              {CURRENCIES.map((cur) => (
                <TouchableOpacity
                  key={cur.code}
                  style={[
                    styles.currencyChip,
                    currency === cur.code && styles.currencyChipActive,
                  ]}
                  onPress={() => setCurrency(cur.code)}
                >
                  <Text style={[
                    styles.currencySymbol,
                    currency === cur.code && styles.currencySymbolActive,
                  ]}>
                    {cur.symbol}
                  </Text>
                  <Text style={[
                    styles.currencyCode,
                    currency === cur.code && styles.currencyCodeActive,
                  ]}>
                    {cur.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Next Button */}
          <TouchableOpacity
            style={[styles.nextBtn, loading && { opacity: 0.6 }]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.nextBtnText}>Next: Add Accounts →</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, paddingBottom: 80 },

  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Theme.spacing.lg },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Theme.colors.primaryLight },
  progressActive: { backgroundColor: Theme.colors.primary, width: 24 },
  progressDone: { backgroundColor: Theme.colors.success },
  progressLine: { width: 28, height: 2, backgroundColor: Theme.colors.primaryLight, marginHorizontal: Theme.spacing.xs },
  progressLineDone: { backgroundColor: Theme.colors.success },

  step: { fontSize: Theme.typography.size.xs, color: Theme.colors.primary, fontWeight: Theme.typography.weight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: Theme.typography.size.xxl, fontWeight: Theme.typography.weight.bold, color: Theme.colors.text, marginTop: 4 },
  subtitle: { fontSize: Theme.typography.size.sm, color: Theme.colors.textMuted, marginTop: 4, marginBottom: Theme.spacing.xl },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: '#18181B', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#ECEAE4',
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  prefix: { fontSize: 15, color: '#71717A', marginRight: 4 },
  input: { flex: 1, fontSize: 15, color: '#18181B' },

  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  currencyChip: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEAE4',
  },
  currencyChipActive: { backgroundColor: '#134E4A', borderColor: '#134E4A' },
  currencySymbol: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: '#18181B', marginRight: 6 },
  currencySymbolActive: { color: '#FFFFFF' },
  currencyCode: { fontSize: 13, color: '#71717A' },
  currencyCodeActive: { color: '#FFFFFF' },

  nextBtn: {
    backgroundColor: '#134E4A', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 32,
  },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Manrope_600SemiBold' },
});

export default SetupProfileScreen;