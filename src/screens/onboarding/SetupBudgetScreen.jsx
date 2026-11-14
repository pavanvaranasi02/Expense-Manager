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
import { completeOnboarding } from '../../services/authService';
import { saveBudgets } from '../../services/budgetService';
import useAuthStore from '../../store/useAuthStore';

const BUDGET_CATEGORIES = [
  { id: 'overall', name: 'Overall Monthly', icon: '💰', suggested: '30000' },
  { id: 'food', name: 'Food & Dining', icon: '🍕', suggested: '8000' },
  { id: 'travel', name: 'Travel', icon: '🚗', suggested: '5000' },
  { id: 'shopping', name: 'Shopping', icon: '🛒', suggested: '5000' },
  { id: 'bills', name: 'Bills & Utilities', icon: '📱', suggested: '3000' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', suggested: '2000' },
  { id: 'pooja', name: 'Pooja & Donations', icon: '🪔', suggested: '2000' },
  { id: 'health', name: 'Health', icon: '🏥', suggested: '2000' },
];

const SetupBudgetScreen = ({ navigation }) => {
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(false);
  const setOnboardingComplete = useAuthStore((state) => state.setOnboardingComplete);

  const handleBudgetChange = (categoryId, value) => {
    // Only allow numbers
    const cleaned = value.replace(/[^0-9]/g, '');
    setBudgets(prev => ({ ...prev, [categoryId]: cleaned }));
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      const userId = auth.currentUser.uid;
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // 1. Save budgets that have values
      const budgetsToSave = BUDGET_CATEGORIES
        .filter(cat => budgets[cat.id] && parseFloat(budgets[cat.id]) > 0)
        .map(cat => ({
          categoryId: cat.id,
          categoryName: cat.name,
          amount: budgets[cat.id],
        }));

      if (budgetsToSave.length > 0) {
        const budgetResult = await saveBudgets(budgetsToSave, month, year);
        if (!budgetResult.success) {
          console.log('⚠️ Budget save warning:', budgetResult.error);
        } else {
          console.log('✅ Budgets saved:', budgetsToSave.length);
        }
      }

      // 2. Mark onboarding as complete
      const result = await completeOnboarding(userId);

      if (result.success) {
        console.log('✅ Onboarding complete!');
        setOnboardingComplete();
      } else {
        Alert.alert('Error', 'Failed to complete setup. Please try again.');
      }
    } catch (error) {
      console.log('❌ Complete setup error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  const handleSkip = async () => {
    Alert.alert(
      'Skip Budgets?',
      'You can set budgets anytime from the Profile tab.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Skip',
          onPress: async () => {
            setLoading(true);
            try {
              const userId = auth.currentUser.uid;
              const result = await completeOnboarding(userId);
              if (result.success) {
                setOnboardingComplete();
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong.');
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  const filledCount = Object.values(budgets).filter(v => v && parseFloat(v) > 0).length;

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
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, styles.progressLineDone]} />
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, styles.progressLineDone]} />
            <View style={[styles.progressDot, styles.progressActive]} />
          </View>

          <Text style={styles.step}>Step 4 of 4</Text>
          <Text style={styles.title}>Set Budgets</Text>
          <Text style={styles.subtitle}>
            Set monthly spending limits to stay on track. Leave blank to skip any category.
          </Text>

          {/* Budget Categories */}
          {BUDGET_CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.budgetCard}>
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetEmoji}>{cat.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.budgetName}>{cat.name}</Text>
                  <Text style={styles.budgetSuggested}>Suggested: ₹{parseInt(cat.suggested).toLocaleString('en-IN')}</Text>
                </View>
              </View>
              <View style={styles.budgetInputRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.budgetInput}
                  placeholder={cat.suggested}
                  placeholderTextColor="#A1A1AA"
                  value={budgets[cat.id] || ''}
                  onChangeText={(val) => handleBudgetChange(cat.id, val)}
                  keyboardType="numeric"
                />
                <Text style={styles.perMonth}>/month</Text>
              </View>
            </View>
          ))}

          {/* Complete Button */}
          <TouchableOpacity
            style={[styles.completeBtn, loading && { opacity: 0.6 }]}
            onPress={handleComplete}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.completeBtnText}>
                {filledCount > 0
                  ? `Complete Setup (${filledCount} budgets) 🚀`
                  : 'Complete Setup 🚀'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F6F2' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ECEAE4' },
  progressActive: { backgroundColor: '#134E4A', width: 14, height: 14, borderRadius: 7 },
  progressDone: { backgroundColor: '#047857' },
  progressLine: { width: 40, height: 2, backgroundColor: '#ECEAE4', marginHorizontal: 4 },
  progressLineDone: { backgroundColor: '#047857' },

  step: { fontSize: 13, color: '#134E4A', fontFamily: 'Manrope_600SemiBold' },
  title: { fontSize: 26, fontFamily: 'Manrope_700Bold', color: '#18181B', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#71717A', marginTop: 4, marginBottom: 24, lineHeight: 20 },

  budgetCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    marginBottom: 10, borderWidth: 1.5, borderColor: '#ECEAE4',
  },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  budgetEmoji: { fontSize: 20, marginRight: 10 },
  budgetName: { fontSize: 15, fontFamily: 'Manrope_500Medium', color: '#18181B' },
  budgetSuggested: { fontSize: 11, color: '#71717A', marginTop: 1 },

  budgetInputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F6F2',
    borderRadius: 10, paddingHorizontal: 14, height: 44,
  },
  rupee: { fontSize: 18, fontFamily: 'Manrope_600SemiBold', color: '#3F3F46', marginRight: 4 },
  budgetInput: { flex: 1, fontSize: 18, fontFamily: 'Manrope_600SemiBold', color: '#18181B' },
  perMonth: { fontSize: 13, color: '#71717A' },

  completeBtn: {
    backgroundColor: '#047857', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 24,
  },
  completeBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Manrope_600SemiBold' },

  skipBtn: { alignItems: 'center', marginTop: 16, padding: 12 },
  skipText: { fontSize: 15, color: '#71717A', fontFamily: 'Manrope_500Medium' },
});

export default SetupBudgetScreen;