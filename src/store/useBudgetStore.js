import { create } from 'zustand';

const useBudgetStore = create((set, get) => ({
  budgets: [],
  loading: false,

  setBudgets: (budgets) => set({ budgets }),
  setLoading: (loading) => set({ loading }),

  addBudgetToStore: (budget) => set((state) => ({
    budgets: [...state.budgets, budget],
  })),

  updateBudgetInStore: (budgetId, data) => set((state) => ({
    budgets: state.budgets.map(b =>
      b.id === budgetId ? { ...b, ...data } : b
    ),
  })),

  removeBudgetFromStore: (budgetId) => set((state) => ({
    budgets: state.budgets.filter(b => b.id !== budgetId),
  })),

  clearBudgets: () => set({ budgets: [], loading: false }),
}));

export default useBudgetStore;