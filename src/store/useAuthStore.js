import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  // State
  user: null,
  userProfile: null,
  isAuthenticated: false,
  isLoading: true,
  isOnboardingComplete: false,
  role: 'USER',
  isStealthMode: false,

  // Actions
  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    isLoading: false,
  }),

  setUserProfile: (profile) => {
    console.log('📝 Setting user profile:', profile ? {
      name: profile.name,
      onboardingComplete: profile.onboardingComplete,
      role: profile.role,
    } : 'null');

    set({
      userProfile: profile,
      isOnboardingComplete: profile?.onboardingComplete === true,
      role: profile?.role || 'USER',
      isStealthMode: profile?.isStealthMode === true,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setOnboardingComplete: () => {
    console.log('🎉 Onboarding marked complete');
    set((state) => ({
      isOnboardingComplete: true,
      userProfile: {
        ...state.userProfile,
        onboardingComplete: true,
      },
    }));
  },

  updateProfile: (data) => set((state) => ({
    userProfile: { ...state.userProfile, ...data },
  })),

  logout: () => {
    console.log('🔓 Clearing auth store');
    set({
      user: null,
      userProfile: null,
      isAuthenticated: false,
      isOnboardingComplete: false,
      role: 'USER',
      isLoading: false,
    });
  },
  
  setStealthMode: (isStealthMode) => set({ isStealthMode }),
  toggleStealthMode: () => set((state) => ({ isStealthMode: !state.isStealthMode })),

  // Getters
  isMaster: () => get().role === 'MASTER',
  getUserId: () => get().user?.uid || null,
  getUserName: () => get().userProfile?.name || get().user?.displayName || 'User',
  getUserEmail: () => get().user?.email || '',
}));

export default useAuthStore;