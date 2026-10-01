export const colors = {
  background: '#0b0714',
  surface: '#161026',
  surfaceRaised: '#1e1734',
  border: '#2d2347',
  borderStrong: '#463769',
  text: '#f4f0ff',
  textMuted: '#a79bc4',
  textFaint: '#7a6f96',
  accent: '#c084fc',
  accentStrong: '#8b5cf6',
  saffron: '#f59e0b',
  success: '#34d399',
  danger: '#f87171',
  overlay: 'rgba(8, 5, 16, 0.82)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 26, fontWeight: '700' },
  heading: { fontSize: 19, fontWeight: '700' },
  subheading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;
