// HeyKip design tokens — the single source for colours, type, radii and shadows.
// Matches the approved canvas (v3). Lime #F6FF9A is the ONLY yellow.

export const colors = {
  bg: '#FFFFFF',
  ink: '#111111',
  muted: '#6E6E68',
  faint: '#B5B5AD',
  grey: '#F2F2EF',
  line: 'rgba(17,17,17,0.08)',
  border: 'rgba(17,17,17,0.14)',

  lime: '#F6FF9A',
  lavender: '#CAC2DF',
  orange: '#E27651',
  sky: '#AAC4E4',
  clay: '#B98070',
  peach: '#FCDCB3',
  sage: '#D9E6CF',
  pink: '#F4D3DA',
  roseBeige: '#EDE6E5',
  sand: '#E3D8D0',
  lilac: '#E7E1F0',
} as const;

// Pin colours by goal position on the board: goal 1 is always orange.
export const pinColors = [colors.orange, colors.lavender, colors.sky] as const;

export const radius = { card: 24, cardLg: 28, field: 16, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

// Card shadow: 0 1px 2px rgba(0,0,0,.04) + 0 8px 24px rgba(0,0,0,.06).
// React Native supports CSS box-shadow strings on the New Architecture.
export const shadow = {
  card: { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' },
} as const;

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  thai: 'IBMPlexSansThai_400Regular',
  thaiMedium: 'IBMPlexSansThai_500Medium',
  thaiSemibold: 'IBMPlexSansThai_600SemiBold',
  hand: 'Caveat_600SemiBold',
  signature: 'MrsSaintDelafield_400Regular',
} as const;

export const type = {
  hero: { fontFamily: fonts.semibold, fontSize: 34, letterSpacing: -0.8, lineHeight: 39 },
  title: { fontFamily: fonts.semibold, fontSize: 27, letterSpacing: -0.5, lineHeight: 34 },
  greeting: { fontFamily: fonts.medium, fontSize: 32, letterSpacing: -0.6, lineHeight: 40 },
  money: { fontFamily: fonts.medium, fontSize: 44, letterSpacing: -1.4, fontVariant: ['tabular-nums'] as const },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.semibold, fontSize: 16 },
} as const;
