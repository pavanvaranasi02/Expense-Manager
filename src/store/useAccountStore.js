import { create } from 'zustand';
import { calculateAccountTotals } from '../services/financialCalculationService';

const useAccountStore = create((set, get) => ({
  accounts: [],
  loading: false,

  setAccounts: (accounts) => set({ accounts }),
  setLoading: (loading) => set({ loading }),

  addAccountToStore: (account) => set((state) => ({
    accounts: [...state.accounts, account],
  })),

  updateAccountInStore: (accountId, data) => set((state) => ({
    accounts: state.accounts.map(acc =>
      acc.id === accountId ? { ...acc, ...data } : acc
    ),
  })),

  removeAccountFromStore: (accountId) => set((state) => ({
    accounts: state.accounts.filter(acc => acc.id !== accountId),
  })),

  // Getters
  getBankAccounts: () => get().accounts.filter(a => a.type === 'BANK'),
  getCreditCards: () => get().accounts.filter(a => a.type === 'CREDIT_CARD'),
  getCashAccounts: () => get().accounts.filter(a => a.type === 'CASH'),

  getTotalAssets: () => {
    return calculateAccountTotals(get().accounts, null, {
      includeInvestmentsInAssets: false,
    }).totalAssets;
  },

  getTotalDebts: () => {
    return calculateAccountTotals(get().accounts, null, {
      includeInvestmentsInAssets: false,
    }).totalLiabilities;
  },

  getNetWorth: () => {
    return calculateAccountTotals(get().accounts, null, {
      includeInvestmentsInAssets: false,
    }).netWorth;
  },

  clearAccounts: () => set({ accounts: [], loading: false }),
}));

export default useAccountStore;