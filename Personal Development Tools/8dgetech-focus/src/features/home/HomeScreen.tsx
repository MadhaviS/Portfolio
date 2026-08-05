import React, { useEffect } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../core/theme/ThemeProvider';
import { AuthAccountButton } from '../../core/auth/AuthAccountButton';
import {
  IconChart,
  IconChecklist,
  IconChevron,
  IconMoon,
  IconPerson,
  IconSun,
  IconTarget,
  IconTomatoClock,
} from '../../core/theme/LineIcons';

const CORAL = '#FF6B5A';
const DOODLE_BG_LIGHT = require('../../../assets/landing-doodles-bg-light.png');
const DOODLE_BG_DARK = require('../../../assets/landing-doodles-bg-dark.png');

const FEATURES = [
  {
    title: 'Stay focused',
    body: 'Eliminate distractions and get more done.',
    Icon: IconTarget,
  },
  {
    title: 'Build better habits',
    body: 'Small steps every day lead to big results.',
    Icon: IconChecklist,
  },
  {
    title: 'Track progress',
    body: 'See your growth and stay motivated.',
    Icon: IconChart,
  },
  {
    title: 'For you',
    body: 'Tools that fit your goals and your lifestyle.',
    Icon: IconPerson,
  },
] as const;

function useWebFonts() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = '8dgetech-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

