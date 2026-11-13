import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addAccount } from '../../services/accountService';

const ACCOUNT_TYPES = [
  { type: 'BANK', label: 'Bank Account', icon: 'business', color: '#3B82F6', emoji: '🏦' },
  { type: 'CREDIT_CARD', label: 'Credit Card', icon: 'card', color: '#F59E0B', emoji: '💳' },
  { type: 'CASH', label: 'Cash', icon: 'cash', color: '#10B981', emoji: '💵' },
];

const SetupAccountsScreen = ({ navigation }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [currentUsage, setCurrentUsage] = useState('');
  const [billDate, setBillDate] = useState('1');
  const [dueDate, setDueDate] = useState('15');

  const resetForm = () => {
    setAccountName('');
    setBankName('');
    setBalance('');
    setCreditLimit('');
    setCurrentUsage('');
    setBillDate('1');
    setDueDate('15');
    setSelectedType(null);
    setShowForm(false);
  };

  const validateForm = () => {
    if (!accountName.trim()) {
      Alert.alert('Required', 'Please enter account name');
      return false;
    }
    if (selectedType === 'CREDIT_CARD' && !creditLimit) {
      Alert.alert('Required', 'Please enter credit limit');
      return false;
    }
    return true;
  };

  const handleAddAccount = async () => {
    if (!validateForm()) return;

    setLoading(true);

    const accountData = {
      type: selectedType,
      name: accountName.trim(),
      bankName: bankName.trim() || null,
      balance: selectedType !== 'CREDIT_CARD' ? parseFloat(balance) || 0 : 0,
      creditLimit: selectedType === 'CREDIT_CARD' ? parseFloat(creditLimit) || 0 : 0,
      currentUsage: selectedType === 'CREDIT_CARD' ? parseFloat(currentUsage) || 0 : 0,
      billGenerationDate: parseInt(billDate) || 1,
      billDueDate: parseInt(dueDate) || 15,
      color: ACCOUNT_TYPES.find(a => a.type === selectedType)?.color || '#455A64',
      isDefault: accounts.length === 0,
    };

    const result = await addAccount(accountData);

    if (result.success) {
      const newAccount = { ...accountData, id: result.id };
      setAccounts(prev => [...prev, newAccount]);
      console.log('✅ Account saved to Firebase:', result.id);
      resetForm();
    } else {
      Alert.alert('Error', 'Failed to save account: ' + result.error);
    }

    setLoading(false);
  };

  const handleNext = () => {
    if (accounts.length === 0) {
      Alert.alert(
        'Skip Accounts?',
        'You can add accounts later from Profile. Continue?',
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Skip', onPress: () => navigation.navigate('SetupBudget') },
        ]
      );
    } else {
      navigation.navigate('SetupBudget');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress */}
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, styles.progressLineDone]} />
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, styles.progressLineDone]} />
            <View style={[styles.progressDot, styles.progressActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>

          <Text style={styles.step}>Step 3 of 4</Text>
          <Text style={styles.title}>Your Accounts</Text>
          <Text style={styles.subtitle}>Add your bank accounts, credit cards & cash</Text>

          {/* Added Accounts List */}
          {accounts.map((acc, index) => (
            <View key={acc.id || index} style={styles.addedAccount}>
              <Text style={styles.addedEmoji}>
                {ACCOUNT_TYPES.find(a => a.type === acc.type)?.emoji}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.addedName}>{acc.name}</Text>
                <Text style={styles.addedDetail}>
                  {acc.type === 'CREDIT_CARD'
                    ? `Limit: ₹${(acc.creditLimit || 0).toLocaleString('en-IN')} | Used: ₹${(acc.currentUsage || 0).toLocaleString('en-IN')}`
                    : `Balance: ₹${(acc.balance || 0).toLocaleString('en-IN')}`}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>
          ))}

          {/* Account Type Selection */}
          {!showForm && (
            <>
              <Text style={styles.sectionLabel}>
                {accounts.length > 0 ? 'Add another account' : 'Add an account'}
              </Text>
              {ACCOUNT_TYPES.map((acc) => (
                <TouchableOpacity
                  key={acc.type}
                  style={styles.typeCard}
                  onPress={() => {
                    setSelectedType(acc.type);
                    setShowForm(true);
                    if (acc.type === 'CASH') setAccountName('Cash in Hand');
                  }}
                >
                  <Text style={styles.typeEmoji}>{acc.emoji}</Text>
                  <Text style={styles.typeLabel}>{acc.label}</Text>
                  <Ionicons name="add-circle-outline" size={24} color="#6C63FF" />
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Account Form */}
          {showForm && (
            <View style={styles.form}>
              <Text style={styles.formTitle}>
                {ACCOUNT_TYPES.find(a => a.type === selectedType)?.emoji}{' '}
                Add {ACCOUNT_TYPES.find(a => a.type === selectedType)?.label}
              </Text>

              {/* Account Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={selectedType === 'CASH' ? 'Cash in Hand' : 'e.g., HDFC Savings'}
                  placeholderTextColor="#94A3B8"
                  value={accountName}
                  onChangeText={setAccountName}
                />
              </View>

              {/* Bank Name */}
              {selectedType !== 'CASH' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Bank Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., HDFC, ICICI, SBI"
                    placeholderTextColor="#94A3B8"
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </View>
              )}

              {/* Balance (Bank & Cash) */}
              {selectedType !== 'CREDIT_CARD' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Current Balance</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={balance}
                      onChangeText={setBalance}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}

              {/* Credit Card Fields */}
              {selectedType === 'CREDIT_CARD' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Credit Limit *</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.rupee}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="100000"
                        placeholderTextColor="#94A3B8"
                        value={creditLimit}
                        onChangeText={setCreditLimit}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Current Outstanding (if any)</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.rupee}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        value={currentUsage}
                        onChangeText={setCurrentUsage}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.dateRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.label}>Bill Date</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                        value={billDate}
                        onChangeText={setBillDate}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={styles.label}>Due Date</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="15"
                        placeholderTextColor="#94A3B8"
                        value={dueDate}
                        onChangeText={setDueDate}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Form Buttons */}
              <View style={styles.formBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, loading && { opacity: 0.6 }]}
                  onPress={handleAddAccount}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Next Button */}
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>
              {accounts.length === 0 ? 'Skip for now →' : `Next: Set Budget → (${accounts.length} added)`}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F1F5F9' },
  progressActive: { backgroundColor: '#6C63FF', width: 14, height: 14, borderRadius: 7 },
  progressDone: { backgroundColor: '#10B981' },
  progressLine: { width: 40, height: 2, backgroundColor: '#F1F5F9', marginHorizontal: 4 },
  progressLineDone: { backgroundColor: '#10B981' },

  step: { fontSize: 13, color: '#6C63FF', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1E293B', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 24 },

  addedAccount: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5',
    padding: 14, borderRadius: 12, marginBottom: 8,
  },
  addedEmoji: { fontSize: 24, marginRight: 12 },
  addedName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  addedDetail: { fontSize: 12, color: '#64748B', marginTop: 2 },

  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginTop: 16, marginBottom: 12 },

  typeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1.5, borderColor: '#F1F5F9',
  },
  typeEmoji: { fontSize: 24, marginRight: 14 },
  typeLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1E293B' },

  form: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    marginTop: 8, borderWidth: 1.5, borderColor: '#F1F5F9',
  },
  formTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 20 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  textInput: {
    backgroundColor: '#F8F9FE', borderRadius: 10, borderWidth: 1.5, borderColor: '#F1F5F9',
    paddingHorizontal: 14, height: 46, fontSize: 15, color: '#1E293B',
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FE',
    borderRadius: 10, borderWidth: 1.5, borderColor: '#F1F5F9', paddingLeft: 14,
  },
  rupee: { fontSize: 18, fontWeight: '600', color: '#64748B' },
  amountInput: { flex: 1, height: 46, fontSize: 15, color: '#1E293B', paddingHorizontal: 8 },
  dateRow: { flexDirection: 'row' },

  formBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: 10, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#F1F5F9',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  saveBtn: {
    flex: 1, height: 46, borderRadius: 10, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#6C63FF',
  },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  nextBtn: {
    backgroundColor: '#6C63FF', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 32,
  },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default SetupAccountsScreen;