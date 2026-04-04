import { Platform } from 'react-native';

export const Theme = {
  colors: {
    primary: '#6C63FF', // Kosh Purple
    primaryDark: '#4F46E5', // Indigo 600
    primaryLight: '#E0E7FF', // Indigo 100
    secondary: '#8B5CF6', // Violet 600
    secondaryLight: '#F3E8FF', // Violet 100
    background: '#F8F9FE',
    surface: '#FFFFFF',
    text: '#1E293B', // Slate 800
    textMuted: '#64748B', // Slate 500
    textLight: '#94A3B8', // Slate 400
    error: '#EF4444',
    errorLight: '#FEE2E2',
    errorBackground: 'rgba(239, 68, 68, 0.1)',
    success: '#10B981',
    successLight: '#D1FAE5',
    successBackground: 'rgba(16, 185, 129, 0.1)',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    border: '#F1F5F9',
    divider: '#F1F5F9',
    primaryBackground: 'rgba(108, 99, 255, 0.08)',
    secondaryBackground: 'rgba(139, 92, 246, 0.05)',
    glass: 'rgba(255, 255, 255, 0.4)',
    glassBorder: 'rgba(255, 255, 255, 0.6)',
    cardShadow: '#64748B',
    googleRed: '#DB4437',
    gold: '#FFD700',
    goldLight: '#FFEC8B',
    goldDark: '#B8860B',
  },
  typography: {
    fontFamily: {
      regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
      bold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
    },
    size: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 28,
    },
    weight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 9999,
  },
  shadows: {
    soft: {
      shadowColor: '#1E293B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    card: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 4,
    },
    elevated: {
      shadowColor: '#6C63FF',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 8,
    },
    premium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 15 },
      shadowOpacity: 0.18,
      shadowRadius: 30,
      elevation: 12,
    },
  }
};

