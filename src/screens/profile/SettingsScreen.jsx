import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "../../config/firebase";
import { updateUserProfile } from "../../services/authService";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  updateNotificationPreferences,
} from "../../services/notificationService";
import {
  checkForGitHubUpdates,
  CURRENT_APP_VERSION,
} from "../../services/updateService";
import UpdateModal from "../../components/UpdateModal";
import useAuthStore from "../../store/useAuthStore";
import useStorageStore from "../../store/useStorageStore";
import { startBackgroundStorageSwitch } from "../../services/storageMigrationService";
import * as Haptics from 'expo-haptics';
import ModernToggle from "../../components/ModernToggle";
import { getCurrencySymbol } from "../../constants/currencies";
import { Theme } from "../../theme/theme";

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
  const storageMode = useStorageStore((state) => state.storageMode);
  const migrationStatus = useStorageStore((state) => state.migrationStatus);
  const migrationProgress = useStorageStore((state) => state.migrationProgress);

  const [currency, setCurrency] = useState(userProfile?.currency || "INR");
  const [showInvestmentsInAssets, setShowInvestmentsInAssets] = useState(
    userProfile?.showInvestmentsInAssets || false,
  );
  const [notificationSettings, setNotificationSettings] = useState({
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(userProfile?.notificationSettings || {}),
  });
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
    const newSymbol = getCurrencySymbol(newCurrency);
    const userId = auth.currentUser.uid;
    const result = await updateUserProfile(userId, {
      currency: newCurrency,
      currencySymbol: newSymbol,
    });
    if (result.success) {
      updateProfile({ currency: newCurrency, currencySymbol: newSymbol });
    }
  };

  const handleInvestmentToggle = async (value) => {
    setShowInvestmentsInAssets(value);
    await saveToFirebase("showInvestmentsInAssets", value);
  };
  
  const handleLabelToggle = async (value) => {
    setShowTabLabels(value);
    await saveToFirebase("showTabLabels", value);
  };

  const handleNotificationToggle = async (key, value) => {
    const updated = { ...notificationSettings, [key]: value };
    setNotificationSettings(updated);
    await updateNotificationPreferences(updated);
    await saveToFirebase("notificationSettings", updated);
  };

  const handleStorageSwitch = (targetMode) => {
    if (targetMode === storageMode) return;
    if (migrationStatus === 'downloading' || migrationStatus === 'uploading') {
      Alert.alert(
        "Sync in Progress",
        "A storage migration is already running in the background. You can continue using the app normally."
      );
      return;
    }

    const isToLocal = targetMode === 'local';
    Alert.alert(
      isToLocal ? "Switch to Local Storage?" : "Switch to Cloud Storage?",
      isToLocal
        ? "All your cloud data (accounts, expenses, incomes, budgets, investments, EMIs, and settings) will be downloaded to this device in the background. You can continue using the app normally."
        : "All your local data will be uploaded to the cloud in the background so it is backed up and synced. You can continue using the app normally.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isToLocal ? "Download & Switch" : "Upload & Switch",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            startBackgroundStorageSwitch(targetMode);
          },
        },
      ]
    );
  };

  // Update Checker State
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await checkForGitHubUpdates();
      setUpdateInfo(res);
      setShowUpdateModal(true);
      if (res.hasUpdate) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to check for updates. Please try again.");
    } finally {
      setCheckingUpdate(false);
    }
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
            <Ionicons name="chevron-back" size={24} color="#18181B" />
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
          <View style={[styles.sectionIcon, { backgroundColor: Theme.colors.primaryLight }]}>
            <Ionicons name="cash" size={16} color={Theme.colors.primary} />
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

        {/* Data & Storage Section */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Theme.colors.primaryLight }]}>
            <Ionicons name="server-outline" size={16} color={Theme.colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>DATA & STORAGE</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.storageGrid}>
            <TouchableOpacity
              style={[
                styles.storageOption,
                storageMode === 'cloud' && styles.storageOptionActiveCloud,
              ]}
              activeOpacity={0.8}
              onPress={() => handleStorageSwitch('cloud')}
            >
              <View style={styles.storageOptionTop}>
                <View style={[styles.storageIconWrap, { backgroundColor: Theme.colors.primaryLight }]}>
                  <Ionicons name="cloud-outline" size={20} color={Theme.colors.primary} />
                </View>
                {storageMode === 'cloud' && (
                  <View style={[styles.storageActivePill, { backgroundColor: Theme.colors.primaryLight }]}>
                    <Text style={[styles.storageActivePillText, { color: Theme.colors.primary }]}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.storageTitle}>Cloud Storage</Text>
              <Text style={styles.storageDesc}>Synced & backed up to Firebase</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.storageOption,
                storageMode === 'local' && styles.storageOptionActiveLocal,
              ]}
              activeOpacity={0.8}
              onPress={() => handleStorageSwitch('local')}
            >
              <View style={styles.storageOptionTop}>
                <View style={[styles.storageIconWrap, { backgroundColor: Theme.colors.primaryLight }]}>
                  <Ionicons name="phone-portrait-outline" size={20} color={Theme.colors.primary} />
                </View>
                {storageMode === 'local' && (
                  <View style={[styles.storageActivePill, { backgroundColor: Theme.colors.primaryLight }]}>
                    <Text style={[styles.storageActivePillText, { color: Theme.colors.primary }]}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.storageTitle}>Local Storage</Text>
              <Text style={styles.storageDesc}>Stored privately on this device</Text>
            </TouchableOpacity>
          </View>

          {(migrationStatus === 'downloading' || migrationStatus === 'uploading') && (
            <View style={styles.migrationBox}>
              <View style={styles.migrationHeader}>
                <ActivityIndicator size="small" color="#134E4A" />
                <Text style={styles.migrationText}>
                  {migrationProgress.label || 'Migrating data in background...'} (
                  {migrationProgress.current}/{migrationProgress.total})
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        migrationProgress.total > 0
                          ? Math.round(
                              (migrationProgress.current / migrationProgress.total) * 100
                            )
                          : 15
                      }%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.migrationHint}>
                Running in background — feel free to keep using the app.
              </Text>
            </View>
          )}
        </View>

        {/* Portfolio Settings */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Theme.colors.primaryLight }]}>
            <Ionicons name="stats-chart" size={16} color={Theme.colors.primary} />
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
              activeColor={Theme.colors.primary}
            />
          </View>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={16} color={Theme.colors.primary} />
            <Text style={styles.infoText}>
              {showInvestmentsInAssets 
                ? "Net Worth = Assets + Investments - Debts"
                : "Net Worth = Assets - Debts (Investments excluded)"}
            </Text>
          </View>
        </View>

        {/* UI Preferences Section */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Theme.colors.primaryLight }]}>
            <Ionicons name="desktop" size={16} color={Theme.colors.primary} />
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
              activeColor={Theme.colors.primary}
            />
          </View>
        </View>

        {/* Privacy & Notifications */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Theme.colors.primaryLight }]}>
            <Ionicons name="notifications" size={16} color={Theme.colors.primary} />
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
              activeColor={Theme.colors.primary}
            />
          </View>
          
          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingSubLabel}>Master toggle for all alerts and tips</Text>
            </View>
            <ModernToggle
              value={notificationSettings.enabled}
              onValueChange={(val) => handleNotificationToggle("enabled", val)}
              activeColor="#134E4A"
            />
          </View>

          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>SIP Due Reminders</Text>
              <Text style={styles.settingSubLabel}>Notify before scheduled mutual fund SIPs</Text>
            </View>
            <ModernToggle
              value={notificationSettings.enabled && notificationSettings.sipReminders}
              onValueChange={(val) => handleNotificationToggle("sipReminders", val)}
              activeColor="#134E4A"
            />
          </View>

          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>RD Payment Reminders</Text>
              <Text style={styles.settingSubLabel}>Alerts for recurring deposit installments</Text>
            </View>
            <ModernToggle
              value={notificationSettings.enabled && notificationSettings.rdReminders}
              onValueChange={(val) => handleNotificationToggle("rdReminders", val)}
              activeColor="#134E4A"
            />
          </View>

          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Budget Overrun Alerts</Text>
              <Text style={styles.settingSubLabel}>Warning when spending reaches 80% or 100%</Text>
            </View>
            <ModernToggle
              value={notificationSettings.enabled && notificationSettings.budgetAlerts}
              onValueChange={(val) => handleNotificationToggle("budgetAlerts", val)}
              activeColor="#134E4A"
            />
          </View>

          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Credit Card Bill Alerts</Text>
              <Text style={styles.settingSubLabel}>Remind before payment due date to avoid interest</Text>
            </View>
            <ModernToggle
              value={notificationSettings.enabled && notificationSettings.creditCardAlerts}
              onValueChange={(val) => handleNotificationToggle("creditCardAlerts", val)}
              activeColor="#134E4A"
            />
          </View>

          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>EMI Due Alerts</Text>
              <Text style={styles.settingSubLabel}>Remind before monthly credit card & loan EMI debits</Text>
            </View>
            <ModernToggle
              value={notificationSettings.enabled && notificationSettings.emiAlerts}
              onValueChange={(val) => handleNotificationToggle("emiAlerts", val)}
              activeColor="#134E4A"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Daily Reminder</Text>
              <Text style={styles.settingSubLabel}>Log your daily expenses at 9 PM</Text>
            </View>
            <ModernToggle
              value={notificationSettings.enabled && notificationSettings.dailyReminder}
              onValueChange={(val) => handleNotificationToggle("dailyReminder", val)}
              activeColor="#134E4A"
            />
          </View>
        </View>

        {/* Family Settings Section */}
        {userProfile?.familyId && storageMode !== 'local' && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: Theme.colors.primaryLight }]}>
                <Ionicons name="people" size={16} color={Theme.colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>FAMILY SETTINGS</Text>
            </View>
            <View style={styles.card}>
              <View style={[styles.settingRow, styles.borderBottom]}>
                <View
                  style={[styles.settingIcon, { backgroundColor: Theme.colors.primaryLight }]}
                >
                  <Ionicons name="sync" size={20} color={Theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
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
                  activeColor={Theme.colors.primary}
                />
              </View>

              {userProfile?.settings?.family?.syncFamilyToPersonal !==
                false && (
                <>
                  <View style={[styles.settingRow, styles.borderBottom]}>
                    <View
                      style={[
                        styles.settingIcon,
                        { backgroundColor: Theme.colors.primaryLight },
                      ]}
                    >
                      <Ionicons name="pencil" size={20} color={Theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
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
                      activeColor={Theme.colors.primary}
                    />
                  </View>

                  <View style={[styles.settingRow, styles.borderBottom]}>
                    <View
                      style={[
                        styles.settingIcon,
                        { backgroundColor: Theme.colors.primaryLight },
                      ]}
                    >
                      <Ionicons name="trash" size={20} color={Theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
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
                      activeColor={Theme.colors.primary}
                    />
                  </View>
                </>
              )}

              {/* Allow Past Date Recurring Expenses */}
              <View style={[styles.settingRow, styles.borderBottom]}>
                <View
                  style={[styles.settingIcon, { backgroundColor: Theme.colors.primaryLight }]}
                >
                  <Ionicons name="calendar" size={20} color={Theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
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
                  activeColor={Theme.colors.primary}
                />
              </View>

              {/* Info Card */}
              <View style={[styles.infoBox, { marginTop: 16 }]}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={Theme.colors.primary}
                />
                <Text style={styles.infoText}>
                  Synced expenses are tagged with [Family] in your personal
                  expense list
                </Text>
              </View>
            </View>
          </>
        )}

        {/* About & Updates Card */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Theme.colors.primaryLight }]}>
            <Ionicons name="information-circle" size={16} color={Theme.colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>ABOUT & UPDATES</Text>
        </View>

        <View style={styles.card}>
          <View style={[styles.aboutRow, styles.borderBottom]}>
            <View>
              <Text style={styles.settingLabel}>App Version</Text>
              <Text style={styles.settingSubLabel}>Installed build release</Text>
            </View>
            <View style={styles.betaBadge}>
              <Text style={styles.betaText}>v{CURRENT_APP_VERSION}</Text>
            </View>
          </View>

          {/* Check for Updates Button */}
          <TouchableOpacity
            style={[styles.aboutRow, styles.borderBottom]}
            onPress={handleCheckForUpdates}
            disabled={checkingUpdate}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Check for Updates</Text>
              <Text style={styles.settingSubLabel}>
                Verify latest release tags on GitHub
              </Text>
            </View>
            {checkingUpdate ? (
              <ActivityIndicator size="small" color="#134E4A" />
            ) : (
              <View style={styles.updateBadge}>
                <Ionicons name="cloud-download-outline" size={14} color="#134E4A" />
                <Text style={styles.updateBadgeText}>Check Now</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* GitHub Releases Link */}
          <TouchableOpacity
            style={[styles.aboutRow, styles.borderBottom]}
            onPress={() =>
              Linking.openURL(
                "https://github.com/pavanvaranasi02/Expense-Manager/releases"
              )
            }
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>GitHub Releases</Text>
              <Text style={styles.settingSubLabel}>
                View changelogs and source repo
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#71717A" />
          </TouchableOpacity>

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
            <Ionicons name="alert-circle" size={16} color="#B91C1C" />
          </View>
          <Text style={[styles.sectionTitle, { color: '#B91C1C' }]}>DANGER ZONE</Text>
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
            colors={['#FCA5A5', '#B91C1C']}
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

      {/* Update Checker Modal */}
      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onClose={() => setShowUpdateModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F6F2" },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F7F6F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: "#18181B", letterSpacing: -0.5 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  avatarMini: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#134E4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextMini: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: '#FFFFFF' },
  profileName: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#18181B' },
  profileEmail: { fontSize: 12, color: '#71717A', fontFamily: 'Manrope_500Medium' },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#047857', marginRight: 4 },
  activeText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: '#047857', textTransform: 'uppercase' },

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
    fontFamily: 'Manrope_700Bold',
    color: "#71717A",
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ECEAE4",
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
    backgroundColor: '#F7F6F2',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  activeCurrencyItem: {
    backgroundColor: '#E6F2F0',
    borderColor: '#134E4A',
  },
  currencySymbol: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: '#18181B' },
  currencyCode: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: '#71717A', marginTop: 4 },
  activeCurrencyText: { color: '#134E4A' },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#134E4A',
    justifyContent: 'center',
    alignItems: 'center',
  },


  settingRow: { flexDirection: "row", alignItems: "center", padding: 18, gap: 12 },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: "#ECEAE4" },
  settingLabel: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: "#1F2937" },
  settingSubLabel: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 2,
    fontFamily: 'Manrope_500Medium',
  },

  switchRow: { flexDirection: "row", alignItems: "center", padding: 18, gap: 12 },

  infoBox: {
    flexDirection: "row",
    backgroundColor: "#E6F2F0",
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  infoText: {
    fontSize: 12,
    color: "#134E4A",
    marginLeft: 10,
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
  },

  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
  },
  aboutValue: { fontSize: 13, color: "#71717A", fontFamily: 'Manrope_600SemiBold' },
  betaBadge: {
    backgroundColor: '#ECEAE4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  betaText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: '#71717A', textTransform: 'uppercase' },
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F2F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  updateBadgeText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
  },

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
    fontFamily: 'Manrope_700Bold',
    color: "#FFFFFF",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  storageGrid: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  storageOption: {
    flex: 1,
    padding: 14,
    borderRadius: Theme.radius.lg,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  storageOptionActiveCloud: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  storageOptionActiveLocal: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  storageOptionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  storageIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageActivePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  storageActivePillText: {
    fontSize: 10,
    fontWeight: Theme.typography.weight.extrabold,
    textTransform: 'uppercase',
  },
  storageTitle: {
    fontSize: Theme.typography.size.sm,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.text,
  },
  storageDesc: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  migrationBox: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    padding: 12,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primaryLight,
  },
  migrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  migrationText: {
    fontSize: Theme.typography.size.xs,
    fontWeight: Theme.typography.weight.bold,
    color: Theme.colors.primaryDark,
    flex: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.surface,
    marginTop: Theme.spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 3,
  },
  migrationHint: {
    fontSize: 11,
    color: Theme.colors.primaryDark,
    marginTop: 6,
  },
});

export default SettingsScreen;
