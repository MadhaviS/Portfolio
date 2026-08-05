import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { pomodoroRepository } from '../../features/pomodoro/data/pomodoroRepository';
import { IconLogout, IconReport } from '../theme/LineIcons';
import { PHASE_THEME } from '../../features/pomodoro/domain/types';

type AuthAccountButtonProps = {
  /** Icon / label ink color */
  color: string;
  iconSize?: number;
  /** Extra styles for the outer pressable (toolbar chip, ghost btn, etc.) */
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Show text beside the icon (landing). */
  showLabel?: boolean;
  labelStyle?: StyleProp<ViewStyle> | object;
  /** Logged-in only: open Report from My account menu. */
  onOpenReport?: () => void;
};

/**
 * Guest → opens sign-in.
 * Signed-in → My account menu (Report when provided, Sign out).
 */
export function AuthAccountButton({
  color,
  iconSize = 18,
  style,
  showLabel = false,
  labelStyle,
  onOpenReport,
}: AuthAccountButtonProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const { isGuest, signOut, signInAsGuest } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = () => {
    if (isGuest) {
      router.push('/sign-in');
      return;
    }
    setMenuOpen(true);
  };

  const doSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      await signInAsGuest();
      // Keep the account workspace intact; just return to guest bucket.
      pomodoroRepository.switchUser('local-guest');
      setMenuOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const openReport = () => {
    setMenuOpen(false);
    onOpenReport?.();
  };

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityLabel={isGuest ? 'Sign in' : 'My account'}
        accessibilityHint={
          isGuest ? 'Opens sign in' : 'Opens account menu'
        }
        style={style}
      >
        <Ionicons
          name={isGuest ? 'person-outline' : 'person-circle'}
          size={iconSize}
          color={color}
        />
        {showLabel ? (
          <Text style={labelStyle}>{isGuest ? 'Sign in' : 'My account'}</Text>
        ) : null}
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={() => (busy ? undefined : setMenuOpen(false))}
            accessibilityLabel="Close account menu"
          />
          <View
            style={[
              styles.menu,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.menuTitle, { color: c.onSurfaceMuted }]}>
              My account
            </Text>

            {onOpenReport ? (
              <Pressable
                onPress={openReport}
                disabled={busy}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: pressed ? c.backgroundAlt : 'transparent',
                    opacity: busy ? 0.6 : 1,
                  },
                ]}
                accessibilityLabel="Report"
              >
                <IconReport color={c.onSurface} size={18} />
                <Text style={[styles.menuItemLabel, { color: c.onSurface }]}>
                  Report
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={doSignOut}
              disabled={busy}
              style={({ pressed }) => [
                styles.menuItem,
                {
                  backgroundColor: pressed ? c.backgroundAlt : 'transparent',
                  opacity: busy ? 0.6 : 1,
                },
              ]}
              accessibilityLabel="Sign out"
            >
              <IconLogout color={PHASE_THEME.focus.bg} size={18} />
              <Text style={[styles.menuItemLabel, { color: c.onSurface }]}>
                Sign out
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(false)}
              disabled={busy}
              style={({ pressed }) => [
                styles.cancelItem,
                {
                  borderColor: c.border,
                  opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.cancelLabel, { color: c.onSurfaceMuted }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 16, 24, 0.45)',
  },
  menu: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    zIndex: 1,
    ...Platform.select({
      web: { boxShadow: '0 16px 40px rgba(0,0,0,0.22)' } as object,
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  cancelItem: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
