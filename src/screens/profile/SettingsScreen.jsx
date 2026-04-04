import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "../../config/firebase";
import { updateUserProfile } from "../../services/authService";
import useAuthStore from "../../store/useAuthStore";
import * as Haptics from 'expo-haptics';
import ModernToggle from "../../components/ModernToggle";

const { width } = Dimensions.get('window');


const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
];

const SettingsScreen = ({ navigation }) => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [currency, setCurrency] = useState(userProfile?.currency || "INR");
  const [showInvestmentsInAssets, setShowInvestmentsInAssets] = useState(
    userProfile?.showInvestmentsInAssets || false,
  );
  const [notifications, setNotifications] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [creditCardAlerts, setCreditCardAlerts] = useState(true);
  const [showTabLabels, setShowTabLabels] = useState(
    userProfile?.showTabLabels !== false,
  );

  const saveToFirebase = async (key, value) => {
    const userId = auth.currentUser.uid;
    const result = await updateUserProfile(userId, { [key]: value });
    if (result.success) {
      updateProfile({ [key]: value });
    }
  };

  const handleCurrencyChange = async (newCurrency) => {
    setCurrency(newCurrency);
    await saveToFirebase("currency", newCurrency);
  };

  const handleInvestmentToggle = async (value) => {
    setShowInvestmentsInAssets(value);
    await saveToFirebase("showInvestmentsInAssets", value);
  };
  
  const handleLabelToggle = async (value) => {
    setShowTabLabels(value);
    await saveToFirebase("showTabLabels", value);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Summary Card */}
        <View style={styles.profileSummary}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarTextMini}>
              {(userProfile?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.profileName}>{userProfile?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{userProfile?.email || 'No email'}</Text>
          </View>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        </View>

        {/* Currency Section */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="cash" size={16} color="#6366F1" />
          </View>
          <Text style={styles.sectionTitle}>CURRENCY</Text>
        </View>
        
        <View style={styles.card}>
          <View style={styles.currencyGrid}>
            {CURRENCIES.map((cur, i) => (
              <TouchableOpacity
                key={cur.code}
                style={[
                  styles.currencyItem,
                  currency === cur.code && styles.activeCurrencyItem,
                ]}
                onPress={() => handleCurrencyChange(cur.code)}
              >
                <Text style={[
                  styles.currencySymbol,
                  currency === cur.code && styles.activeCurrencyText
                ]}>{cur.symbol}</Text>
                <Text style={[
                  styles.currencyCode,
                  currency === cur.code && styles.activeCurrencyText
                ]}>{cur.code}</Text>
                {currency === cur.code && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Portfolio Settings */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="stats-chart" size={16} color="#10B981" />
          </View>
          <Text style={styles.sectionTitle}>ASSETS & PORTFOLIO</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Net Worth Calculation</Text>
              <Text style={styles.settingSubLabel}>Include investments in assets</Text>
            </View>
            <ModernToggle
              value={showInvestmentsInAssets}
              onValueChange={handleInvestmentToggle}
              activeColor="#10B981"
            />
          </View>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={16} color="#10B981" />
            <Text style={styles.infoText}>
              {showInvestmentsInAssets 
                ? "Net Worth = Assets + Investments - Debts"
                : "Net Worth = Assets - Debts (Investments excluded)"}
            </Text>
          </View>
        </View>

        {/* UI Preferences Section */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="desktop" size={16} color="#EF4444" />
          </View>
          <Text style={styles.sectionTitle}>UI PREFERENCES</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Navigation Labels</Text>
              <Text style={styles.settingSubLabel}>Show text labels in bottom navigation</Text>
            </View>
            <ModernToggle
              value={showTabLabels}
              onValueChange={handleLabelToggle}
              activeColor="#6366F1"
            />
          </View>
        </View>

        {/* Privacy & Notifications */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#FFF7ED' }]}>
            <Ionicons name="notifications" size={16} color="#F59E0B" />
          </View>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
        </View>

        <View style={styles.card}>
          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Stealth Mode</Text>
              <Text style={styles.settingSubLabel}>Mask balances and currency values (****)</Text>
            </View>
            <ModernToggle
              value={useAuthStore((state) => state.isStealthMode)}
              onValueChange={(val) => {
                useAuthStore.getState().setStealthMode(val);
                saveToFirebase("isStealthMode", val);
              }}
              activeColor="#F59E0B"
            />
          </View>
          
          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingSubLabel}>Receive smart alerts and tips</Text>
            </View>
            <ModernToggle
              value={notifications}
              onValueChange={setNotifications}
              activeColor="#6366F1"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Daily Reminder</Text>
              <Text style={styles.settingSubLabel}>Log your daily expenses at 9 PM</Text>
            </View>
            <ModernToggle
              value={dailyReminder}
              onValueChange={setDailyReminder}
              activeColor="#6366F1"
            />
          </View>
        </View>

        {/* Family Settings Section */}
        {userProfile?.familyId && (
          <>
            <Text style={styles.sectionTitle}>Family Settings</Text>
            <View style={styles.card}>
              <View style={[styles.settingRow, styles.borderBottom]}>
                <View
                  style={[styles.settingIcon, { backgroundColor: "#F0EFFF" }]}
                >
                  <Ionicons name="sync" size={20} color="#6C63FF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.settingLabel}>Sync to Personal</Text>
                  <Text style={styles.settingSubLabel}>
                    Family expenses you pay for will be added to your personal
                    expenses
                  </Text>
                </View>
                <ModernToggle
                  value={
                    userProfile?.settings?.family?.syncFamilyToPersonal ?? true
                  }
                  onValueChange={async (value) => {
                    const userId = useAuthStore.getState().user?.uid;
                    if (userId) {
                      await updateUserProfile(userId, {
                        "settings.family.syncFamilyToPersonal": value,
                      });
                      updateProfile({
                        settings: {
                          ...userProfile.settings,
                          family: {
                            ...userProfile?.settings?.family,
                            syncFamilyToPersonal: value,
                          },
                        },
                      });
                    }
                  }}
                  activeColor="#6366F1"
                />
              </View>

              {userProfile?.settings?.family?.syncFamilyToPersonal !==
                false && (
                <>
                  <View style={[styles.settingRow, styles.borderBottom]}>
                    <View
                      style={[
                        styles.settingIcon,
                        { backgroundColor: "#DBEAFE" },
                      ]}
                    >
                      <Ionicons name="pencil" size={20} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.settingLabel}>Sync on Edit</Text>
                      <Text style={styles.settingSubLabel}>
                        Update personal expense when family expense is edited
                      </Text>
                    </View>
                    <ModernToggle
                      value={userProfile?.settings?.family?.syncOnEdit ?? true}
                      onValueChange={async (value) => {
                        const userId = useAuthStore.getState().user?.uid;
                        if (userId) {
                          await updateUserProfile(userId, {
                            "settings.family.syncOnEdit": value,
                          });
                          updateProfile({
                            settings: {
                              ...userProfile.settings,
                              family: {
                                ...userProfile?.settings?.family,
                                syncOnEdit: value,
                              },
                            },
                          });
                        }
                      }}
                      activeColor="#3B82F6"
                    />
                  </View>

                  <View style={styles.settingRow}>
                    <View
                      style={[
                        styles.settingIcon,
                        { backgroundColor: "#FEE2E2" },
                      ]}
                    >
                      <Ionicons name="trash" size={20} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.settingLabel}>Sync on Delete</Text>
                      <Text style={styles.settingSubLabel}>
                        Delete personal expense when family expense is removed
                      </Text>
                    </View>
                    <ModernToggle
                      value={
                        userProfile?.settings?.family?.syncOnDelete ?? true
                      }
                      onValueChange={async (value) => {
                        const userId = useAuthStore.getState().user?.uid;
                        if (userId) {
                          await updateUserProfile(userId, {
                            "settings.family.syncOnDelete": value,
                          });
                          updateProfile({
                            settings: {
                              ...userProfile.settings,
                              family: {
                                ...userProfile?.settings?.family,
                                syncOnDelete: value,
                              },
                            },
                          });
                        }
                      }}
                      activeColor="#EF4444"
                    />
                  </View>
                </>
              )}

              {/* Allow Past Date Recurring Expenses */}
              <View style={[styles.settingRow, styles.borderBottom]}>
                <View
                  style={[styles.settingIcon, { backgroundColor: "#D1FAE5" }]}
                >
                  <Ionicons name="calendar" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.settingLabel}>
                    Allow Past Recurring Expenses
                  </Text>
                  <Text style={styles.settingSubLabel}>
                    Create recurring templates with past start dates
                  </Text>
                </View>
                <ModernToggle
                  value={
                    userProfile?.settings?.family?.allowPastRecurring ?? false
                  }
                  onValueChange={async (value) => {
                    const userId = useAuthStore.getState().user?.uid;
                    if (userId) {
                      await updateUserProfile(userId, {
                        "settings.family.allowPastRecurring": value,
                      });
                      updateProfile({
                        settings: {
                          ...userProfile.settings,
                          family: {
                            ...userProfile?.settings?.family,
                            allowPastRecurring: value,
                          },
                        },
                      });
                    }
                  }}
                  activeColor="#10B981"
                />
              </View>

              {/* Info Card */}
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#6C63FF"
                />
                <Text style={styles.infoText}>
                  Synced expenses are tagged with [Family] in your personal
                  expense list
                </Text>
              </View>
            </View>
          </>
        )}

        {/* About Card */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#F1F5F9' }]}>
            <Ionicons name="information-circle" size={16} color="#64748B" />
          </View>
          <Text style={styles.sectionTitle}>ABOUT KOSH</Text>
        </View>

        <View style={styles.card}>
          <View style={[styles.aboutRow, styles.borderBottom]}>
            <Text style={styles.settingLabel}>App Version</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaText}>1.0.0 Alpha</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.settingLabel}>User ID</Text>
            <Text style={styles.aboutValue} numberOfLines={1}>
              {auth.currentUser?.uid?.substring(0, 12)}...
            </Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
          </View>
          <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>DANGER ZONE</Text>
        </View>
        
        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={() =>
            Alert.alert(
              "Delete Account",
              "This will permanently delete your account and all data. This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete Permanently", style: "destructive" },
              ],
            )
          }
        >
          <LinearGradient
            colors={['#FCA5A5', '#EF4444']}
            style={styles.dangerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <Text style={styles.dangerText}>Delete My Account</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  avatarMini: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextMini: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  profileName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  profileEmail: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 4 },
  activeText: { fontSize: 10, fontWeight: '800', color: '#10B981', textTransform: 'uppercase' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#6B7280",
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  currencyItem: {
    width: (width - 72) / 2,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  activeCurrencyItem: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  currencySymbol: { fontSize: 24, fontWeight: '900', color: '#111827' },
  currencyCode: { fontSize: 12, fontWeight: '800', color: '#6B7280', marginTop: 4 },
  activeCurrencyText: { color: '#6366F1' },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },


  settingRow: { flexDirection: "row", alignItems: "center", padding: 18 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  settingLabel: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  settingSubLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    fontWeight: '500',
  },

  switchRow: { flexDirection: "row", alignItems: "center", padding: 18 },

  infoBox: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  infoText: {
    fontSize: 12,
    color: "#6366F1",
    marginLeft: 10,
    flex: 1,
    fontWeight: '600',
  },

  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
  },
  aboutValue: { fontSize: 13, color: "#6B7280", fontWeight: '600' },
  betaBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  betaText: { fontSize: 10, fontWeight: '900', color: '#64748B', textTransform: 'uppercase' },

  dangerBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 4,
  },
  dangerGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
});

export default SettingsScreen;
