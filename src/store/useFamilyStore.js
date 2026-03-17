import { create } from 'zustand';
import { auth } from '../config/firebase';

const useFamilyStore = create((set, get) => ({
  family: null,
  members: [],
  loading: false,

  // NEW: Expenses state
  expenses: [],
  expensesLoading: false,

  // NEW: Budget state
  budget: null,
  budgetLoading: false,

  setFamily: (family) => set({ family }),
  setMembers: (members) => set({ members }),
  setLoading: (loading) => set({ loading }),

  // NEW: Expense setters
  setExpenses: (expenses) => set({ expenses }),
  setExpensesLoading: (expensesLoading) => set({ expensesLoading }),

  addExpenseToStore: (expense) =>
    set((state) => ({
      expenses: [expense, ...state.expenses],
    })),

  updateExpenseInStore: (expenseId, data) =>
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === expenseId ? { ...e, ...data } : e)),
    })),

  removeExpenseFromStore: (expenseId) =>
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== expenseId),
    })),

  // NEW: Budget setters
  setBudget: (budget) => set({ budget }),
  setBudgetLoading: (budgetLoading) => set({ budgetLoading }),

  addMemberToStore: (member) =>
    set((state) => ({
      members: [...state.members, member],
      family: state.family
        ? { ...state.family, memberCount: state.members.length + 1 }
        : null,
    })),

  removeMemberFromStore: (userId) =>
    set((state) => {
      const updatedMembers = state.members.filter((m) => m.userId !== userId);
      return {
        members: updatedMembers,
        family: state.family
          ? { ...state.family, memberCount: updatedMembers.length }
          : null,
      };
    }),

  updateMemberInStore: (userId, data) =>
    set((state) => ({
      members: state.members.map((m) => (m.userId === userId ? { ...m, ...data } : m)),
    })),

  updateFamilyInStore: (data) =>
    set((state) => ({
      family: state.family ? { ...state.family, ...data } : null,
    })),

  // Getters
  isOwner: () => {
    const family = get().family;
    const userId = auth.currentUser?.uid;
    return family?.ownerId === userId;
  },

  isCoAdmin: () => {
    const family = get().family;
    const userId = auth.currentUser?.uid;
    return family?.coAdminId === userId;
  },

  canManageMembers: () => {
    return get().isOwner() || get().isCoAdmin();
  },

  getMemberCount: () => get().members.length,

  getCurrentUserRole: () => {
    const userId = auth.currentUser?.uid;
    const member = get().members.find((m) => m.userId === userId);
    return member?.role || null;
  },

  clearFamily: () =>
    set({
      family: null,
      members: [],
      loading: false,
      expenses: [],
      expensesLoading: false,
      budget: null,
      budgetLoading: false,
    }),
}));

export default useFamilyStore;