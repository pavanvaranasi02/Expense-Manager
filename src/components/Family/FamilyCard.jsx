import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MemberAvatar from './MemberAvatar';

const FamilyCard = ({ family, members, onPress }) => {
  const displayMembers = members?.slice(0, 4) || [];
  const extraCount = (members?.length || 0) - 4;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="home" size={24} color="#134E4A" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.familyName}>{family?.name || 'My Family'}</Text>
          <Text style={styles.memberCount}>
            {members?.length || 0} member{members?.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#71717A" />
      </View>

      <View style={styles.membersRow}>
        {displayMembers.map((member, index) => (
          <View key={member.userId} style={[styles.memberAvatar, { marginLeft: index > 0 ? -10 : 0 }]}>
            <MemberAvatar member={member} size={36} showBadge={true} />
          </View>
        ))}
        {extraCount > 0 && (
          <View style={styles.extraBadge}>
            <Text style={styles.extraText}>+{extraCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#71717A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  familyName: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
  },
  memberCount: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#ECEAE4',
  },
  memberAvatar: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 20,
  },
  extraBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECEAE4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  extraText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#71717A',
  },
});

export default FamilyCard;