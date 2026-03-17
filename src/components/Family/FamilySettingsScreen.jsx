import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import MemberAvatar from '../../components/Family/MemberAvatar';
import { FAMILY_ROLES } from '../../constants/familyRoles';
import {
    deleteFamily,
    leaveFamily,
    renameFamily,
    transferOwnership
} from '../../services/familyService';
import useAuthStore from '../../store/useAuthStore';
import useFamilyStore from '../../store/useFamilyStore';

const FamilySettingsScreen = ({ navigation }) => {
  const userId = useAuthStore((s) => s.user?.uid);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { family, members, isOwner, clearFamily, updateFamilyInStore } = useFamilyStore();
  
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [newName, setNewName] = useState(family?.name || '');
  const [loading, setLoading] = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      Toast.show({
        type: 'error',
        text1: 'Invalid name',
        text2: 'Name must be at least 2 characters',
      });
      return;
    }

    setLoading(true);
    const result = await renameFamily(newName.trim());
    setLoading(false);

    if (result.success) {
      updateFamilyInStore({ name: newName.trim() });
      setShowRenameModal(false);
      Toast.show({
        type: 'success',
        text1: 'Family Renamed',
        text2: `Now called "${newName.trim()}"`,
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Failed to rename',
        text2: result.error,
      });
    }
  };

  const handleTransfer = async (newOwnerId) => {
    const newOwner = members.find((m) => m.userId === newOwnerId);
    
    Alert.alert(
      'Transfer Ownership',
      `Are you sure you want to transfer ownership to ${newOwner?.displayName}? You will become a regular member and cannot undo this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await transferOwnership(newOwnerId);
            setLoading(false);

            if (result.success) {
              setShowTransferModal(false);
              Toast.show({
                type: 'success',
                text1: 'Ownership Transferred',
                text2: `${newOwner?.displayName} is now the owner`,
              });
              // Refresh family data
              navigation.replace('FamilyDashboard');
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to transfer',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    const message = isOwner()
      ? 'Are you sure you want to leave? Ownership will be transferred to another member. If you are the last member, the family will be deleted.'
      : 'Are you sure you want to leave this family? You can rejoin later with an invite code.';

    Alert.alert('Leave Family', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const result = await leaveFamily();
          setLoading(false);

          if (result.success) {
            updateProfile({ familyId: null });
            clearFamily();
            Toast.show({
              type: 'success',
              text1: 'You left the family',
            });
            navigation.replace('FamilyLanding');
          } else {
            Toast.show({
              type: 'error',
              text1: 'Failed to leave',
              text2: result.error,
            });
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Family',
      'Are you sure you want to delete this family? This action cannot be undone and all members will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await deleteFamily();
            setLoading(false);

            if (result.success) {
              updateProfile({ familyId: null });
              clearFamily();
              Toast.show({
                type: 'success',
                text1: 'Family Deleted',
              });
              navigation.replace('FamilyLanding');
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to delete',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  const otherMembers = members.filter((m) => m.userId !== userId && m.role !== FAMILY_ROLES.OWNER);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Family Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Family Info */}
        <View style={styles.infoCard}>
          <View style={styles.familyIcon}>
            <Ionicons name="home" size={32} color="#6C63FF" />
          </View>
          <View style={styles.familyInfo}>
            <Text style={styles.familyName}>{family?.name}</Text>
            <Text style={styles.familyMeta}>
              {members.length} member{members.length !== 1 ? 's' : ''} • Created {
                family?.createdAt?.toDate
                  ? family.createdAt.toDate().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                  : 'recently'
              }
            </Text>
          </View>
        </View>

        {/* Settings Options */}
        {isOwner() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Owner Controls</Text>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => {
                setNewName(family?.name || '');
                setShowRenameModal(true);
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#F0EFFF' }]}>
                <Ionicons name="pencil" size={18} color="#6C63FF" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Rename Family</Text>
                <Text style={styles.settingDesc}>Change the family display name</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            {otherMembers.length > 0 && (
              <TouchableOpacity 
                style={styles.settingItem}
                onPress={() => setShowTransferModal(true)}
              >
                <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="swap-horizontal" size={18} color="#F59E0B" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Transfer Ownership</Text>
                  <Text style={styles.settingDesc}>Make someone else the owner</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Danger Zone</Text>
          
          <TouchableOpacity 
            style={styles.dangerItem}
            onPress={handleLeave}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="exit-outline" size={18} color="#EF4444" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: '#EF4444' }]}>Leave Family</Text>
              <Text style={styles.settingDesc}>
                {isOwner() ? 'Ownership will be transferred' : 'You can rejoin with a code'}
              </Text>
            </View>
          </TouchableOpacity>

          {isOwner() && (
            <TouchableOpacity 
              style={styles.dangerItem}
              onPress={handleDelete}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="trash" size={18} color="#EF4444" />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: '#EF4444' }]}>Delete Family</Text>
                <Text style={styles.settingDesc}>Permanently delete and remove all members</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      )}

      {/* Rename Modal */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Family</Text>
            
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter new name"
              maxLength={30}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn}
                onPress={handleRename}
              >
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transfer Ownership Modal */}
      <Modal
        visible={showTransferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Transfer Ownership</Text>
            <Text style={styles.modalSubtitle}>Select the new owner</Text>
            
            <ScrollView style={styles.membersList}>
              {otherMembers.map((member) => (
                <TouchableOpacity
                  key={member.userId}
                  style={styles.memberSelectItem}
                  onPress={() => handleTransfer(member.userId)}
                >
                  <MemberAvatar member={member} size={40} showBadge={true} />
                  <Text style={styles.memberSelectName}>{member.displayName}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCancelBtnFull}
              onPress={() => setShowTransferModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  familyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F0EFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  familyInfo: {
    flex: 1,
    marginLeft: 14,
  },
  familyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  familyMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  settingDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#F8F9FE',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnFull: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  membersList: {
    maxHeight: 300,
  },
  memberSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8F9FE',
    marginBottom: 8,
  },
  memberSelectName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 12,
  },
});

export default FamilySettingsScreen;