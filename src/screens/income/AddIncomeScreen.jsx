import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccounts } from '../../services/accountService';
import { addIncome, INCOME_SOURCES } from '../../services/incomeService';

const AddIncomeScreen = ({ navigation }) => {
  const [amount, setAmount] = useState('');
  const [selectedSource, setSelectedSource] = useState(INCOME_SOURCES[0]);
  const [note, setNote] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const result = await getAccounts();
      if (result.success) {
        const bankAccounts = result.accounts.filter(
          (a) => a.type !== 'CREDIT_CARD'
        );
        setAccounts(bankAccounts);
        if (bankAccounts.length > 0) {
          setSelectedAccount(
            bankAccounts.find((a) => a.isDefault) || bankAccounts[0]
          );
        }
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Required', 'Please enter amount');
      return;
    }

    setLoading(true);
    const result = await addIncome({
      amount,
      source: selectedSource.id,
      sourceName: selectedSource.name,
      sourceIcon: selectedSource.icon,
      accountId: selectedAccount?.id,
      accountName: selectedAccount?.name || 'Unknown',
      note,
      date: new Date(),
    });

    if (result.success) navigation.goBack();
    else Alert.alert('Error', result.error);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Income</Text>
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Amount */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount Received</Text>
              <View style={styles.amountRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="#D1D5DB"
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
            </View>

            {/* Source */}
            <Text style={styles.fieldLabel}>Income Source</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowSourceModal(true)}
            >
              <View style={styles.selectorContent}>
                <Text style={styles.selectorIcon}>{selectedSource.icon}</Text>
                <Text style={styles.selectorText}>{selectedSource.name}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Account */}
            <Text style={styles.fieldLabel}>Deposit To</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowAccountModal(true)}
            >
              {selectedAccount ? (
                <View style={styles.selectorContent}>
                  <Text style={styles.selectorIcon}>
                    {selectedAccount.type === 'CASH' ? '💵' : '🏦'}
                  </Text>
                  <View>
                    <Text style={styles.selectorText}>
                      {selectedAccount.name}
                    </Text>
                    <Text style={styles.selectorSub}>
                      Balance: ₹
                      {(selectedAccount.balance || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.selectorPlaceholder}>Select account</Text>
              )}
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Note */}
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g., June salary, Birthday gift from Dad"
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* Extra bottom spacing for keyboard */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Source Modal */}
      <Modal visible={showSourceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Source</Text>
              <TouchableOpacity onPress={() => setShowSourceModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={INCOME_SOURCES}
              numColumns={3}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sourceGridItem,
                    selectedSource.id === item.id && {
                      backgroundColor: item.color + '20',
                      borderColor: item.color,
                    },
                  ]}
                  onPress={() => {
                    setSelectedSource(item);
                    setShowSourceModal(false);
                  }}
                >
                  <Text style={styles.sourceGridIcon}>{item.icon}</Text>
                  <Text style={styles.sourceGridName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Account Modal */}
      <Modal visible={showAccountModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit To</Text>
              <TouchableOpacity onPress={() => setShowAccountModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {accounts.length === 0 ? (
              <Text style={styles.noAccText}>
                No bank or cash accounts. Add one from Profile.
              </Text>
            ) : (
              accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accOption,
                    selectedAccount?.id === acc.id && styles.accOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedAccount(acc);
                    setShowAccountModal(false);
                  }}
                >
                  <Text style={styles.accEmoji}>
                    {acc.type === 'CASH' ? '💵' : '🏦'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accName}>{acc.name}</Text>
                    <Text style={styles.accBal}>
                      ₹{(acc.balance || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  {selectedAccount?.id === acc.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#10B981"
                    />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  saveBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  amountSection: { alignItems: 'center', paddingVertical: 24 },
  amountLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupee: { fontSize: 36, fontWeight: '300', color: '#374151' },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: '#10B981',
    minWidth: 80,
    textAlign: 'center',
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },

  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  selectorContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorIcon: { fontSize: 22, marginRight: 10 },
  selectorText: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  selectorSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  selectorPlaceholder: { fontSize: 15, color: '#9CA3AF' },

  noteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 15,
    color: '#1A1A2E',
    minHeight: 80,
    textAlignVertical: 'top',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },

  sourceGridItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    margin: 4,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  sourceGridIcon: { fontSize: 24, marginBottom: 4 },
  sourceGridName: { fontSize: 11, color: '#374151', textAlign: 'center' },

  noAccText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 20,
  },
  accOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  accOptionActive: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  accEmoji: { fontSize: 24, marginRight: 12 },
  accName: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  accBal: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});

export default AddIncomeScreen;