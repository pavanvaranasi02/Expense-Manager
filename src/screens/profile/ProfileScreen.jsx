import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { LinearGradient } from 'expo-linear-gradient';
import { getAccounts } from '../../services/accountService';
import { logoutUser, updateUserProfile } from '../../services/authService';
import { getExpenses } from '../../services/expenseService';
import { CURRENT_APP_VERSION } from '../../services/updateService';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '../../utils/format';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const FAQ_ITEMS = [
  {
    q: 'How does Local vs Cloud storage work?',
    a: 'Local mode stores your data privately on your device in SQLite. Cloud mode syncs your records across devices via Firebase. You can switch anytime in Settings > Storage Mode.',
  },
  {
    q: 'What is Stealth Mode?',
    a: 'Stealth Mode hides balances and transaction amounts across the app (replacing them with ****) for privacy when viewing your finances in public.',
  },
  {
    q: 'How do Family Sync settings work?',
    a: 'When you are part of a Family group, you can choose whether family expenses you pay for automatically sync to your personal expense history on create, edit, or delete.',
  },
  {
    q: 'How are Profile Quick Stats calculated?',
    a: 'Accounts shows your active tracked accounts, Member shows when your profile was created, and Tracked sums all recorded income and expense transactions.',
  },
  {
    q: 'How do I manage budgets and alerts?',
    a: 'Go to Profile > Budgets to set monthly or category limits, and customize budget overrun, bill, and reminder alerts in Settings.',
  },
];

const menuSections = [
  {
    title: 'APP & PREFERENCES',
    items: [
      { id: 'categories', icon: 'grid-outline', label: 'Categories', screen: 'ManageCategories', color: '#D97706' },
      { id: 'activityLogs', icon: 'document-text-outline', label: 'Activity & Audit Logs', screen: 'ActivityLogs', color: '#0F766E' },
      { id: 'settings', icon: 'settings-outline', label: 'Settings & Storage', screen: 'Settings', color: '#475569' },
    ]
  },
  {
    title: 'SUPPORT & ABOUT',
    items: [
      { id: 'help', icon: 'help-circle-outline', label: 'Help & FAQ', color: '#2563EB' },
      { id: 'share', icon: 'share-social-outline', label: 'Invite Friends', color: '#134E4A' },
    ]
  }
];

