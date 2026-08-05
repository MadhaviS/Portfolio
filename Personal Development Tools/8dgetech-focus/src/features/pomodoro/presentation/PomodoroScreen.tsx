import React, { useEffect, useState } from 'react';
import {
  Modal,
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
import {
  DEFAULT_SETTINGS,
  PHASE_THEME,
  formatFinishClock,
  formatMinutesShort,
  formatTimer,
  type PomodoroPhase,
  type PomodoroSettings,
  type PomodoroTask,
} from '../domain/types';
import { usePomodoroTimer } from './usePomodoroTimer';
import { HowItWorksTour } from './HowItWorksTour';
import { useHowItWorksTour } from './useHowItWorksTour';
import { ReportModal } from './ReportModal';
import { CalendarModal } from './CalendarModal';
import { SoftDoodles } from '../../../core/theme/SoftDoodles';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { useAuth } from '../../../core/auth/AuthProvider';
import { pomodoroRepository } from '../data/pomodoroRepository';

const MODES: PomodoroPhase[] = ['focus', 'shortBreak', 'longBreak'];

export function PomodoroScreen() {
  const {
    phase,
    remaining,
    progress,
    running,
    settings,
    stats,
    tasks,
    activeTask,
    activeTaskId,
    finishAt,
    start,
    pause,
    reset,
    selectPhase,
    updateSettings,
    addTask,
    selectTask,
    toggleTaskDone,
    changeEstimate,
    deleteTask,
  } = usePomodoroTimer();

  const router = useRouter();
  const { isGuest, user, signOut, signInAsGuest } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const { open: tourOpen, complete: completeTour } = useHowItWorksTour();
  const theme = PHASE_THEME[phase];
  const isPartial = remaining > 0 && remaining < durationForPhaseSeconds(settings, phase);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const prev = document.title;
    document.title = `${formatTimer(remaining)} — ${PHASE_THEME[phase].label}`;
    return () => {
      document.title = prev;
    };
  }, [remaining, phase]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.push('/')}
            hitSlop={8}
            accessibilityLabel="Back to home"
          >
            <Text style={styles.brand}>Pomodoro</Text>
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => setReportOpen(true)}
              style={({ pressed }) => [
                styles.navBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.navBtnLabel}>Report</Text>
            </Pressable>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [
                styles.navBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.navBtnLabel}>Setting</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (isGuest) {
                  router.push('/sign-in');
                  return;
                }
                await signOut();
                await signInAsGuest();
                pomodoroRepository.switchUser('local-guest', { reset: true });
              }}
              style={({ pressed }) => [
                styles.navBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.navBtnLabel}>
                {isGuest ? 'Login' : 'Logout'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.timerCard, { backgroundColor: theme.panel }]}>
          <SoftDoodles density={1} accent="rgba(255,255,255,0.35)" />
          <View style={styles.modeTabs}>
            {MODES.map((mode) => {
              const active = mode === phase;
              return (
                <Pressable
                  key={mode}
                  onPress={() => selectPhase(mode)}
                  style={[
                    styles.modeTab,
                    active && styles.modeTabActive,
                  ]}
                >
                  <Text style={styles.modeTabText}>
                    {PHASE_THEME[mode].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.timerText}>{formatTimer(remaining)}</Text>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>

          {activeTask && !activeTask.done ? (
            <Text style={styles.workingOn} numberOfLines={1}>
              #{tasks.findIndex((t) => t.id === activeTask.id) + 1}{' '}
              {activeTask.title}
            </Text>
          ) : (
            <Text style={styles.workingOn}>Time to focus!</Text>
          )}

          <Pressable
            onPress={running ? pause : start}
            style={({ pressed }) => [
              styles.startBtn,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.startLabel, { color: theme.bg }]}>
              {running ? 'PAUSE' : isPartial ? 'RESUME' : 'START'}
            </Text>
          </Pressable>

          <Pressable onPress={reset} style={styles.skipLink}>
            <Text style={styles.skipText}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.tasksHeader}>
          <Text style={styles.tasksTitle}>Tasks</Text>
          <Text style={styles.tasksMeta}>
            {stats.focusCompletedToday} /{' '}
            {Math.max(
              stats.focusCompletedToday,
              tasks.reduce((sum, t) => sum + t.estimatePomodoros, 0),
            )}
          </Text>
        </View>

        <View style={styles.taskList}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              active={task.id === activeTaskId}
              onSelect={() => selectTask(task.id)}
              onToggle={() => toggleTaskDone(task.id)}
              onInc={() => changeEstimate(task.id, 1)}
              onDec={() => changeEstimate(task.id, -1)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </View>

        <View style={styles.addRow}>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Add a task..."
            placeholderTextColor="rgba(255,255,255,0.55)"
            style={styles.addInput}
            onSubmitEditing={() => {
              if (!draftTitle.trim()) return;
              addTask(draftTitle.trim(), 1);
              setDraftTitle('');
            }}
          />
          <Pressable
            onPress={() => {
              if (!draftTitle.trim()) return;
              addTask(draftTitle.trim(), 1);
              setDraftTitle('');
            }}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.finishCard}>
          <Text style={styles.finishLabel}>Est. finish</Text>
          <Text style={styles.finishValue}>{formatFinishClock(finishAt)}</Text>
          <Text style={styles.finishHint}>
            Based on open task estimates · {formatMinutesShort(stats.focusMinutesToday)}{' '}
            focused today
          </Text>
        </View>

        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>
            {isGuest
              ? 'Focus today'
              : `Hi ${user?.displayName ?? 'there'} · focus today`}
          </Text>
          <View style={styles.reportRow}>
            <ReportStat label="Today" value={`${stats.focusCompletedToday} pomos`} />
            <ReportStat
              label="Focus time"
              value={formatMinutesShort(stats.focusMinutesToday)}
            />
            <ReportStat
              label="All time"
              value={formatMinutesShort(stats.focusMinutesAllTime)}
            />
          </View>
        </View>

        <Text style={styles.powered}>powered by 8dgeTech@2026</Text>
      </ScrollView>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
        disabled={running}
      />

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onOpenCalendar={() => {
          setReportOpen(false);
          setCalendarOpen(true);
        }}
        stats={stats}
      />

      <CalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />

      <HowItWorksTour open={tourOpen} onFinish={completeTour} />
    </View>
  );
}

function TaskRow({
  task,
  active,
  onSelect,
  onToggle,
  onInc,
  onDec,
  onDelete,
}: {
  task: PomodoroTask;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onInc: () => void;
  onDec: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.taskRow,
        active && styles.taskRowActive,
        task.done && styles.taskRowDone,
      ]}
    >
      <Pressable onPress={onToggle} hitSlop={8} style={styles.checkHit}>
        <View style={[styles.check, task.done && styles.checkOn]}>
          {task.done ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      </Pressable>

      <View style={styles.taskBody}>
        <Text
          style={[styles.taskTitle, task.done && styles.taskTitleDone]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <Text style={styles.taskPomos}>
          {task.completedPomodoros}/{task.estimatePomodoros}
        </Text>
      </View>

      <View style={styles.estControls}>
        <Pressable onPress={onDec} style={styles.estBtn}>
          <Text style={styles.estBtnText}>−</Text>
        </Pressable>
        <Pressable onPress={onInc} style={styles.estBtn}>
          <Text style={styles.estBtnText}>+</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.estBtn}>
          <Text style={styles.estBtnText}>×</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reportStat}>
      <Text style={styles.reportStatValue}>{value}</Text>
      <Text style={styles.reportStatLabel}>{label}</Text>
    </View>
  );
}

