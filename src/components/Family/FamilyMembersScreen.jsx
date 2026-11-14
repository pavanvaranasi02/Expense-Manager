import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import FamilyMemberItem from '../../components/Family/FamilyMemberItem';
import { Analytics } from '../../config/firebase';
import { FAMILY_ROLES } from '../../constants/familyRoles';
import {
    demoteCoAdmin,
    getFamily,
    promoteToCoAdmin,
    removeMember
} from '../../services/familyService';
import useAuthStore from '../../store/useAuthStore';
import useFamilyStore from '../../store/useFamilyStore';

const FamilyMembersScreen = ({ navigation }) => {
  const userId = useAuthStore((s) => s.user?.uid);
  const userProfile = useAuthStore((s) => s.userProfile);
  const { family, members, setFamily, setMembers, isOwner, canManageMembers } = useFamilyStore();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchMembers = async () => {
    try {
      const familyId = userProfile?.familyId;
      if (!familyId) return;

      const result = await getFamily(familyId);
      if (result.success) {
        setFamily(result.family);
        setMembers(result.family.members || []);
      }
    } catch (error) {
      console.log('Fetch members error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('FamilyMembers');
      fetchMembers();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const handlePromote = (memberUserId) => {
    const member = members.find((m) => m.userId === memberUserId);
    Alert.alert(
      'Promote to Co-Admin',
      `Make ${member?.displayName} a Co-Admin? They will be able to invite and remove members.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            setActionLoading(memberUserId);
            const result = await promoteToCoAdmin(memberUserId);
            setActionLoading(null);

            if (result.success) {
              Toast.show({
                type: 'success',
                text1: 'Member Promoted',
                text2: `${member?.displayName} is now Co-Admin`,
              });
              fetchMembers();
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to promote',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  const handleDemote = (memberUserId) => {
    const member = members.find((m) => m.userId === memberUserId);
    Alert.alert(
      'Remove Co-Admin Role',
      `Remove Co-Admin role from ${member?.displayName}? They will become a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(memberUserId);
            const result = await demoteCoAdmin();
            setActionLoading(null);

            if (result.success) {
              Toast.show({
                type: 'success',
                text1: 'Role Changed',
                text2: `${member?.displayName} is now a regular member`,
              });
              fetchMembers();
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to demote',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  const handleRemove = (memberUserId) => {
    const member = members.find((m) => m.userId === memberUserId);
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member?.displayName} from the family? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(memberUserId);
            const result = await removeMember(memberUserId);
            setActionLoading(null);

            if (result.success) {
              Toast.show({
                type: 'success',
                text1: 'Member Removed',
                text2: `${member?.displayName} has been removed`,
              });
              fetchMembers();
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to remove',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  // Sort members: Owner first, then Co-Admin, then by join date
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { [FAMILY_ROLES.OWNER]: 0, [FAMILY_ROLES.COADMIN]: 1, [FAMILY_ROLES.MEMBER]: 2 };
    return (roleOrder[a.role] || 2) - (roleOrder[b.role] || 2);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Family Members</Text>
        {canManageMembers() && (
          <TouchableOpacity 
            style={styles.addBtn}
            onPress={() => navigation.navigate('FamilyInvite')}
          >
            <Ionicons name="person-add" size={22} color="#134E4A" />
          </TouchableOpacity>
        )}
        {!canManageMembers() && <View style={{ width: 44 }} />}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#134E4A']} />
        }
      >
        {/* Member Count */}
        <View style={styles.countCard}>
          <Ionicons name="people" size={24} color="#134E4A" />
          <Text style={styles.countText}>
            {members.length} of 6 members
          </Text>
          {members.length < 6 && (
            <Text style={styles.slotsText}>
              {6 - members.length} slot{6 - members.length !== 1 ? 's' : ''} available
            </Text>
          )}
        </View>

        {/* Members List */}
        <View style={styles.membersList}>
          {sortedMembers.map((member) => (
            <View key={member.userId} style={styles.memberItemWrapper}>
              {actionLoading === member.userId ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#134E4A" />
                </View>
              ) : null}
              <FamilyMemberItem
                member={member}
                isCurrentUser={member.userId === userId}
                canManage={canManageMembers()}
                isOwner={isOwner()}
                onPromote={handlePromote}
                onDemote={handleDemote}
                onRemove={handleRemove}
              />
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Role Legend</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendBadge, { backgroundColor: '#E6F2F0' }]}>
              <Ionicons name="star" size={12} color="#134E4A" />
            </View>
            <Text style={styles.legendText}>Owner — Full control over the family</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendBadge, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="shield-checkmark" size={12} color="#3B82F6" />
            </View>
            <Text style={styles.legendText}>Co-Admin — Can invite & remove members</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendBadge, { backgroundColor: '#ECEAE4' }]}>
              <Ionicons name="person" size={12} color="#71717A" />
            </View>
            <Text style={styles.legendText}>Member — Can view & add expenses</Text>
          </View>
        </View>
      </ScrollView>
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  countCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  countText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
  },
  slotsText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: '#047857',
  },
  membersList: {
    marginBottom: 24,
  },
  memberItemWrapper: {
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 16,
  },
  legend: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  legendTitle: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: '#71717A',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  legendText: {
    fontSize: 13,
    color: '#71717A',
    flex: 1,
  },
});

export default FamilyMembersScreen;