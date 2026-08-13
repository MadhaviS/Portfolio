import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
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
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../public/theme/ThemeProvider';
import { fontBody, fontDisplay } from '../../public/theme/fonts';
import { AuthAccountButton } from '../../public/auth/AuthAccountButton';
import {
  IconChevron,
  IconDepth,
  IconDrift,
  IconMoon,
  IconPulse,
  IconSun,
} from '../../public/theme/LineIcons';
import {
  getComingSoonApps,
  getEnabledApps,
  type MiniAppId,
  type MiniAppStory,
} from '../../public/registry/appRegistry';
import { PHASE_THEME } from '../../apps/pulse/domain/types';

const DOODLE_BG_LIGHT = require('../../../assets/landing-doodles-bg-light.jpg');
const DOODLE_BG_DARK = require('../../../assets/landing-doodles-bg-dark.jpg');

const APP_ICONS: Record<
  MiniAppId,
  React.ComponentType<{ color?: string; size?: number }>
> = {
  pulse: IconPulse,
  drift: IconDrift,
  depth: IconDepth,
};

const RHYTHM = [
  { label: '25', hint: 'focus', kind: 'work' as const },
  { label: '5', hint: 'break', kind: 'rest' as const },
  { label: '25', hint: 'focus', kind: 'work' as const },
  { label: '5', hint: 'break', kind: 'rest' as const },
  { label: '15', hint: 'long', kind: 'long' as const },
];

