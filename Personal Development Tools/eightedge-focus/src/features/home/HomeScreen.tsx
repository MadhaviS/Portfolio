import React, { useEffect } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../core/theme/ThemeProvider';
import { SoftDoodles } from '../../core/theme/SoftDoodles';
import { useAuth } from '../../core/auth/AuthProvider';
import { getEnabledApps } from '../../registry/appRegistry';
import { pomodoroRepository } from '../pomodoro/data/pomodoroRepository';

function useWebFonts() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'eightedge-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

export function HomeScreen() {
  useWebFonts();
  const { theme, toggleLightDark, resolved } = useTheme();
  const { user, isGuest, signOut, signInAsGuest } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const apps = getEnabledApps();
  const c = theme.colors;
  const wide = width >= 880;
  const isLight = resolved === 'light';
  const ink = c.onSurface;
  const inkSoft = c.onSurfaceMuted;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = 'Focus';
  }, []);

  const breath = useSharedValue(1);
  const floatY = useSharedValue(0);
  const ring = useSharedValue(0.92);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    ring.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 2600 }),
          withTiming(0.92, { duration: 2600 }),
        ),
        -1,
        false,
      ),
    );
  }, [breath, floatY, ring]);

  const tomatoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }, { translateY: floatY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value }],
    opacity: 0.22 + (ring.value - 0.92) * 2,
  }));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.root,
        { minHeight: Math.max(height, 640), paddingBottom: 56 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Company name — only once, top */}
      <View style={styles.topBar}>
        <Text style={[styles.company, { color: ink, fontFamily: fontDisplay }]}>
          8dgeTech
        </Text>
        <View style={styles.topActions}>
          <Pressable
            onPress={async () => {
              if (isGuest) {
                router.push('/sign-in');
                return;
              }
              await signOut();
              await signInAsGuest();
              pomodoroRepository.switchUser('local-guest', { reset: true });
              router.replace('/pomodoro');
            }}
            style={({ pressed }) => [
              styles.themeBtn,
              {
                borderColor: c.border,
                backgroundColor: c.surface,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Text style={[styles.themeLabel, { color: ink, fontFamily: fontBody }]}>
              {isGuest ? 'Sign in' : 'Sign out'}
            </Text>
          </Pressable>
          <Pressable
            onPress={toggleLightDark}
            accessibilityLabel="Toggle color theme"
            style={({ pressed }) => [
              styles.themeBtn,
              {
                borderColor: c.border,
                backgroundColor: c.surface,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Text style={[styles.themeLabel, { color: ink, fontFamily: fontBody }]}>
              {isLight ? 'Dark' : 'Light'}
            </Text>
          </Pressable>
        </View>
      </View>

      {user ? (
        <Text style={[styles.signedIn, { color: inkSoft, fontFamily: fontBody }]}>
          {isGuest ? 'Browsing as guest' : `Signed in as ${user.displayName}`}
        </Text>
      ) : null}

      <View style={[styles.hero, wide && styles.heroWide]}>
        <SoftDoodles density={1} />
        <View style={[styles.copy, wide && styles.copyWide]}>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: isLight ? '#F0D6C8' : c.surface,
                borderColor: c.primary,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: ink, fontFamily: fontBody }]}>
              Personal development toolkit
            </Text>
          </View>

          <Text style={[styles.headline, { color: ink, fontFamily: fontDisplay }]}>
            Make focus{'\n'}feel effortless
          </Text>

          <Text style={[styles.support, { color: inkSoft, fontFamily: fontBody }]}>
            A calm Pomodoro with tasks, breaks, and a clear picture of how you
            spent your time — built to grow into more small tools later.
          </Text>

          <View style={styles.ctaRow}>
            <Link href="/pomodoro" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.ctaPrimary,
                  {
                    backgroundColor: isLight ? '#F0D6C8' : c.primary,
                    borderColor: c.primary,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.ctaPrimaryLabel,
                    { color: c.primaryText, fontFamily: fontBody },
                  ]}
                >
                  Open Pomodoro
                </Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.metaRow}>
            {['25 min focus', '5 min break', 'Task list'].map((item) => (
              <View
                key={item}
                style={[styles.metaChip, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <Text style={[styles.metaChipText, { color: ink, fontFamily: fontBody }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.visual, wide && styles.visualWide]}>
          <Animated.View
            style={[
              styles.orbit,
              ringStyle,
              { borderColor: c.primary },
            ]}
          />
          <View
            style={[
              styles.orbitDashed,
              { borderColor: isLight ? c.doodle : c.border },
            ]}
          />
          <Link href="/pomodoro" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Open Pomodoro timer">
              <Animated.View
                style={[
                  styles.tomato,
                  tomatoStyle,
                  { backgroundColor: '#BA4949', shadowColor: '#BA4949' },
                ]}
              >
                <Text style={[styles.tomatoMode, { fontFamily: fontBody }]}>
                  Pomodoro
                </Text>
                <Text style={[styles.tomatoTime, { fontFamily: fontDisplay }]}>
                  25:00
                </Text>
                <View style={styles.tomatoBtn}>
                  <Text style={[styles.tomatoBtnLabel, { fontFamily: fontBody }]}>
                    START
                  </Text>
                </View>
              </Animated.View>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.toolsBlock}>
        <Text style={[styles.toolsLabel, { color: ink, fontFamily: fontBody }]}>
          Start here
        </Text>
        <View style={[styles.toolsRow, wide && styles.toolsRowWide]}>
          {apps.map((app) => (
            <Link key={app.id} href={app.route as '/pomodoro'} asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.toolTile,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
              >
                <View style={styles.toolTop}>
                  <View style={[styles.toolIcon, { backgroundColor: '#BA4949' }]}>
                    <View style={styles.toolIconInner} />
                  </View>
                  <Text style={[styles.toolGo, { color: ink, fontFamily: fontBody }]}>
                    Open →
                  </Text>
                </View>
                <Text style={[styles.toolTitle, { color: ink, fontFamily: fontDisplay }]}>
                  {app.title}
                </Text>
                <Text style={[styles.toolSub, { color: inkSoft, fontFamily: fontBody }]}>
                  Timed focus blocks, short breaks, a task list, and a simple
                  report of how your sessions went.
                </Text>
              </Pressable>
            </Link>
          ))}

          <View
            style={[
              styles.comingTile,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Text style={[styles.comingEyebrow, { color: inkSoft, fontFamily: fontBody }]}>
              Next up
            </Text>
            <Text style={[styles.comingTitle, { color: ink, fontFamily: fontDisplay }]}>
              More small tools
            </Text>
            <Text style={[styles.comingSub, { color: inkSoft, fontFamily: fontBody }]}>
              Habits, journaling, and breath timers will join this same home —
              one login, one calm place.
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.powered, { color: inkSoft, fontFamily: fontBody }]}>
        powered by 8dgeTech@2026
      </Text>
    </ScrollView>
  );
}

const fontDisplay = Platform.select({
  web: 'Fraunces, Georgia, serif',
  default: 'serif',
});

const fontBody = Platform.select({
  web: 'Outfit, system-ui, sans-serif',
  default: 'System',
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  root: {
    paddingHorizontal: 24,
    paddingTop: 18,
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  company: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  signedIn: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
  },
  themeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  hero: {
    gap: 40,
    marginBottom: 48,
    position: 'relative',
    overflow: 'hidden',
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 56,
    minHeight: 420,
  },
  copy: {
    gap: 18,
    maxWidth: 540,
    zIndex: 1,
  },
  copyWide: { flex: 1.05 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headline: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1.8,
    lineHeight: 60,
  },
  support: {
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '500',
    maxWidth: 460,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  ctaPrimary: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  ctaPrimaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  visualWide: {
    flex: 0.95,
    maxWidth: 380,
  },
  orbit: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
  },
  orbitDashed: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.55,
  },
  tomato: {
    width: 270,
    borderRadius: 22,
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  tomatoMode: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tomatoTime: {
    color: '#FFFFFF',
    fontSize: 68,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  tomatoBtn: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 38,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tomatoBtnLabel: {
    color: '#7A2E2E',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 14,
  },
  toolsBlock: { gap: 14 },
  toolsLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  toolsRow: { gap: 14 },
  toolsRowWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  toolTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 10,
    minWidth: 260,
  },
  toolTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  toolIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  toolTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  toolSub: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  toolGo: {
    fontSize: 13,
    fontWeight: '700',
  },
  comingTile: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    gap: 8,
    minWidth: 220,
  },
  comingEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  comingTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  comingSub: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  powered: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
