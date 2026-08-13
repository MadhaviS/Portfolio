import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../../public/theme/ThemeProvider';
import { fontBody } from '../../../public/theme/fonts';
import { AuthAccountButton } from '../../../public/auth/AuthAccountButton';
import { IconMoon, IconSun } from '../../../public/theme/LineIcons';
import { DRIFT_CAUSES, formatAway } from '../domain/types';
import { useDrift } from './DriftProvider';
import { DriftAtmosphere, driftHeroHeight } from './DriftAtmosphere';
import { DriftDayReportModal } from './DriftDayReportModal';
import { DriftReportModal } from './DriftReportModal';
import { DriftCalendarModal } from './DriftCalendarModal';
import { PHASE_THEME } from '../../pulse/domain/types';

const SHORT = PHASE_THEME.shortBreak;

/** Edge doodles (white line art); page fill from Drift teal theme. */
const DOODLE_FRAME = require('../../../../assets/drift-doodles-frame.png');

/**
 * Idle vs active:
 * - Idle: calm orb (message only). Setup lives in a panel under it.
 * - Active: orb shows live state; log/end panel below.
 */
const PALETTE = {
  light: {
    bg: SHORT.pageLight,
    orb: SHORT.bg,
    orbRing: 'rgba(255,255,255,0.35)',
    ink: '#FFFFFF',
    inkMuted: 'rgba(255,255,255,0.9)',
    onField: '#FFFFFF',
    chromeBg: 'rgba(255,255,255,0.18)',
    chromeBorder: 'rgba(255,255,255,0.4)',
    surface: '#F4F8F6',
    surfaceInk: '#1A2A26',
    surfaceMuted: '#4F6862',
    panel: 'rgba(255,255,255,0.14)',
    panelBorder: 'rgba(255,255,255,0.28)',
    fieldBg: 'rgba(255,255,255,0.2)',
    fieldBorder: 'rgba(255,255,255,0.42)',
    accent: '#FFFFFF',
    onAccent: SHORT.pageLight,
    placeholder: 'rgba(255,255,255,0.62)',
    divider: 'rgba(26, 42, 38, 0.1)',
  },
  dark: {
    bg: SHORT.pageDark,
    orb: SHORT.bg,
    orbRing: 'rgba(255,255,255,0.28)',
    ink: '#FFFFFF',
    inkMuted: 'rgba(255,255,255,0.88)',
    onField: '#F2F7F5',
    chromeBg: 'rgba(255,255,255,0.1)',
    chromeBorder: 'rgba(255,255,255,0.26)',
    surface: '#E8F0ED',
    surfaceInk: '#121C1A',
    surfaceMuted: '#455E58',
    panel: 'rgba(255,255,255,0.1)',
    panelBorder: 'rgba(255,255,255,0.2)',
    fieldBg: 'rgba(255,255,255,0.14)',
    fieldBorder: 'rgba(255,255,255,0.3)',
    accent: SHORT.accent,
    onAccent: SHORT.pageDark,
    placeholder: 'rgba(255,255,255,0.55)',
    divider: 'rgba(18, 28, 26, 0.1)',
  },
} as const;

