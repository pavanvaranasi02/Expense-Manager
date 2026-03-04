import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import { updateUserProfile } from '../../services/authService';
import useAuthStore from '../../store/useAuthStore';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const SettingsScreen = ({ navigation }) => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [currency, setCurrency] = useState(userProfile?.currency || 'INR');
  const [showInvestmentsInAssets, setShowInvestmentsInAssets] = useState(
    userProfile?.showInvestmentsInAssets || false
  );
  const [notifications, setNotifications] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [creditCardAlerts, setCreditCardAlerts] = useState(true);

  const saveToFirebase = async (key, value) => {
    const userId = auth.currentUser.uid;
    const result = await updateUserProfile(userId, { [key]: value });
    if (result.success) {
      updateProfile({ [key]: value });
    }
  };

  const handleCurrencyChange = async (newCurrency) => {
    setCurrency(newCurrency);
    await saveToFirebase('currency', newCurrency);
  };

  const handleInvestmentToggle = async (value) => {
    setShowInvestmentsInAssets(value);
    await saveToFirebase('showInvestmentsInAssets', value);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Currency */}
        <Text style={styles.sectionTitle}>Currency</Text>
        <View style={styles.card}>
          {CURRENCIES.map((cur, i) => (
            <TouchableOpacity
              key={cur.code}
              style={[styles.settingRow, i < CURRENCIES.length - 1 && styles.borderBottom]}
              onPress={() => handleCurrencyChange(cur.code)}
            >
              <Text style={styles.currencySymbol}>{cur.symbol}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{cur.name}</Text>
                <Text style={styles.settingSubLabel}>{cur.code}</Text>
              </View>
              {currency === cur.code && (
                <Ionicons name="checkmark-circle" size={22} color="#6C63FF" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Portfolio Settings */}
        <Text style={styles.sectionTitle}>Portfolio & Investments</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Include Investments in Net Worth</Text>
              <Text style={styles.settingSubLabel}>
                {showInvestmentsInAssets
                  ? 'Net Worth = Assets + Investments - Debts'
                  : 'Net Worth = Assets - Debts (Investments shown separately)'}
              </Text>
            </View>
            <Switch
              value={showInvestmentsInAssets}
              onValueChange={handleInvestmentToggle}
              trackColor={{ true: '#6C63FF', false: '#E5E7EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {showInvestmentsInAssets && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={16} color="#6C63FF" />
              <Text style={styles.infoText}>
                Your investment portfolio value will be added to assets in the dashboard Net Worth calculation.
              </Text>
            </View>
          )}
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingSubLabel}>Receive important alerts</Text>
            </View>
            <Switch value={notifications} onValueChange={setNotifications}
              trackColor={{ true: '#6C63FF', false: '#E5E7EB' }} thumbColor="#FFFFFF" />
          </View>
          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Daily Expense Reminder</Text>
              <Text style={styles.settingSubLabel}>Remind to log expenses at 9 PM</Text>
            </View>
            <Switch value={dailyReminder} onValueChange={setDailyReminder}
              trackColor={{ true: '#6C63FF', false: '#E5E7EB' }} thumbColor="#FFFFFF" />
          </View>
          <View style={[styles.switchRow, styles.borderBottom]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Budget Alerts</Text>
              <Text style={styles.settingSubLabel}>Alert when nearing budget limit</Text>
            </View>
            <Switch value={budgetAlerts} onValueChange={setBudgetAlerts}
              trackColor={{ true: '#6C63FF', false: '#E5E7EB' }} thumbColor="#FFFFFF" />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Credit Card Bill Alerts</Text>
              <Text style={styles.settingSubLabel}>Remind before bill due date</Text>
            </View>
            <Switch value={creditCardAlerts} onValueChange={setCreditCardAlerts}
              trackColor={{ true: '#6C63FF', false: '#E5E7EB' }} thumbColor="#FFFFFF" />
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={[styles.aboutRow, styles.borderBottom]}>
            <Text style={styles.settingLabel}>App Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.settingLabel}>User ID</Text>
            <Text style={styles.aboutValue} numberOfLines={1}>
              {auth.currentUser?.uid?.substring(0, 16)}...
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={() => Alert.alert('Delete Account', 'This will permanently delete your account and all data.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive' },
          ])}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.dangerText}>Delete My Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginTop: 24, marginBottom: 10 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },

  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  currencySymbol: { fontSize: 22, fontWeight: '700', color: '#374151', marginRight: 14, width: 30, textAlign: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  settingSubLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2, lineHeight: 16 },

  switchRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },

  infoBox: {
    flexDirection: 'row', backgroundColor: '#F0EFFF', padding: 12, margin: 10,
    borderRadius: 10, alignItems: 'flex-start',
  },
  infoText: { fontSize: 12, color: '#6C63FF', marginLeft: 8, flex: 1, lineHeight: 16 },

  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  aboutValue: { fontSize: 14, color: '#6B7280', maxWidth: 180 },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12,
  },
  dangerText: { fontSize: 15, fontWeight: '600', color: '#EF4444', marginLeft: 8 },
});

export default SettingsScreen;