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
import { addAccount, updateAccount } from '../../services/accountService';
import useAccountStore from '../../store/useAccountStore';

const ACCOUNT_TYPES = [
  { type: 'BANK', label: 'Bank Account', emoji: '🏦', color: '#3B82F6' },
  { type: 'CREDIT_CARD', label: 'Credit Card', emoji: '💳', color: '#F59E0B' },
  { type: 'CASH', label: 'Cash', emoji: '💵', color: '#10B981' },
];

const BANK_COLORS = [
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Orange', color: '#F59E0B' },
  { name: 'Green', color: '#10B981' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Gray', color: '#6B7280' },
];

const AddAccountScreen = ({ navigation, route }) => {
  const existingAccount = route?.params?.account;
  const editMode = route?.params?.editMode || false;

  const [selectedType, setSelectedType] = useState(existingAccount?.type || null);
  const [accountName, setAccountName] = useState(existingAccount?.name || '');
  const [bankName, setBankName] = useState(existingAccount?.bankName || '');
  const [balance, setBalance] = useState(existingAccount?.balance?.toString() || '');
  const [creditLimit, setCreditLimit] = useState(existingAccount?.creditLimit?.toString() || '');
  const [currentUsage, setCurrentUsage] = useState(existingAccount?.currentUsage?.toString() || '');
  const [billDate, setBillDate] = useState(existingAccount?.billGenerationDate?.toString() || '1');
  const [dueDate, setDueDate] = useState(existingAccount?.billDueDate?.toString() || '15');
  const [selectedColor, setSelectedColor] = useState(existingAccount?.color || '#3B82F6');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!selectedType) {
      Alert.alert('Required', 'Please select account type');
      return false;
    }
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

  const handleSave = async () => {
    if (!validate()) return;
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
      color: selectedColor,
    };

    let result;
    if (editMode && existingAccount?.id) {
      result = await updateAccount(existingAccount.id, accountData);
      if (result.success) {
        useAccountStore.getState().updateAccountInStore(existingAccount.id, accountData);
      }
    } else {
      result = await addAccount(accountData);
      if (result.success) {
        useAccountStore.getState().addAccountToStore({ id: result.id, ...accountData });
      }
    }

    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', 'Failed to save: ' + result.error);
    }

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editMode ? 'Edit Account' : 'Add Account'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Account Type (not editable in edit mode) */}
          {!editMode && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Type</Text>
              <View style={styles.typeRow}>
                {ACCOUNT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.type}
                    style={[
                      styles.typeChip,
                      selectedType === type.type && { backgroundColor: type.color, borderColor: type.color },
                    ]}
                    onPress={() => {
                      setSelectedType(type.type);
                      if (type.type === 'CASH') setAccountName('Cash in Hand');
                    }}
                  >
                    <Text style={styles.typeEmoji}>{type.emoji}</Text>
                    <Text style={[
                      styles.typeLabel,
                      selectedType === type.type && { color: '#FFFFFF' },
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {selectedType && (
            <>
              {/* Account Name */}
              <View style={styles.section}>
                <Text style={styles.label}>Account Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., HDFC Savings"
                  placeholderTextColor="#9CA3AF"
                  value={accountName}
                  onChangeText={setAccountName}
                />
              </View>

              {/* Bank Name */}
              {selectedType !== 'CASH' && (
                <View style={styles.section}>
                  <Text style={styles.label}>Bank Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., HDFC, ICICI, SBI"
                    placeholderTextColor="#9CA3AF"
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </View>
              )}

              {/* Balance (Bank & Cash) */}
              {selectedType !== 'CREDIT_CARD' && (
                <View style={styles.section}>
                  <Text style={styles.label}>Current Balance</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      value={balance}
                      onChangeText={(v) => setBalance(v.replace(/[^0-9.]/g, ''))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}

              {/* Credit Card Fields */}
              {selectedType === 'CREDIT_CARD' && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.label}>Credit Limit *</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.rupee}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="100000"
                        placeholderTextColor="#9CA3AF"
                        value={creditLimit}
                        onChangeText={(v) => setCreditLimit(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.label}>Current Outstanding</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.rupee}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={currentUsage}
                        onChangeText={(v) => setCurrentUsage(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.dateSection}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Bill Generation Date</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="1"
                        placeholderTextColor="#9CA3AF"
                        value={billDate}
                        onChangeText={setBillDate}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>Payment Due Date</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="15"
                        placeholderTextColor="#9CA3AF"
                        value={dueDate}
                        onChangeText={setDueDate}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Color Picker */}
              <View style={styles.section}>
                <Text style={styles.label}>Card Color</Text>
                <View style={styles.colorRow}>
                  {BANK_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c.color}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c.color },
                        selectedColor === c.color && styles.colorDotActive,
                      ]}
                      onPress={() => setSelectedColor(c.color)}
                    >
                      {selectedColor === c.color && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveBtn, loading && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editMode ? 'Update Account' : 'Save Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },

  typeRow: { gap: 10 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 8,
  },
  typeEmoji: { fontSize: 22, marginRight: 12 },
  typeLabel: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },

  textInput: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, height: 50, fontSize: 15, color: '#1A1A2E',
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingLeft: 14,
  },
  rupee: { fontSize: 20, fontWeight: '600', color: '#6B7280' },
  amountInput: { flex: 1, height: 50, fontSize: 18, fontWeight: '600', color: '#1A1A2E', paddingHorizontal: 8 },
  dateSection: { flexDirection: 'row', marginBottom: 20 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: {
    width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
  },
  colorDotActive: { borderWidth: 3, borderColor: '#1A1A2E' },

  saveBtn: {
    backgroundColor: '#6C63FF', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 12,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default AddAccountScreen;