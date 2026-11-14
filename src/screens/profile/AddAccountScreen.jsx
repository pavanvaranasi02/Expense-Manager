import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { addAccount, updateAccount } from '../../services/accountService';
import useAccountStore from '../../store/useAccountStore';

const ACCOUNT_TYPES = [
  { type: 'BANK', label: 'Bank Account', emoji: '🏦', color: '#3B82F6' },
  { type: 'CREDIT_CARD', label: 'Credit Card', emoji: '💳', color: '#F59E0B' },
  { type: 'CASH', label: 'Cash', emoji: '💵', color: '#047857' },
];

const BANK_COLORS = [
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#0F766E' },
  { name: 'Red', color: '#B91C1C' },
  { name: 'Orange', color: '#F59E0B' },
  { name: 'Green', color: '#047857' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Gray', color: '#71717A' },
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editMode ? 'Edit Account' : 'New Account'}</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: '#E6F2F0' }]}>
                  <Ionicons name="apps" size={14} color="#134E4A" />
                </View>
                <Text style={styles.sectionTitle}>ACCOUNT TYPE</Text>
              </View>
              <View style={styles.typeRow}>
                {ACCOUNT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.type}
                    style={[
                      styles.typeChip,
                      selectedType === type.type && { backgroundColor: type.color + '10', borderColor: type.color },
                    ]}
                    onPress={() => {
                      setSelectedType(type.type);
                      if (type.type === 'CASH') setAccountName('Cash in Hand');
                    }}
                  >
                    <View style={[styles.typeIconBox, { backgroundColor: type.color + '15' }]}>
                      <Text style={styles.typeEmoji}>{type.emoji}</Text>
                    </View>
                    <Text style={[
                      styles.typeLabel,
                      selectedType === type.type && { color: type.color, fontFamily: 'Manrope_700Bold' },
                    ]}>
                      {type.label}
                    </Text>
                    {selectedType === type.type && (
                      <View style={[styles.checkBadge, { backgroundColor: type.color }]}>
                        <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {selectedType && (
            <>
              {/* Account Name */}
              <View style={styles.section}>
                <Text style={styles.label}>ACCOUNT NAME *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. HDFC Savings"
                  placeholderTextColor="#71717A"
                  value={accountName}
                  onChangeText={setAccountName}
                />
              </View>

              {/* Bank Name */}
              {selectedType !== 'CASH' && (
                <View style={styles.section}>
                  <Text style={styles.label}>BANK NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. HDFC, ICICI, SBI"
                    placeholderTextColor="#71717A"
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </View>
              )}

              {/* Balance (Bank & Cash) */}
              {selectedType !== 'CREDIT_CARD' && (
                <View style={styles.section}>
                  <Text style={styles.label}>CURRENT BALANCE</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor="#71717A"
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
                    <Text style={styles.label}>CREDIT LIMIT *</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.rupee}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="100,000"
                        placeholderTextColor="#71717A"
                        value={creditLimit}
                        onChangeText={(v) => setCreditLimit(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.label}>CURRENT OUTSTANDING</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.rupee}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0"
                        placeholderTextColor="#71717A"
                        value={currentUsage}
                        onChangeText={(v) => setCurrentUsage(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.dateSection}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>BILL CYCLE DAY</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="1"
                        placeholderTextColor="#71717A"
                        value={billDate}
                        onChangeText={setBillDate}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>DUE DAY</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="15"
                        placeholderTextColor="#71717A"
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
                <Text style={styles.label}>TAG COLOR</Text>
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
                style={[styles.saveBtnCont, loading && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#134E4A', '#4338CA']}
                  style={styles.saveBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editMode ? 'UPDATE ACCOUNT' : 'SECURE ACCOUNT'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F6F2' },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EFEA',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F7F6F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#F1EFEA',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: "#18181B", letterSpacing: -0.5 },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingLeft: 4 },
  sectionIconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sectionTitle: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: "#71717A", letterSpacing: 1.5 },
  label: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: "#71717A", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 },

  typeRow: { gap: 10 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1EFEA',
    marginBottom: 4,
    position: 'relative',
  },
  typeIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  typeEmoji: { fontSize: 22 },
  typeLabel: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#18181B', marginLeft: 12 },
  checkBadge: {
    position: 'absolute',
    right: 16,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1EFEA',
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1EFEA',
    paddingLeft: 18,
  },
  rupee: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: '#18181B' },
  amountInput: {
    flex: 1,
    height: 60,
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    paddingHorizontal: 12,
    letterSpacing: -0.5,
  },
  dateSection: { flexDirection: 'row', marginBottom: 8 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
  },

  saveBtnCont: { borderRadius: 20, overflow: 'hidden', marginTop: 12, elevation: 4, shadowColor: '#134E4A', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 } },
  saveBtn: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Manrope_700Bold', letterSpacing: 1 },
});

export default AddAccountScreen;