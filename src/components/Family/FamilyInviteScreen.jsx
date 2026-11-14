import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import InviteCodeCard from '../../components/Family/InviteCodeCard';
import { regenerateInviteCode } from '../../services/familyService';
import useFamilyStore from '../../store/useFamilyStore';

const FamilyInviteScreen = ({ navigation }) => {
  const { family, isOwner, isCoAdmin, updateFamilyInStore } = useFamilyStore();
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = () => {
    Alert.alert(
      'Regenerate Code',
      'Are you sure? The old code will stop working immediately and anyone with it won\'t be able to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            setRegenerating(true);
            const result = await regenerateInviteCode();
            setRegenerating(false);

            if (result.success) {
              updateFamilyInStore({ inviteCode: result.inviteCode });
              Toast.show({
                type: 'success',
                text1: 'New Code Generated',
                text2: result.inviteCode,
              });
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to regenerate',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  const canRegenerate = isOwner() || isCoAdmin();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Members</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail" size={48} color="#134E4A" />
          </View>
        </View>

        <Text style={styles.title}>Invite Family Members</Text>
        <Text style={styles.subtitle}>
          Share this code with your family members so they can join and start tracking expenses together.
        </Text>

        {/* Code Card */}
        {regenerating ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#134E4A" />
            <Text style={styles.loadingText}>Generating new code...</Text>
          </View>
        ) : (
          <InviteCodeCard
            inviteCode={family?.inviteCode || 'FAM-XXXXXX'}
            familyName={family?.name || 'My Family'}
            canRegenerate={canRegenerate}
            onRegenerate={handleRegenerate}
          />
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How it works</Text>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>Share the code via WhatsApp, SMS, or any messenger</Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>Family member opens KOSH app</Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>They go to Family tab and tap "Join with Code"</Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>Enter the code and they're in! 🎉</Text>
          </View>
        </View>

        {/* Member limit notice */}
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color="#71717A" />
          <Text style={styles.noticeText}>
            A family can have up to 6 members. Currently: {family?.memberCount || 1}/6
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F2',
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
    paddingTop: 20,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
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
    marginBottom: 24,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#71717A',
  },
  instructions: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  instructionsTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    marginBottom: 14,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#71717A',
    lineHeight: 18,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F7F6F2',
    borderRadius: 12,
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#71717A',
  },
});

export default FamilyInviteScreen;