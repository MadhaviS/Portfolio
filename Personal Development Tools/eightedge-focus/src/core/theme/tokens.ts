export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Contrast rules (strict):
 * - Light mode: light backgrounds + ONLY dark text (no white / pale gray copy)
 * - Dark mode: dark backgrounds + ONLY light text (no charcoal copy)
 */
export const lightTheme = {
  mode: 'light' as const,
  colors: {
    background: '#F7F4EF',
    backgroundAlt: '#ECE6DC',
    surface: '#FFFFFF',
    /** All light-mode copy uses these dark values */
    text: '#0A0D12',
    textMuted: '#1A2332',
    onSurface: '#0A0D12',
    onSurfaceMuted: '#1A2332',
    primary: '#B84A2F',
    /** Dark label on primary buttons in light mode — never white */
    primaryText: '#0A0D12',
    accent: '#1F5C52',
    border: '#9A8F82',
    doodle: '#6E6258',
    success: '#1F5C52',
    danger: '#8F2F2F',
    timerRing: '#B84A2F',
    timerTrack: '#D5CCC0',
  },
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    background: '#0B0F14',
    backgroundAlt: '#151B24',
    surface: '#1A222E',
    /** All dark-mode copy uses these light values */
    text: '#F7F4EF',
    textMuted: '#E2E8F0',
    onSurface: '#F7F4EF',
    onSurfaceMuted: '#E2E8F0',
    primary: '#E07A5F',
    /** Light label on primary in dark mode */
    primaryText: '#F7F4EF',
    accent: '#6BC4B2',
    border: '#2F3B4C',
    doodle: '#3A4A5E',
    success: '#6BC4B2',
    danger: '#E89292',
    timerRing: '#E07A5F',
    timerTrack: '#232C3A',
  },
};

export type AppTheme = typeof lightTheme;
