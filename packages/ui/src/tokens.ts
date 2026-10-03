/** Work Trail design tokens, sampled from the admin and mobile mockups (docs/specs/*.png). */
export const tokens = {
  color: {
    canvas: '#FBF8F5',
    surface: '#FFFFFF',
    line: '#ECE7E1',
    ink: { 900: '#17130F', 700: '#3A3631', 500: '#6B6E72', 300: '#A9ACB0' },
    brand: {
      50: '#FFF5EE',
      100: '#FFE8D7',
      200: '#FFCDA8',
      400: '#FF7A2E',
      500: '#FE5A0C',
      600: '#E84A00',
      700: '#B83A00',
    },
    success: { 50: '#EAF7EF', 500: '#1F9D55' },
    danger: { 500: '#DC2626' },
  },
  gradient: {
    cta: 'linear-gradient(90deg, #FF7A2E 0%, #E84A00 100%)',
    authPanel: 'linear-gradient(180deg, #FFF3E8 0%, #FFE6D2 100%)',
  },
  radius: { input: 12, card: 16, panel: 20, pill: 999 },
  shadow: { card: '0 1px 2px rgba(23,19,15,.04), 0 8px 24px rgba(23,19,15,.06)' },
  font: { display: 'Barlow Semi Condensed', body: 'Barlow' },
} as const;

export type Tokens = typeof tokens;
