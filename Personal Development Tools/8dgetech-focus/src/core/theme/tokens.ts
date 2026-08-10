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
    primary: '#C64642',
    primaryText: '#FFFFFF',
    accent: '#D45B57',
    border: '#E8E1D8',
    doodle: '#A89888',
    success: '#38858A',
    danger: '#C64642',
    timerRing: '#C64642',
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
    primary: '#D45B57',
    primaryText: '#FFFFFF',
    accent: '#E07A76',
    border: '#3A323E',
    doodle: '#5A4E58',
    success: '#4A9B9F',
    danger: '#D45B57',
    timerRing: '#D45B57',
    timerTrack: '#2E2734',
  },
};

export type AppTheme = typeof lightTheme;
