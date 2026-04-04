import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resetPassword } from '../../services/authService';
import { Theme } from '../../theme/theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    const result = await resetPassword(email.trim());

    if (result.success) {
      setSent(true);
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons name="mail" size={48} color={Theme.colors.primary} />
          </View>
          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successText}>
            We've sent a password reset link to {email}
          </Text>
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backToLoginText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Theme.colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={Theme.colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.resetBtn, loading && styles.btnDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Theme.colors.surface} />
            ) : (
              <Text style={styles.resetBtnText}>Send Reset Link</Text>
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
  scrollContent: { 
    paddingHorizontal: Theme.spacing.lg + Theme.spacing.xs, 
    paddingTop: Theme.spacing.xs 
  },

  backBtn: {
    width: 44, height: 44, borderRadius: Theme.radius.full, 
    backgroundColor: Theme.colors.border + '40', 
    justifyContent: 'center', alignItems: 'center', 
    marginBottom: Theme.spacing.lg,
  },

  title: { 
    fontSize: Theme.typography.size.xxl + 2, 
    fontWeight: Theme.typography.weight.extrabold, 
    color: Theme.colors.text, 
    letterSpacing: -0.8 
  },
  subtitle: { 
    fontSize: Theme.typography.size.base - 1, 
    color: Theme.colors.textMuted, 
    marginTop: Theme.spacing.xs, 
    marginBottom: Theme.spacing.xl, 
    lineHeight: 22 
  },

  inputGroup: { marginBottom: Theme.spacing.xl },
  label: { 
    fontSize: Theme.typography.size.sm - 1, 
    fontWeight: Theme.typography.weight.semibold, 
    color: Theme.colors.text, 
    marginBottom: Theme.spacing.sm 
  },
  inputContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, 
    borderWidth: 1.5, 
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md, 
    height: 58,
  },
  inputIcon: { marginRight: Theme.spacing.sm + Theme.spacing.xs },
  input: { 
    flex: 1, 
    fontSize: Theme.typography.size.base, 
    color: Theme.colors.text, 
    fontWeight: Theme.typography.weight.medium 
  },

  resetBtn: {
    backgroundColor: Theme.colors.primary, 
    height: 58, 
    borderRadius: Theme.radius.lg,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  resetBtnText: { 
    color: Theme.colors.surface, 
    fontSize: Theme.typography.size.lg - 1, 
    fontWeight: Theme.typography.weight.bold 
  },
  btnDisabled: { opacity: 0.6 },

  // Success State
  successContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Theme.spacing.xl },
  successIcon: {
    width: 96, height: 96, borderRadius: Theme.radius.full, 
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center', alignItems: 'center', 
    marginBottom: Theme.spacing.lg,
  },
  successTitle: { 
    fontSize: Theme.typography.size.xxl, 
    fontWeight: Theme.typography.weight.extrabold, 
    color: Theme.colors.text, 
    marginBottom: Theme.spacing.sm 
  },
  successText: { 
    fontSize: Theme.typography.size.base - 1, 
    color: Theme.colors.textMuted, 
    textAlign: 'center', 
    lineHeight: 22 
  },
  backToLoginBtn: {
    backgroundColor: Theme.colors.primary, 
    paddingVertical: Theme.spacing.md, 
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.lg, 
    marginTop: Theme.spacing.xl,
  },
  backToLoginText: { 
    color: Theme.colors.surface, 
    fontSize: Theme.typography.size.base, 
    fontWeight: Theme.typography.weight.bold 
  },
});

export default ForgotPasswordScreen;