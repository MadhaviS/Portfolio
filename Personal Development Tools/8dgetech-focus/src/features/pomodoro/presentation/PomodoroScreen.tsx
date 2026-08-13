import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  ALARM_SOUND_OPTIONS,
  DEFAULT_SETTINGS,
  FOCUS_SOUND_OPTIONS,
  PHASE_THEME,
  formatFinishClock,
  formatMinutesShort,
  formatTimer,
  type PomodoroPhase,
  type PomodoroSettings,
  type PomodoroTask,
} from '../domain/types';
import { usePomodoro } from './PomodoroProvider';
import { HowItWorksTour } from './HowItWorksTour';
import { useHowItWorksTour } from './useHowItWorksTour';
import { ReportModal } from './ReportModal';
import { CalendarModal } from './CalendarModal';
import { AddTaskModal } from './AddTaskModal';
import { RitualRing } from './RitualRing';
import { PhaseIconGlyph } from './PhaseIcon';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { fontBody } from '../../../core/theme/fonts';
import { AuthAccountButton } from '../../../core/auth/AuthAccountButton';
import { IconGear, IconMoon, IconSun } from '../../../core/theme/LineIcons';
import { previewSound } from '../data/pomodoroAudio';

const MODES: PomodoroPhase[] = ['focus', 'shortBreak', 'longBreak'];

const PHASE_RITUAL_LABEL: Record<PomodoroPhase, string> = {
  focus: 'FOCUS',
  shortBreak: 'SHORT BREAK',
  longBreak: 'LONG BREAK',
};

const PHASE_TAB_LABEL: Record<PomodoroPhase, string> = {
  focus: 'Focus',
  shortBreak: 'Short',
  longBreak: 'Long',
};

/** Original doodle art as one transparent overlay; phase fill from PHASE_THEME. */
const DOODLE_FRAME = require('../../../../assets/pomodoro-doodles-frame.png');

