// Design tokens from the dark-neon design reference (colours, spacing, radii, type scale).
// Design only: no feature decisions live here.

export const colors = {
  bg: '#090A18', // near-black navy
  bgDeep: '#111029', // deep indigo
  surface: '#191A2C', // elevated cards
  surfaceAlt: '#252536', // secondary surface
  teal: '#17D7D3',
  tealDeep: '#0AA8AD',
  tealBubble: '#0C4A52', // deep teal for message-like blocks
  orange: '#FF7138',
  orangeSoft: '#FF8A45',
  violet: '#A83DFF',
  text: '#F6F3F2',
  textMuted: '#A9A7B3',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.14)',
  danger: '#FF5A6A',
  onAccent: '#1B0E08', // dark text on orange
  overlay: 'rgba(9,10,24,0.72)',
} as const;

export const spacing = { xs: 4, sm: 6, md: 10, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { card: 14, field: 12, button: 14, chip: 999 } as const;

/** Horizontal page margin from the design reference. */
export const PAGE_MARGIN = 16;

/** Height of the bottom tab bar (without the safe-area inset). */
export const TAB_BAR_HEIGHT = 64;

export const type = {
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  cardTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  body: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  chip: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
} as const;

export type TypeVariant = keyof typeof type;
export type Tone = 'primary' | 'muted' | 'accent' | 'teal' | 'danger' | 'onAccent';

/** Maps a text tone to its colour. */
export const toneColor: Record<Tone, string> = {
  primary: colors.text,
  muted: colors.textMuted,
  accent: colors.orangeSoft,
  teal: colors.teal,
  danger: colors.danger,
  onAccent: colors.onAccent,
};
