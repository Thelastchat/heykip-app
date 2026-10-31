// HeyKip design tokens — the single source for colours, type, radii and shadows.
// Glow redesign (Oct 2026): lime and orange moved warmer — lime to 58° (#FFFC9A), orange to 20° (#E28151).
// Lime is still the ONLY yellow; the 3D icon set is tinted to the same 58°.

export const colors = {
  bg: '#FFFFFF',
  ink: '#111111',
  muted: '#6E6E68',
  faint: '#B5B5AD',
  grey: '#F2F2EF',
  line: 'rgba(17,17,17,0.08)',
  border: 'rgba(17,17,17,0.14)',

  lime: '#FFFC9A',
  limeDeep: '#F0EA4A', // the stronger lime: rings, fills, progress
  lavender: '#CAC2DF', // money in
  lavenderText: '#5B4A96', // money in, as text on light glass
  orange: '#E28151',
  orangeText: '#B45A2F', // orange that reads as text on light glass
  sky: '#AAC4E4',
  clay: '#B98070',
  peach: '#FCDCB3',
  sage: '#D9E6CF',
  pink: '#F4D3DA',
  roseBeige: '#EDE6E5',
  sand: '#E3D8D0',
  lilac: '#E7E1F0',
} as const;

// What each kind of money looks like, everywhere. The rule: two different things never get colours that
// look alike (same tone) — only things that belong together share one. Rent & bills are one group: black.
export const money = {
  fixed: colors.ink, // rent & bills — the money that goes first
  living: colors.sky,
  safetyNet: colors.sage,
  goal: colors.lime,
  fun: colors.orange,
  goalChoice: colors.pink, // the goal, when it sits in a list next to food (lime)
} as const;

// Pin colours by goal position on the board: goal 1 is always orange.
export const pinColors = [colors.orange, colors.lavender, colors.sky] as const;

// The glow look: one soft field behind every screen, frosted see-through cards on top.
export const glow = {
  field: ['#FDFBF6', '#FCF8EF', '#F8F5F7', '#F5F2F8'] as const, // top → bottom
  peach: '#FFD2A6',
  peachWarm: '#FFBF8E', // when spending runs a bit fast
  yellow: '#FFF47A',
  lavender: '#DCD2F7',
  cream: '#FFE2C2',
  glass: 'rgba(255,255,255,0.42)',
  glassEdge: 'rgba(255,255,255,0.95)',
  control: 'rgba(17,17,17,0.07)', // buttons that sit on glass need their own fill
} as const;

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
