export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Shared palette: Option C — plum focus, sage short, clay long.
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
    primary: '#397097',
    primaryText: '#FFFFFF',
    accent: '#4A84A8',
    border: '#E8E1D8',
    doodle: '#A89888',
    success: '#4A7C74',
    danger: '#397097',
    timerRing: '#397097',
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
    primary: '#4A84A8',
    primaryText: '#FFFFFF',
    accent: '#6BA0C4',
    border: '#3A323E',
    doodle: '#5A4E58',
    success: '#5F968C',
    danger: '#4A84A8',
    timerRing: '#4A84A8',
    timerTrack: '#2E2734',
  },
};

export type AppTheme = typeof lightTheme;
