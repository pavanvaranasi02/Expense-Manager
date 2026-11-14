export const Theme = {
  colors: {
    // Editorial Treasury Identity (Warm Alabaster + Deep Charcoal Ink + Treasury Pine)
    primary: '#134E4A', // Treasury Pine
    primaryBright: '#0F766E',
    primaryDark: '#0F3D3A',
    primaryLight: '#E6F2F0',
    secondary: '#18181B', // Deep Charcoal Ink
    secondaryLight: '#F1EFEA',

    // Dark ink aliases (for secondary screens)
    heroStart: '#18181B',
    heroEnd: '#27272A',

    // Warm Alabaster Canvas & Paper Surfaces
    background: '#F7F6F2',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1EFEA',
    surfaceMuted: '#EAE7E0',
    canvasRecessed: '#EFECE6',

    // Signature Dark Treasury Surfaces (for flagship wealth / card modules)
    pineSurface: '#103C38',
    pineSurfaceMuted: '#164E49',
    pineBorder: '#1E5B55',
    inkSurface: '#18181B',
    inkSurfaceMuted: '#27272A',
    inkBorder: '#2E2E33',

    // Typography hierarchy
    text: '#18181B',
    textSecondary: '#3F3F46',
    textMuted: '#71717A',
    textLight: '#A1A1AA',

    // Semantic financial colors (used strictly for financial deltas & status)
    error: '#B91C1C',
    errorLight: '#FEF2F2',
    errorBackground: 'rgba(185, 28, 28, 0.08)',
    success: '#047857',
    successLight: '#ECFDF5',
    successBackground: 'rgba(4, 120, 87, 0.08)',
    warning: '#B45309',
    warningLight: '#FFFBEB',
    warningBackground: 'rgba(180, 83, 9, 0.08)',
    info: '#1D4ED8',
    infoLight: '#EFF6FF',

    // Warm stone hairlines & dividers
    border: '#E5E2DC',
    borderSubtle: '#ECEAE4',
    divider: '#ECEAE4',

    // Subtle tints
    primaryBackground: 'rgba(19, 78, 74, 0.08)',
    secondaryBackground: 'rgba(24, 24, 27, 0.05)',
    glass: 'rgba(255, 255, 255, 0.85)',
    glassBorder: 'rgba(229, 226, 220, 0.9)',
    cardShadow: '#18181B',
    googleRed: '#DB4437',
    gold: '#B45309',
    goldLight: '#FEF3C7',
    goldDark: '#78350F',
  },
  typography: {
    fontFamily: {
      regular: 'Manrope_400Regular',
      medium: 'Manrope_500Medium',
      semibold: 'Manrope_600SemiBold',
      semiBold: 'Manrope_600SemiBold',
      bold: 'Manrope_700Bold',
    },
    size: {
      xxs: 11,
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 28,
      display: 34,
    },
    weight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '700',
    },
    tabularNums: {
      fontVariant: ['tabular-nums'],
    },
    presets: {
      heroAmount: {
        fontFamily: 'Manrope_700Bold',
        fontSize: 36,
        lineHeight: 44,
        letterSpacing: -1.0,
        fontVariant: ['tabular-nums'],
      },
      displayNumber: {
        fontFamily: 'Manrope_700Bold',
        fontSize: 32,
        lineHeight: 39,
        letterSpacing: -0.8,
        fontVariant: ['tabular-nums'],
      },
      title: {
        fontFamily: 'Manrope_700Bold',
        fontSize: 21,
        lineHeight: 27,
        letterSpacing: -0.35,
      },
      screenTitle: {
        fontFamily: 'Manrope_700Bold',
        fontSize: 24,
        lineHeight: 30,
        letterSpacing: -0.5,
      },
      screenSubtitle: {
        fontFamily: 'Manrope_400Regular',
        fontSize: 13,
        lineHeight: 18,
      },
      sectionEyebrow: {
        fontFamily: 'Manrope_600SemiBold',
        fontSize: 11,
        lineHeight: 15,
        letterSpacing: 0.85,
        textTransform: 'uppercase',
      },
      cardTitle: {
        fontFamily: 'Manrope_600SemiBold',
        fontSize: 16,
        lineHeight: 22,
        letterSpacing: -0.2,
      },
      rowTitle: {
        fontFamily: 'Manrope_600SemiBold',
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: -0.1,
      },
      rowSubtitle: {
        fontFamily: 'Manrope_400Regular',
        fontSize: 12,
        lineHeight: 17,
      },
      body: {
        fontFamily: 'Manrope_400Regular',
        fontSize: 14,
        lineHeight: 20,
      },
      bodyMedium: {
        fontFamily: 'Manrope_500Medium',
        fontSize: 14,
        lineHeight: 20,
      },
      caption: {
        fontFamily: 'Manrope_500Medium',
        fontSize: 12,
        lineHeight: 16,
      },
      formLabel: {
        fontFamily: 'Manrope_600SemiBold',
        fontSize: 11,
        lineHeight: 15,
        letterSpacing: 0.85,
        textTransform: 'uppercase',
      },
      inputValue: {
        fontFamily: 'Manrope_500Medium',
        fontSize: 15,
        lineHeight: 20,
      },
      buttonLabel: {
        fontFamily: 'Manrope_600SemiBold',
        fontSize: 15,
        lineHeight: 20,
      },
      monoValue: {
        fontFamily: 'Manrope_700Bold',
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: -0.2,
        fontVariant: ['tabular-nums'],
      },
      pillLabel: {
        fontFamily: 'Manrope_600SemiBold',
        fontSize: 12,
        lineHeight: 16,
      },
    },
  },
  layout: {
    screenPaddingHorizontal: 20,
    sectionGap: 24,
    cardPadding: 16,
    componentGap: 12,
    inputHeight: 48,
    buttonHeight: 52,
    headerPaddingTop: 8,
    headerPaddingBottom: 14,
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
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    xxl: 16,
    full: 9999,
  },
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    soft: {
      shadowColor: '#18181B',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    card: {
      shadowColor: '#18181B',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    elevated: {
      shadowColor: '#18181B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    premium: {
      shadowColor: '#18181B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};
