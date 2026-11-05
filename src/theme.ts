// HeyKip design tokens — the single source for colours, type, radii and shadows.
// Glow redesign (Oct 2026): lime and orange moved warmer — lime to 58° (#FFFC9A), orange to 20° (#E28151).
// Lime is still the ONLY yellow; the 3D icon set is tinted to the same 58°.

// Light (the original Glow) and Dark. Every screen reads these at the moment it draws, so switching the look
// (Profile → Look) swaps the values here and redraws the app. Brand colours stay the same in both; text and
// surfaces flip. `ink` is always "the text colour" and `paper` always "the opposite of ink" (white in Light,
// near-black in Dark) — so a black button with white text becomes a light button with dark text in Dark.
// `onAccent` is text that sits on lime, pastel or photo backgrounds: always dark, in both looks.
const LIGHT = {
  bg: '#FFFFFF',
  ink: '#111111',
  muted: '#6E6E68',
  faint: '#B5B5AD',
  soft: '#B9B8B0', // the quiet second line of a heading ("Today’s money")
  grey: '#F2F2EF',
  line: 'rgba(17,17,17,0.08)',
  border: 'rgba(17,17,17,0.14)',
  paper: '#FFFFFF',
  card: '#FCFAF6', // solid cards and sheets
  sheet: 'rgba(253,251,247,0.97)', // bottom sheets
  onAccent: '#111111', // text on lime, pastels and photos — dark in both looks
  onAccentMuted: '#6E6E68',
  solid: '#141414', // the black cards (Plus) — stay dark in both looks
  onSolid: '#FFFFFF',

  lime: '#FFFC9A',
  limeDeep: '#F0EA4A', // the stronger lime: rings, fills, progress
  lavender: '#CAC2DF', // money in
  lavenderText: '#5B4A96', // money in, as text
  orange: '#E28151',
  orangeText: '#B45A2F', // orange that reads as text
  sky: '#AAC4E4',
  clay: '#B98070',
  peach: '#FCDCB3',
  sage: '#D9E6CF',
  pink: '#F4D3DA',
  roseBeige: '#EDE6E5',
  sand: '#E3D8D0',
  lilac: '#E7E1F0',
};
type Palette = { [K in keyof typeof LIGHT]: string };
const DARK: Palette = {
  ...LIGHT,
  bg: '#121214',
  ink: '#F3F2EC',
  muted: '#A6A59E',
  faint: '#827F78',
  soft: '#76756F',
  grey: '#232227',
  line: 'rgba(243,242,236,0.10)',
  border: 'rgba(243,242,236,0.18)',
  paper: '#141416',
  card: '#1D1C21',
  sheet: 'rgba(29,28,33,0.98)',
  onAccent: '#111111',
  onAccentMuted: '#55554F',
  solid: '#26252C',
  onSolid: '#F3F2EC',
  lavenderText: '#BDB0F2', // readable on dark
  orangeText: '#F2A27C', // readable on dark
  lilac: '#2C2738',
};

export const colors: Palette = { ...LIGHT };

// What each kind of money looks like, everywhere. The rule: two different things never get colours that
// look alike (same tone) — only things that belong together share one. Rent & bills are one group: black.
export const money = {
  get fixed() {
    return colors.ink; // rent & bills — the money that goes first
  },
  living: LIGHT.sky,
  safetyNet: LIGHT.sage,
  goal: LIGHT.lime,
  fun: LIGHT.orange,
  goalChoice: LIGHT.pink, // the goal, when it sits in a list next to food (lime)
};

// Pin colours by goal position on the board: goal 1 is always orange.
export const pinColors = [LIGHT.orange, LIGHT.lavender, LIGHT.sky] as const;

// The glow look: one soft field behind every screen, frosted see-through cards on top.
const GLOW_LIGHT = {
  field: ['#FDFBF6', '#FCF8EF', '#F8F5F7', '#F5F2F8'] as readonly string[], // top → bottom
  peach: '#FFD2A6',
  peachWarm: '#FFBF8E', // when spending runs a bit fast
  yellow: '#FFF47A',
  lavender: '#DCD2F7',
  cream: '#FFE2C2',
  glass: 'rgba(255,255,255,0.42)',
  glassEdge: 'rgba(255,255,255,0.95)',
  control: 'rgba(17,17,17,0.07)', // buttons that sit on glass need their own fill
  blobOpacity: 1,
};
const GLOW_DARK: typeof GLOW_LIGHT = {
  field: ['#141416', '#151418', '#17161C', '#1A1820'],
  peach: '#6A3F2A',
  peachWarm: '#7A3E24',
  yellow: '#4B4620',
  lavender: '#3B3166',
  cream: '#5A4027',
  glass: 'rgba(255,255,255,0.06)',
  glassEdge: 'rgba(255,255,255,0.10)',
  control: 'rgba(243,242,236,0.10)',
  blobOpacity: 0.75,
};
export const glow = { ...GLOW_LIGHT };

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
  // Thai words switch to these automatically (src/lib/thaiText.tsx).
  thai: 'IBMPlexSansThai-Regular',
  thaiMedium: 'IBMPlexSansThai-Medium',
  thaiSemibold: 'IBMPlexSansThai-SemiBold',
  thaiBold: 'IBMPlexSansThai-Bold',
  hand: 'Caveat_600SemiBold',
  handThai: 'Sriracha_400Regular', // Caveat has no Thai letters: Thai handwriting switches to this marker-pen font
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

// ---------- Light / Dark ----------

export type Scheme = 'light' | 'dark';
let current: Scheme = 'light';
let version = 0;

/** Which look is showing right now. */
export const scheme = () => current;

/** Swap every colour to the other look. Screens redraw afterwards (ThemeProvider remounts the app). */
export function applyScheme(s: Scheme) {
  if (s === current) return;
  current = s;
  version++;
  Object.assign(colors, s === 'dark' ? DARK : LIGHT);
  Object.assign(glow, s === 'dark' ? GLOW_DARK : GLOW_LIGHT);
}

/** The text colour (`ink`) at some strength — lines, tracks, quiet fills. Flips with the look. */
export const inkA = (a: number) => (current === 'dark' ? `rgba(243,242,236,${a})` : `rgba(17,17,17,${a})`);

/** Always white / always black at some strength — for things on photos, lime or the black Plus cards. */
export const whiteA = (a: number) => `rgba(255,255,255,${a})`;
export const blackA = (a: number) => `rgba(17,17,17,${a})`;

/** A white wash at some strength (frosted fills on glass). In Dark it becomes a soft light wash. */
export const glassA = (a: number) => (current === 'dark' ? `rgba(255,255,255,${Math.min(0.16, a * 0.18).toFixed(3)})` : `rgba(255,255,255,${a})`);

/**
 * Styles that follow the look: `const styles = themed(() => StyleSheet.create({...}))`. The styles are worked out
 * again (once) after the look changes, so `colors.ink` inside them is always the current one.
 */
export function themed<T extends object>(make: () => T): T {
  let made: T | null = null;
  let at = -1;
  const get = () => {
    if (!made || at !== version) {
      made = make();
      at = version;
    }
    return made;
  };
  return new Proxy({} as T, {
    get: (_t, k) => (get() as Record<string | symbol, unknown>)[k],
    has: (_t, k) => k in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, k) => Object.getOwnPropertyDescriptor(get(), k),
  });
}
