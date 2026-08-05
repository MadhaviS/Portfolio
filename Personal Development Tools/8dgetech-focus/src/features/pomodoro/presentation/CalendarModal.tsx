import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../core/theme/ThemeProvider';
import {
  formatMinutesShort,
  formatDayHeading,
  phaseLabel,
  sessionDurationLabel,
  type CalendarCell,
  type DayLog,
  type PomodoroSession,
} from '../domain/types';
import { usePomodoroCalendar } from './usePomodoroCalendar';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const NAVY = '#1B2A4A';
const NAVY_MUTED = '#7A8BB0';
const NAVY_DIM = '#4A5C80';
const PINK = '#F06292';
const FOCUS = '#BA4949';
const BREAK = '#38858A';
const LONG = '#397097';

const fontBody = Platform.select({
  web: 'Outfit, system-ui, sans-serif',
  default: 'System',
});

function sessionStartLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sessionDurationShort(session: PomodoroSession): string {
  if (!session.endedAt) return '…';
  const mins = Math.max(
    1,
    Math.round(
      (new Date(session.endedAt).getTime() -
        new Date(session.startedAt).getTime()) /
        60000,
    ),
  );
  if (mins < 60) return `${mins}M`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}H ${m}M` : `${h}H`;
}

type CalendarModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CalendarModal({ open, onClose }: CalendarModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isCompact = width < 560;
  const [expanded, setExpanded] = useState(true);
  const expand = useSharedValue(1);

  const {
    label,
    cells,
    selectedKey,
    selectedLog,
    setSelectedKey,
    goPrev,
    goNext,
    goToday,
    refresh,
  } = usePomodoroCalendar();

  useEffect(() => {
    if (!open) return;
    refresh();
    setExpanded(true);
  }, [open, refresh]);

  useEffect(() => {
    expand.value = withTiming(expanded ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, expand]);

  const calendarBodyStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + expand.value * 0.65,
    maxHeight: 56 + expand.value * 280,
    overflow: 'hidden' as const,
  }));

  const monthTitle = useMemo(() => label.toUpperCase(), [label]);
  const year = useMemo(() => {
    const parts = label.split(' ');
    return parts[parts.length - 1] ?? '';
  }, [label]);

  const dayHeading = useMemo(() => {
    const d = new Date(selectedKey + 'T12:00:00');
    return d.toLocaleDateString([], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [selectedKey]);

  return (
    <Modal
      visible={open}
      animationType={isCompact ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          isCompact ? styles.backdropCompact : styles.backdropWide,
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            isCompact ? styles.cardCompact : styles.cardWide,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              maxHeight: height * (isCompact ? 0.92 : 0.88),
              width: isCompact ? '100%' : Math.min(480, width - 48),
            },
          ]}
        >
          {isCompact ? (
            <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
          ) : null}

          <View style={styles.header}>
            <Text style={[styles.title, { color: c.onSurface, fontFamily: fontBody }]}>
              Calendar
            </Text>
            <Pressable
              onPress={onClose}
              style={[styles.close, { backgroundColor: c.backgroundAlt }]}
              accessibilityLabel="Close calendar"
            >
              <Text style={[styles.closeText, { color: c.onSurface }]}>×</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={styles.calendarPanel}>
              <View style={styles.calTopBar}>
                <Text style={[styles.yearText, { fontFamily: fontBody }]}>{year}</Text>
                <Pressable onPress={goToday} hitSlop={8}>
                  <Text style={[styles.todayTop, { fontFamily: fontBody }]}>Today</Text>
                </Pressable>
              </View>

              <View style={styles.monthNav}>
                <Pressable onPress={goPrev} hitSlop={12} style={styles.monthArrowHit}>
                  <Text style={styles.monthArrow}>‹</Text>
                </Pressable>
                <Text style={[styles.monthTitle, { fontFamily: fontBody }]}>
                  {monthTitle.replace(` ${year}`, '')}
                </Text>
                <Pressable onPress={goNext} hitSlop={12} style={styles.monthArrowHit}>
                  <Text style={styles.monthArrow}>›</Text>
                </Pressable>
              </View>

              <Animated.View style={calendarBodyStyle}>
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((d) => (
                    <Text key={d} style={[styles.weekday, { fontFamily: fontBody }]}>
                      {d}
                    </Text>
                  ))}
                </View>

                <View style={styles.grid}>
                  {cells.map((cell, idx) => (
                    <DayCell
                      key={`${cell.dateKey ?? 'e'}-${idx}`}
                      cell={cell}
                      selected={cell.dateKey === selectedKey}
                      onSelect={(key) => {
                        setSelectedKey(key);
                        if (isCompact) setExpanded(false);
                      }}
                    />
                  ))}
                </View>
              </Animated.View>

              <Pressable
                onPress={() => setExpanded((v) => !v)}
                style={styles.handleHit}
                accessibilityLabel={expanded ? 'Collapse calendar' : 'Expand calendar'}
              >
                <View style={styles.handle} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.agenda}
              contentContainerStyle={styles.agendaContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.agendaHeader}>
                <Text
                  style={[styles.agendaDate, { color: c.onSurface, fontFamily: fontBody }]}
                >
                  {dayHeading}
                </Text>
                <Pressable onPress={goToday}>
                  <Text
                    style={[
                      styles.agendaToday,
                      { color: c.onSurfaceMuted, fontFamily: fontBody },
                    ]}
                  >
                    Today
                  </Text>
                </Pressable>
              </View>

              <DayAgenda log={selectedLog} />
            </ScrollView>
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.okBtn, { backgroundColor: '#BA4949' }]}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function DayCell({
  cell,
  selected,
  onSelect,
}: {
  cell: CalendarCell;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  if (!cell.dateKey || cell.dayOfMonth == null) {
    return <View style={styles.cell} />;
  }

  const hasActivity = !!cell.log?.hasActivity;

  return (
    <Pressable
      onPress={() => onSelect(cell.dateKey!)}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={[styles.dayBubble, selected && styles.dayBubbleSelected]}>
        <Text
          style={[
            styles.dayNum,
            { fontFamily: fontBody },
            selected && styles.dayNumSelected,
            cell.isToday && !selected && styles.dayNumToday,
          ]}
        >
          {cell.dayOfMonth}
        </Text>
      </View>
      {hasActivity ? <View style={styles.eventDot} /> : <View style={styles.eventDotSpacer} />}
    </Pressable>
  );
}

function DayAgenda({ log }: { log: DayLog }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const rows = useMemo(() => {
    const items: {
      id: string;
      tone: string;
      time: string;
      duration: string;
      title: string;
      meta: string;
    }[] = [];

    for (const s of log.sessions) {
      const tone =
        s.phase === 'focus' ? FOCUS : s.phase === 'shortBreak' ? BREAK : LONG;
      items.push({
        id: s.id,
        tone,
        time: sessionStartLabel(s.startedAt),
        duration: sessionDurationShort(s),
        title: phaseLabel(s.phase),
        meta: !s.endedAt
          ? 'In progress'
          : s.completed
            ? `Completed · ${sessionDurationLabel(s)}`
            : `Stopped · ${sessionDurationLabel(s)}`,
      });
    }

    for (const t of log.tasksCreated) {
      items.push({
        id: `created-${t.id}`,
        tone: PINK,
        time: sessionStartLabel(t.createdAt),
        duration: '—',
        title: t.title,
        meta: `Task created · ${t.completedPomodoros}/${t.estimatePomodoros} pomos`,
      });
    }

    for (const tw of log.tasksWorked) {
      if (log.tasksCreated.some((t) => t.id === tw.task.id)) continue;
      items.push({
        id: `worked-${tw.task.id}`,
        tone: '#F0A05A',
        time: 'Focus',
        duration: formatMinutesShort(tw.focusMinutes),
        title: tw.task.title,
        meta: `${tw.focusSessions} sessions · ${tw.task.completedPomodoros}/${tw.task.estimatePomodoros} est.`,
      });
    }

    return items;
  }, [log]);

  if (rows.length === 0) {
    return (
      <View style={[styles.emptyCard, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.emptyTitle, { color: c.onSurface, fontFamily: fontBody }]}>
          Nothing logged
        </Text>
        <Text style={[styles.emptyBody, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
          Sessions and tasks for {formatDayHeading(log.dateKey).toLowerCase()} will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.agendaList}>
      <View style={[styles.summaryRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        <SummaryChip label="Focus" value={`${log.focusCompleted}`} />
        <SummaryChip label="Deep work" value={formatMinutesShort(log.focusMinutes)} />
        <SummaryChip label="Breaks" value={formatMinutesShort(log.breakMinutes)} />
      </View>

      {rows.map((row) => (
        <View
          key={row.id}
          style={[styles.agendaRow, { backgroundColor: c.background, borderColor: c.border }]}
        >
          <View style={[styles.toneBar, { backgroundColor: row.tone }]} />
          <View style={styles.timeCol}>
            {row.time ? (
              <Text style={[styles.timeText, { color: c.onSurface, fontFamily: fontBody }]}>
                {row.time}
              </Text>
            ) : null}
            <Text style={[styles.durText, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              {row.duration}
            </Text>
          </View>
          <View style={styles.agendaCopy}>
            <Text style={[styles.agendaTitle, { color: c.onSurface, fontFamily: fontBody }]}>
              {row.title}
            </Text>
            <Text style={[styles.agendaMeta, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              {row.meta}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.summaryChip}>
      <Text style={[styles.summaryValue, { color: c.onSurface, fontFamily: fontBody }]}>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropWide: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdropCompact: {
    justifyContent: 'flex-end',
  },
  card: {
    borderWidth: 1,
    zIndex: 2,
    overflow: 'hidden',
  },
  cardWide: {
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  cardCompact: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '700' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 22, fontWeight: '600', lineHeight: 24 },
  body: {
    flexShrink: 1,
    minHeight: 280,
    gap: 0,
  },
  calendarPanel: {
    backgroundColor: NAVY,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
    borderRadius: 16,
  },
  calTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  yearText: {
    color: NAVY_MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  todayTop: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 8,
  },
  monthArrowHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrow: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 28,
  },
  monthTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: NAVY_MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 2,
    minHeight: 40,
  },
  dayBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleSelected: {
    backgroundColor: PINK,
  },
  dayNum: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dayNumSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayNumToday: {
    color: PINK,
    fontWeight: '800',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  eventDotSpacer: {
    width: 4,
    height: 4,
    marginTop: 2,
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: NAVY_DIM,
  },
  agenda: {
    maxHeight: 260,
    marginTop: 12,
  },
  agendaContent: {
    paddingBottom: 8,
    gap: 12,
  },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agendaDate: {
    fontSize: 15,
    fontWeight: '700',
  },
  agendaToday: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  summaryChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  agendaList: {
    gap: 10,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 56,
  },
  toneBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  timeCol: {
    width: 68,
    paddingVertical: 10,
    paddingLeft: 10,
    gap: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  durText: {
    fontSize: 11,
    fontWeight: '600',
  },
  agendaCopy: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 4,
    gap: 2,
  },
  agendaTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  agendaMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  okBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  okText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
