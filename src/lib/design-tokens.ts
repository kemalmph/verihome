// VeriHome Design Tokens — extracted from Stitch project 10150202233806739775

export const colors = {
  // Brand
  primaryGreen: '#1A7A5E',
  darkNavy: '#0D2137',
  lightGreenBg: '#E8F5F0',
  textPrimary: '#333333',
  textMuted: '#888888',
  borderColor: '#CCCCCC',

  // Material color system
  primary: '#006048',
  primaryContainer: '#1A7A5E',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#ADFFDE',
  primaryFixed: '#9CF4D1',
  primaryFixedDim: '#80D7B6',
  onPrimaryFixed: '#002116',
  onPrimaryFixedVariant: '#00513C',

  secondary: '#4D6079',
  secondaryContainer: '#CEE1FF',
  onSecondary: '#FFFFFF',
  onSecondaryContainer: '#52647D',
  secondaryFixed: '#D2E4FF',
  secondaryFixedDim: '#B5C8E5',
  onSecondaryFixed: '#081C32',
  onSecondaryFixedVariant: '#364860',

  tertiary: '#4A5753',
  tertiaryContainer: '#636F6B',
  onTertiary: '#FFFFFF',
  tertiaryFixed: '#D8E5E0',
  tertiaryFixedDim: '#BCC9C5',

  surface: '#FBF9F8',
  surfaceBright: '#FBF9F8',
  surfaceDim: '#DCD9D9',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F6F3F2',
  surfaceContainer: '#F0EDED',
  surfaceContainerHigh: '#EAE8E7',
  surfaceContainerHighest: '#E4E2E1',
  surfaceVariant: '#E4E2E1',

  onSurface: '#1B1C1C',
  onSurfaceVariant: '#3E4944',
  onBackground: '#1B1C1C',
  background: '#FBF9F8',

  outline: '#6E7A74',
  outlineVariant: '#BEC9C2',

  inverseSurface: '#303030',
  inverseOnSurface: '#F3F0F0',
  inversePrimary: '#80D7B6',

  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onError: '#FFFFFF',
  onErrorContainer: '#93000A',
} as const;

export const typography = {
  fontFamily: 'Public Sans, sans-serif',
  h1: { size: '40px', lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' },
  h1Mobile: { size: '32px', lineHeight: '1.2', fontWeight: '700' },
  h2: { size: '32px', lineHeight: '1.3', fontWeight: '700' },
  h2Mobile: { size: '24px', lineHeight: '1.3', fontWeight: '700' },
  h3: { size: '24px', lineHeight: '1.4', fontWeight: '600' },
  h4: { size: '20px', lineHeight: '1.4', fontWeight: '600' },
  bodyLg: { size: '18px', lineHeight: '1.6', fontWeight: '400' },
  bodyMd: { size: '16px', lineHeight: '1.6', fontWeight: '400' },
  labelMd: { size: '14px', lineHeight: '1.0', fontWeight: '500' },
  small: { size: '12px', lineHeight: '1.4', fontWeight: '400' },
} as const;

export const spacing = {
  xs: '4px',
  base: '8px',
  sm: '12px',
  md: '24px',
  gutter: '24px',
  lg: '48px',
  xl: '80px',
  marginMobile: '16px',
  marginDesktop: '64px',
} as const;

export const borderRadius = {
  default: '4px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

export const shadows = {
  surface1: '0px 4px 12px rgba(13, 33, 55, 0.05)',
  surface1Hover: '0px 8px 20px rgba(13, 33, 55, 0.08)',
  cardBorderHover: 'rgba(26, 122, 94, 0.3)',
} as const;

export const layout = {
  maxWidth: '1280px',
  maxWidthDashboard: '1400px',
  sidebarWidth: '288px',
  navbarHeight: '80px',
} as const;
