/**
 * Design tokens espelhados de styles/tokens/colors.css para uso em
 * @react-pdf/renderer (que não suporta CSS variables).
 *
 * Contexto light (impressão em papel branco).
 */
export const nogmaColors = {
  petroleum: '#0C4651',
  petroleum950: '#041F25',
  petroleum800: '#0C4651',
  petroleum600: '#196E7C',
  petroleum100: '#E1EEF0',
  petroleum050: '#F1F7F8',
  lime: '#CCFF00',
  lime600: '#A3CC00',
  lime050: '#FAFFE0',
  black: '#000000',
  white: '#FFFFFF',
  neutral50: '#F7F8F8',
  neutral100: '#EEF0F0',
  neutral200: '#E1E4E4',
  neutral300: '#C9CDCD',
  neutral400: '#A1A1A1',
  neutral600: '#565B5B',
  neutral800: '#232626',
  success: '#2FA36B',
  successBg: '#E7F5EE',
  warning: '#E8A317',
  warningBg: '#FBF1DC',
  danger: '#D6483B',
  dangerBg: '#FBE9E7',
} as const;

export const spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

export const fontSizes = {
  micro: 7,
  caption: 8,
  body: 10,
  bodyLg: 11,
  h4: 12,
  h3: 14,
  h2: 18,
  h1: 22,
  display: 28,
} as const;