function RhythmBeat({
  label,
  hint,
  kind,
  brand,
  inkSoft,
  delay,
  tiny,
}: {
  label: string;
  hint: string;
  kind: 'work' | 'rest' | 'long';
  brand: string;
  inkSoft: string;
  delay: number;
  tiny: boolean;
}) {
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, pulse]);

  const glow = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 0.92 + pulse.value * 0.08 }],
  }));

  const fill =
    kind === 'work' ? brand : kind === 'long' ? `${brand}CC` : 'transparent';
  const size = tiny ? 40 : 48;

  return (
    <View style={styles.beat}>
      <Animated.View
        style={[
          styles.beatOrb,
          glow,
          {
            backgroundColor: fill,
            borderColor: kind === 'rest' ? brand : 'transparent',
            borderWidth: kind === 'rest' ? 2 : 0,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.beatNum,
            {
              color: kind === 'rest' ? brand : '#FFFFFF',
              fontFamily: fontDisplay,
              fontSize: tiny ? 14 : 16,
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
      <Text
        style={[
          styles.beatHint,
          { color: inkSoft, fontFamily: fontBody, fontSize: tiny ? 10 : 11 },
        ]}
      >
        {hint}
      </Text>
    </View>
  );
}

function StoryBody({
  story,
  brand,
  ink,
  inkSoft,
  border,
  tiny,
  narrow,
  showRhythm,
}: {
  story: MiniAppStory;
  brand: string;
  ink: string;
  inkSoft: string;
  border: string;
  tiny: boolean;
  narrow: boolean;
  showRhythm?: boolean;
}) {
  return (
    <View>
      <Text
        style={[
          styles.storyKicker,
          { color: brand, fontFamily: fontBody, fontSize: tiny ? 11 : 12 },
        ]}
      >
        {story.kicker}
      </Text>
      <Text
        style={[
          styles.storyTitle,
          {
            color: ink,
            fontFamily: fontDisplay,
            fontSize: tiny ? 22 : narrow ? 26 : 32,
            lineHeight: tiny ? 28 : narrow ? 32 : 40,
          },
        ]}
      >
        {story.title}
      </Text>
      <Text
        style={[
          styles.storyLead,
          {
            color: inkSoft,
            fontFamily: fontBody,
            fontSize: tiny ? 13 : 15,
            lineHeight: tiny ? 19 : 23,
          },
        ]}
      >
        {story.lead}
      </Text>

      {showRhythm ? (
        <View style={styles.rhythmBlock}>
          <Text
            style={[
              styles.rhythmLabel,
              { color: ink, fontFamily: fontBody, fontSize: tiny ? 12 : 13 },
            ]}
          >
            The classic pulse
          </Text>
          <View style={styles.rhythmRow}>
            {RHYTHM.map((beat, i) => (
              <React.Fragment key={`${beat.label}-${i}`}>
                {i > 0 ? (
                  <View
                    style={[styles.rhythmLink, { backgroundColor: `${brand}44` }]}
                  />
                ) : null}
                <RhythmBeat
                  {...beat}
                  brand={brand}
                  inkSoft={inkSoft}
                  delay={i * 180}
                  tiny={tiny}
                />
              </React.Fragment>
            ))}
          </View>
          <Text
            style={[
              styles.rhythmCaption,
              {
                color: inkSoft,
                fontFamily: fontBody,
                fontSize: tiny ? 12 : 13,
                lineHeight: 19,
              },
            ]}
          >
            Four focus blocks, then a longer rest — a tempo your brain can keep.
          </Text>
        </View>
      ) : null}

      <View style={styles.whyBlock}>
        {story.points.map((item, i) => (
          <View
            key={item.mark}
            style={[
              styles.whyRow,
              i < story.points.length - 1 && {
                borderBottomColor: border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text
              style={[
                styles.whyMark,
                {
                  color: brand,
                  fontFamily: fontDisplay,
                  fontSize: tiny ? 17 : 20,
                },
              ]}
            >
              {item.mark}
            </Text>
            <View style={styles.whyCopy}>
              <Text
                style={[
                  styles.whyItemTitle,
                  {
                    color: ink,
                    fontFamily: fontBody,
                    fontSize: tiny ? 14 : 16,
                  },
                ]}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  styles.whyItemBody,
                  {
                    color: inkSoft,
                    fontFamily: fontBody,
                    fontSize: tiny ? 12 : 14,
                    lineHeight: tiny ? 17 : 20,
                  },
                ]}
              >
                {item.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function HomeScreen() {
  const { theme, toggleLightDark, resolved } = useTheme();
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const c = theme.colors;
  const isLight = resolved === 'light';
  const ink = isLight ? '#1A1C20' : c.onSurface;
  const inkSoft = isLight ? '#6B6661' : c.onSurfaceMuted;
  const brand = c.primary;
  const narrow = width < 700;
  const short = height < 720;
  const tiny = height < 600 || width < 360;
  const padX = width < 480 ? 18 : width < 900 ? 32 : 48;
  const padY = short ? 12 : 18;

  const titleSize = tiny ? 40 : short ? 50 : narrow ? 60 : 78;
  const titleLine = titleSize * 1.05;
  const subSize = tiny ? 13 : short ? 14 : 16;
  const ctaPadV = tiny ? 13 : short ? 15 : 20;
  const ctaTitleSize = tiny ? 19 : short ? 23 : 28;
  const iconSize = tiny ? 26 : short ? 30 : 34;

  const enabledApps = getEnabledApps();
  const upcoming = getComingSoonApps();
  const [openStory, setOpenStory] = useState<MiniAppId | null>(null);

  const toggleStory = (id: MiniAppId) => {
    setOpenStory((prev) => (prev === id ? null : id));
  };

  const storyPrompt = (id: MiniAppId, open: boolean) => {
    if (id === 'pulse') {
      return open
        ? 'Hide the tomato story'
        : 'Why a tomato taught the world to focus';
    }
    if (id === 'drift') {
      return open
        ? 'Hide the drift story'
        : 'Why noticing the slip beats chasing streaks';
    }
    return open ? 'Hide story' : 'Read the story';
  };

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

  const accentFor = (id: MiniAppId) =>
    id === 'drift'
      ? isLight
        ? PHASE_THEME.shortBreak.pageLight
        : PHASE_THEME.shortBreak.accent
      : brand;

  const sideBySide = width >= 720;

  return (
    <ImageBackground
      source={isLight ? DOODLE_BG_LIGHT : DOODLE_BG_DARK}
      style={[styles.page, { backgroundColor: c.background, height }]}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          !openStory && { minHeight: height },
        ]}
        showsVerticalScrollIndicator={!!openStory}
      >
        <View
          style={[
            styles.fold,
            {
              paddingHorizontal: padX,
              paddingTop: padY,
              paddingBottom: openStory ? 8 : padY,
              ...(!openStory
                ? { flexGrow: 1, minHeight: height - padY }
                : null),
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
                  {
                    color: ink,
                    fontFamily: fontBody,
                    fontSize: tiny ? 12 : 14,
                  },
                ]}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  {
                    borderColor: c.border,
                    backgroundColor: isLight ? '#FFFFFF' : c.surface,
                    opacity: pressed ? 0.88 : 1,
                    paddingVertical: tiny ? 8 : 10,
                    paddingHorizontal: tiny ? 12 : 16,
                  },
                ]}
              />
              <Pressable
                onPress={toggleLightDark}
                accessibilityLabel="Toggle color theme"
                style={({ pressed }) => [
                  styles.iconBtn,
                  {
                    borderColor: c.border,
                    backgroundColor: isLight ? '#FFFFFF' : c.surface,
                    opacity: pressed ? 0.88 : 1,
                    width: tiny ? 38 : 42,
                    height: tiny ? 38 : 42,
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

          <View style={[styles.hero, !openStory && styles.heroGrow]}>
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
                ? 'A suite of tools to focus, stay present, and go deep.'
                : 'A personal suite to help you focus, catch drift,\nand go deeper every day.'}
            </Text>

            {enabledApps.length > 0 ? (
              <View
                style={[
                  styles.ctaRow,
                  {
                    marginTop: short ? 10 : 14,
                    flexDirection: sideBySide ? 'row' : 'column',
                    alignItems: sideBySide ? 'stretch' : 'center',
                  },
                ]}
              >
                {enabledApps.map((app, index) => {
                  const Icon = APP_ICONS[app.id];
                  const accent = accentFor(app.id);
                  const open = openStory === app.id;
                  const prompt = storyPrompt(app.id, open);
                  return (
                    <View
                      key={app.id}
                      style={[
                        styles.ctaCol,
                        sideBySide ? styles.ctaColSide : styles.ctaColStack,
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.ctaWrap,
                          index === 0 ? cardMotion : null,
                          Platform.OS === 'web'
                            ? ({
                                boxShadow: `0 16px 36px ${accent}40`,
                              } as object)
                            : null,
                        ]}
                      >
                        <Pressable
                          onPress={() => {
                            if (app.route) {
                              router.push(app.route as '/pomodoro');
                            }
                          }}
                          style={({ pressed }) => [
                            styles.ctaCard,
                            {
                              backgroundColor: accent,
                              transform: [{ scale: pressed ? 0.99 : 1 }],
                              shadowColor: accent,
                              paddingVertical: ctaPadV,
                              paddingHorizontal: tiny ? 14 : 18,
                            },
                          ]}
                          accessibilityRole="link"
                          accessibilityLabel={`Open ${app.title}`}
                        >
                          <View
                            style={[
                              styles.ctaIcon,
                              {
                                width: iconSize + 16,
                                height: iconSize + 16,
                                borderRadius: (iconSize + 16) / 2,
                              },
                            ]}
                          >
                            <Icon color="#FFFFFF" size={iconSize} />
                          </View>
                          <View style={styles.ctaCopy}>
                            <Text
                              style={[
                                styles.ctaTitle,
                                {
                                  fontFamily: fontDisplay,
                                  fontSize: ctaTitleSize,
                                },
                              ]}
                            >
                              {app.title}
                            </Text>
                            <Text
                              style={[
                                styles.ctaMeta,
                                {
                                  fontFamily: fontBody,
                                  fontSize: tiny ? 12 : 13,
                                },
                              ]}
                              numberOfLines={2}
                            >
                              {app.subtitle}
                            </Text>
                          </View>
                          <IconChevron color="#FFFFFF" size={tiny ? 18 : 20} />
                        </Pressable>
                      </Animated.View>

                      <Pressable
                        onPress={() => toggleStory(app.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        accessibilityLabel={prompt}
                        style={({ pressed }) => [
                          styles.discloseBtn,
                          {
                            borderColor: c.border,
                            backgroundColor: isLight
                              ? 'rgba(255,255,255,0.7)'
                              : 'rgba(34,46,60,0.7)',
                            opacity: pressed ? 0.88 : 1,
                            marginTop: 10,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.discloseLabel,
                            {
                              color: ink,
                              fontFamily: fontBody,
                              fontSize: tiny ? 11 : 12,
                              flex: 1,
                            },
                          ]}
                        >
                          {prompt}
                        </Text>
                        <Feather
                          name={open ? 'chevron-up' : 'chevron-down'}
                          size={15}
                          color={accent}
                        />
                      </Pressable>

                      {open ? (
                        <View
                          style={[
                            styles.storyExpand,
                            {
                              borderTopColor: c.border,
                              backgroundColor: isLight
                                ? 'rgba(255,255,255,0.55)'
                                : 'rgba(34,46,60,0.45)',
                            },
                          ]}
                        >
                          <StoryBody
                            story={app.story}
                            brand={accent}
                            ink={ink}
                            inkSoft={inkSoft}
                            border={c.border}
                            tiny={tiny}
                            narrow={!sideBySide || width < 900}
                            showRhythm={app.id === 'pulse'}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          {upcoming.length > 0 ? (
            <View
              style={[
                styles.nextWrap,
                {
                  borderTopColor: c.border,
                  marginTop: openStory ? 8 : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.nextKicker,
                  {
                    color: inkSoft,
                    fontFamily: fontBody,
                    fontSize: tiny ? 11 : 12,
                  },
                ]}
              >
                Next in Focus
              </Text>
              <View style={styles.nextStack}>
                {upcoming.map((app) => {
                  const Icon = APP_ICONS[app.id];
                  const open = openStory === app.id;
                  const accent = accentFor(app.id);
                  return (
                    <View
                      key={app.id}
                      style={[
                        styles.nextCard,
                        {
                          backgroundColor: isLight
                            ? 'rgba(255,255,255,0.72)'
                            : 'rgba(34,46,60,0.72)',
                          borderColor: open ? accent : c.border,
                        },
                      ]}
                    >
                      <Pressable
                        onPress={() => toggleStory(app.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        accessibilityLabel={`${app.title}. ${app.subtitle}. ${
                          open ? 'Hide' : 'Show'
                        } description`}
                        style={({ pressed }) => [
                          styles.nextHeadBtn,
                          { opacity: pressed ? 0.88 : 1 },
                        ]}
                      >
                        <Icon color={accent} size={tiny ? 17 : 19} />
                        <View style={styles.nextHeadCopy}>
                          <View style={styles.nextTitleRow}>
                            <Text
                              style={[
                                styles.nextTitle,
                                {
                                  color: ink,
                                  fontFamily: fontDisplay,
                                  fontSize: tiny ? 15 : 17,
                                },
                              ]}
                            >
                              {app.title}
                            </Text>
                            <View
                              style={[
                                styles.soonPill,
                                {
                                  backgroundColor: isLight
                                    ? `${accent}18`
                                    : 'rgba(255,255,255,0.1)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.soonText,
                                  {
                                    color: accent,
                                    fontFamily: fontBody,
                                    fontSize: 10,
                                  },
                                ]}
                              >
                                Soon
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.nextBody,
                              {
                                color: inkSoft,
                                fontFamily: fontBody,
                                fontSize: tiny ? 12 : 13,
                                lineHeight: 17,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {app.subtitle}
                          </Text>
                        </View>
                        <Feather
                          name={open ? 'chevron-up' : 'chevron-down'}
                          size={17}
                          color={inkSoft}
                        />
                      </Pressable>

                      {open ? (
                        <View
                          style={[
                            styles.nextStory,
                            { borderTopColor: c.border },
                          ]}
                        >
                          <StoryBody
                            story={app.story}
                            brand={accent}
                            ink={ink}
                            inkSoft={inkSoft}
                            border={c.border}
                            tiny={tiny}
                            narrow={narrow}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: '100%',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
  },
  fold: {
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 2,
    paddingVertical: 12,
  },
  heroGrow: {
    flexGrow: 1,
  },
  heroTitle: {
    fontWeight: '700',
    letterSpacing: -2.6,
    textAlign: 'center',
  },
  heroSub: {
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 460,
    paddingHorizontal: 8,
  },
  ctaRow: {
    width: '100%',
    maxWidth: 920,
    gap: 16,
    justifyContent: 'center',
  },
  ctaCol: {
    gap: 0,
    alignItems: 'stretch',
  },
  ctaColSide: {
    flex: 1,
    minWidth: 0,
    maxWidth: 440,
  },
  ctaColStack: {
    width: '100%',
    maxWidth: 520,
  },
  ctaWrap: {
    width: '100%',
    shadowOpacity: 0.26,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 11,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
  },
  ctaIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCopy: { flex: 1, gap: 2, minWidth: 0 },
  ctaTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  ctaMeta: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  discloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  discloseLabel: {
    fontWeight: '600',
  },
  storyExpand: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  storyKicker: {
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  storyTitle: {
    fontWeight: '700',
    letterSpacing: -0.9,
    marginBottom: 10,
  },
  storyLead: {
    fontWeight: '500',
  },
  rhythmBlock: {
    marginTop: 22,
    gap: 12,
  },
  rhythmLabel: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rhythmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  rhythmLink: {
    width: 12,
    height: 2,
    borderRadius: 1,
    marginBottom: 16,
  },
  beat: {
    alignItems: 'center',
    gap: 3,
    minWidth: 46,
  },
  beatOrb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  beatNum: {
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  beatHint: {
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  rhythmCaption: {
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 400,
    alignSelf: 'center',
  },
  whyBlock: {
    marginTop: 20,
  },
  whyRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
  },
  whyMark: {
    fontWeight: '700',
    letterSpacing: -0.4,
    minWidth: 30,
  },
  whyCopy: {
    flex: 1,
    gap: 3,
  },
  whyItemTitle: {
    fontWeight: '700',
  },
  whyItemBody: {
    fontWeight: '500',
  },
  nextWrap: {
    zIndex: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    gap: 10,
    paddingTop: 14,
    paddingBottom: 18,
  },
  nextKicker: {
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nextStack: {
    gap: 10,
  },
  nextCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  nextHeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nextHeadCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextTitle: {
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  soonPill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  soonText: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  nextBody: {
    fontWeight: '500',
  },
  nextStory: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 12,
  },
});
