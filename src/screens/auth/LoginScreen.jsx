import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import React, { memo, useCallback, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View} from 'react-native';
import { AppAlert as Alert } from "../../components/ui/AppAlert";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Analytics } from '../../config/firebase';
import { loginWithEmail, signInWithGoogle } from '../../services/authService';
import { Theme } from '../../theme/theme';
import KoshLogo from '../../components/Branding/KoshLogo';

WebBrowser.maybeCompleteAuthSession();

// --- MEMOIZED COMPONENTS ---

const RegisterLink = memo(({ onNavigate }) => (
  <View style={styles.registerRow}>
    <Text style={styles.registerText}>Don&apos;t have an account? </Text>
    <TouchableOpacity 
        onPress={onNavigate}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Register"
    >
      <Text style={styles.registerLink}>Sign Up</Text>
    </TouchableOpacity>
  </View>
));

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [focusedField, setFocusedField] = useState(null);

  // Animation values
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 10, stiffness: 300 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  React.useEffect(() => {
    Analytics.screenView('Login');
  }, []);

  // Google Sign In Setup
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response.authentication?.idToken);
    }
  }, [response]);

  // ===== VALIDATION =====
  const validate = useCallback(() => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter a valid email';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (Object.keys(newErrors).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  // ===== EMAIL LOGIN =====
  const handleEmailLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await loginWithEmail(email.trim(), password);

    if (!result.success) {
      setErrors({ general: result.error });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Analytics.login('email');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setLoading(false);
  };

  // ===== GOOGLE LOGIN =====
  const handleGoogleSignIn = async (idToken) => {
    if (!idToken) return;

    setGoogleLoading(true);
    const result = await signInWithGoogle(idToken);

    if (!result.success) {
      Alert.alert('Google Sign In Failed', result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Analytics.login('google');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setGoogleLoading(false);
  };

  const handleRegisterNavigation = useCallback(() => {
    navigation.navigate('Register');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Editorial Brand Header */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            style={styles.heroSection}
          >
            <KoshLogo size={58} />
            <Text style={styles.appName}>KOSH</Text>
            <Text style={styles.tagline}>Personal Wealth &amp; Expense Treasury</Text>
          </Animated.View>

          {/* Treasury Form Card */}
          <Animated.View
            entering={FadeInUp.delay(180).duration(500)}
            style={styles.formCard}
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Welcome back</Text>
              <Text style={styles.formSubtitle}>
                Sign in to access your accounts, investments, and insights.
              </Text>
            </View>

            {/* General Error */}
            {errors.general && (
              <Animated.View entering={FadeInDown} style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </Animated.View>
            )}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View
                style={[
                  styles.inputContainer,
                  errors.email && styles.inputError,
                  focusedField === 'email' && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={focusedField === 'email' ? '#134E4A' : '#64748B'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  onFocus={() => {
                    setFocusedField('email');
                    Haptics.selectionAsync();
                  }}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  accessibilityLabel="Email input"
                  accessibilityHint="Input your registered email address"
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  accessibilityRole="button"
                  accessibilityLabel="Reset Password"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  errors.password && styles.inputError,
                  focusedField === 'password' && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={focusedField === 'password' ? '#134E4A' : '#64748B'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  onFocus={() => {
                    setFocusedField('password');
                    Haptics.selectionAsync();
                  }}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  accessibilityLabel="Password input"
                  accessibilityHint="Input your secure password"
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowPassword(!showPassword);
                    Haptics.selectionAsync();
                  }}
                  style={styles.passwordToggle}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Sign In Button */}
            <Animated.View style={[styles.loginBtnWrapper, buttonAnimatedStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleEmailLogin}
                disabled={loading}
                style={[styles.loginBtn, loading && styles.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Sign In"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={styles.loginBtnInner}>
                    <Text style={styles.loginBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
              onPress={() => promptAsync()}
              disabled={!request || googleLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {googleLoading ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <View style={styles.googleContent}>
                  <Ionicons name="logo-google" size={18} color="#DC2626" />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.footerSection}>
            <RegisterLink onNavigate={handleRegisterNavigation} />
            <View style={styles.trustRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#64748B" />
              <Text style={styles.trustText}>Private &amp; encrypted financial workspace</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F6F2' },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },

  // Editorial Header
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 22,
    fontFamily: 'Manrope_800ExtraBold',
    color: '#0F172A',
    marginTop: 12,
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
    marginTop: 4,
  },

  // Card
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E2DC',
    overflow: 'hidden',
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  formSubtitle: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 19,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: '#B91C1C',
    marginLeft: 10,
    flex: 1,
  },

  // Inputs
  inputGroup: { marginBottom: 16 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: '#334155',
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F6F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E2DC',
    paddingHorizontal: 14,
    height: 52,
  },
  inputFocused: {
    borderColor: '#134E4A',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#B91C1C',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: '#0F172A',
  },
  passwordToggle: { padding: 6 },
  errorText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: '#B91C1C',
    marginTop: 5,
    marginLeft: 2,
  },

  // Sign In Button
  loginBtnWrapper: {
    marginTop: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  loginBtn: {
    height: 52,
    backgroundColor: '#134E4A',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.2,
  },
  btnDisabled: { opacity: 0.7 },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E2DC' },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Google
  googleBtn: {
    backgroundColor: '#FFFFFF',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E2DC',
    justifyContent: 'center',
  },
  googleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleBtnText: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
  },

  // Footer
  footerSection: {
    marginTop: 22,
    alignItems: 'center',
    gap: 10,
  },
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
  },
  registerLink: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
  },
});

export default LoginScreen;