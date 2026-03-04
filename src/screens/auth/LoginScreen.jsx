import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
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
import { Analytics } from '../../config/firebase';
import { loginWithEmail, signInWithGoogle } from '../../services/authService';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    Analytics.screenView('Login');
  }, []);

  // Google Sign In Setup
  // ⚠️ REPLACE with your actual Web Client ID from Google Cloud Console
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  });

  // Handle Google Sign In Response
  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response.authentication?.idToken);
    }
  }, [response]);

  // ===== VALIDATION =====
  const validate = () => {
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== EMAIL LOGIN =====
  const handleEmailLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const result = await loginWithEmail(email.trim(), password);

    if (!result.success) {
      setErrors({ general: result.error });
    } else {
      Analytics.login('email');
    }
    // If success, onAuthStateChanged in AppNavigator handles navigation
    setLoading(false);
  };

  // ===== GOOGLE LOGIN =====
  const handleGoogleSignIn = async (idToken) => {
    if (!idToken) return;

    setGoogleLoading(true);
    const result = await signInWithGoogle(idToken);

    if (!result.success) {
      Alert.alert('Google Sign In Failed', result.error);
    } else {
      Analytics.login('google');
    }
    setGoogleLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Text style={styles.emoji}>💰</Text>
            <Text style={styles.appName}>Expense Manager</Text>
            <Text style={styles.tagline}>Track your money smartly</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue</Text>

            {/* General Error */}
            {errors.general && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputContainer, errors.email && styles.inputError]}>
                <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleEmailLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
              onPress={() => promptAsync()}
              disabled={!request || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#1A1A2E" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },

  // Logo
  logoSection: { alignItems: 'center', marginTop: 40, marginBottom: 32 },
  emoji: { fontSize: 56 },
  appName: { fontSize: 28, fontWeight: '700', color: '#1A1A2E', marginTop: 8 },
  tagline: { fontSize: 15, color: '#6B7280', marginTop: 4 },

  // Form
  formSection: { flex: 1 },
  formTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A2E' },
  formSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 24 },

  // Error Banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2',
    padding: 12, borderRadius: 10, marginBottom: 16,
  },
  errorBannerText: { fontSize: 13, color: '#EF4444', marginLeft: 8, flex: 1 },

  // Input
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#1A1A2E', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, height: 52,
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#1A1A2E' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 4 },

  // Forgot
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { fontSize: 14, color: '#6C63FF', fontWeight: '500' },

  // Login Button
  loginBtn: {
    backgroundColor: '#6C63FF', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 16, fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // Google
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', height: 52, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginLeft: 10 },

  // Register
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 32 },
  registerText: { fontSize: 14, color: '#6B7280' },
  registerLink: { fontSize: 14, color: '#6C63FF', fontWeight: '600' },
});

export default LoginScreen;