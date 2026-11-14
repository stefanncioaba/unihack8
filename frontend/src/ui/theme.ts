// Design tokens: "Timișoara after dark". Ink-and-navy layers for the city at night, signal yellow
// (like transit signage) for anything you can act on, pale signal blue for status and trust.
// Design only: no feature decisions live here.

export const colors = {
  bg: '#000814', // Ink Black: screen background
  bgDeep: '#001D3D', // Prussian Blue: deep wash behind content
  surface: '#001D3D', // Prussian Blue: cards and panels
  surfaceAlt: '#00284D', // between Prussian and Oxford: tracks, quiet pills
  oxford: '#003566', // Oxford Navy: raised / selected surfaces, map highlights
  bubble: '#003566', // own chat messages
  accent: '#FFC300', // School Bus Yellow: primary actions, active state
  gold: '#FFD60A', // Gold: accent text and links on dark
  signal: '#8EC5FF', // pale signal blue: status, reliability, success
  signalDeep: '#3B7DD8',
  text: '#EEF3FA',
  textMuted: '#8DA2BF',
  border: 'rgba(142,197,255,0.12)',
  borderStrong: 'rgba(142,197,255,0.20)',
  danger: '#FF6B6B',
  onAccent: '#000814', // ink text on yellow
  overlay: 'rgba(0,8,20,0.72)',
} as const;

export const spacing = { xs: 4, sm: 6, md: 10, lg: 16, xl: 24, xxl: 32 } as const;

/** Cards are softer than buttons; buttons read like signage plates. */
export const radius = { card: 18, field: 12, button: 12, chip: 999 } as const;

/** Horizontal page margin from the design reference. */
export const PAGE_MARGIN = 16;

/** Height of the bottom tab bar (without the safe-area inset). */
export const TAB_BAR_HEIGHT = 64;

export const type = {
  title: { fontSize: 24, fontWeight: '800', lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 23, letterSpacing: -0.2 },
  cardTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  body: { fontSize: 13, fontWeight: '400', lineHeight: 19 },
  caption: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  chip: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
} as const;

export type TypeVariant = keyof typeof type;
export type Tone = 'primary' | 'muted' | 'accent' | 'signal' | 'danger' | 'onAccent';

/** Maps a text tone to its colour. */
export const toneColor: Record<Tone, string> = {
  primary: colors.text,
  muted: colors.textMuted,
  accent: colors.gold,
  signal: colors.signal,
  danger: colors.danger,
  onAccent: colors.onAccent,
};
