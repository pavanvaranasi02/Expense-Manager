import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Analytics } from '../../config/firebase';
import { registerWithEmail } from '../../services/authService';

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    Analytics.screenView('Register');
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter a valid email';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Minimum 6 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const result = await registerWithEmail(name.trim(), email.trim(), password);

    if (!result.success) {
      setErrors({ general: result.error });
    } else {
      Analytics.signUp('email');
    }
    // Success: onAuthStateChanged handles navigation
    setLoading(false);
  };

  const renderInput = (config) => (
    <View style={styles.inputGroup} key={config.key}>
      <Text style={styles.label}>{config.label}</Text>
      <View style={[styles.inputContainer, errors[config.key] && styles.inputError]}>
        <Ionicons name={config.icon} size={20} color="#9CA3AF" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={config.placeholder}
          placeholderTextColor="#9CA3AF"
          value={config.value}
          onChangeText={(text) => {
            config.setter(text);
            if (errors[config.key]) setErrors({ ...errors, [config.key]: null });
          }}
          keyboardType={config.keyboardType || 'default'}
          autoCapitalize={config.autoCapitalize || 'none'}
          secureTextEntry={config.secure && !showPassword}
        />
        {config.secure && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20} color="#9CA3AF"
            />
          </TouchableOpacity>
        )}
      </View>
      {errors[config.key] && <Text style={styles.errorText}>{errors[config.key]}</Text>}
    </View>
  );

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start tracking your expenses today</Text>

          {/* Error Banner */}
          {errors.general && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          )}

          {/* Form */}
          {renderInput({
            key: 'name', label: 'Full Name', icon: 'person-outline',
            placeholder: 'Enter your name', value: name, setter: setName,
            autoCapitalize: 'words',
          })}

          {renderInput({
            key: 'email', label: 'Email', icon: 'mail-outline',
            placeholder: 'Enter your email', value: email, setter: setEmail,
            keyboardType: 'email-address',
          })}

          {renderInput({
            key: 'password', label: 'Password', icon: 'lock-closed-outline',
            placeholder: 'Create a password', value: password, setter: setPassword,
            secure: true,
          })}

          {renderInput({
            key: 'confirmPassword', label: 'Confirm Password', icon: 'lock-closed-outline',
            placeholder: 'Confirm your password', value: confirmPassword,
            setter: setConfirmPassword, secure: true,
          })}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.registerBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },

  header: { marginTop: 8, marginBottom: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },

  title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 28 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2',
    padding: 12, borderRadius: 10, marginBottom: 16,
  },
  errorBannerText: { fontSize: 13, color: '#EF4444', marginLeft: 8, flex: 1 },

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

  registerBtn: {
    backgroundColor: '#6C63FF', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  registerBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginText: { fontSize: 14, color: '#6B7280' },
  loginLink: { fontSize: 14, color: '#6C63FF', fontWeight: '600' },
});

export default RegisterScreen;