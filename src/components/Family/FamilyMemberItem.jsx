import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FAMILY_ROLES, ROLE_COLORS, ROLE_LABELS } from '../../constants/familyRoles';
import MemberAvatar from './MemberAvatar';

const FamilyMemberItem = ({ 
  member, 
  isCurrentUser = false,
  canManage = false,
  isOwner = false,
  onPromote,
  onDemote,
  onRemove,
}) => {
  const { displayName, role } = member;
  const roleLabel = ROLE_LABELS[role] || 'Member';
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS[FAMILY_ROLES.MEMBER];

  const showActions = canManage && !isCurrentUser && role !== FAMILY_ROLES.OWNER;

  return (
    <View style={styles.container}>
      <MemberAvatar member={member} size={48} showBadge={true} />
      
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{displayName}</Text>
          {isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youText}>You</Text>
            </View>
          )}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: `${roleColor}15` }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>
      </View>

      {showActions && (
        <View style={styles.actions}>
          {/* Promote to Co-Admin (only Owner can do this) */}
          {isOwner && role === FAMILY_ROLES.MEMBER && onPromote && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.promoteBtn]} 
              onPress={() => onPromote(member.userId)}
            >
              <Ionicons name="shield-checkmark" size={16} color="#3B82F6" />
            </TouchableOpacity>
          )}

          {/* Demote Co-Admin (only Owner can do this) */}
          {isOwner && role === FAMILY_ROLES.COADMIN && onDemote && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.demoteBtn]} 
              onPress={() => onDemote(member.userId)}
            >
              <Ionicons name="arrow-down" size={16} color="#F59E0B" />
            </TouchableOpacity>
          )}

          {/* Remove member */}
          {onRemove && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.removeBtn]} 
              onPress={() => onRemove(member.userId)}
            >
              <Ionicons name="close" size={16} color="#B91C1C" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: '#18181B',
  },
  youBadge: {
    backgroundColor: '#E6F2F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  youText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoteBtn: {
    backgroundColor: '#DBEAFE',
  },
  demoteBtn: {
    backgroundColor: '#FEF3C7',
  },
  removeBtn: {
    backgroundColor: '#FEE2E2',
  },
});

export default FamilyMemberItem;