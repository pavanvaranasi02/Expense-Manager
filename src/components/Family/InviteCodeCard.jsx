import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

const InviteCodeCard = ({ inviteCode, familyName, onRegenerate, canRegenerate = false }) => {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Toast.show({
      type: 'success',
      text1: 'Code Copied!',
      text2: 'Invite code copied to clipboard',
      visibilityTime: 2000,
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🏠 Join my family "${familyName}" on KOSH!\n\nFamily Code: ${inviteCode}\n\nOpen the app and enter the code in the Family tab.\n\nDon't have the app?`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>FAMILY INVITE CODE</Text>
      
      <View style={styles.codeContainer}>
        <Text style={styles.code}>{inviteCode}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
          <Ionicons name="copy-outline" size={20} color="#6C63FF" />
          <Text style={styles.actionText}>Copy</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={20} color="#6C63FF" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {canRegenerate && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.actionBtn} onPress={onRegenerate}>
              <Ionicons name="refresh-outline" size={20} color="#F59E0B" />
              <Text style={[styles.actionText, { color: '#F59E0B' }]}>New Code</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.hint}>
        Share this code with family members to let them join
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 12,
  },
  codeContainer: {
    backgroundColor: '#F8F9FE',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6C63FF',
    letterSpacing: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
    marginLeft: 6,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default InviteCodeCard;