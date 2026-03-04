import { create } from 'zustand';

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
    return get().accounts
      .filter(a => a.type === 'BANK' || a.type === 'CASH')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  },

  getTotalDebts: () => {
    return get().accounts
      .filter(a => a.type === 'CREDIT_CARD')
      .reduce((sum, a) => sum + (a.currentUsage || 0), 0);
  },

  getNetWorth: () => {
    return get().getTotalAssets() - get().getTotalDebts();
  },

  clearAccounts: () => set({ accounts: [], loading: false }),
}));

export default useAccountStore;