const ProfileScreen = ({ navigation }) => {
  const [loggingOut, setLoggingOut] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCurrency, setEditCurrency] = useState('INR');
  const [savingProfile, setSavingProfile] = useState(false);
  const [accountCount, setAccountCount] = useState(0);
  const [trackedVolume, setTrackedVolume] = useState(0);

  const userName = useAuthStore((state) => state.getUserName());
  const userEmail = useAuthStore((state) => state.getUserEmail());
  const userId = useAuthStore((state) => state.getUserId());
  const userProfile = useAuthStore((state) => state.userProfile);
  const isStealthMode = useAuthStore((state) => state.isStealthMode);
  const updateProfileStore = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadStats = async () => {
        try {
          const [accountsRes, expensesRes] = await Promise.all([
            getAccounts(),
            getExpenses(),
          ]);
          if (!isActive) return;

          if (accountsRes?.success) {
            const activeAccounts = (accountsRes.accounts || []).filter(
              (a) => a.isActive !== false
            );
            setAccountCount(activeAccounts.length);
          }
          if (expensesRes?.success) {
            const total = (expensesRes.expenses || []).reduce(
              (sum, tx) => sum + Math.abs(Number(tx.amount) || 0),
              0
            );
            setTrackedVolume(total);
          }
        } catch (_err) {
          // Keep existing stats on transient fetch error
        }
      };

      loadStats();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const getMemberSince = () => {
    const raw = userProfile?.createdAt;
    if (!raw) return 'Now';
    const date = raw?.toDate ? raw.toDate() : new Date(raw);
    if (isNaN(date.getTime())) return 'Now';
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  const formatTrackedVolume = () => {
    if (isStealthMode) return '****';
    const cur = userProfile?.currency || 'INR';
    const symbolMap = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    const symbol = userProfile?.currencySymbol || symbolMap[cur] || '₹';

    if (cur === 'INR') {
      if (trackedVolume >= 10000000) return `${symbol} ${(trackedVolume / 10000000).toFixed(1)}Cr`;
      if (trackedVolume >= 100000) return `${symbol} ${(trackedVolume / 100000).toFixed(1)}L`;
      if (trackedVolume >= 1000) return `${symbol} ${(trackedVolume / 1000).toFixed(1)}K`;
    } else {
      if (trackedVolume >= 1000000) return `${symbol} ${(trackedVolume / 1000000).toFixed(1)}M`;
      if (trackedVolume >= 1000) return `${symbol} ${(trackedVolume / 1000).toFixed(1)}K`;
    }
    return formatCurrency(Math.round(trackedVolume), false, symbol);
  };

  const showStatsInfo = () => {
    Alert.alert(
      'Profile Quick Stats',
      '• Accounts: Total active bank, card, and wallet accounts you track.\n\n• Member: Month and year your KOSH profile was created.\n\n• Tracked: Combined volume of all recorded expenses and income transactions.'
    );
  };

  const handleMenuPress = async (item) => {
    if (item.id === 'help') {
      setShowHelpModal(true);
      return;
    }
    if (item.id === 'share') {
      try {
        const releasesUrl = 'https://github.com/pavanvaranasi02/Expense-Manager/releases';
        await Share.share({
          title: 'Download KOSH',
          message: `Track your expenses, budgets, investments & family finances effortlessly with KOSH!\n\nDownload the latest release: ${releasesUrl}`,
          url: releasesUrl,
        });
      } catch (_err) {
        // Ignore share dismissal/errors
      }
      return;
    }
    if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const openEditModal = () => {
    setEditName(userProfile?.name || userName || '');
    setEditPhone(userProfile?.phone || '');
    setEditCurrency(userProfile?.currency || 'INR');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }

    setSavingProfile(true);
    try {
      const currencyObj = CURRENCIES.find((c) => c.code === editCurrency) || CURRENCIES[0];
      const profileData = {
        name: trimmedName,
        phone: editPhone.trim() || null,
        currency: currencyObj.code,
        currencySymbol: currencyObj.symbol,
      };

      if (userId) {
        const result = await updateUserProfile(userId, profileData);
        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to update account details');
          setSavingProfile(false);
          return;
        }
      }

      updateProfileStore(profileData);
      setShowEditModal(false);
    } catch (_error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
    setSavingProfile(false);
  };

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Profile"
        subtitle="Account & preferences"
        showBack
        navigation={navigation}
        rightActions={
          <TouchableOpacity
            style={styles.editHeaderBtn}
            onPress={openEditModal}
            accessibilityLabel="Edit account details"
          >
            <Ionicons name="create-outline" size={18} color={Theme.colors.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Clean Editorial Identity Card */}
        <SurfaceCard style={styles.profileCard}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitial()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{userName}</Text>
              <Text style={styles.email}>{userEmail}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.currencyBadge}>
                  <Ionicons name="cash-outline" size={12} color={Theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.currencyText}>{getCurrencyLabel()}</Text>
                </View>
                <View style={[styles.currencyBadge, { backgroundColor: Theme.colors.successLight }]}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={Theme.colors.success} style={{ marginRight: 4 }} />
                  <Text style={[styles.currencyText, { color: Theme.colors.success }]}>Verified</Text>
                </View>
              </View>
            </View>
          </View>
        </SurfaceCard>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statsInfoBtn}
            onPress={showStatsInfo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="About profile stats"
          >
            <Ionicons name="information-circle-outline" size={16} color={Theme.colors.textLight} />
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{accountCount}</Text>
            <Text style={styles.statLabel}>Accounts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{getMemberSince()}</Text>
            <Text style={styles.statLabel}>Member</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{formatTrackedVolume()}</Text>
            <Text style={styles.statLabel}>Tracked</Text>
          </View>
        </View>

        {/* Subtle KOSH Pro Banner */}
        <SurfaceCard style={styles.premiumCard} onPress={() => {}}>
          <View style={styles.premiumRow}>
            <View style={styles.premiumIconContainer}>
              <Ionicons name="sparkles-outline" size={20} color={Theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>KOSH Pro</Text>
              <Text style={styles.premiumSubtitle}>Advanced insights & custom reports</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Theme.colors.textLight} />
          </View>
        </SurfaceCard>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuGroup}>
              {section.items.map((item, idx) => (
                <View key={item.id}>
                  <TouchableOpacity
                    style={styles.menuCard}
                    onPress={() => handleMenuPress(item)}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: Theme.colors.primaryLight }]}>
                      <Ionicons name={item.icon} size={20} color={Theme.colors.primary} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#71717A" />
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && <View style={styles.menuDivider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Danger Zone */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: '#B91C1C' }]}>DANGER ZONE</Text>
          <View style={styles.menuGroup}>
            <TouchableOpacity
              style={[styles.menuCard, loggingOut && { opacity: 0.5 }]}
              onPress={handleLogout}
              disabled={loggingOut}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#B91C1C" />
              </View>
              <Text style={[styles.menuLabel, { color: '#B91C1C' }]}>Logout</Text>
              {loggingOut ? (
                <ActivityIndicator color="#B91C1C" size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#B91C1C" />
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

      {/* Edit Account Details Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Account Details</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.modalCloseBtn}
                disabled={savingProfile}
              >
                <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor={Theme.colors.textLight}
                autoCapitalize="words"
                editable={!savingProfile}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Optional phone number"
                placeholderTextColor={Theme.colors.textLight}
                keyboardType="phone-pad"
                editable={!savingProfile}
              />

              {!!userEmail && (
                <>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.readOnlyField}>
                    <Ionicons
                      name="mail-outline"
                      size={16}
                      color={Theme.colors.textMuted}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.readOnlyText} numberOfLines={1}>
                      {userEmail}
                    </Text>
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Default Currency</Text>
              <View style={styles.currencyRow}>
                {CURRENCIES.map((cur) => {
                  const selected = editCurrency === cur.code;
                  return (
                    <TouchableOpacity
                      key={cur.code}
                      style={[
                        styles.currencyChip,
                        selected && styles.currencyChipActive,
                      ]}
                      onPress={() => setEditCurrency(cur.code)}
                      disabled={savingProfile}
                    >
                      <Text
                        style={[
                          styles.currencyChipText,
                          selected && styles.currencyChipTextActive,
                        ]}
                      >
                        {cur.symbol} {cur.code}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowEditModal(false)}
                disabled={savingProfile}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Help & FAQ Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & FAQ</Text>
              <TouchableOpacity
                onPress={() => setShowHelpModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {FAQ_ITEMS.map((faq, index) => (
                <View
                  key={faq.q}
                  style={[
                    styles.faqItem,
                    index === FAQ_ITEMS.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Text style={styles.faqAnswer}>{faq.a}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { flex: 0, marginTop: 16 }]}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={styles.saveBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { paddingBottom: 100 },
  editHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    marginHorizontal: 20,
    marginTop: 6,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(19, 78, 74, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 22,
    color: Theme.colors.primary,
  },
  name: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 19,
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  email: {
    fontFamily: Theme.typography.fontFamily.regular,
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  currencyBadge: {
    backgroundColor: Theme.colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  currencyText: {
    fontFamily: Theme.typography.fontFamily.semibold,
    fontSize: 11,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
  },

  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: Theme.radius.lg,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    position: 'relative',
  },
  statsInfoBtn: {
    position: 'absolute',
    top: 8,
    right: 10,
    padding: 4,
    zIndex: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: '70%', backgroundColor: Theme.colors.borderSubtle, alignSelf: 'center' },
  statVal: { ...Theme.typography.presets.monoValue, fontSize: 16, color: Theme.colors.text },
  statLabel: { ...Theme.typography.presets.rowSubtitle, color: Theme.colors.textMuted, marginTop: 2 },

  premiumCard: {
    marginHorizontal: 20,
    marginTop: 14,
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumTitle: { ...Theme.typography.presets.rowTitle, color: Theme.colors.text },
  premiumSubtitle: { ...Theme.typography.presets.rowSubtitle, color: Theme.colors.textMuted, marginTop: 2 },
  premiumIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionContainer: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
    marginBottom: 10,
    paddingLeft: 4,
  },
  menuGroup: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
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
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: '#1F2937' },
  menuDivider: { height: 1, backgroundColor: '#F7F6F2', marginHorizontal: 16 },

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
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 1,
  },
  footerSlogan: { 
    fontSize: 11, 
    color: '#71717A', 
    marginTop: 10, 
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: Theme.colors.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: Theme.colors.textMuted,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: Theme.colors.text,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    opacity: 0.75,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: Theme.colors.textMuted,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  currencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  currencyChipActive: {
    backgroundColor: Theme.colors.primaryLight,
    borderColor: Theme.colors.primary,
  },
  currencyChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: Theme.colors.textMuted,
  },
  currencyChipTextActive: {
    color: Theme.colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: Theme.colors.textMuted,
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  faqItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  faqQuestion: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 19,
    color: Theme.colors.textMuted,
  },
});

export default ProfileScreen;