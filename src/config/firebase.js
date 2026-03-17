import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const getEnvVar = (processEnvKey, constantsKey) => {
  // 1. Check Constants.expoConfig.extra first (Correct way for Builds/Config)
  const fromConstants = Constants.expoConfig?.extra?.[constantsKey];
  if (fromConstants && !fromConstants.startsWith('$(')) return fromConstants;

  // 2. Fallback to process.env (Local dev only)
  const fromEnv = process.env[processEnvKey];
  if (fromEnv) return fromEnv;

  return undefined;
};

const firebaseApiKey = getEnvVar('EXPO_PUBLIC_FIREBASE_API_KEY', 'firebaseApiKey');
const firebaseAuthDomain = getEnvVar('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'firebaseAuthDomain');
const firebaseProjectId = getEnvVar('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'firebaseProjectId');
const firebaseStorageBucket = getEnvVar('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'firebaseStorageBucket');
const firebaseMessagingSenderId = getEnvVar('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'firebaseMessagingSenderId');
const firebaseAppId = getEnvVar('EXPO_PUBLIC_FIREBASE_APP_ID', 'firebaseAppId');
const firebaseMeasurementId = getEnvVar('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID', 'firebaseMeasurementId');

// ============ VALIDATE CONFIG ============
// Fail fast in dev if any required key is missing
const REQUIRED_CONFIG = {
  firebaseApiKey,
  firebaseAuthDomain,
  firebaseProjectId,
  firebaseStorageBucket,
  firebaseMessagingSenderId,
  firebaseAppId,
};

if (__DEV__) {
  const missingKeys = Object.entries(REQUIRED_CONFIG)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    console.error(
      '❌ Firebase config — missing environment variables:',
      missingKeys,
      '\n👉 Make sure your .env file exists in the project root and has all EXPO_PUBLIC_FIREBASE_* keys.',
      '\n👉 Restart the dev server with: npx expo start --clear'
    );
  } else {
    console.log('✅ Firebase config loaded from environment variables');
  }
}

console.log("API KEY:", process.env.EXPO_PUBLIC_FIREBASE_API_KEY);

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: firebaseAuthDomain,
  projectId: firebaseProjectId,
  storageBucket: firebaseStorageBucket,
  messagingSenderId: firebaseMessagingSenderId,
  appId: firebaseAppId,
  measurementId: firebaseMeasurementId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Already initialized — happens during Fast Refresh in dev
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

let analytics = null;

const initAnalytics = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(app);
      if (__DEV__) console.log('✅ Firebase Analytics initialized');
    } else {
      if (__DEV__) {
        console.log(
          'ℹ️ Firebase Analytics not supported in this environment.',
          'Events will be logged to console in DEV mode.'
        );
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.log('ℹ️ Firebase Analytics skipped:', error.message);
    }
  }
};

initAnalytics();

export const logAnalyticsEvent = (eventName, params = {}) => {
  try {
    if (analytics) {
      logEvent(analytics, eventName, params);
    } else if (__DEV__) {
      // Console logging acts as analytics in development
      console.log(`📊 [Analytics Event] ${eventName}`, params);
    }
  } catch (error) {
    if (__DEV__) {
      console.log('❌ Analytics logEvent error:', error.message);
    }
  }
};

export const Analytics = {

  // ── Auth ──────────────────────────────────────────────
  login: (method = 'email') =>
    logAnalyticsEvent('login', { method }),

  signUp: (method = 'email') =>
    logAnalyticsEvent('sign_up', { method }),

  logout: () =>
    logAnalyticsEvent('logout'),

  forgotPassword: () =>
    logAnalyticsEvent('forgot_password'),

  // ── Onboarding ────────────────────────────────────────
  onboardingStep: (step) =>
    logAnalyticsEvent('onboarding_step', { step }),

  onboardingComplete: () =>
    logAnalyticsEvent('onboarding_complete'),

  // ── Expenses ──────────────────────────────────────────
  addExpense: (category, amount) =>
    logAnalyticsEvent('add_expense', { category, amount }),

  editExpense: (category) =>
    logAnalyticsEvent('edit_expense', { category }),

  deleteExpense: (category) =>
    logAnalyticsEvent('delete_expense', { category }),

  // ── Income ────────────────────────────────────────────
  addIncome: (source, amount) =>
    logAnalyticsEvent('add_income', { source, amount }),

  deleteIncome: (source) =>
    logAnalyticsEvent('delete_income', { source }),

  // ── Accounts ──────────────────────────────────────────
  addAccount: (type) =>
    logAnalyticsEvent('add_account', { account_type: type }),

  editAccount: (type) =>
    logAnalyticsEvent('edit_account', { account_type: type }),

  deleteAccount: (type) =>
    logAnalyticsEvent('delete_account', { account_type: type }),

  // ── Budgets ───────────────────────────────────────────
  setBudget: (type, amount) =>
    logAnalyticsEvent('set_budget', { budget_type: type, amount }),

  editBudget: (type) =>
    logAnalyticsEvent('edit_budget', { budget_type: type }),

  deleteBudget: () =>
    logAnalyticsEvent('delete_budget'),

  budgetAlert: (category, percentUsed) =>
    logAnalyticsEvent('budget_alert', {
      category,
      percent_used: percentUsed,
    }),

  // ── Investments ───────────────────────────────────────
  addInvestment: (investmentType) =>
    logAnalyticsEvent('add_investment', { investment_type: investmentType }),

  updateInvestmentValue: (investmentType) =>
    logAnalyticsEvent('update_investment_value', {
      investment_type: investmentType,
    }),

  confirmSip: (amount) =>
    logAnalyticsEvent('confirm_sip', { amount }),

  skipSip: () =>
    logAnalyticsEvent('skip_sip'),

  deleteInvestment: (investmentType) =>
    logAnalyticsEvent('delete_investment', {
      investment_type: investmentType,
    }),

  // ── Categories ────────────────────────────────────────
  addCategory: () =>
    logAnalyticsEvent('add_category'),

  editCategory: () =>
    logAnalyticsEvent('edit_category'),

  deleteCategory: () =>
    logAnalyticsEvent('delete_category'),

  // ── Settings ──────────────────────────────────────────
  changeCurrency: (currency) =>
    logAnalyticsEvent('change_currency', { currency }),

  toggleInvestmentsInNetWorth: (enabled) =>
    logAnalyticsEvent('toggle_investments_net_worth', { enabled }),

  // ── Screens ───────────────────────────────────────────
  // Call this in useFocusEffect on important screens
  screenView: (screenName) =>
    logAnalyticsEvent('screen_view', { screen_name: screenName }),

  // ── Family Events ────────────────────────────────────
  createFamily: (name) =>
    logAnalyticsEvent('create_family', { family_name: name }),

  joinFamily: () =>
    logAnalyticsEvent('join_family'),

  leaveFamily: () =>
    logAnalyticsEvent('leave_family'),

  deleteFamily: () =>
    logAnalyticsEvent('delete_family'),

  inviteFamily: (method) =>
    logAnalyticsEvent('invite_family', { method }), // 'copy' or 'share'

  promoteToCoAdmin: () =>
    logAnalyticsEvent('promote_to_coadmin'),

  removeFamilyMember: () =>
    logAnalyticsEvent('remove_family_member'),

  transferOwnership: () =>
    logAnalyticsEvent('transfer_ownership'),

  // ── Notifications ───────────────────────────────────
  viewNotifications: () =>
    logAnalyticsEvent('view_notifications'),

  clearNotifications: () =>
    logAnalyticsEvent('clear_notifications'),

  // ── Family Expenses ──────────────────────────────────
  addFamilyExpense: (category, amount) =>
    logAnalyticsEvent('add_family_expense', { category, amount }),

  editFamilyExpense: (category) =>
    logAnalyticsEvent('edit_family_expense', { category }),

  deleteFamilyExpense: (category) =>
    logAnalyticsEvent('delete_family_expense', { category }),

  // ── Family Budget ────────────────────────────────────
  setFamilyBudget: (overall, categories_count) =>
    logAnalyticsEvent('set_family_budget', { overall, categories_count }),

  deleteFamilyBudget: () =>
    logAnalyticsEvent('delete_family_budget'),

  // ── Family Analytics ─────────────────────────────────
  viewFamilyAnalytics: () =>
    logAnalyticsEvent('view_family_analytics'),
  
};

export { analytics, app, auth, db, storage };