function SettingsModal({
  open,
  settings,
  onClose,
  onChange,
  disabled,
}: {
  open: boolean;
  settings: PomodoroSettings;
  onClose: () => void;
  onChange: (partial: Partial<PomodoroSettings>) => void;
  disabled: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isCompact = width < 560;

  return (
    <Modal
      visible={open}
      animationType={isCompact ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalBackdrop,
          isCompact ? styles.modalBackdropCompact : styles.modalBackdropWide,
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.modalCard,
            isCompact ? styles.modalCardCompact : styles.modalCardWide,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              maxHeight: height * (isCompact ? 0.88 : 0.82),
              width: isCompact ? '100%' : Math.min(420, width - 48),
            },
          ]}
        >
          {isCompact ? (
            <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
          ) : null}

          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: c.onSurface }]}>
              Timer Setting
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[styles.modalClose, { backgroundColor: c.backgroundAlt }]}
              accessibilityLabel="Close settings"
            >
              <Text style={[styles.modalCloseText, { color: c.onSurface }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <NumberField
              label="Pomodoro"
              value={settings.focusMinutes}
              disabled={disabled}
              onChange={(focusMinutes) => onChange({ focusMinutes })}
            />
            <NumberField
              label="Short Break"
              value={settings.shortBreakMinutes}
              disabled={disabled}
              onChange={(shortBreakMinutes) => onChange({ shortBreakMinutes })}
            />
            <NumberField
              label="Long Break"
              value={settings.longBreakMinutes}
              disabled={disabled}
              onChange={(longBreakMinutes) => onChange({ longBreakMinutes })}
            />
            <NumberField
              label="Long Break interval"
              value={settings.sessionsUntilLongBreak}
              disabled={disabled}
              min={2}
              max={8}
              onChange={(sessionsUntilLongBreak) =>
                onChange({ sessionsUntilLongBreak })
              }
            />

            <Pressable
              disabled={disabled}
              onPress={() => onChange({ autoContinue: !settings.autoContinue })}
              style={[
                styles.autoRow,
                {
                  borderColor: c.border,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.autoLabel, { color: c.onSurface }]}>
                Auto start next phase
              </Text>
              <Text style={[styles.autoValue, { color: c.primary }]}>
                {settings.autoContinue ? 'ON' : 'OFF'}
              </Text>
            </Pressable>

            <Pressable
              disabled={disabled}
              onPress={() => onChange({ ...DEFAULT_SETTINGS })}
              style={[
                styles.resetBtn,
                {
                  borderColor: c.border,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.resetBtnText, { color: c.onSurface }]}>
                Reset to default
              </Text>
              <Text style={[styles.resetHint, { color: c.onSurfaceMuted }]}>
                25 · 5 · 15 · auto on
              </Text>
            </Pressable>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={[styles.modalDone, { backgroundColor: isCompact ? '#BA4949' : c.primary }]}
          >
            <Text
              style={[
                styles.modalDoneText,
                { color: isCompact ? '#FFFFFF' : c.primaryText },
              ]}
            >
              OK
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  min = 1,
  max = 120,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
  min?: number;
  max?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.numberField}>
      <Text style={[styles.numberLabel, { color: c.onSurfaceMuted }]}>{label}</Text>
      <View style={styles.numberControls}>
        <Pressable
          disabled={disabled}
          onPress={() => onChange(Math.max(min, value - 1))}
          style={[styles.numBtn, { backgroundColor: c.backgroundAlt }]}
        >
          <Text style={[styles.numBtnText, { color: c.onSurface }]}>−</Text>
        </Pressable>
        <Text style={[styles.numberValue, { color: c.onSurface }]}>{value}</Text>
        <Pressable
          disabled={disabled}
          onPress={() => onChange(Math.min(max, value + 1))}
          style={[styles.numBtn, { backgroundColor: c.backgroundAlt }]}
        >
          <Text style={[styles.numBtnText, { color: c.onSurface }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function durationForPhaseSeconds(
  settings: PomodoroSettings,
  phase: PomodoroPhase,
): number {
  const minutes =
    phase === 'focus'
      ? settings.focusMinutes
      : phase === 'shortBreak'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
  return minutes * 60;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 48,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  brand: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  settingsBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  settingsLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  navBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  navBtnLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  timerCard: {
    borderRadius: 8,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  modeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  modeTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  modeTabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  timerText: {
    color: '#fff',
    fontSize: 96,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    lineHeight: 110,
  },
  progressTrack: {
    width: '88%',
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  workingOn: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  startBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 56,
    borderRadius: 8,
    marginTop: 4,
    // Pomofocus-like bottom shadow edge
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  startLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  skipLink: { padding: 6 },
  skipText: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  tasksHeader: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.55)',
    paddingBottom: 10,
  },
  tasksTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tasksMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  taskList: { marginTop: 12, gap: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent',
  },
  taskRowActive: {
    borderLeftColor: '#222',
  },
  taskRowDone: {
    opacity: 0.72,
  },
  checkHit: { padding: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#DFDFDF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: '#BA4949',
    borderColor: '#BA4949',
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  taskBody: { flex: 1, gap: 2 },
  taskTitle: { color: '#555', fontSize: 15, fontWeight: '600' },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskPomos: { color: '#999', fontSize: 12 },
  estControls: { flexDirection: 'row', gap: 4 },
  estBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  estBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
  addRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.45)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  finishCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  finishLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  finishValue: { color: '#fff', fontSize: 28, fontWeight: '700' },
  finishHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    textAlign: 'center',
  },
  reportCard: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  reportTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between' },
  reportStat: { alignItems: 'center', flex: 1 },
  reportStatValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reportStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  powered: {
    marginTop: 28,
    marginBottom: 8,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdropWide: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBackdropCompact: {
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderWidth: 1,
    gap: 0,
    zIndex: 2,
    overflow: 'hidden',
  },
  modalCardWide: {
    borderRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    alignSelf: 'center',
  },
  modalCardCompact: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  modalBody: {
    gap: 14,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  numberField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  numberLabel: { fontSize: 14, fontWeight: '600' },
  numberControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnText: { fontSize: 18, fontWeight: '600' },
  numberValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  autoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
  },
  autoLabel: { fontSize: 14, fontWeight: '600' },
  autoValue: { fontWeight: '800' },
  resetBtn: {
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  resetHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalDone: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneText: { fontWeight: '700', fontSize: 15 },
});
