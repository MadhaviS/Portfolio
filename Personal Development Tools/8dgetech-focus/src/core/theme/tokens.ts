export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Shared palette: tomato focus red, cream surfaces, soft charcoal ink.
 * Contrast: light = dark text only; dark = light text only.
 */
export const lightTheme = {
  mode: 'light' as const,
  colors: {
    background: '#FDFBF7',
    backgroundAlt: '#F3EDE5',
    surface: '#FFFFFF',
    text: '#1A1C20',
    textMuted: '#6B6661',
    onSurface: '#1A1C20',
    onSurfaceMuted: '#6B6661',
    primary: '#BA4949',
    primaryText: '#FFFFFF',
    accent: '#C15C5C',
    border: '#E8E1D8',
    doodle: '#A89888',
    success: '#38858A',
    danger: '#BA4949',
    timerRing: '#BA4949',
    timerTrack: '#EDE6DC',
  },
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    background: '#141018',
    backgroundAlt: '#1E1822',
    surface: '#26202C',
    text: '#FFF8F2',
    textMuted: '#D4C8BE',
    onSurface: '#FFF8F2',
    onSurfaceMuted: '#D4C8BE',
    primary: '#C15C5C',
    primaryText: '#FFFFFF',
    accent: '#D47A7A',
    border: '#3A323E',
    doodle: '#5A4E58',
    success: '#4A9B9F',
    danger: '#C15C5C',
    timerRing: '#C15C5C',
    timerTrack: '#2E2734',
  },
};

export type AppTheme = typeof lightTheme;
