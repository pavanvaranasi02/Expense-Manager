import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { FAMILY_ROLES, ROLE_COLORS } from '../../constants/familyRoles';

const MemberAvatar = ({ 
  member, 
  size = 48, 
  showBadge = true,
  showName = false,
}) => {
  const { displayName, photoURL, role } = member;
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const isOwner = role === FAMILY_ROLES.OWNER;
  const isCoAdmin = role === FAMILY_ROLES.COADMIN;
  const badgeColor = ROLE_COLORS[role] || ROLE_COLORS[FAMILY_ROLES.MEMBER];

  return (
    <View style={styles.container}>
      <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        {photoURL ? (
          <Image 
            source={{ uri: photoURL }} 
            style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} 
          />
        ) : (
          <View style={[styles.initialsContainer, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
          </View>
        )}
        
        {showBadge && (isOwner || isCoAdmin) && (
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Ionicons 
              name={isOwner ? 'star' : 'shield-checkmark'} 
              size={size * 0.25} 
              color="#FFFFFF" 
            />
          </View>
        )}
      </View>
      
      {showName && (
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: '#F1F5F9',
  },
  initialsContainer: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: '700',
    color: '#64748B',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  name: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    maxWidth: 70,
    textAlign: 'center',
  },
});

export default MemberAvatar;