import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { logoutUser } from '../../services/authService';
import { CURRENT_APP_VERSION } from '../../services/updateService';
import useAuthStore from '../../store/useAuthStore';

const menuSections = [
  {
    title: 'FINANCES',
    items: [
      { id: 'accounts', icon: 'wallet-outline', label: 'My Accounts', screen: 'ManageAccounts', color: '#6366F1' },
      { id: 'portfolio', icon: 'trending-up-outline', label: 'Portfolio & Investments', screen: 'Portfolio', color: '#10B981' },
      { id: 'budgets', icon: 'pie-chart-outline', label: 'Budgets', screen: 'BudgetList', color: '#8B5CF6' },
      { id: 'creditBill', icon: 'card-outline', label: 'Credit Card Bills', screen: 'CreditCardBill', color: '#EF4444' },
    ]
  },
  {
    title: 'CUSTOMIZATION',
    items: [
      { id: 'categories', icon: 'grid-outline', label: 'Categories', screen: 'ManageCategories', color: '#F59E0B' },
      { id: 'settings', icon: 'settings-outline', label: 'Settings', screen: 'Settings', color: '#64748B' },
    ]
  },
  {
    title: 'SUPPORT',
    items: [
      { id: 'help', icon: 'help-circle-outline', label: 'Help & FAQ', screen: 'Help', color: '#3B82F6' },
      { id: 'share', icon: 'share-social-outline', label: 'Invite Friends', screen: 'Share', color: '#EC4899' },
    ]
  }
];

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const [loggingOut, setLoggingOut] = useState(false);
  const userName = useAuthStore((state) => state.getUserName());
  const userEmail = useAuthStore((state) => state.getUserEmail());
  const userProfile = useAuthStore((state) => state.userProfile);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            const result = await logoutUser();
            if (result.success) {
              logout(); // Clear zustand store
            } else {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
            setLoggingOut(false);
          },
        },
      ]
    );
  };

  const getInitial = () => {
    return (userName || 'U').charAt(0).toUpperCase();
  };

  const getCurrencyLabel = () => {
    const cur = userProfile?.currency || 'INR';
    const map = { INR: '₹ INR', USD: '$ USD', EUR: '€ EUR', GBP: '£ GBP' };
    return map[cur] || cur;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header Gradient Background */}
        <LinearGradient
          colors={['#6366F1', '#4F46E5']}
          style={styles.headerBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.topNav}>
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity style={styles.editBtn}>
                <Ionicons name="pencil" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Profile Info Overlay Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#FFFFFF', '#F0F9FF']}
              style={styles.avatarBorder}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitial()}</Text>
              </View>
            </LinearGradient>
            <View style={styles.onlineBadge} />
          </View>
          
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.email}>{userEmail}</Text>
          
          <View style={styles.badgeRow}>
            <View style={styles.currencyBadge}>
              <Ionicons name="cash-outline" size={12} color="#6366F1" style={{ marginRight: 4 }} />
              <Text style={styles.currencyText}>{getCurrencyLabel()}</Text>
            </View>
            <View style={[styles.currencyBadge, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark" size={12} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={[styles.currencyText, { color: '#10B981' }]}>Verified</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>12</Text>
            <Text style={styles.statLabel}>Accounts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>
              {userProfile?.createdAt?.toDate
                ? userProfile.createdAt.toDate().toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                : 'Now'}
            </Text>
            <Text style={styles.statLabel}>Member</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>₹ 2.4L</Text>
            <Text style={styles.statLabel}>Tracked</Text>
          </View>
        </View>

        {/* Premium Banner */}
        <TouchableOpacity style={styles.premiumCard}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.premiumGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>Upgrade to KOSH Pro</Text>
              <Text style={styles.premiumSubtitle}>Get advanced insights & reports</Text>
            </View>
            <View style={styles.premiumIconContainer}>
              <Ionicons name="diamond" size={24} color="#F59E0B" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuGroup}>
              {section.items.map((item, idx) => (
                <View key={item.id}>
                  <TouchableOpacity
                    style={styles.menuCard}
                    onPress={() => item.screen && navigation.navigate(item.screen)}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && <View style={styles.menuDivider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Danger Zone */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>DANGER ZONE</Text>
          <View style={styles.menuGroup}>
            <TouchableOpacity
              style={[styles.menuCard, loggingOut && { opacity: 0.5 }]}
              onPress={handleLogout}
              disabled={loggingOut}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Logout</Text>
              {loggingOut ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version */}
        <View style={styles.footer}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v{CURRENT_APP_VERSION} ALPHA</Text>
          </View>
          <Text style={styles.footerSlogan}>Built with Pride 🇮🇳 in India</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 100 },

  headerBackground: {
    height: 180,
    width: '100%',
    paddingHorizontal: 20,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 24,
    marginTop: -60,
    alignItems: 'center',
    paddingBottom: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  avatarContainer: {
    marginTop: -45,
    position: 'relative',
  },
  avatarBorder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    padding: 3,
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#FFFFFF' },
  onlineBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  name: { fontSize: 24, fontWeight: '900', color: '#111827', marginTop: 12, letterSpacing: -0.5 },
  email: { fontSize: 14, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  currencyBadge: {
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  currencyText: { fontSize: 11, color: '#6366F1', fontWeight: '800', textTransform: 'uppercase' },

  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    paddingVertical: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: '70%', backgroundColor: '#F3F4F6', alignSelf: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },

  premiumCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  premiumTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  premiumSubtitle: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, marginTop: 2, fontWeight: '500' },
  premiumIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionContainer: { marginTop: 28, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
    marginBottom: 10,
    letterSpacing: 1.5,
    paddingLeft: 4,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },
  menuDivider: { height: 1, backgroundColor: '#F9FAFB', marginHorizontal: 16 },

  footer: { marginTop: 48, alignItems: 'center', paddingBottom: 40 },
  versionBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  versionText: { 
    fontSize: 10, 
    color: '#D97706', 
    fontWeight: '900',
    letterSpacing: 1,
  },
  footerSlogan: { 
    fontSize: 11, 
    color: '#9CA3AF', 
    marginTop: 10, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ProfileScreen;