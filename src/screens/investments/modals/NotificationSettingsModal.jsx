import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../../../services/notificationService";
import useAuthStore from "../../../store/useAuthStore";

const NotificationSettingsModal = ({ visible, onClose }) => {
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const prefs = await getNotificationPreferences();
      setSettings(prefs);
    } catch (error) {
      console.log("Failed to load notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    try {
      const res = await updateNotificationPreferences(updated);
      if (res.success) {
        updateProfile({ notificationSettings: updated });
      } else {
        Alert.alert("Error", "Could not save notification setting");
      }
    } catch (error) {
      console.log("Save notification error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="notifications" size={20} color="#134E4A" />
              </View>
              <View>
                <Text style={styles.title}>Notification Preferences</Text>
                <Text style={styles.subTitle}>
                  Configure your wealth & payment alerts
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#71717A" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#134E4A" />
              <Text style={styles.loadingText}>Loading settings...</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* Master Switch */}
              <View style={styles.masterCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.masterTitle}>All Notifications</Text>
                  <Text style={styles.masterSub}>
                    Enable or pause all system notifications
                  </Text>
                </View>
                <Switch
                  value={settings.enabled}
                  onValueChange={(val) => handleToggle("enabled", val)}
                  trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                  thumbColor={settings.enabled ? "#0F766E" : "#F8FAFC"}
                />
              </View>

              {/* Section 1: Investment & Wealth Alerts */}
              <Text style={styles.sectionHeading}>Investments & Wealth</Text>

              <View style={styles.settingsGroup}>
                <View style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: "#E6F2F0" }]}>
                    <Ionicons name="repeat" size={18} color="#134E4A" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>SIP Due Reminders</Text>
                    <Text style={styles.settingSub}>
                      Notify before monthly SIP execution dates
                    </Text>
                  </View>
                  <Switch
                    disabled={!settings.enabled}
                    value={settings.enabled && settings.sipReminders}
                    onValueChange={(val) => handleToggle("sipReminders", val)}
                    trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                    thumbColor={settings.sipReminders ? "#0F766E" : "#F8FAFC"}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: "#CCFBF1" }]}>
                    <Ionicons name="sync" size={18} color="#0D9488" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>RD Payment Reminders</Text>
                    <Text style={styles.settingSub}>
                      Alerts for recurring deposit installments
                    </Text>
                  </View>
                  <Switch
                    disabled={!settings.enabled}
                    value={settings.enabled && settings.rdReminders}
                    onValueChange={(val) => handleToggle("rdReminders", val)}
                    trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                    thumbColor={settings.rdReminders ? "#0F766E" : "#F8FAFC"}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="flag" size={18} color="#D97706" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>Maturity Alerts</Text>
                    <Text style={styles.settingSub}>
                      Alerts when FD / RD reach maturity
                    </Text>
                  </View>
                  <Switch
                    disabled={!settings.enabled}
                    value={settings.enabled && settings.maturityAlerts}
                    onValueChange={(val) => handleToggle("maturityAlerts", val)}
                    trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                    thumbColor={settings.maturityAlerts ? "#0F766E" : "#F8FAFC"}
                  />
                </View>
              </View>

              {/* Section 2: Budget & Spending Alerts */}
              <Text style={styles.sectionHeading}>Budget & Expenses</Text>

              <View style={styles.settingsGroup}>
                <View style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="pie-chart" size={18} color="#B91C1C" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>Budget Overrun Alerts</Text>
                    <Text style={styles.settingSub}>
                      Warnings when spending exceeds 80% or 100%
                    </Text>
                  </View>
                  <Switch
                    disabled={!settings.enabled}
                    value={settings.enabled && settings.budgetAlerts}
                    onValueChange={(val) => handleToggle("budgetAlerts", val)}
                    trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                    thumbColor={settings.budgetAlerts ? "#0F766E" : "#F8FAFC"}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: "#FFF7ED" }]}>
                    <Ionicons name="card" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>Credit Card Bill Alerts</Text>
                    <Text style={styles.settingSub}>
                      Urgent reminders before payment due date
                    </Text>
                  </View>
                  <Switch
                    disabled={!settings.enabled}
                    value={settings.enabled && settings.creditCardAlerts}
                    onValueChange={(val) =>
                      handleToggle("creditCardAlerts", val)
                    }
                    trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                    thumbColor={settings.creditCardAlerts ? "#0F766E" : "#F8FAFC"}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: "#F3E8FF" }]}>
                    <Ionicons name="time" size={18} color="#9333EA" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>Daily Expense Reminder</Text>
                    <Text style={styles.settingSub}>
                      Evening reminder to log daily transactions
                    </Text>
                  </View>
                  <Switch
                    disabled={!settings.enabled}
                    value={settings.enabled && settings.dailyReminder}
                    onValueChange={(val) => handleToggle("dailyReminder", val)}
                    trackColor={{ false: "#CBD5E1", true: "#818CF8" }}
                    thumbColor={settings.dailyReminder ? "#0F766E" : "#F8FAFC"}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "88%",
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E6F2F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  subTitle: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECEAE4",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#71717A",
  },
  masterCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E6F2F0",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginBottom: 16,
  },
  masterTitle: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: "#312E81",
  },
  masterSub: {
    fontSize: 12,
    color: "#4338CA",
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  settingsGroup: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E2DC",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingTextCol: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: "#0F172A",
  },
  settingSub: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E2DC",
  },
  doneBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
  },
});

export default NotificationSettingsModal;
