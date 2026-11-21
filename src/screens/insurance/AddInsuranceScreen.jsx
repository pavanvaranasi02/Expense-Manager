import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppAlert as Alert } from '../../components/ui/AppAlert';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { getCurrencySymbol } from '../../constants/currencies';
import {
  addInsurance,
  INSURANCE_TYPES,
  PREMIUM_FREQUENCIES,
  updateInsurance,
} from '../../services/insuranceService';
import useAuthStore from '../../store/useAuthStore';
import { Theme } from '../../theme/theme';

const cleanDecimal = (v) => v.replace(/[^0-9.]/g, '');

const AddInsuranceScreen = ({ navigation, route }) => {
  const editMode = Boolean(route?.params?.editMode && route?.params?.policy);
  const existing = route?.params?.policy || {};
  const initialType = route?.params?.initialType || 'health';

  const userProfile = useAuthStore((s) => s.userProfile);
  const cs = userProfile?.currencySymbol || getCurrencySymbol(userProfile?.currency, '₹');

  const [type, setType] = useState(existing.type || initialType);
  const [name, setName] = useState(existing.name || '');
  const [insurer, setInsurer] = useState(existing.insurer || '');
  const [policyNumber, setPolicyNumber] = useState(existing.policyNumber || '');
  const [sumInsured, setSumInsured] = useState(
    existing.sumInsured ? String(existing.sumInsured) : ''
  );
  const [premiumAmount, setPremiumAmount] = useState(
    existing.premiumAmount ? String(existing.premiumAmount) : ''
  );
  const [frequency, setFrequency] = useState(existing.frequency || 'yearly');
  const [startDate, setStartDate] = useState(existing.startDate || '');
  const [nextDueDate, setNextDueDate] = useState(existing.nextDueDate || '');
  const [coveredMembers, setCoveredMembers] = useState(existing.coveredMembers || '');
  const [nomineeName, setNomineeName] = useState(existing.nomineeName || '');
  const [coverTillAge, setCoverTillAge] = useState(
    existing.coverTillAge ? String(existing.coverTillAge) : ''
  );
  const [vehicleNumber, setVehicleNumber] = useState(existing.vehicleNumber || '');
  const [idvAmount, setIdvAmount] = useState(
    existing.idvAmount ? String(existing.idvAmount) : ''
  );
  const [ncbPercent, setNcbPercent] = useState(
    existing.ncbPercent !== null && existing.ncbPercent !== undefined
      ? String(existing.ncbPercent)
      : ''
  );
  const [note, setNote] = useState(existing.note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a policy name.');
      return;
    }
    if (!sumInsured || Number.isNaN(parseFloat(sumInsured))) {
      Alert.alert('Required', 'Please enter the sum insured / coverage amount.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type,
        name: name.trim(),
        insurer: insurer.trim(),
        policyNumber: policyNumber.trim(),
        sumInsured: parseFloat(sumInsured) || 0,
        premiumAmount: parseFloat(premiumAmount) || 0,
        frequency,
        startDate: startDate.trim(),
        nextDueDate: nextDueDate.trim(),
        coveredMembers: type === 'health' ? coveredMembers.trim() : '',
        nomineeName: type === 'term' ? nomineeName.trim() : '',
        coverTillAge: type === 'term' && coverTillAge ? parseInt(coverTillAge, 10) : null,
        vehicleNumber: type === 'car' ? vehicleNumber.trim().toUpperCase() : '',
        idvAmount: type === 'car' && idvAmount ? parseFloat(idvAmount) : null,
        ncbPercent: type === 'car' && ncbPercent !== '' ? parseFloat(ncbPercent) : null,
        note: note.trim(),
      };

      const res = editMode
        ? await updateInsurance(existing.id, payload)
        : await addInsurance(payload);

      if (res.success) {
        navigation.goBack();
      } else {
        Alert.alert('Error', res.error || 'Could not save insurance policy.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title={editMode ? 'Edit Policy' : 'Add Insurance'}
        subtitle="Health, Term Life & Car"
        showBack
        navigation={navigation}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Policy Type */}
          <Text style={styles.label}>Insurance Type</Text>
          <View style={styles.typeRow}>
            {INSURANCE_TYPES.map((t) => {
              const active = type === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typePill,
                    active && { borderColor: t.color, backgroundColor: t.bg },
                  ]}
                  onPress={() => setType(t.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={t.icon}
                    size={18}
                    color={active ? t.color : Theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typePillText,
                      active && { color: t.color, fontWeight: '700' },
                    ]}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Policy Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={
              type === 'health'
                ? 'e.g. HDFC Ergo Optima Restore'
                : type === 'term'
                  ? 'e.g. Max Life Smart Secure Plus'
                  : 'e.g. Honda City Comprehensive'
            }
            placeholderTextColor={Theme.colors.textMuted}
          />

          <Text style={styles.label}>Insurer / Provider</Text>
          <TextInput
            style={styles.input}
            value={insurer}
            onChangeText={setInsurer}
            placeholder="e.g. HDFC Ergo, LIC, ICICI Lombard"
            placeholderTextColor={Theme.colors.textMuted}
          />

          <Text style={styles.label}>Policy Number (Optional)</Text>
          <TextInput
            style={styles.input}
            value={policyNumber}
            onChangeText={setPolicyNumber}
            placeholder="e.g. POL-12345678"
            placeholderTextColor={Theme.colors.textMuted}
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sum Insured ({cs}) *</Text>
              <TextInput
                style={styles.input}
                value={sumInsured}
                onChangeText={(v) => setSumInsured(cleanDecimal(v))}
                placeholder="1000000"
                placeholderTextColor={Theme.colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Premium ({cs})</Text>
              <TextInput
                style={styles.input}
                value={premiumAmount}
                onChangeText={(v) => setPremiumAmount(cleanDecimal(v))}
                placeholder="18500"
                placeholderTextColor={Theme.colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.label}>Premium Frequency</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.freqRow}
          >
            {PREMIUM_FREQUENCIES.map((f) => {
              const active = frequency === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.freqChip, active && styles.freqChipActive]}
                  onPress={() => setFrequency(f.id)}
                >
                  <Text style={[styles.freqChipText, active && styles.freqChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-04-01"
                placeholderTextColor={Theme.colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Next Due (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={nextDueDate}
                onChangeText={setNextDueDate}
                placeholder="2027-04-01"
                placeholderTextColor={Theme.colors.textMuted}
              />
            </View>
          </View>

          {/* Health-specific */}
          {type === 'health' && (
            <>
              <Text style={styles.label}>Covered Members</Text>
              <TextInput
                style={styles.input}
                value={coveredMembers}
                onChangeText={setCoveredMembers}
                placeholder="e.g. Self, Spouse, Parents"
                placeholderTextColor={Theme.colors.textMuted}
              />
            </>
          )}

          {/* Term-specific */}
          {type === 'term' && (
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nominee Name</Text>
                <TextInput
                  style={styles.input}
                  value={nomineeName}
                  onChangeText={setNomineeName}
                  placeholder="e.g. Spouse / Parent"
                  placeholderTextColor={Theme.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cover Till Age</Text>
                <TextInput
                  style={styles.input}
                  value={coverTillAge}
                  onChangeText={(v) => setCoverTillAge(v.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 65"
                  placeholderTextColor={Theme.colors.textMuted}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
            </View>
          )}

          {/* Car-specific */}
          {type === 'car' && (
            <>
              <Text style={styles.label}>Vehicle Registration No.</Text>
              <TextInput
                style={styles.input}
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder="e.g. KA01AB1234"
                autoCapitalize="characters"
                placeholderTextColor={Theme.colors.textMuted}
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>IDV ({cs})</Text>
                  <TextInput
                    style={styles.input}
                    value={idvAmount}
                    onChangeText={(v) => setIdvAmount(cleanDecimal(v))}
                    placeholder="650000"
                    placeholderTextColor={Theme.colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>NCB (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={ncbPercent}
                    onChangeText={(v) => setNcbPercent(cleanDecimal(v))}
                    placeholder="20"
                    placeholderTextColor={Theme.colors.textMuted}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>
            </>
          )}

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={note}
            onChangeText={setNote}
            placeholder="Agent contact, riders, claim helpline..."
            placeholderTextColor={Theme.colors.textMuted}
            multiline
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>
                {editMode ? 'Update Policy' : 'Save Policy'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scrollContent: { padding: Theme.spacing.md, paddingBottom: 48 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
  },
  typePillText: { fontSize: 13, fontWeight: '600', color: Theme.colors.textSecondary },
  input: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: Theme.colors.textPrimary,
  },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  freqRow: { gap: 8, paddingVertical: 2 },
  freqChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  freqChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  freqChipText: { fontSize: 13, fontWeight: '600', color: Theme.colors.textSecondary },
  freqChipTextActive: { color: '#FFFFFF' },
  saveBtn: {
    marginTop: 22,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

export default AddInsuranceScreen;
