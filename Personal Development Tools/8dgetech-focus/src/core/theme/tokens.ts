export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * README-mockup palette: warm cream, coral accent, soft charcoal ink.
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
    primary: '#FF6B5A',
    primaryText: '#FFFFFF',
    accent: '#BA4949',
    border: '#E8E1D8',
    doodle: '#A89888',
    success: '#3D7A6A',
    danger: '#BA4949',
    timerRing: '#FF6B5A',
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
    primary: '#FF8A7A',
    primaryText: '#1A1A1D',
    accent: '#E07A5F',
    border: '#3A323E',
    doodle: '#5A4E58',
    success: '#6BC4B2',
    danger: '#FF8A7A',
    timerRing: '#FF8A7A',
    timerTrack: '#2E2734',
  },
};

export type AppTheme = typeof lightTheme;
