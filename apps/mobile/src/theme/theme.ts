import { tokens } from '@worktrail/ui';

const c = tokens.color;
export const colors = {
  canvas: c.canvas,
  surface: c.surface,
  line: c.line,
  ink900: c.ink[900],
  ink700: c.ink[700],
  ink500: c.ink[500],
  ink300: c.ink[300],
  brand50: c.brand[50],
  brand100: c.brand[100],
  brand200: c.brand[200],
  brand500: c.brand[500],
  brand700: c.brand[700],
  success50: c.success[50],
  success500: c.success[500],
  danger500: c.danger[500],
} as const;

export const ctaGradient = [c.brand[400], c.brand[600]] as const;
export const radius = tokens.radius;

export const fonts = {
  body: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  display: 'BarlowSemiCondensed_700Bold',
} as const;

export const shadow = {
  shadowColor: '#17130F',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
