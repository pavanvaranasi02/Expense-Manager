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
import MemberAvatar from '../../components/Family/MemberAvatar';
import { Analytics } from '../../config/firebase';
import { getFamily, getFamilyByCode, joinFamily } from '../../services/familyService';
import useAuthStore from '../../store/useAuthStore';
import useFamilyStore from '../../store/useFamilyStore';
import { validateFamilyCode } from '../../utils/familyCodeGenerator';

const JoinFamilyScreen = ({ navigation }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const { setFamily, setMembers } = useFamilyStore();
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const handleCodeChange = async (text) => {
    // Auto-format: add FAM- prefix and uppercase
    const formatted = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setCode(formatted);
    setPreview(null);

    // Auto-fetch preview when code looks complete
    const fullCode = formatted.startsWith('FAM-') ? formatted : `FAM-${formatted}`;
    if (validateFamilyCode(fullCode)) {
      setPreviewLoading(true);
      const result = await getFamilyByCode(fullCode);
      setPreviewLoading(false);
      
      if (result.success) {
        setPreview(result.family);
      }
    }
  };

  const handleJoin = async () => {
    const fullCode = code.startsWith('FAM-') ? code : `FAM-${code}`;
    
    if (!validateFamilyCode(fullCode)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid code format',
        text2: 'Code should be FAM-XXXXXX (6 characters)',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await joinFamily(fullCode);

      if (result.success) {
        Analytics.joinFamily();

        // Update local auth store
        updateProfile({ familyId: result.familyId });

        // Fetch family data
        const familyResult = await getFamily(result.familyId);
        if (familyResult.success) {
          setFamily(familyResult.family);
          setMembers(familyResult.family.members || []);
        }

        Toast.show({
          type: 'success',
          text1: 'Welcome to the family! 🎉',
          text2: result.role === 'coadmin' ? 'You are now Co-Admin!' : 'You joined successfully',
        });

        navigation.replace('FamilyDashboard');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to join',
          text2: result.error,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const displayCode = code.startsWith('FAM-') ? code : code.length > 0 ? `FAM-${code}` : '';

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
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Family</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          {/* Illustration */}
          <View style={styles.iconContainer}>
            <Ionicons name="enter-outline" size={48} color="#6C63FF" />
          </View>

          <Text style={styles.title}>Enter Invite Code</Text>
          <Text style={styles.subtitle}>
            Ask your family member for the invite code and enter it below.
          </Text>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="FAM-XXXXXX"
              placeholderTextColor="#CBD5E1"
              value={displayCode}
              onChangeText={handleCodeChange}
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {previewLoading && (
              <ActivityIndicator size="small" color="#6C63FF" style={styles.inputLoader} />
            )}
          </View>

          {/* Preview Card */}
          {preview && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewIconContainer}>
                  <Ionicons name="home" size={24} color="#6C63FF" />
                </View>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>{preview.name}</Text>
                  <Text style={styles.previewMeta}>
                    {preview.memberCount}/6 members
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>

              {/* Member Avatars */}
              <View style={styles.previewMembers}>
                {preview.members?.slice(0, 4).map((member, index) => (
                  <View key={member.userId} style={[styles.previewAvatar, { marginLeft: index > 0 ? -8 : 0 }]}>
                    <MemberAvatar member={member} size={32} showBadge={false} />
                  </View>
                ))}
                {preview.memberCount > 4 && (
                  <View style={styles.moreMembers}>
                    <Text style={styles.moreMembersText}>+{preview.memberCount - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Error State */}
          {code.length >= 6 && !preview && !previewLoading && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
              <Text style={styles.errorText}>Invalid or expired code</Text>
            </View>
          )}
        </View>

        {/* Join Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.joinBtn, !preview && styles.joinBtnDisabled]}
            onPress={handleJoin}
            disabled={loading || !preview}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="people" size={22} color="#FFFFFF" />
                <Text style={styles.joinBtnText}>Join Family</Text>
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
    backgroundColor: '#F8F9FE',
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
    fontWeight: '700',
    color: '#1E293B',
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
    backgroundColor: '#F0EFFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    paddingVertical: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
  inputLoader: {
    marginLeft: 8,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F0EFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  previewMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  previewMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  previewAvatar: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  moreMembers: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreMembersText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  footer: {
    padding: 24,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  joinBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default JoinFamilyScreen;