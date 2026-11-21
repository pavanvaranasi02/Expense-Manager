import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { logUserAction } from './activityLogService';
import {
  addLocalDoc,
  deleteLocalDoc,
  getLocalCollection,
  getLocalDoc,
  isLocalMode,
  LOCAL_COLLECTIONS,
  updateLocalDoc,
} from './localStorageService';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

export const INSURANCE_TYPES = [
  { id: 'health', name: 'Health', fullName: 'Health Insurance', icon: 'heart-outline', color: '#10B981', bg: '#ECFDF5' },
  { id: 'term', name: 'Term Life', fullName: 'Term Life Insurance', icon: 'shield-checkmark-outline', color: '#6366F1', bg: '#EEF2FF' },
  { id: 'car', name: 'Car', fullName: 'Car / Motor Insurance', icon: 'car-outline', color: '#F59E0B', bg: '#FFFBEB' },
];

export const PREMIUM_FREQUENCIES = [
  { id: 'yearly', label: 'Yearly', months: 12 },
  { id: 'half_yearly', label: 'Half-Yearly', months: 6 },
  { id: 'quarterly', label: 'Quarterly', months: 3 },
  { id: 'monthly', label: 'Monthly', months: 1 },
  { id: 'one_time', label: 'One-Time', months: 0 },
];

const getFrequencyAnnualMultiplier = (freqId) => {
  switch (freqId) {
    case 'monthly': return 12;
    case 'quarterly': return 4;
    case 'half_yearly': return 2;
    case 'yearly': return 1;
    default: return 0;
  }
};

export const advanceDueDate = (dateStr, frequencyId) => {
  const freq = PREMIUM_FREQUENCIES.find((f) => f.id === frequencyId);
  if (!freq || !freq.months || !dateStr) return dateStr || '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  parsed.setMonth(parsed.getMonth() + freq.months);
  return parsed.toISOString().split('T')[0];
};

export const getInsurances = async () => {
  try {
    const userId = getUserId();
    if (await isLocalMode()) {
      const items = await getLocalCollection(LOCAL_COLLECTIONS.INSURANCES);
      return {
        success: true,
        insurances: items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
      };
    }

    const q = query(collection(db, 'users', userId, 'insurances'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const insurances = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, insurances };
  } catch (error) {
    console.error('getInsurances error:', error);
    return { success: false, insurances: [], error: error.message };
  }
};

export const addInsurance = async (data) => {
  try {
    const userId = getUserId();
    const typeMeta = INSURANCE_TYPES.find((t) => t.id === data.type) || INSURANCE_TYPES[0];
    const policy = {
      type: typeMeta.id,
      typeName: typeMeta.fullName,
      name: data.name.trim(),
      insurer: data.insurer?.trim() || '',
      policyNumber: data.policyNumber?.trim() || '',
      sumInsured: parseFloat(data.sumInsured) || 0,
      premiumAmount: parseFloat(data.premiumAmount) || 0,
      frequency: data.frequency || 'yearly',
      startDate: data.startDate?.trim() || '',
      nextDueDate: data.nextDueDate?.trim() || '',
      coveredMembers: data.coveredMembers?.trim() || '',
      nomineeName: data.nomineeName?.trim() || '',
      coverTillAge: data.coverTillAge ? parseInt(data.coverTillAge, 10) : null,
      vehicleNumber: data.vehicleNumber?.trim()?.toUpperCase() || '',
      idvAmount: data.idvAmount ? parseFloat(data.idvAmount) : null,
      ncbPercent: data.ncbPercent !== '' && data.ncbPercent !== undefined ? parseFloat(data.ncbPercent) : null,
      note: data.note?.trim() || '',
      paymentHistory: [],
      isActive: true,
    };

    if (await isLocalMode()) {
      const saved = await addLocalDoc(LOCAL_COLLECTIONS.INSURANCES, policy);
      await logUserAction('ADD_INSURANCE', { id: saved.id, type: policy.type, name: policy.name });
      return { success: true, id: saved.id, insurance: saved };
    }

    const ref = await addDoc(collection(db, 'users', userId, 'insurances'), {
      ...policy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logUserAction('ADD_INSURANCE', { id: ref.id, type: policy.type, name: policy.name });
    return { success: true, id: ref.id, insurance: { id: ref.id, ...policy } };
  } catch (error) {
    console.error('addInsurance error:', error);
    return { success: false, error: error.message };
  }
};

export const updateInsurance = async (id, updates) => {
  try {
    const userId = getUserId();
    const typeMeta = INSURANCE_TYPES.find((t) => t.id === updates.type);
    const payload = {
      ...updates,
      ...(typeMeta ? { typeName: typeMeta.fullName } : {}),
    };

    if (await isLocalMode()) {
      await updateLocalDoc(LOCAL_COLLECTIONS.INSURANCES, id, payload);
      return { success: true };
    }

    await updateDoc(doc(db, 'users', userId, 'insurances', id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('updateInsurance error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteInsurance = async (id) => {
  try {
    const userId = getUserId();
    if (await isLocalMode()) {
      await deleteLocalDoc(LOCAL_COLLECTIONS.INSURANCES, id);
      return { success: true };
    }

    await deleteDoc(doc(db, 'users', userId, 'insurances', id));
    return { success: true };
  } catch (error) {
    console.error('deleteInsurance error:', error);
    return { success: false, error: error.message };
  }
};

export const markPremiumPaid = async (id, paidDate = new Date().toISOString().split('T')[0]) => {
  try {
    const userId = getUserId();
    let current;

    if (await isLocalMode()) {
      current = await getLocalDoc(LOCAL_COLLECTIONS.INSURANCES, id);
    } else {
      const snap = await getDoc(doc(db, 'users', userId, 'insurances', id));
      if (snap.exists()) current = { id: snap.id, ...snap.data() };
    }

    if (!current) return { success: false, error: 'Policy not found' };

    const nextDueDate = advanceDueDate(current.nextDueDate || paidDate, current.frequency);
    const entry = {
      id: `${Date.now()}`,
      amount: Number(current.premiumAmount) || 0,
      paidDate,
    };
    const paymentHistory = [entry, ...(current.paymentHistory || [])];

    return await updateInsurance(id, { nextDueDate, paymentHistory });
  } catch (error) {
    console.error('markPremiumPaid error:', error);
    return { success: false, error: error.message };
  }
};

export const getDaysUntilRenewal = (nextDueDate) => {
  if (!nextDueDate) return null;
  const due = new Date(nextDueDate);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const calculateInsuranceTotals = (insurances = []) => {
  const active = insurances.filter((p) => p.isActive !== false);
  let totalCoverage = 0;
  let annualPremium = 0;
  let upcomingRenewals = 0;

  for (const p of active) {
    totalCoverage += Number(p.sumInsured) || 0;
    const mult = getFrequencyAnnualMultiplier(p.frequency);
    annualPremium += (Number(p.premiumAmount) || 0) * mult;
    const days = getDaysUntilRenewal(p.nextDueDate);
    if (days !== null && days <= 30) upcomingRenewals += 1;
  }

  return {
    activeCount: active.length,
    totalCoverage,
    annualPremium,
    upcomingRenewals,
  };
};
