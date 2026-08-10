import React, { useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
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
import { Feather } from '@expo/vector-icons';
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
import { usePomodoroTimer } from './usePomodoroTimer';
import { HowItWorksTour } from './HowItWorksTour';
import { useHowItWorksTour } from './useHowItWorksTour';
import { ReportModal } from './ReportModal';
import { CalendarModal } from './CalendarModal';
import { AddTaskModal } from './AddTaskModal';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { AuthAccountButton } from '../../../core/auth/AuthAccountButton';
import { IconGear, IconMoon, IconSun } from '../../../core/theme/LineIcons';
import { previewSound } from '../data/pomodoroAudio';

const MODES: PomodoroPhase[] = ['focus', 'shortBreak', 'longBreak'];
const DOODLE_BG_LIGHT = require('../../../../assets/landing-doodles-bg-light.png');
const DOODLE_BG_DARK = require('../../../../assets/landing-doodles-bg-dark.png');

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
    updateTaskDetails,
    selectTask,
    toggleTaskDone,
    deleteTask,
  } = usePomodoroTimer();

  const router = useRouter();
  const { theme: appTheme, resolved, toggleLightDark } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PomodoroTask | null>(null);
  const { open: tourOpen, complete: completeTour } = useHowItWorksTour();
  const theme = PHASE_THEME[phase];
  const isLight = resolved === 'light';
  const c = appTheme.colors;
  const chromeInk = c.onSurface;
  const chromeMuted = c.onSurfaceMuted;
  const chromeBtnBg = isLight ? 'rgba(26,28,32,0.06)' : 'rgba(255,248,242,0.08)';
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
    <ImageBackground
      source={isLight ? DOODLE_BG_LIGHT : DOODLE_BG_DARK}
      style={[styles.root, { backgroundColor: c.background }]}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
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
            <Text style={[styles.brand, { color: theme.bg }]}>Pomodoro</Text>
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              accessibilityLabel="Settings"
              style={({ pressed }) => [
                styles.iconAction,
                {
                  backgroundColor: chromeBtnBg,
                  borderColor: isLight ? 'rgba(26,28,32,0.12)' : c.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconGear color={chromeInk} size={17} />
            </Pressable>
            <AuthAccountButton
              color={chromeInk}
              iconSize={18}
              onOpenReport={() => setReportOpen(true)}
              style={({ pressed }) => [
                styles.iconAction,
                {
                  backgroundColor: chromeBtnBg,
                  borderColor: isLight ? 'rgba(26,28,32,0.12)' : c.border,
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
                  borderColor: isLight ? 'rgba(26,28,32,0.12)' : c.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {isLight ? (
                <IconSun color={chromeInk} size={16} />
              ) : (
                <IconMoon color={chromeInk} size={16} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={[styles.timerCard, { backgroundColor: theme.bg }]}>
          <View style={styles.modeTabs}>
            {MODES.map((mode) => {
              const active = mode === phase;
              return (
                <Pressable
                  key={mode}
                  onPress={() => selectPhase(mode)}
                  style={[styles.modeTab, active && styles.modeTabActive]}
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
              { opacity: pressed ? 0.92 : 1 },
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

        <View style={[styles.tasksCard, { backgroundColor: theme.bg }]}>
          <View style={styles.tasksHeader}>
            <Text style={styles.tasksTitle}>Tasks</Text>
            <Pressable
              accessibilityLabel="Task options"
              style={styles.tasksMenuBtn}
              hitSlop={6}
            >
              <Feather name="more-vertical" size={16} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.taskList}>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                active={task.id === activeTaskId}
                onSelect={() => selectTask(task.id)}
                onToggle={() => toggleTaskDone(task.id)}
                onEdit={() => {
                  setEditingTask(task);
                  setTaskModalOpen(true);
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => {
              setEditingTask(null);
              setTaskModalOpen(true);
            }}
            style={({ pressed }) => [
              styles.addTaskBtn,
              { opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.addTaskBtnText}>+ Add Task</Text>
          </Pressable>
        </View>

        <View style={[styles.finishCard, { backgroundColor: theme.bg }]}>
          <Text style={styles.finishLabel}>Est. finish</Text>
          <Text style={styles.finishValue}>{formatFinishClock(finishAt)}</Text>
          <Text style={styles.finishHint}>
            Based on open task estimates · {formatMinutesShort(stats.focusMinutesToday)}{' '}
            focused today
          </Text>
        </View>

        <Text style={[styles.powered, { color: chromeMuted }]}>
          powered by 8dgeTech@2026
        </Text>
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
    </ImageBackground>
  );
}

function TaskRow({
  task,
  active,
  onSelect,
  onToggle,
  onEdit,
}: {
  task: PomodoroTask;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <View style={styles.taskCardWrap}>
      <Pressable
        onPress={onSelect}
        style={[
          styles.taskCard,
          active && styles.taskCardActive,
          task.done && styles.taskCardDone,
        ]}
      >
        <View style={[styles.taskAccent, active && styles.taskAccentOn]} />
        <View style={styles.taskCardInner}>
          <View style={styles.taskMainRow}>
            <Pressable onPress={onToggle} hitSlop={8} style={styles.checkHit}>
              <View style={[styles.check, task.done && styles.checkOn]}>
                {task.done ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </Pressable>

            <Text
              style={[styles.taskTitle, task.done && styles.taskTitleDone]}
              numberOfLines={2}
            >
              {task.title}
            </Text>

            <Text style={styles.taskCount}>
              {task.completedPomodoros} / {task.estimatePomodoros}
            </Text>

            <Pressable
              onPress={onEdit}
              hitSlop={6}
              accessibilityLabel="Edit task"
              style={styles.taskMoreBtn}
            >
              <Feather name="more-vertical" size={16} color="#777" />
            </Pressable>
          </View>

          {task.note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>{task.note}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
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
                label="Pomodoro"
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
              label="Auto Start Pomodoros"
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
          Pomodoros until a long break
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
  root: { flex: 1, width: '100%' },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 48,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    zIndex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  navBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCard: {
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 18,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  modeTabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  timerText: {
    color: '#fff',
    fontSize: 92,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    lineHeight: 104,
  },
  progressTrack: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 4,
  },
  workingOn: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  startBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 12,
    marginTop: 4,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  startLabel: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  skipLink: { padding: 6 },
  skipText: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  tasksCard: {
    marginTop: 22,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.9)',
  },
  tasksTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tasksMenuBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskList: { gap: 10 },
  taskCardWrap: {
    position: 'relative',
    zIndex: 1,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 56,
  },
  taskCardActive: {},
  taskCardDone: {
    opacity: 0.72,
  },
  taskAccent: {
    width: 6,
    backgroundColor: 'transparent',
  },
  taskAccentOn: {
    backgroundColor: '#1A1A1A',
  },
  taskCardInner: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  taskMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkHit: { padding: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: '#BA4949',
    borderColor: '#BA4949',
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
    color: '#333',
    fontSize: 15,
    fontWeight: '700',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskCount: {
    color: '#9A9A9A',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  taskMoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: {
    marginLeft: 34,
    backgroundColor: '#F4F0D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteText: {
    color: '#5C5428',
    fontSize: 13,
    fontWeight: '500',
  },
  taskMenu: {
    position: 'absolute',
    right: 8,
    top: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    zIndex: 20,
    ...Platform.select({
      web: { boxShadow: '0 8px 20px rgba(0,0,0,0.18)' },
      default: {
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  taskMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  taskMenuDanger: {
    color: '#BA4949',
    fontWeight: '700',
    fontSize: 14,
  },
  addTaskBtn: {
    marginTop: 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  addTaskBtnText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    fontSize: 15,
  },
  finishCard: {
    marginTop: 16,
    borderRadius: 16,
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
  powered: {
    marginTop: 28,
    marginBottom: 8,
    textAlign: 'center',
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
