import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import React, { memo, useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
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
    <Text style={styles.registerText}>Don't have an account? </Text>
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
          {/* Hero Section */}
          <Animated.View 
              entering={FadeInDown.delay(200).duration(800)} 
              style={styles.heroSection}
          >
            <View style={styles.heroHeader}>
                <KoshLogo size={80} />
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>EXCLUSIVE ACCESS</Text>
                </View>
            </View>
            <Text style={styles.appName}>KOSH</Text>
            <Text style={styles.tagline}>Future of Wealth Management</Text>
          </Animated.View>

          <Animated.View 
            entering={FadeInUp.delay(400).duration(800)}
            style={styles.formSection}
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>Enter your details to continue</Text>
            </View>

            {/* General Error */}
            {errors.general && (
              <Animated.View entering={FadeInDown} style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Theme.colors.error} />
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
                  focusedField === 'email' && styles.inputFocused
                ]}
              >
                <Ionicons 
                    name="mail-outline" 
                    size={20} 
                    color={focusedField === 'email' ? Theme.colors.primary : Theme.colors.textLight} 
                    style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={Theme.colors.textLight}
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
              <Text style={styles.label}>Password</Text>
              <View 
                style={[
                  styles.inputContainer, 
                  errors.password && styles.inputError,
                  focusedField === 'password' && styles.inputFocused
                ]}
              >
                <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={focusedField === 'password' ? Theme.colors.primary : Theme.colors.textLight} 
                    style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={Theme.colors.textLight}
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
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Theme.colors.textLight}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityRole="button"
              accessibilityLabel="Reset Password"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <Animated.View style={[styles.loginBtnWrapper, buttonAnimatedStyle]}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  onPress={handleEmailLogin}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Sign In"
                >
                    <LinearGradient
                        colors={[Theme.colors.primary, Theme.colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.loginBtn, loading && styles.btnDisabled]}
                    >
                        {loading ? (
                            <ActivityIndicator color={Theme.colors.surface} />
                        ) : (
                            <Text style={styles.loginBtnText}>Sign In</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
              onPress={() => promptAsync()}
              disabled={!request || googleLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {googleLoading ? (
                <ActivityIndicator color={Theme.colors.text} />
              ) : (
                <View style={styles.googleContent}>
                  <Ionicons name="logo-google" size={20} color={Theme.colors.googleRed} />
                  <Text style={styles.googleBtnText}>Google</Text>
                </View>
              )}
            </TouchableOpacity>

            <RegisterLink onNavigate={handleRegisterNavigation} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  keyboardView: { flex: 1 },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: Theme.spacing.lg + Theme.spacing.xs, 
    paddingBottom: Theme.spacing.xl + Theme.spacing.sm 
  },

  // Hero
  heroSection: {
    alignItems: 'center', 
    marginTop: Theme.spacing.xl + Theme.spacing.sm, 
    marginBottom: Theme.spacing.xxl 
  },
  heroHeader: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  badge: {
    backgroundColor: Theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
    marginTop: Theme.spacing.md,
  },
  badgeText: {
    fontSize: 10,
    color: Theme.colors.primary,
    fontWeight: Theme.typography.weight.extrabold,
    letterSpacing: 1,
  },
  appName: { 
    fontSize: Theme.typography.size.xxl, 
    fontWeight: Theme.typography.weight.extrabold, 
    color: Theme.colors.text, 
    marginTop: Theme.spacing.sm, 
    letterSpacing: -0.5 
  },
  tagline: { 
    fontSize: Theme.typography.size.sm - 1, 
    color: Theme.colors.textMuted, 
    marginTop: Theme.spacing.xs, 
    fontWeight: Theme.typography.weight.medium 
  },

  // Form
  formSection: { flex: 1 },
  formHeader: { marginBottom: Theme.spacing.lg + Theme.spacing.xs },
  formTitle: { 
    fontSize: Theme.typography.size.xxl + 2, 
    fontWeight: Theme.typography.weight.extrabold, 
    color: Theme.colors.text, 
    letterSpacing: -0.8 
  },
  formSubtitle: { 
    fontSize: Theme.typography.size.base - 1, 
    color: Theme.colors.textMuted, 
    marginTop: Theme.spacing.xs 
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.errorBackground,
    padding: Theme.spacing.sm + Theme.spacing.xs, 
    borderRadius: Theme.radius.md, 
    marginBottom: Theme.spacing.xl - Theme.spacing.sm,
    borderWidth: 1, 
    borderColor: Theme.colors.error + '20',
  },
  errorBannerText: { 
    fontSize: Theme.typography.size.sm, 
    color: Theme.colors.error, 
    marginLeft: Theme.spacing.sm + Theme.spacing.xs, 
    flex: 1, 
    fontWeight: Theme.typography.weight.medium 
  },

  // Input
  inputGroup: { marginBottom: Theme.spacing.lg },
  label: { 
    fontSize: Theme.typography.size.sm - 1, 
    fontWeight: Theme.typography.weight.semibold, 
    color: Theme.colors.text, 
    marginBottom: Theme.spacing.sm, 
    marginLeft: Theme.spacing.xs / 2 
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
  inputFocused: { 
    borderColor: Theme.colors.primary, 
    backgroundColor: Theme.colors.surface 
  },
  inputError: { 
    borderColor: Theme.colors.error, 
    backgroundColor: Theme.colors.errorBackground + '40' 
  },
  inputIcon: { marginRight: Theme.spacing.sm + Theme.spacing.xs },
  input: { 
    flex: 1, 
    fontSize: Theme.typography.size.base, 
    color: Theme.colors.text, 
    fontWeight: Theme.typography.weight.medium 
  },
  passwordToggle: { padding: Theme.spacing.xs },
  errorText: { 
    fontSize: Theme.typography.size.xs, 
    color: Theme.colors.error, 
    marginTop: Theme.spacing.xs + Theme.spacing.xs/2, 
    marginLeft: Theme.spacing.xs, 
    fontWeight: Theme.typography.weight.medium 
  },

  // Forgot
  forgotBtn: { alignSelf: 'flex-end', marginBottom: Theme.spacing.lg + Theme.spacing.xs },
  forgotText: { 
    fontSize: Theme.typography.size.sm, 
    color: Theme.colors.primary, 
    fontWeight: Theme.typography.weight.bold 
  },

  // Login Button
  loginBtnWrapper: {
    marginBottom: Theme.spacing.lg + Theme.spacing.sm,
    borderRadius: Theme.radius.lg,
  },
  loginBtn: {
    height: 58, 
    borderRadius: Theme.radius.lg,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  loginBtnText: { 
    color: Theme.colors.surface, 
    fontSize: Theme.typography.size.lg - 1, 
    fontWeight: Theme.typography.weight.bold, 
    letterSpacing: 0.5 
  },
  btnDisabled: { opacity: 0.7 },

  // Divider
  divider: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: Theme.spacing.lg + Theme.spacing.sm 
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border },
  dividerText: { 
    marginHorizontal: Theme.spacing.md, 
    fontSize: Theme.typography.size.xs, 
    color: Theme.colors.textLight, 
    fontWeight: Theme.typography.weight.extrabold, 
    letterSpacing: 1 
  },

  // Google
  googleBtn: {
    backgroundColor: Theme.colors.surface, 
    height: 58, 
    borderRadius: Theme.radius.lg,
    borderWidth: 1.5, 
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.xl,
    justifyContent: 'center',
  },
  googleContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleBtnText: { 
    fontSize: Theme.typography.size.base, 
    fontWeight: Theme.typography.weight.bold, 
    color: Theme.colors.text, 
    marginLeft: Theme.spacing.md - Theme.spacing.xs 
  },

  // Register
  registerRow: { flexDirection: 'row', justifyContent: 'center' },
  registerText: { 
    fontSize: Theme.typography.size.base - 1, 
    color: Theme.colors.textMuted, 
    fontWeight: Theme.typography.weight.medium 
  },
  registerLink: { 
    fontSize: Theme.typography.size.base - 1, 
    color: Theme.colors.primary, 
    fontWeight: Theme.typography.weight.bold 
  },
});

export default LoginScreen;