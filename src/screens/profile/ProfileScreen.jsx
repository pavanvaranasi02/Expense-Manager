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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logoutUser } from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';

const menuItems = [
  { id: 'accounts', icon: 'card', label: 'My Accounts', screen: 'ManageAccounts', color: '#6C63FF' },
  { id: 'portfolio', icon: 'trending-up', label: 'Portfolio & Investments', screen: 'Portfolio', color: '#10B981' },
  { id: 'categories', icon: 'grid', label: 'Categories', screen: 'ManageCategories', color: '#FF9800' },
  { id: 'budgets', icon: 'wallet', label: 'Budgets', screen: 'BudgetList', color: '#4CAF50' },
  { id: 'creditBill', icon: 'card-outline', label: 'Credit Card Bills', screen: 'CreditCardBill', color: '#F44336' },
  { id: 'settings', icon: 'settings', label: 'Settings', screen: 'Settings', color: '#607D8B' },
];

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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitial()}</Text>
          </View>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.email}>{userEmail}</Text>
          {userProfile?.phone && (
            <Text style={styles.phone}>+91 {userProfile.phone}</Text>
          )}
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyText}>{getCurrencyLabel()}</Text>
          </View>
        </View>

        {/* Account Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member since</Text>
            <Text style={styles.infoValue}>
              {userProfile?.createdAt?.toDate
                ? userProfile.createdAt.toDate().toLocaleDateString('en-IN', {
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Recently'}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Auth Provider</Text>
            <Text style={styles.infoValue}>
              {userProfile?.authProvider === 'google' ? '🔵 Google' : '📧 Email'}
            </Text>
          </View>
        </View>

        {/* Menu */}
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuCard}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && { opacity: 0.5 }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.logoutText}>Logout</Text>
            </>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  content: { padding: 20, paddingBottom: 100 },

  profileHeader: { alignItems: 'center', marginVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  name: { fontSize: 20, fontWeight: '600', color: '#1A1A2E' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  phone: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  currencyBadge: {
    backgroundColor: '#F0EFFF', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, marginTop: 8,
  },
  currencyText: { fontSize: 12, color: '#6C63FF', fontWeight: '600' },

  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, fontWeight: '500', color: '#1A1A2E' },
  infoDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },

  menuCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A2E' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, marginTop: 20, backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444', marginLeft: 8 },

  version: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: 16 },
});

export default ProfileScreen;