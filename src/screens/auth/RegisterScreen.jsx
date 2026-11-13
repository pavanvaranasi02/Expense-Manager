import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import Animated, { 
    FadeInDown, 
    FadeInUp, 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring,
    withTiming 
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Analytics } from '../../config/firebase';
import { registerWithEmail } from '../../services/authService';
import { Theme } from '../../theme/theme';
import KoshLogo from '../../components/Branding/KoshLogo';

const { width } = Dimensions.get('window');

// --- SUB-COMPONENTS ---

const PasswordStrength = memo(({ password }) => {
  if (!password) return null;
  
  let strength = 0;
  if (password.length > 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  const colors = ['#E5E7EB', '#EF4444', '#FBBF24', '#34D399', '#059669'];
  const labels = ['', 'Wait, too simple', 'Getting better', 'That\'s good', 'Fort Knox Level!'];

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.strengthContainer}>
      <View style={styles.strengthBarRow}>
        {[1, 2, 3, 4].map((i) => (
          <View 
            key={i} 
            style={[
              styles.strengthBar, 
              { backgroundColor: i <= strength ? colors[strength] : Theme.colors.border }
            ]} 
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: colors[strength] }]}>{labels[strength]}</Text>
    </Animated.View>
  );
});



const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [focusedField, setFocusedField] = useState(null);

  // Button Animation
  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  useEffect(() => {
    Analytics.screenView('Register');
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email, password, confirmPassword]);

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await registerWithEmail(name.trim(), email.trim(), password);

    if (!result.success) {
      setErrors({ general: result.error });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Analytics.signUp('email');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setLoading(false);
  };

  const renderInput = (config, index) => (
    <Animated.View 
        entering={FadeInDown.delay(500 + index * 100).duration(600)}
        style={styles.inputGroup} 
        key={config.key}
    >
      <Text style={styles.label}>{config.label}</Text>
      <View style={[
          styles.inputContainer, 
          errors[config.key] && styles.inputError,
          focusedField === config.key && styles.inputFocused
      ]}>
        <Ionicons 
            name={config.icon} 
            size={20} 
            color={focusedField === config.key ? Theme.colors.primary : Theme.colors.textLight} 
            style={styles.inputIcon} 
        />
        <TextInput
          style={styles.input}
          placeholder={config.placeholder}
          placeholderTextColor={Theme.colors.textLight}
          value={config.value}
          onChangeText={(text) => {
            config.setter(text);
            if (errors[config.key]) setErrors({ ...errors, [config.key]: null });
          }}
          onFocus={() => {
              setFocusedField(config.key);
              Haptics.selectionAsync();
          }}
          onBlur={() => setFocusedField(null)}
          keyboardType={config.keyboardType || 'default'}
          autoCapitalize={config.autoCapitalize || 'none'}
          secureTextEntry={config.secure && !showPassword}
          accessibilityLabel={config.label}
        />
        {config.secure && (
          <TouchableOpacity 
              onPress={() => {
                  setShowPassword(!showPassword);
                  Haptics.selectionAsync();
              }}
              style={styles.eyeBtn}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20} color={Theme.colors.textLight}
            />
          </TouchableOpacity>
        )}
      </View>
      {config.key === 'password' && <PasswordStrength password={password} />}
      {errors[config.key] && <Text style={styles.errorText}>{errors[config.key]}</Text>}
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>KOSH</Text>
            </View>
            
            <TouchableOpacity style={styles.infoBtn}>
               <Ionicons name="information-circle-outline" size={22} color={Theme.colors.textLight} />
            </TouchableOpacity>
          </Animated.View>

          {/* Hero Section */}
          <Animated.View 
              entering={FadeInDown.delay(200).duration(800)} 
              style={styles.heroSection}
          >
            <View style={styles.badge}>
                <Text style={styles.badgeText}>EXCLUSIVE ACCESS</Text>
            </View>
            <Text style={styles.heroTitle}>Join the Future of Finance</Text>
            <Text style={styles.subtitle}>Experience the next generation of wealth management in India.</Text>
          </Animated.View>

          {/* Error Banner */}
          {errors.general && (
            <Animated.View entering={FadeInDown} style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Theme.colors.error} />
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </Animated.View>
          )}

          {/* Form */}
          <View style={styles.formContainer}>
            {[
              {
                key: 'name', label: 'Full Name', icon: 'person-outline',
                placeholder: 'Arjun Malhotra', value: name, setter: setName,
                autoCapitalize: 'words',
              },
              {
                key: 'email', label: 'Email Address', icon: 'mail-outline',
                placeholder: 'arjun@ethereal.com', value: email, setter: setEmail,
                keyboardType: 'email-address',
              },
              {
                key: 'password', label: 'Password', icon: 'lock-closed-outline',
                placeholder: 'At least 8 characters', value: password, setter: setPassword,
                secure: true,
              },
              {
                key: 'confirmPassword', label: 'Confirm Password', icon: 'lock-closed-outline',
                placeholder: 'Repeat your password', value: confirmPassword,
                setter: setConfirmPassword, secure: true,
              }
            ].map((item, index) => renderInput(item, index))}


            {/* Register Button */}
            <Animated.View 
                entering={FadeInUp.delay(900).duration(600)}
                style={[styles.btnWrapper, buttonAnimatedStyle]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleRegister}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Create Account"
              >
                  <LinearGradient
                      colors={[Theme.colors.primary, Theme.colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.registerBtn, loading && styles.btnDisabled]}
                  >
                      {loading ? (
                        <ActivityIndicator color={Theme.colors.surface} />
                      ) : (
                        <Text style={styles.registerBtnText}>Create Account</Text>
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

            {/* Social Social Sign In */}
            <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialBtn}>
                    <Ionicons name="logo-google" size={20} color={Theme.colors.googleRed} />
                    <Text style={styles.socialBtnText}>Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}>
                    <Ionicons name="logo-apple" size={20} color={Theme.colors.text} />
                    <Text style={styles.socialBtnText}>Apple</Text>
                </TouchableOpacity>
            </View>

            {/* Login Link */}
            <Animated.View entering={FadeInUp.delay(1100).duration(600)} style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: Theme.spacing.lg, 
    paddingBottom: Theme.spacing.xl 
  },



  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginTop: Theme.spacing.sm, 
    marginBottom: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Theme.typography.size.base,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  backBtn: {
    width: 42, 
    height: 42, 
    borderRadius: Theme.radius.full, 
    backgroundColor: Theme.colors.surface, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border + '50',
    ...Theme.shadows.sm,
  },
  infoBtn: {
    width: 42, 
    height: 42, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  
  heroSection: {
    marginBottom: Theme.spacing.xl,
  },
  badge: {
    backgroundColor: Theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.md,
  },
  badgeText: {
    fontSize: 10,
    color: Theme.colors.primary,
    fontWeight: Theme.typography.weight.extrabold,
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: Theme.typography.size.xxxl,
    fontWeight: Theme.typography.weight.extrabold,
    color: Theme.colors.text,
    lineHeight: 38,
    letterSpacing: -1,
    marginBottom: Theme.spacing.xs,
  },
  subtitle: { 
    fontSize: Theme.typography.size.base, 
    color: Theme.colors.textMuted, 
    lineHeight: 24,
    fontWeight: Theme.typography.weight.medium,
  },

  errorBanner: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.errorBackground,
    padding: Theme.spacing.md, 
    borderRadius: Theme.radius.md, 
    marginBottom: Theme.spacing.lg,
    borderWidth: 1, 
    borderColor: Theme.colors.error + '20',
  },
  errorBannerText: { 
    fontSize: Theme.typography.size.sm, 
    color: Theme.colors.error, 
    marginLeft: Theme.spacing.sm, 
    flex: 1, 
    fontWeight: Theme.typography.weight.medium 
  },

  formContainer: {
    gap: Theme.spacing.xs,
  },
  inputGroup: { marginBottom: Theme.spacing.md },
  label: { 
    fontSize: Theme.typography.size.sm, 
    fontWeight: Theme.typography.weight.semibold, 
    color: Theme.colors.text, 
    marginBottom: Theme.spacing.sm,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.surface + '80',
    borderRadius: Theme.radius.lg, 
    borderWidth: 1.5, 
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md, 
    height: 58,
  },
  inputFocused: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  inputError: { 
    borderColor: Theme.colors.error, 
    backgroundColor: Theme.colors.errorBackground + '20' 
  },
  inputIcon: { marginRight: Theme.spacing.sm },
  input: { 
    flex: 1, 
    fontSize: Theme.typography.size.base, 
    color: Theme.colors.text, 
    fontWeight: Theme.typography.weight.medium 
  },
  errorText: { 
    fontSize: Theme.typography.size.xs, 
    color: Theme.colors.error, 
    marginTop: 6, 
    marginLeft: 4, 
    fontWeight: Theme.typography.weight.medium 
  },


  btnWrapper: {
    marginTop: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
    ...Theme.shadows.md,
  },
  registerBtn: {
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  registerBtnText: { 
    color: Theme.colors.surface, 
    fontSize: Theme.typography.size.lg, 
    fontWeight: Theme.typography.weight.bold,
    letterSpacing: 0.5,
  },
  btnDisabled: { opacity: 0.6 },

  strengthContainer: {
    marginTop: Theme.spacing.sm,
    paddingHorizontal: 4,
  },
  strengthBarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: Theme.radius.full,
  },
  strengthLabel: {
    fontSize: Theme.typography.size.xs,
    fontWeight: Theme.typography.weight.bold,
    marginTop: 6,
    textAlign: 'right',
  },
  eyeBtn: {
    padding: Theme.spacing.xs,
  },

  divider: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: Theme.spacing.lg 
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border + '80' },
  dividerText: { 
    marginHorizontal: Theme.spacing.md, 
    fontSize: 10, 
    color: Theme.colors.textLight, 
    fontWeight: Theme.typography.weight.extrabold, 
    letterSpacing: 1.2 
  },

  socialRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  socialBtn: {
    flex: 1,
    height: 54,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...Theme.shadows.sm,
  },
  socialBtnText: {
    fontSize: Theme.typography.size.sm,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
  },

  loginRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: Theme.spacing.xl 
  },
  loginText: { 
    fontSize: Theme.typography.size.base, 
    color: Theme.colors.textMuted, 
    fontWeight: Theme.typography.weight.medium 
  },
  loginLink: { 
    fontSize: Theme.typography.size.base, 
    color: Theme.colors.primary, 
    fontWeight: Theme.typography.weight.bold 
  },
});

export default RegisterScreen;