export function PomodoroScreen() {
  const {
    phase,
    remaining,
    progress,
    running,
    isPartial,
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
    updateTaskDetails,
    selectTask,
    toggleTaskDone,
    deleteTask,
    minimize,
  } = usePomodoro();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { resolved, toggleLightDark } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PomodoroTask | null>(null);
  const [todayOpen, setTodayOpen] = useState(false);
  const { open: tourOpen, complete: completeTour } = useHowItWorksTour();
  const theme = PHASE_THEME[phase];
  const isLight = resolved === 'light';
  const pageBg = isLight ? theme.pageLight : theme.pageDark;
  const ink = '#FFFFFF';
  const inkMuted = 'rgba(255,255,255,0.72)';
  const chromeBtnBg = 'rgba(255,255,255,0.12)';
  const chromeBorder = 'rgba(255,255,255,0.22)';
  const ringSize = Math.min(360, Math.max(300, winW - 48));
  /** Light: bright arc on phase wash. Dark: phase accent on deep page. */
  const ringProgress = isLight ? '#FFFFFF' : theme.accent;
  const ringTrack = isLight
    ? 'rgba(255,255,255,0.34)'
    : 'rgba(255,255,255,0.16)';
  const ringGlow = isLight ? 'rgba(255,255,255,0.5)' : theme.bg;
  const openTaskCount = (tasks ?? []).filter((t) => !t.done).length;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const prevHtml = document.documentElement.style.backgroundColor;
    const prevBody = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = pageBg;
    document.body.style.backgroundColor = pageBg;
    return () => {
      document.documentElement.style.backgroundColor = prevHtml;
      document.body.style.backgroundColor = prevBody;
    };
  }, [pageBg]);

  const chrome = (
    <>
      <View
        style={[
          styles.stage,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => {
              if (running || isPartial) minimize();
              router.navigate('/');
            }}
            hitSlop={8}
            accessibilityLabel="Back to home"
          >
            <Text style={[styles.brand, { color: ink }]}>
              Pulse
            </Text>
          </Pressable>
          <View style={styles.topActions}>
            {running || isPartial ? (
              <Pressable
                onPress={() => {
                  minimize();
                }}
                accessibilityLabel="Pop timer out"
                style={({ pressed }) => [
                  styles.iconAction,
                  {
                    backgroundColor: chromeBtnBg,
                    borderColor: chromeBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="minimize-2" size={16} color={ink} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setSettingsOpen(true)}
              accessibilityLabel="Settings"
              style={({ pressed }) => [
                styles.iconAction,
                {
                  backgroundColor: chromeBtnBg,
                  borderColor: chromeBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconGear color={ink} size={17} />
            </Pressable>
            <AuthAccountButton
              color={ink}
              iconSize={18}
              onOpenReport={() => setReportOpen(true)}
              style={({ pressed }) => [
                styles.iconAction,
                {
                  backgroundColor: chromeBtnBg,
                  borderColor: chromeBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            />
            <Pressable
              onPress={toggleLightDark}
              accessibilityLabel="Toggle color theme"
              style={({ pressed }) => [
                styles.iconAction,
                {
                  backgroundColor: chromeBtnBg,
                  borderColor: chromeBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {isLight ? (
                <IconSun color={ink} size={16} />
              ) : (
                <IconMoon color={ink} size={16} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.phaseTabs}>
          {MODES.map((mode) => {
            const active = mode === phase;
            return (
              <Pressable
                key={mode}
                onPress={() => selectPhase(mode)}
                style={[
                  styles.phaseTab,
                  active && styles.phaseTabActive,
                ]}
                accessibilityLabel={PHASE_THEME[mode].label}
              >
                <PhaseIconGlyph
                  phase={mode}
                  color={active ? ink : inkMuted}
                  size={active ? 20 : 17}
                />
                <Text
                  style={[
                    styles.phaseTabText,
                    {
                      color: active ? ink : inkMuted,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}
                >
                  {PHASE_TAB_LABEL[mode]}
                </Text>
                {active ? (
                  <View style={[styles.phaseUnderline, { backgroundColor: ink }]} />
                ) : (
                  <View style={styles.phaseUnderlineSpacer} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.ritualCenter}>
          <RitualRing
            progress={progress}
            size={ringSize}
            stroke={isLight ? 10 : 9}
            trackColor={ringTrack}
            progressColor={ringProgress}
            glowColor={ringGlow}
            breathing={running}
          >
            <PhaseIconGlyph phase={phase} color={ink} size={28} />
            <Text
              style={[
                styles.timerText,
                { color: ink, fontSize: ringSize * 0.175 },
              ]}
            >
              {formatTimer(remaining)}
            </Text>
            <Text style={[styles.ritualPhase, { color: inkMuted }]}>
              {PHASE_RITUAL_LABEL[phase]}
            </Text>
            <View style={styles.ringControls}>
              <Pressable
                onPress={reset}
                hitSlop={10}
                accessibilityLabel="Reset"
                style={({ pressed }) => [
                  styles.ringControlBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="rotate-ccw" size={22} color={ink} />
              </Pressable>
              <Pressable
                onPress={running ? pause : start}
                hitSlop={10}
                accessibilityLabel={
                  running ? 'Pause' : isPartial ? 'Resume' : 'Start'
                }
                style={({ pressed }) => [
                  styles.ringControlBtn,
                  styles.ringControlPlay,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Feather
                  name={running ? 'pause' : 'play'}
                  size={28}
                  color={ink}
                />
              </Pressable>
            </View>
          </RitualRing>

          <Text style={[styles.nowLabel, { color: inkMuted }]} numberOfLines={1}>
            {activeTask && !activeTask.done
              ? `Now: ${activeTask.title}`
              : 'Time to focus'}
          </Text>

          <View style={styles.finishBlock}>
            <Text style={[styles.finishLabel, { color: inkMuted }]}>
              Est. finish
            </Text>
            <Text style={[styles.finishValue, { color: ink }]}>
              {formatFinishClock(finishAt)}
            </Text>
            <Text style={[styles.finishHint, { color: inkMuted }]}>
              {formatMinutesShort(stats.focusMinutesToday)} focused today
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => setTodayOpen(true)}
          style={({ pressed }) => [
            styles.todayPeek,
            {
              backgroundColor: 'rgba(12,14,18,0.55)',
              borderColor: 'rgba(255,255,255,0.18)',
              opacity: pressed ? 0.92 : 1,
            },
          ]}
          accessibilityLabel="Open today's tasks"
        >
          <View style={styles.todayHandle} />
          <View style={styles.todayPeekRow}>
            <Text style={[styles.todayPeekTitle, { color: ink }]}>
              Today · {openTaskCount} {openTaskCount === 1 ? 'task' : 'tasks'}
            </Text>
            <Feather name="chevron-up" size={18} color={inkMuted} />
          </View>
          {activeTask && !activeTask.done ? (
            <Text
              style={[styles.todayPeekSub, { color: inkMuted }]}
              numberOfLines={1}
            >
              {activeTask.title}
            </Text>
          ) : null}
        </Pressable>
      </View>

      <Modal
        visible={todayOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTodayOpen(false)}
      >
        <View style={styles.todayBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTodayOpen(false)} />
          <View
            style={[
              styles.todaySheet,
              {
                backgroundColor: isLight ? '#F7F4EF' : '#1A1C20',
                paddingBottom: Math.max(insets.bottom, 16),
                maxHeight: '78%',
              },
            ]}
          >
            <View style={[styles.todaySheetHandle, { backgroundColor: isLight ? '#C8C2BA' : '#555' }]} />
            <View style={styles.todaySheetHeader}>
              <Text
                style={[
                  styles.todaySheetTitle,
                  {
                    color: isLight ? '#1A1C20' : '#FFFFFF',
                  },
                ]}
              >
                Today
              </Text>
              <Text
                style={[
                  styles.todaySheetMeta,
                  { color: isLight ? '#6B6560' : 'rgba(255,255,255,0.6)' },
                ]}
              >
                Est. finish {formatFinishClock(finishAt)}
              </Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.todayList}
            >
              {(tasks ?? []).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  active={task.id === activeTaskId}
                  accent={theme.bg}
                  isLight={isLight}
                  onSelect={() => {
                    selectTask(task.id);
                    setTodayOpen(false);
                  }}
                  onToggle={() => toggleTaskDone(task.id)}
                  onEdit={() => {
                    setEditingTask(task);
                    setTodayOpen(false);
                    setTaskModalOpen(true);
                  }}
                />
              ))}

              <Pressable
                onPress={() => {
                  setEditingTask(null);
                  setTodayOpen(false);
                  setTaskModalOpen(true);
                }}
                style={({ pressed }) => [
                  styles.addTaskBtn,
                  {
                    borderColor: isLight ? `${theme.bg}66` : 'rgba(255,255,255,0.35)',
                    backgroundColor: isLight ? `${theme.bg}12` : 'rgba(255,255,255,0.06)',
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.addTaskBtnText,
                    {
                      color: isLight ? theme.bg : '#FFFFFF',
                    },
                  ]}
                >
                  + Add Task
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      <AddTaskModal
        open={taskModalOpen}
        initialTask={editingTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={({ title, estimate, note }) => {
          if (editingTask) {
            updateTaskDetails(editingTask.id, { title, estimate, note });
          } else {
            addTask(title, estimate, note);
          }
        }}
        onDelete={
          editingTask
            ? () => {
                deleteTask(editingTask.id);
                setTaskModalOpen(false);
                setEditingTask(null);
              }
            : undefined
        }
      />
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <View pointerEvents="none" style={styles.doodleHost}>
        <Image
          source={DOODLE_FRAME}
          style={[styles.doodleFrame, { opacity: isLight ? 0.78 : 0.62 }]}
          resizeMode="cover"
        />
      </View>
      <View style={styles.stageLayer}>{chrome}</View>
    </View>
  );
}

function TaskRow({
  task,
  active,
  accent,
  isLight,
  onSelect,
  onToggle,
  onEdit,
}: {
  task: PomodoroTask;
  active: boolean;
  accent: string;
  isLight: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const titleColor = isLight ? '#1A1C20' : '#FFFFFF';
  const muted = isLight ? '#8A847C' : 'rgba(255,255,255,0.5)';
  const rule = isLight ? 'rgba(26,28,32,0.1)' : 'rgba(255,255,255,0.1)';

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.taskRow,
        {
          borderBottomColor: rule,
          opacity: task.done ? 0.55 : 1,
          backgroundColor: active
            ? isLight
              ? `${accent}14`
              : 'rgba(255,255,255,0.06)'
            : 'transparent',
        },
      ]}
    >
      <Pressable onPress={onToggle} hitSlop={8} style={styles.checkHit}>
        <View
          style={[
            styles.check,
            {
              borderColor: task.done ? accent : muted,
              backgroundColor: task.done ? accent : 'transparent',
            },
          ]}
        >
          {task.done ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
        </View>
      </Pressable>

      <View style={styles.taskTextCol}>
        <Text
          style={[
            styles.taskTitle,
            {
              color: titleColor,
              textDecorationLine: task.done ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {task.note ? (
          <Text style={[styles.noteText, { color: muted }]} numberOfLines={2}>
            {task.note}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.taskCount, { color: muted }]}>
        {task.completedPomodoros}/{task.estimatePomodoros}
      </Text>

      <Pressable onPress={onEdit} hitSlop={6} accessibilityLabel="Edit task" style={styles.taskMoreBtn}>
        <Feather name="more-vertical" size={16} color={muted} />
      </Pressable>
    </Pressable>
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
              maxHeight: height * (isCompact ? 0.9 : 0.86),
              width: isCompact ? '100%' : Math.min(440, width - 48),
            },
          ]}
        >
          {isCompact ? (
            <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
          ) : null}

          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: c.onSurfaceMuted }]}>
              SETTING
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
          <View style={[styles.modalDivider, { backgroundColor: c.border }]} />

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={15} color={c.onSurfaceMuted} />
              <Text style={[styles.sectionTitle, { color: c.onSurfaceMuted }]}>
                TIMER
              </Text>
            </View>

            <Text style={[styles.timeGroupLabel, { color: c.onSurface }]}>
              Time (minutes)
            </Text>
            <View style={styles.timeRow}>
              <MinuteInput
                label="Focus"
                value={settings.focusMinutes}
                disabled={disabled}
                min={1}
                max={120}
                onChange={(focusMinutes) => onChange({ focusMinutes })}
              />
              <MinuteInput
                label="Short Break"
                value={settings.shortBreakMinutes}
                disabled={disabled}
                min={1}
                max={60}
                onChange={(shortBreakMinutes) => onChange({ shortBreakMinutes })}
              />
              <MinuteInput
                label="Long Break"
                value={settings.longBreakMinutes}
                disabled={disabled}
                min={1}
                max={60}
                onChange={(longBreakMinutes) => onChange({ longBreakMinutes })}
              />
            </View>

            <ToggleRow
              label="Auto Start Breaks"
              value={settings.autoStartBreaks}
              disabled={disabled}
              onToggle={() =>
                onChange({ autoStartBreaks: !settings.autoStartBreaks })
              }
            />
            <ToggleRow
              label="Auto Start Focus"
              value={settings.autoStartPomodoros}
              disabled={disabled}
              onToggle={() =>
                onChange({ autoStartPomodoros: !settings.autoStartPomodoros })
              }
            />
            <LongBreakIntervalField
              value={settings.sessionsUntilLongBreak}
              disabled={disabled}
              onChange={(sessionsUntilLongBreak) =>
                onChange({ sessionsUntilLongBreak })
              }
            />

            <View style={[styles.modalDivider, { backgroundColor: c.border }]} />

            <View style={styles.sectionHeader}>
              <Feather name="check-square" size={15} color={c.onSurfaceMuted} />
              <Text style={[styles.sectionTitle, { color: c.onSurfaceMuted }]}>
                TASK
              </Text>
            </View>

            <ToggleRow
              label="Auto Check Tasks"
              hint='If you enable "Auto Check Tasks", the active task will be automatically checked when the actual pomodoro count reaches the estimated count.'
              value={settings.autoCheckTasks}
              disabled={disabled}
              onToggle={() =>
                onChange({ autoCheckTasks: !settings.autoCheckTasks })
              }
            />
            <ToggleRow
              label="Check to Bottom"
              hint='If you enable "Auto Switch Tasks", the checked task will be automatically moved to the bottom of the task list.'
              value={settings.moveCompletedToBottom}
              disabled={disabled}
              onToggle={() =>
                onChange({
                  moveCompletedToBottom: !settings.moveCompletedToBottom,
                })
              }
            />

            <View style={[styles.modalDivider, { backgroundColor: c.border }]} />

            <View style={styles.sectionHeader}>
              <Feather name="volume-2" size={15} color={c.onSurfaceMuted} />
              <Text style={[styles.sectionTitle, { color: c.onSurfaceMuted }]}>
                SOUND
              </Text>
            </View>

            <SoundBlock
              kind="alarm"
              label="Alarm Sound"
              options={ALARM_SOUND_OPTIONS}
              selectedId={settings.alarmSound}
              volume={settings.alarmVolume}
              disabled={disabled}
              onSelect={(alarmSound) => onChange({ alarmSound })}
              onVolumeChange={(alarmVolume) => onChange({ alarmVolume })}
              repeat={settings.alarmRepeat}
              onRepeatChange={(alarmRepeat) => onChange({ alarmRepeat })}
            />

            <SoundBlock
              kind="focus"
              label="Focus Sound"
              options={FOCUS_SOUND_OPTIONS}
              selectedId={settings.focusSound}
              volume={settings.focusVolume}
              disabled={disabled}
              onSelect={(focusSound) => onChange({ focusSound })}
              onVolumeChange={(focusVolume) => onChange({ focusVolume })}
            />

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
                25 · 5 · 15 · wood · ticking
              </Text>
            </Pressable>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={[
              styles.modalDone,
              { backgroundColor: c.primary },
            ]}
          >
            <Text
              style={[
                styles.modalDoneText,
                { color: c.primaryText },
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

function LongBreakIntervalField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (Number.isNaN(parsed)) {
      setText(String(value));
      return;
    }
    const next = Math.min(12, Math.max(1, parsed));
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.intervalRow}>
      <View style={styles.intervalCopy}>
        <Text style={[styles.toggleLabel, { color: c.onSurface }]}>
          Long Break interval
        </Text>
        <Text style={[styles.intervalHint, { color: c.onSurfaceMuted }]}>
          Focus blocks until a long break
        </Text>
      </View>
      <TextInput
        value={text}
        editable={!disabled}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        onChangeText={setText}
        onBlur={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        style={[
          styles.minuteInput,
          styles.intervalInput,
          {
            color: c.onSurface,
            backgroundColor: c.backgroundAlt,
            borderColor: c.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      />
    </View>
  );
}

function MinuteInput({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  compact,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
  min: number;
  max: number;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (Number.isNaN(parsed)) {
      setText(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <View style={[styles.minuteField, compact && styles.minuteFieldCompact]}>
      {label ? (
        <Text style={[styles.minuteLabel, { color: c.onSurfaceMuted }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={text}
        editable={!disabled}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        onChangeText={setText}
        onBlur={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        style={[
          styles.minuteInput,
          compact && styles.minuteInputCompact,
          {
            color: c.onSurface,
            backgroundColor: c.backgroundAlt,
            borderColor: c.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      />
    </View>
  );
}

function SoundBlock<T extends string>({
  kind,
  label,
  options,
  selectedId,
  volume,
  disabled,
  onSelect,
  onVolumeChange,
  repeat,
  onRepeatChange,
}: {
  kind: 'alarm' | 'focus';
  label: string;
  options: { id: T; label: string }[];
  selectedId: T;
  volume: number;
  disabled: boolean;
  onSelect: (id: T) => void;
  onVolumeChange: (volume: number) => void;
  repeat?: number;
  onRepeatChange?: (repeat: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const selectedLabel =
    options.find((o) => o.id === selectedId)?.label ?? selectedId;
  const volumePreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playPreview = (id: T, nextVolume = volume) => {
    void previewSound(kind, id as never, nextVolume);
  };

  const handleVolumeChange = (next: number) => {
    onVolumeChange(next);
    if (volumePreviewTimer.current) clearTimeout(volumePreviewTimer.current);
    volumePreviewTimer.current = setTimeout(() => {
      playPreview(selectedId, next);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (volumePreviewTimer.current) clearTimeout(volumePreviewTimer.current);
    };
  }, []);

  return (
    <View style={[styles.soundBlock, { opacity: disabled ? 0.5 : 1 }]}>
      <View style={styles.soundTopRow}>
        <Text style={[styles.soundLabel, { color: c.onSurface }]}>{label}</Text>
        <SoundSelect
          label={selectedLabel}
          options={options}
          selectedId={selectedId}
          disabled={disabled}
          onSelect={(id) => {
            onSelect(id);
            playPreview(id);
          }}
        />
      </View>
      <VolumeSlider
        value={volume}
        disabled={disabled}
        onChange={handleVolumeChange}
      />
      {onRepeatChange != null && repeat != null ? (
        <View style={styles.repeatRow}>
          <Text style={[styles.repeatLabel, { color: c.onSurfaceMuted }]}>
            repeat
          </Text>
          <TextInput
            value={String(repeat)}
            editable={!disabled}
            keyboardType="number-pad"
            selectTextOnFocus
            onChangeText={(text) => {
              const digits = text.replace(/[^\d]/g, '');
              if (digits === '') {
                onRepeatChange(0);
                return;
              }
              onRepeatChange(Math.min(60, Math.max(0, Number(digits))));
            }}
            style={[
              styles.repeatInput,
              {
                color: c.onSurface,
                backgroundColor: c.backgroundAlt,
                borderColor: c.border,
              },
            ]}
            accessibilityLabel="Alarm repeat count"
          />
        </View>
      ) : null}
    </View>
  );
}

function SoundSelect<T extends string>({
  label,
  options,
  selectedId,
  disabled,
  onSelect,
}: {
  label: string;
  options: { id: T; label: string }[];
  selectedId: T;
  disabled: boolean;
  onSelect: (id: T) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.soundSelect,
          { backgroundColor: c.backgroundAlt, borderColor: c.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Sound: ${label}`}
      >
        <Text style={[styles.soundSelectText, { color: c.onSurface }]}>
          {label}
        </Text>
        <Feather name="chevron-down" size={16} color={c.onSurfaceMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.soundPickerOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.soundPickerCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {options.map((option) => {
              const active = option.id === selectedId;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                  style={[
                    styles.soundPickerItem,
                    active && { backgroundColor: c.backgroundAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.soundPickerItemText,
                      {
                        color: c.onSurface,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {active ? (
                    <Feather name="check" size={16} color={c.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

function VolumeSlider({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(1);

  const setFromX = (locationX: number) => {
    const width = Math.max(1, trackWidthRef.current);
    const next = Math.round(Math.max(0, Math.min(100, (locationX / width) * 100)));
    onChange(next);
  };

  return (
    <View style={styles.volumeRow}>
      <Text style={[styles.volumeValue, { color: c.onSurfaceMuted }]}>
        {value}
      </Text>
      <View
        ref={trackRef}
        collapsable={false}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={(e) => setFromX(e.nativeEvent.locationX)}
        onResponderMove={(e) => setFromX(e.nativeEvent.locationX)}
        style={[styles.volumeTrack, { backgroundColor: c.border }]}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: 100, now: value }}
      >
        <View
          style={[
            styles.volumeFill,
            {
              width: `${value}%`,
              backgroundColor: c.onSurfaceMuted,
            },
          ]}
        />
        <View
          style={[
            styles.volumeThumb,
            {
              left: `${value}%`,
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}
        />
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  disabled,
  onToggle,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width: winW, height: winH } = useWindowDimensions();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [bubbleH, setBubbleH] = useState(0);
  const infoRef = useRef<View>(null);
  const bubbleMaxW = Math.min(280, winW - 24);
  // Match super_tooltip-style tipDistance: sit almost against the target.
  const tipGap = 3;
  const arrowSize = 8;

  const openTooltip = () => {
    const node = infoRef.current as unknown as {
      measureInWindow?: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => void;
    } | null;
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, w, h) => {
        setBubbleH(0);
        setAnchor({ x, y, w, h });
        setTooltipOpen(true);
      });
      return;
    }
    setBubbleH(0);
    setAnchor(null);
    setTooltipOpen(true);
  };

  const estimatedH = bubbleH || 72;
  const spaceBelow = anchor ? winH - (anchor.y + anchor.h) : winH;
  const placeBelow = !anchor || spaceBelow >= estimatedH + tipGap + arrowSize + 12;
  const bubbleTop = anchor
    ? placeBelow
      ? anchor.y + anchor.h + tipGap
      : Math.max(8, anchor.y - tipGap - arrowSize - estimatedH)
    : 120;
  const anchorCenterX = anchor ? anchor.x + anchor.w / 2 : 40;
  const bubbleLeft = Math.max(
    12,
    Math.min(anchorCenterX - 28, winW - bubbleMaxW - 12),
  );
  const arrowLeft = Math.max(
    12,
    Math.min(anchorCenterX - bubbleLeft - arrowSize, bubbleMaxW - 24),
  );

  return (
    <View style={[styles.toggleRow, { opacity: disabled ? 0.5 : 1 }]}>
      <View style={styles.toggleCopy}>
        <View style={styles.toggleLabelRow}>
          <Pressable
            disabled={disabled}
            onPress={onToggle}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            accessibilityLabel={label}
            accessibilityHint={hint}
            style={styles.toggleLabelHit}
          >
            <Text style={[styles.toggleLabel, { color: c.onSurface }]}>
              {label}
            </Text>
          </Pressable>
          {hint ? (
            <View ref={infoRef} collapsable={false}>
              <Pressable
                onPress={openTooltip}
                hitSlop={8}
                accessibilityLabel={`${label} info`}
                accessibilityHint={hint}
                style={styles.infoHit}
              >
                <Text style={[styles.infoMark, { color: c.onSurfaceMuted }]}>
                  ⓘ
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        disabled={disabled}
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
      >
        <View
          style={[
            styles.switchTrack,
            {
              backgroundColor: value ? c.success : c.border,
            },
          ]}
        >
          <View
            style={[
              styles.switchThumb,
              value ? styles.switchThumbOn : styles.switchThumbOff,
            ]}
          />
        </View>
      </Pressable>

      {hint ? (
        <Modal
          visible={tooltipOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setTooltipOpen(false)}
        >
          <View style={styles.tooltipOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setTooltipOpen(false)}
              accessibilityLabel="Dismiss info"
            />
            <View
              pointerEvents="box-none"
              style={[
                styles.tooltipFloatWrap,
                {
                  top: bubbleTop,
                  left: bubbleLeft,
                  width: bubbleMaxW,
                },
              ]}
            >
              {placeBelow ? (
                <View
                  style={[
                    styles.tooltipArrowUp,
                    {
                      marginLeft: arrowLeft,
                      borderBottomColor: c.surface,
                    },
                  ]}
                />
              ) : null}
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0 && Math.abs(h - bubbleH) > 1) {
                    setBubbleH(h);
                  }
                }}
                style={[
                  styles.tooltipBubble,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={[styles.tooltipText, { color: c.onSurface }]}>
                  {hint}
                </Text>
              </View>
              {!placeBelow ? (
                <View
                  style={[
                    styles.tooltipArrowDown,
                    {
                      marginLeft: arrowLeft,
                      borderTopColor: c.surface,
                    },
                  ]}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', overflow: 'hidden' },
  doodleHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  doodleFrame: {
    width: '100%',
    height: '100%',
  },
  stageLayer: {
    flex: 1,
    zIndex: 1,
  },
  stage: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  brand: {
    fontFamily: fontBody,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  phaseTab: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 72,
    gap: 4,
  },
  phaseTabActive: {
    opacity: 1,
  },
  phaseTabText: {
    fontFamily: fontBody,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  phaseUnderline: {
    marginTop: 4,
    height: 2,
    width: 22,
    borderRadius: 2,
  },
  phaseUnderlineSpacer: {
    marginTop: 4,
    height: 2,
    width: 22,
  },
  ritualCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingBottom: 8,
  },
  timerText: {
    fontFamily: fontBody,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    textAlign: 'center',
  },
  ritualPhase: {
    fontFamily: fontBody,
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
  },
  ringControls: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  ringControlBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringControlPlay: {
    width: 56,
    height: 56,
  },
  nowLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: '90%',
  },
  finishBlock: {
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  finishLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  finishValue: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5 },
  finishHint: { fontSize: 12, fontWeight: '500' },
  todayPeek: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 4,
  },
  todayHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
  },
  todayPeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayPeekTitle: { fontSize: 15, fontWeight: '700' },
  todayPeekSub: { marginTop: 4, fontSize: 13, fontWeight: '500' },
  todayBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  todaySheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 18,
  },
  todaySheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  todaySheetHeader: {
    marginBottom: 8,
    gap: 2,
  },
  todaySheetTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  todaySheetMeta: { fontSize: 13, fontWeight: '500' },
  todayList: {
    paddingBottom: 12,
    gap: 0,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  checkHit: { padding: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTextCol: { flex: 1, minWidth: 0, gap: 2 },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  taskCount: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  taskMoreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addTaskBtn: {
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addTaskBtnText: {
    fontWeight: '700',
    fontSize: 15,
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
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.2,
    flex: 1,
    textAlign: 'center',
    marginLeft: 32,
  },
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
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginBottom: 4,
  },
  modalBody: {
    gap: 14,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  timeGroupLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  minuteField: {
    flex: 1,
    gap: 6,
  },
  minuteFieldCompact: {
    flex: 0,
    width: 64,
  },
  minuteLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  minuteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  minuteInputCompact: {
    width: 64,
    fontSize: 16,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  intervalCopy: {
    flex: 1,
    gap: 2,
  },
  intervalHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  intervalInput: {
    width: 72,
    flexGrow: 0,
  },
  soundBlock: {
    gap: 12,
    paddingVertical: 10,
  },
  soundTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  soundLabel: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  soundSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 132,
    justifyContent: 'space-between',
  },
  soundSelectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  soundPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  soundPickerCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  soundPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  soundPickerItemText: {
    fontSize: 15,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 2,
  },
  volumeValue: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  volumeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    justifyContent: 'center',
  },
  volumeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.45,
  },
  volumeThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      } as object,
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
    }),
  },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  repeatLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  repeatInput: {
    width: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  toggleCopy: { flex: 1 },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleLabelHit: {
    flexShrink: 1,
  },
  infoHit: {
    padding: 2,
  },
  infoMark: {
    fontSize: 13,
    fontWeight: '700',
  },
  tooltipOverlay: {
    flex: 1,
  },
  tooltipFloatWrap: {
    position: 'absolute',
    zIndex: 20,
  },
  tooltipArrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tooltipArrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tooltipBubble: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 20px rgba(0,0,0,0.16)',
      } as object,
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  tooltipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
  resetBtn: {
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
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
