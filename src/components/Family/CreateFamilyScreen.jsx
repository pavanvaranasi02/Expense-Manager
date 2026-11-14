import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Analytics } from '../../config/firebase';
import { createFamily, getFamily } from '../../services/familyService';
import useAuthStore from '../../store/useAuthStore';
import useFamilyStore from '../../store/useFamilyStore';

const CreateFamilyScreen = ({ navigation }) => {
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const { setFamily, setMembers } = useFamilyStore();
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const handleCreate = async () => {
    const trimmedName = familyName.trim();
    if (!trimmedName) {
        Toast.show({
        type: 'error',
        text1: 'Family name required',
        text2: 'Please enter a name for your family',
        });
        return;
    }

    if (trimmedName.length < 2) {
        Toast.show({
        type: 'error',
        text1: 'Name too short',
        text2: 'Family name must be at least 2 characters',
        });
        return;
    }

    setLoading(true);
    try {
        const result = await createFamily(trimmedName);

        if (result.success) {
        Analytics.createFamily(trimmedName);

        // Fetch full family data FIRST
        const familyResult = await getFamily(result.familyId);
        
        if (familyResult.success) {
            // Update family store FIRST (before auth store)
            setFamily(familyResult.family);
            setMembers(familyResult.family.members || []);
            
            // Then update auth store
            updateProfile({ familyId: result.familyId });

            Toast.show({
            type: 'success',
            text1: 'Family Created! 🎉',
            text2: `Invite code: ${result.inviteCode}`,
            visibilityTime: 3000,
            });

            // Small delay to ensure state propagation, then navigate
            setTimeout(() => {
            navigation.replace('FamilyDashboard');
            }, 100);
        } else {
            Toast.show({
            type: 'error',
            text1: 'Error loading family',
            text2: familyResult.error,
            });
        }
        } else {
        Toast.show({
            type: 'error',
            text1: 'Failed to create family',
            text2: result.error,
        });
        }
    } catch (error) {
        console.log('Create family error:', error);
        Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
        });
    } finally {
        setLoading(false);
      }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Family</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          {/* Illustration */}
          <View style={styles.iconContainer}>
            <Ionicons name="home" size={48} color="#134E4A" />
          </View>

          <Text style={styles.title}>Name Your Family</Text>
          <Text style={styles.subtitle}>
            Choose a name that represents your family. You can always change it later.
          </Text>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g., The Varanasis"
              placeholderTextColor="#71717A"
              value={familyName}
              onChangeText={setFamilyName}
              maxLength={30}
              autoFocus
            />
            <Text style={styles.charCount}>{familyName.length}/30</Text>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#134E4A" />
            <Text style={styles.infoText}>
              After creating, you'll receive a unique invite code to share with family members.
            </Text>
          </View>
        </View>

        {/* Create Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.createBtn, !familyName.trim() && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={loading || !familyName.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                <Text style={styles.createBtnText}>Create Family</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E2DC',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: '#18181B',
    paddingVertical: 16,
  },
  charCount: {
    position: 'absolute',
    right: 16,
    bottom: 8,
    fontSize: 11,
    color: '#71717A',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E6F2F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#134E4A',
    lineHeight: 18,
  },
  footer: {
    padding: 24,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#134E4A',
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#134E4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  createBtnText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
});

export default CreateFamilyScreen;