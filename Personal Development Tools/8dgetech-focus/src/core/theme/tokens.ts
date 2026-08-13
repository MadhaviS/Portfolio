export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * App brand: steel blue. Phase washes (focus / short / long) live only on the
 * Pomodoro ritual screen — everywhere else uses this single palette.
 */
export const lightTheme = {
  mode: 'light' as const,
  colors: {
    background: '#F7F9FB',
    backgroundAlt: '#E8EEF3',
    surface: '#FFFFFF',
    text: '#1A1C20',
    textMuted: '#5C6670',
    onSurface: '#1A1C20',
    onSurfaceMuted: '#5C6670',
    primary: '#397097',
    primaryText: '#FFFFFF',
    accent: '#4A84A8',
    border: '#D5DEE6',
    doodle: '#8A9AAB',
    success: '#3D7A62',
    danger: '#C45C5C',
    timerRing: '#397097',
    timerTrack: '#DDE5EC',
  },
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    background: '#121820',
    backgroundAlt: '#1A2430',
    surface: '#222E3C',
    text: '#F2F6FA',
    textMuted: '#A8B4C0',
    onSurface: '#F2F6FA',
    onSurfaceMuted: '#A8B4C0',
    primary: '#4A84A8',
    primaryText: '#FFFFFF',
    accent: '#6BA0C4',
    border: '#2E3C4C',
    doodle: '#4A5C6C',
    success: '#5F968C',
    danger: '#D67070',
    timerRing: '#4A84A8',
    timerTrack: '#1E2834',
  },
};

export type AppTheme = typeof lightTheme;
