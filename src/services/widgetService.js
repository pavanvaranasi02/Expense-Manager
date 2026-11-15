import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateAccountTotals } from './financialCalculationService';
import { formatCurrency } from '../utils/format';

export const WIDGET_STORAGE_KEY = '@kosh_widget_snapshot_v1';
export const WIDGET_NAME = 'KoshQuickExpenseWidget';

export const WIDGET_DEEP_LINKS = Object.freeze({
  HOME: 'kosh://',
  ADD_EXPENSE: 'kosh://add-expense',
  HISTORY: 'kosh://history?filter=all',
  addExpenseWithCategory: (categoryId) =>
    `kosh://add-expense?categoryId=${encodeURIComponent(categoryId)}`,
});

export const DEFAULT_QUICK_CATEGORIES = Object.freeze([
  { id: 'food', label: 'Food', icon: '🍕' },
  { id: 'travel', label: 'Travel', icon: '🚗' },
  { id: 'groceries', label: 'Groceries', icon: '🥬' },
  { id: 'bills', label: 'Bills', icon: '📱' },
]);

/**
 * Pure snapshot builder for Home Screen Widgets (Android & iOS).
 * Combines all active BANK account balances and keeps CASH (Cash in Hand) separate.
 */
export const buildWidgetSnapshot = (accounts = [], options = {}) => {
  const {
    currencySymbol = '₹',
    isStealthMode = false,
    updatedAt = new Date().toISOString(),
  } = options;

  const activeAccounts = (accounts || []).filter((a) => a && a.isActive !== false);
  const bankAccountCount = activeAccounts.filter((a) => a.type === 'BANK').length;
  const cashAccountCount = activeAccounts.filter((a) => a.type === 'CASH').length;

  const totals = calculateAccountTotals(activeAccounts, null, {
    includeInvestmentsInAssets: false,
  });

  const bankBalance = totals.bankBalance;
  const cashBalance = totals.cashBalance;

  return {
    bankBalance,
    cashBalance,
    formattedBankBalance: formatCurrency(bankBalance, isStealthMode, currencySymbol),
    formattedCashBalance: formatCurrency(cashBalance, isStealthMode, currencySymbol),
    bankAccountCount,
    cashAccountCount,
    currencySymbol,
    isStealthMode: Boolean(isStealthMode),
    quickCategories: DEFAULT_QUICK_CATEGORIES,
    updatedAt,
  };
};

export const getDefaultWidgetSnapshot = () =>
  buildWidgetSnapshot([], {
    currencySymbol: '₹',
    isStealthMode: false,
  });

export const saveWidgetSnapshot = async (snapshot) => {
  try {
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(snapshot));
    return { success: true };
  } catch (error) {
    console.log('⚠️ Failed to save widget snapshot:', error?.message || error);
    return { success: false, error: error?.message || 'Storage error' };
  }
};

export const loadWidgetSnapshot = async () => {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return getDefaultWidgetSnapshot();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return getDefaultWidgetSnapshot();
    }
    return {
      ...getDefaultWidgetSnapshot(),
      ...parsed,
      quickCategories:
        Array.isArray(parsed.quickCategories) && parsed.quickCategories.length > 0
          ? parsed.quickCategories
          : DEFAULT_QUICK_CATEGORIES,
    };
  } catch (error) {
    console.log('⚠️ Failed to load widget snapshot:', error?.message || error);
    return getDefaultWidgetSnapshot();
  }
};

/**
 * Push a prepared snapshot to the OS Home Screen Widget (Android / iOS).
 * Safe no-op on Web, Node test environments, or when native widget module is unavailable.
 */
export const pushWidgetSnapshot = async (snapshot) => {
  try {
    const { Platform } = require('react-native');

    if (Platform.OS === 'android') {
      const React = require('react');
      const { requestWidgetUpdate } = require('react-native-android-widget');
      const { default: KoshAndroidWidget } = require('../widgets/KoshAndroidWidget');

      await requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: (widgetInfo) =>
          React.createElement(KoshAndroidWidget, {
            snapshot,
            width: widgetInfo?.width,
            height: widgetInfo?.height,
          }),
        widgetNotFound: () => {
          // No widget pinned on home screen yet; ignore silently
        },
      });
    } else if (Platform.OS === 'ios') {
      const { default: KoshIosWidget } = require('../widgets/KoshIosWidget');
      if (KoshIosWidget && typeof KoshIosWidget.updateSnapshot === 'function') {
        KoshIosWidget.updateSnapshot(snapshot);
      }
    }
  } catch (error) {
    // Non-fatal: widget update may be unavailable in Expo Go, web, or tests
    console.log('⚠️ Widget push skipped:', error?.message || error);
  }
};

/**
 * Refresh the widget snapshot from current accounts & user preferences,
 * persist to AsyncStorage, and update active home screen widgets.
 */
export const refreshWidgetSnapshot = async (accountsOverride = null) => {
  try {
    const { getCurrencySymbol } = require('../constants/currencies');
    const useAuthStore = require('../store/useAuthStore').default;
    const authState = useAuthStore.getState();

    if (!authState?.isAuthenticated && !accountsOverride) {
      return null;
    }

    let accounts = accountsOverride;
    if (!Array.isArray(accounts)) {
      const { getAccounts } = require('./accountService');
      const res = await getAccounts();
      if (!res?.success) return null;
      accounts = res.accounts || [];
    }

    const userProfile = authState?.userProfile;
    const currencySymbol =
      userProfile?.currencySymbol || getCurrencySymbol(userProfile?.currency, '₹');
    const isStealthMode = Boolean(authState?.isStealthMode);

    const snapshot = buildWidgetSnapshot(accounts, {
      currencySymbol,
      isStealthMode,
    });

    await saveWidgetSnapshot(snapshot);
    await pushWidgetSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    console.log('⚠️ refreshWidgetSnapshot error:', error?.message || error);
    return null;
  }
};