export function HomeScreen() {
  useWebFonts();
  const { theme, toggleLightDark, resolved } = useTheme();
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const c = theme.colors;
  const isLight = resolved === 'light';
  const ink = isLight ? '#1A1C20' : c.onSurface;
  const inkSoft = isLight ? '#6B6661' : c.onSurfaceMuted;
  const coral = isLight ? CORAL : c.primary;
  const narrow = width < 700;
  const short = height < 720;
  const tiny = height < 600 || width < 360;
  const padX = width < 480 ? 18 : width < 900 ? 32 : 48;
  const padY = short ? 12 : 20;

  const titleSize = tiny ? 42 : short ? 52 : narrow ? 64 : 84;
  const titleLine = titleSize * 1.05;
  const subSize = tiny ? 13 : short ? 14 : 17;
  const ctaPadV = tiny ? 14 : short ? 16 : 22;
  const ctaTitleSize = tiny ? 20 : short ? 24 : 30;
  const iconSize = tiny ? 28 : short ? 32 : 36;
  const featureIconSize = tiny ? 20 : 24;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = 'Focus · 8dgeTech';
  }, []);

  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bob]);

  const cardMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * -4 }],
  }));

  return (
    <ImageBackground
      source={isLight ? DOODLE_BG_LIGHT : DOODLE_BG_DARK}
      style={[styles.page, { backgroundColor: c.background, height }]}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <View
        style={[
          styles.root,
          {
            paddingHorizontal: padX,
            paddingTop: padY,
            paddingBottom: padY + 4,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Text
            style={[
              styles.company,
              {
                color: ink,
                fontFamily: fontDisplay,
                fontSize: tiny ? 20 : 26,
              },
            ]}
          >
            8dgeTech
          </Text>
          <View style={styles.topActions}>
            <AuthAccountButton
              color={ink}
              iconSize={tiny ? 16 : 18}
              showLabel
              labelStyle={[
                styles.ghostLabel,
                { color: ink, fontFamily: fontBody, fontSize: tiny ? 12 : 14 },
              ]}
              style={({ pressed }) => [
                styles.ghostBtn,
                {
                  borderColor: isLight ? '#D9D2C8' : c.border,
                  backgroundColor: isLight ? '#FFFFFF' : c.surface,
                  opacity: pressed ? 0.88 : 1,
                  paddingVertical: tiny ? 8 : 11,
                  paddingHorizontal: tiny ? 12 : 18,
                },
              ]}
            />
            <Pressable
              onPress={toggleLightDark}
              accessibilityLabel="Toggle color theme"
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  borderColor: isLight ? '#D9D2C8' : c.border,
                  backgroundColor: isLight ? '#FFFFFF' : c.surface,
                  opacity: pressed ? 0.88 : 1,
                  width: tiny ? 38 : 44,
                  height: tiny ? 38 : 44,
                },
              ]}
            >
              {isLight ? (
                <IconSun color={ink} size={17} />
              ) : (
                <IconMoon color={ink} size={17} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <Text
            style={[
              styles.heroTitle,
              {
                color: ink,
                fontFamily: fontDisplay,
                fontSize: titleSize,
                lineHeight: titleLine,
              },
            ]}
          >
            Focus
          </Text>
          <Text
            style={[
              styles.heroSub,
              {
                color: inkSoft,
                fontFamily: fontBody,
                fontSize: subSize,
                lineHeight: subSize * 1.45,
              },
            ]}
          >
            {narrow
              ? 'A personal toolkit to focus, build habits, and grow.'
              : 'A personal development toolkit to help you focus,\nbuild habits, and grow every day.'}
          </Text>

          <Animated.View
            style={[
              styles.ctaWrap,
              cardMotion,
              { marginTop: short ? 10 : 16 },
              Platform.OS === 'web'
                ? ({
                    boxShadow: `0 18px 40px ${coral}40`,
                  } as object)
                : null,
            ]}
          >
            <Pressable
              onPress={() => router.push('/pomodoro')}
              style={({ pressed }) => [
                styles.ctaCard,
                {
                  backgroundColor: coral,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                  shadowColor: coral,
                  paddingVertical: ctaPadV,
                  paddingHorizontal: tiny ? 16 : 24,
                },
              ]}
              accessibilityRole="link"
              accessibilityLabel="Open Pomodoro"
            >
              <View
                style={[
                  styles.ctaIcon,
                  {
                    width: iconSize + 20,
                    height: iconSize + 20,
                    borderRadius: (iconSize + 20) / 2,
                  },
                ]}
              >
                <IconTomatoClock color="#FFFFFF" size={iconSize} />
              </View>
              <View style={styles.ctaCopy}>
                <Text
                  style={[
                    styles.ctaTitle,
                    { fontFamily: fontDisplay, fontSize: ctaTitleSize },
                  ]}
                >
                  Pomodoro
                </Text>
                <Text
                  style={[
                    styles.ctaMeta,
                    { fontFamily: fontBody, fontSize: tiny ? 12 : 14 },
                  ]}
                >
                  Focus • breaks • tasks
                </Text>
              </View>
              <IconChevron color="#FFFFFF" size={tiny ? 18 : 24} />
            </Pressable>
          </Animated.View>
        </View>

        <View
          style={[
            styles.featuresWrap,
            {
              borderTopColor: isLight ? '#E8E1D8' : c.border,
              paddingTop: short ? 14 : 22,
            },
          ]}
        >
          <View style={[styles.features, narrow && styles.featuresGrid]}>
            {FEATURES.map((f, i) => {
              const FeatureIcon = f.Icon;
              return (
                <View
                  key={f.title}
                  style={[
                    styles.featureCol,
                    narrow && styles.featureColGrid,
                    !narrow && i < FEATURES.length - 1 && styles.featureDivider,
                    { borderColor: isLight ? '#E8E1D8' : c.border },
                  ]}
                >
                  <FeatureIcon
                    color={coral}
                    size={featureIconSize}
                    style={styles.featureIcon}
                  />
                  <Text
                    style={[
                      styles.featureTitle,
                      {
                        color: ink,
                        fontFamily: fontBody,
                        fontSize: tiny ? 13 : 15,
                      },
                    ]}
                  >
                    {f.title}
                  </Text>
                  <Text
                    style={[
                      styles.featureBody,
                      {
                        color: inkSoft,
                        fontFamily: fontBody,
                        fontSize: tiny ? 11 : 13,
                        lineHeight: tiny ? 15 : 18,
                      },
                    ]}
                    numberOfLines={narrow ? 2 : 3}
                  >
                    {f.body}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </ImageBackground>
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
  page: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  root: {
    flex: 1,
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
    flexShrink: 0,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  company: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  ghostBtn: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ghostLabel: { fontWeight: '600' },
  iconBtn: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 2,
    minHeight: 0,
  },
  heroTitle: {
    fontWeight: '700',
    letterSpacing: -2.8,
    textAlign: 'center',
  },
  heroSub: {
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 460,
    paddingHorizontal: 8,
  },
  ctaWrap: {
    width: '100%',
    maxWidth: 540,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
  },
  ctaIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCopy: { flex: 1, gap: 2 },
  ctaTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  ctaMeta: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  featuresWrap: {
    zIndex: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  features: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCol: {
    flex: 1,
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  featureColGrid: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '47%',
    width: '47%',
    paddingHorizontal: 4,
  },
  featureDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  featureIcon: {
    marginBottom: 2,
  },
  featureTitle: {
    fontWeight: '700',
  },
  featureBody: {
    fontWeight: '500',
  },
});