export function DriftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { resolved, toggleLightDark } = useTheme();
  const isLight = resolved === 'light';
  const p = isLight ? PALETTE.light : PALETTE.dark;

  const {
    session,
    intentionDraft,
    setIntentionDraft,
    selectedTaskId,
    setSelectedTaskId,
    pulseTasks,
    nudgeVisible,
    todayInsight,
    driftCount,
    start,
    stop,
    logManual,
    markReturn,
    minimize,
  } = useDrift();

  const [reportOpen, setReportOpen] = useState(false);
  const [dayReportOpen, setDayReportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const quiet = !!session;
  const orbSize = Math.min(
    session ? 300 : 220,
    Math.max(session ? 240 : 180, winW - (session ? 96 : 140)),
    winH * (session ? 0.34 : 0.26),
  );
  const heroH = driftHeroHeight(orbSize, quiet || !session);
  // Scale orb copy/buttons so “I'm back” / “End session” fit on small phones.
  const orbCompact = orbSize < 260;
  const orbTight = orbSize < 220;
  const orbTitleSize = orbTight ? 15 : orbCompact ? 17 : 20;
  const orbTitleLine = orbTight ? 20 : orbCompact ? 22 : 26;
  const orbBtnPadV = orbTight ? 8 : orbCompact ? 9 : 11;
  const orbBtnPadH = orbTight ? 14 : orbCompact ? 16 : 20;
  const orbBtnText = orbTight ? 12 : orbCompact ? 13 : 14;
  const orbStatNum = orbTight ? 20 : orbCompact ? 24 : 28;
  const orbGap = orbTight ? 5 : orbCompact ? 6 : 8;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = 'Drift · Focus';
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = p.bg;
    body.style.backgroundColor = p.bg;
    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, [p.bg]);

  const returnCount =
    session?.events.filter((e) => e.kind === 'return').length ?? 0;
  const todayDrifts = todayInsight.drifts;
  const isWeb = Platform.OS === 'web';
  const bottomPad = Math.max(insets.bottom, 16) + 28;

  const goHome = () => {
    if (session) minimize();
    router.navigate('/');
  };

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={goHome} hitSlop={8} accessibilityLabel="Back to home">
        <Text style={[styles.brand, { color: p.onField }]}>Drift</Text>
      </Pressable>
      <View style={styles.topActions}>
        <Pressable
          onPress={() => setReportOpen(true)}
          accessibilityLabel="Open Drift report"
          style={({ pressed }) => [
            styles.iconAction,
            {
              backgroundColor: p.chromeBg,
              borderColor: p.chromeBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="bar-chart-2" size={16} color={p.onField} />
        </Pressable>
        <Pressable
          onPress={() => setCalendarOpen(true)}
          accessibilityLabel="Open Drift calendar"
          style={({ pressed }) => [
            styles.iconAction,
            {
              backgroundColor: p.chromeBg,
              borderColor: p.chromeBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="calendar" size={16} color={p.onField} />
        </Pressable>
        <AuthAccountButton
          color={p.onField}
          iconSize={18}
          onOpenReport={() => setReportOpen(true)}
          style={({ pressed }) => [
            styles.iconAction,
            {
              backgroundColor: p.chromeBg,
              borderColor: p.chromeBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        />
        <Pressable
          onPress={toggleLightDark}
          accessibilityLabel="Toggle color theme"
          style={({ pressed }) => [
            styles.iconAction,
            {
              backgroundColor: p.chromeBg,
              borderColor: p.chromeBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {isLight ? (
            <IconSun color={p.onField} size={16} />
          ) : (
            <IconMoon color={p.onField} size={16} />
          )}
        </Pressable>
      </View>
    </View>
  );

  const main = (
    <>
      <View style={[styles.hero, { minHeight: heroH }]}>
        <DriftAtmosphere orbSize={orbSize} quiet={quiet || !session} />
        <View
          style={[
            styles.orb,
            {
              width: orbSize,
              height: orbSize,
              borderRadius: orbSize / 2,
              backgroundColor: p.orb,
              borderColor: p.orbRing,
              shadowColor: '#000',
              gap: session ? orbGap : 8,
              paddingHorizontal: session
                ? orbTight
                  ? 16
                  : orbCompact
                    ? 20
                    : 24
                : 22,
            },
          ]}
        >
          {!session ? (
            <>
              <Text style={[styles.orbKicker, { color: p.inkMuted }]}>
                Drift
              </Text>
              <Text style={[styles.orbTitleIdle, { color: p.ink }]}>
                Notice the slip.{'\n'}Return softly.
              </Text>
              {todayDrifts > 0 ? (
                <Text style={[styles.orbIdleMeta, { color: p.inkMuted }]}>
                  {todayDrifts} drift{todayDrifts === 1 ? '' : 's'} today
                </Text>
              ) : (
                <Text style={[styles.orbIdleMeta, { color: p.inkMuted }]}>
                  Ready when you are
                </Text>
              )}
            </>
          ) : nudgeVisible ? (
            <>
              <Text
                style={[
                  styles.orbKicker,
                  {
                    color: p.inkMuted,
                    fontSize: orbTight ? 10 : 11,
                  },
                ]}
              >
                Welcome back
              </Text>
              <Text
                style={[
                  styles.orbTitle,
                  {
                    color: p.ink,
                    fontSize: orbTitleSize,
                    lineHeight: orbTitleLine,
                  },
                ]}
                numberOfLines={2}
              >
                {session.intention}
              </Text>
              <Text
                style={[
                  styles.orbHint,
                  {
                    color: p.inkMuted,
                    fontSize: orbTight ? 11 : 12,
                    lineHeight: orbTight ? 15 : 17,
                    maxWidth: orbSize * 0.72,
                  },
                ]}
              >
                Attention wandered. Acknowledge it and continue.
              </Text>
              <Pressable
                onPress={markReturn}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: p.accent,
                    opacity: pressed ? 0.92 : 1,
                    minWidth: 0,
                    paddingVertical: orbBtnPadV,
                    paddingHorizontal: orbBtnPadH,
                    marginTop: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: p.onAccent, fontSize: orbBtnText },
                  ]}
                >
                  I{"'"}m back
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.livePill,
                  {
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    paddingVertical: orbTight ? 4 : 6,
                    paddingHorizontal: orbTight ? 10 : 12,
                  },
                ]}
              >
                <View style={styles.liveDot} />
                <Text
                  style={[
                    styles.liveText,
                    { color: p.ink, fontSize: orbTight ? 10 : 11 },
                  ]}
                >
                  Watching
                </Text>
              </View>
              <Text
                style={[
                  styles.orbTitle,
                  {
                    color: p.ink,
                    fontSize: orbTitleSize,
                    lineHeight: orbTitleLine,
                  },
                ]}
                numberOfLines={2}
              >
                {session.intention}
              </Text>
              <View
                style={[
                  styles.statRow,
                  { gap: orbTight ? 14 : 18, marginVertical: 0 },
                ]}
              >
                <View style={styles.stat}>
                  <Text
                    style={[
                      styles.statNum,
                      { color: p.ink, fontSize: orbStatNum },
                    ]}
                  >
                    {driftCount}
                  </Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: p.inkMuted, fontSize: orbTight ? 10 : 11 },
                    ]}
                  >
                    drifts
                  </Text>
                </View>
                <View
                  style={[
                    styles.statDivider,
                    {
                      backgroundColor: 'rgba(255,255,255,0.35)',
                      height: orbTight ? 26 : 30,
                    },
                  ]}
                />
                <View style={styles.stat}>
                  <Text
                    style={[
                      styles.statNum,
                      { color: p.ink, fontSize: orbStatNum },
                    ]}
                  >
                    {returnCount}
                  </Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: p.inkMuted, fontSize: orbTight ? 10 : 11 },
                    ]}
                  >
                    returns
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={stop}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: p.accent,
                    opacity: pressed ? 0.92 : 1,
                    minWidth: 0,
                    paddingVertical: orbBtnPadV,
                    paddingHorizontal: orbBtnPadH,
                    marginTop: 2,
                  },
                ]}
                accessibilityLabel="End Drift session"
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: p.onAccent, fontSize: orbBtnText },
                  ]}
                >
                  End session
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {!session ? (
        <View
          style={[
            styles.setupPanel,
            {
              backgroundColor: p.panel,
              borderColor: p.panelBorder,
            },
          ]}
        >
          <Text style={[styles.panelTitle, { color: p.ink }]}>
            Start a watch
          </Text>
              <Text style={[styles.panelHint, { color: p.inkMuted }]}>
                {selectedTaskId
                  ? 'Using your Pulse task — change it or edit the intention.'
                  : 'Choose a Pulse task, or type what you want to protect.'}
              </Text>
          {pulseTasks.length > 0 ? (
            <View style={styles.taskPickRowSetup}>
              {pulseTasks.map((task) => {
                const active = selectedTaskId === task.id;
                return (
                  <Pressable
                    key={task.id}
                    onPress={() =>
                      setSelectedTaskId(active ? null : task.id)
                    }
                    style={({ pressed }) => [
                      styles.taskChip,
                      {
                        backgroundColor: active
                          ? 'rgba(255,255,255,0.95)'
                          : p.surface,
                        borderColor: active ? '#fff' : 'transparent',
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.taskChipText,
                        {
                          color: active ? SHORT.pageLight : p.surfaceInk,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {task.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.setupEmptyTasks, { color: p.inkMuted }]}>
              No open Pulse tasks — name an intention below.
            </Text>
          )}
          <TextInput
            value={intentionDraft}
            onChangeText={setIntentionDraft}
            placeholder="What are you protecting?"
            placeholderTextColor={p.placeholder}
            style={[
              styles.setupInput,
              {
                color: p.ink,
                backgroundColor: p.fieldBg,
                borderColor: p.fieldBorder,
              },
            ]}
          />
          <Pressable
            onPress={start}
            style={({ pressed }) => [
              styles.setupStartBtn,
              {
                backgroundColor: p.accent,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start Drift session"
          >
            <Text style={[styles.primaryBtnText, { color: p.onAccent }]}>
              Start watching
            </Text>
          </Pressable>
        </View>
      ) : null}

      {session && !nudgeVisible ? (
        <View
          style={[
            styles.actionPanel,
            {
              backgroundColor: p.panel,
              borderColor: p.panelBorder,
            },
          ]}
        >
          <Text style={[styles.panelTitle, { color: p.ink }]}>
            Caught yourself?
          </Text>
          <Text style={[styles.panelHint, { color: p.inkMuted }]}>
            Tap to log a drift. Leave the tab anytime — watching stays in the
            sticky chip.
          </Text>
          <View style={styles.causeRow}>
            {DRIFT_CAUSES.map((cause) => (
              <Pressable
                key={cause.id}
                onPress={() => logManual(cause.id)}
                style={({ pressed }) => [
                  styles.causeChip,
                  {
                    backgroundColor: p.surface,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Text style={[styles.causeText, { color: p.surfaceInk }]}>
                  {cause.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => setDayReportOpen(true)}
        style={({ pressed }) => [
          styles.weekCard,
          {
            backgroundColor: p.surface,
            borderColor: isLight
              ? 'rgba(255,255,255,0.5)'
              : 'transparent',
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open day report"
      >
        <View style={styles.todayRow}>
          <Text style={[styles.weekTitle, { color: p.surfaceInk }]}>
            Today
          </Text>
          <View
            style={[styles.weekBadge, { backgroundColor: `${SHORT.bg}22` }]}
          >
            <Text style={[styles.weekBadgeNum, { color: SHORT.bg }]}>
              {todayDrifts}
            </Text>
            <Text style={[styles.weekBadgeLabel, { color: p.surfaceMuted }]}>
              drifts
            </Text>
          </View>
        </View>

        <View style={styles.todayLine}>
          {todayInsight.watchedSeconds > 0 || todayDrifts > 0 ? (
            <Text style={[styles.todayLineText, { color: p.surfaceMuted }]}>
              <Text style={{ color: SHORT.bg, fontWeight: '800' }}>
                {formatAway(todayInsight.focusSeconds)}
              </Text>
              {' focus · '}
              <Text style={{ color: '#C47B5A', fontWeight: '800' }}>
                {formatAway(todayInsight.driftedSeconds)}
              </Text>
              {' drifted'}
            </Text>
          ) : (
            <Text style={[styles.todayLineText, { color: p.surfaceMuted }]}>
              No watch yet — start to track today
            </Text>
          )}
          <Text style={[styles.todayChevron, { color: SHORT.bg }]}>→</Text>
        </View>
      </Pressable>
    </>
  );

  const stagePad = {
    paddingTop: Math.max(insets.top, 14) + 4,
    paddingBottom: bottomPad,
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: p.bg },
        isWeb ? styles.rootWeb : null,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.doodleHost, isWeb ? styles.doodleHostWeb : null]}
      >
        <Image
          source={DOODLE_FRAME}
          style={[styles.doodleFrame, { opacity: isLight ? 0.72 : 0.55 }]}
          resizeMode="cover"
        />
      </View>

      {isWeb ? (
        <View style={[styles.stage, styles.stageWeb, stagePad]}>
          {topBar}
          <View style={styles.pageBody}>{main}</View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.stage, stagePad, styles.pageBody]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          bounces
        >
          {topBar}
          {main}
        </ScrollView>
      )}

      <DriftDayReportModal
        open={dayReportOpen}
        onClose={() => setDayReportOpen(false)}
        onOpenWeekReport={() => setReportOpen(true)}
      />
      <DriftReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onOpenCalendar={() => {
          setReportOpen(false);
          setCalendarOpen(true);
        }}
      />
      <DriftCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  /** Full-viewport page scroll — not a nested pane under the header. */
  rootWeb: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'auto',
    // @ts-expect-error RN web scrollbar axis
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  doodleHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  doodleHostWeb: {
    position: 'fixed' as unknown as 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  doodleFrame: {
    width: '100%',
    height: '100%',
  },
  stage: {
    zIndex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  stageWeb: {
    position: 'relative',
    flexGrow: 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    zIndex: 3,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: {
    fontFamily: fontBody,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBody: {
    width: '100%',
    alignItems: 'stretch',
    paddingTop: 4,
    gap: 18,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
    zIndex: 2,
    borderWidth: 1.5,
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7DFFB3',
  },
  liveText: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  orbKicker: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  orbTitle: {
    fontFamily: fontBody,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    lineHeight: 30,
  },
  orbTitleIdle: {
    fontFamily: fontBody,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 28,
  },
  orbIdleMeta: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  orbHint: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 230,
  },
  setupPanel: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  setupEmptyTasks: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  taskPickRowSetup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setupInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 13,
    fontFamily: fontBody,
    fontWeight: '600',
    fontSize: 15,
  },
  setupStartBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  taskChipText: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    minWidth: 168,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: fontBody,
    fontSize: 15,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginVertical: 2,
  },
  stat: { alignItems: 'center', gap: 2, minWidth: 58 },
  statDivider: { width: 1, height: 34 },
  statNum: {
    fontFamily: fontBody,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '600',
  },
  actionPanel: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    alignItems: 'stretch',
  },
  panelTitle: {
    fontFamily: fontBody,
    fontSize: 16,
    fontWeight: '700',
  },
  panelHint: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 4,
  },
  causeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  causeChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 72,
    alignItems: 'center',
  },
  causeText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
  },
  endBtn: {
    marginTop: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  endBtnText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
  },
  weekCard: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  todayLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  todayLineText: {
    flex: 1,
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  todayChevron: {
    fontFamily: fontBody,
    fontSize: 16,
    fontWeight: '700',
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  weekTitle: {
    fontFamily: fontBody,
    fontSize: 17,
    fontWeight: '700',
  },
  weekHint: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 18,
  },
  weekBadge: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  weekBadgeNum: {
    fontFamily: fontBody,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  weekBadgeLabel: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '600',
  },
  taskStatsBlock: {
    gap: 10,
    marginTop: 4,
  },
  taskStatsLabel: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeSplitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeSplitCard: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  timeSplitLabel: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timeSplitValue: {
    fontFamily: fontBody,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  splitTrackWrap: { gap: 6 },
  splitTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  splitFocus: { height: '100%' },
  splitDrift: { height: '100%' },
  splitMeta: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '600',
  },
  hourBlock: { gap: 8 },
  hourChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 100,
    gap: 2,
  },
  hourCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  hourVal: {
    fontFamily: fontBody,
    fontSize: 9,
    fontWeight: '700',
    minHeight: 12,
  },
  hourBar: {
    width: '70%',
    maxWidth: 16,
    borderRadius: 4,
  },
  hourStack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hourLabel: {
    fontFamily: fontBody,
    fontSize: 9,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '600',
  },
  taskStatRow: { gap: 5 },
  taskStatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  taskStatTitle: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  taskStatCount: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '800',
  },
  taskStatTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  taskStatFill: {
    height: '100%',
    borderRadius: 4,
  },
  taskTimeMeta: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '500',
  },
  reportLink: {
    paddingTop: 4,
    alignSelf: 'flex-start',
  },
  reportLinkText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  dayRow: {
    paddingVertical: 11,
  },
  dayDate: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  dayMeta: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
  },
});
