import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type FocusTimerChipNative = {
  canDrawOverlays: () => boolean;
  openOverlaySettings: () => void;
  showCountdown: (endsAtMs: number, accentHex?: string) => void;
  showPaused: (label: string, accentHex?: string) => void;
  hide: () => void;
};

const native: FocusTimerChipNative | null =
  Platform.OS === 'android'
    ? (requireNativeModule('FocusTimerChip') as FocusTimerChipNative)
    : null;

export const focusTimerChip = {
  canDrawOverlays(): boolean {
    if (!native) return false;
    try {
      return native.canDrawOverlays();
    } catch {
      return false;
    }
  },

  openOverlaySettings() {
    native?.openOverlaySettings();
  },

  showCountdown(endsAtMs: number, accentHex?: string) {
    native?.showCountdown(endsAtMs, accentHex);
  },

  showPaused(label: string, accentHex?: string) {
    native?.showPaused(label, accentHex);
  },

  hide() {
    native?.hide();
  },
};
