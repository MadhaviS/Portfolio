import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { pomodoroRepository } from '../data/pomodoroRepository';
import {
  buildDayLog,
  formatMinutesShort,
  toDateKey,
  type PomodoroStats,
} from '../domain/types';

type ReportModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenCalendar: () => void;
  stats: PomodoroStats;
};

function lastNDays(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(toDateKey(d));
  }
  return keys;
}

function weekdayShort(dateKey: string): string {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString([], {
    weekday: 'short',
  });
}

export function ReportModal({ open, onClose, onOpenCalendar, stats }: ReportModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isCompact = width < 560;

  const week = useMemo(() => {
    pomodoroRepository.hydrate();
    const sessions = pomodoroRepository.listSessions();
    const tasks = pomodoroRepository.listTasks();
    const keys = lastNDays(7);
    return keys.map((key) => {
      const log = buildDayLog(key, sessions, tasks);
      return {
        key,
        label: weekdayShort(key),
        minutes: log.focusMinutes,
        pomos: log.focusCompleted,
      };
    });
  }, [open, stats.focusCompletedToday, stats.focusMinutesAllTime]);

  const maxMinutes = Math.max(1, ...week.map((d) => d.minutes));
  const weekTotal = week.reduce((s, d) => s + d.minutes, 0);
  const weekPomos = week.reduce((s, d) => s + d.pomos, 0);

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
              maxHeight: height * (isCompact ? 0.92 : 0.85),
              width: isCompact ? '100%' : Math.min(480, width - 48),
            },
          ]}
        >
          {isCompact ? (
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          ) : null}

          <View style={styles.header}>
            <Text style={[styles.title, { color: c.onSurface }]}>Report</Text>
            <Pressable
              onPress={onClose}
              style={[styles.close, { backgroundColor: c.backgroundAlt }]}
            >
              <Text style={[styles.closeText, { color: c.onSurface }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            <Text style={[styles.sectionLabel, { color: c.onSurfaceMuted }]}>
              Summary
            </Text>
            <View style={styles.summaryRow}>
              <Summary
                label="Today"
                value={`${stats.focusCompletedToday}`}
                hint="pomos"
              />
              <Summary
                label="Today focus"
                value={formatMinutesShort(stats.focusMinutesToday)}
                hint="done"
              />
              <Summary
                label="All time"
                value={formatMinutesShort(stats.focusMinutesAllTime)}
                hint="focus"
              />
            </View>

            <Text style={[styles.sectionLabel, { color: c.onSurfaceMuted }]}>
              Last 7 days
            </Text>
            <View
              style={[
                styles.chartCard,
                { backgroundColor: c.background, borderColor: c.border },
              ]}
            >
              <View style={styles.chartRow}>
                {week.map((d) => {
                  const h = Math.max(8, Math.round((d.minutes / maxMinutes) * 110));
                  return (
                    <View key={d.key} style={styles.barCol}>
                      <Text style={[styles.barValue, { color: c.onSurfaceMuted }]}>
                        {d.minutes > 0 ? d.minutes : ''}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor:
                              d.minutes > 0 ? c.primary : c.border,
                            opacity: d.minutes > 0 ? 1 : 0.35,
                          },
                        ]}
                      />
                      <Text style={[styles.barLabel, { color: c.onSurface }]}>
                        {d.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.weekMeta, { color: c.onSurfaceMuted }]}>
                {weekPomos} pomos · {formatMinutesShort(weekTotal)} focus this week
              </Text>
            </View>

            <Pressable
              onPress={onOpenCalendar}
              style={[
                styles.calendarBtn,
                { borderColor: c.border, backgroundColor: c.background },
              ]}
            >
              <Text style={[styles.calendarBtnText, { color: c.onSurface }]}>
                Open calendar
              </Text>
              <Text style={[styles.calendarBtnMeta, { color: c.onSurfaceMuted }]}>
                Day-by-day sessions and tasks
              </Text>
            </Pressable>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={[styles.okBtn, { backgroundColor: c.primary }]}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.summary, { borderColor: c.border, backgroundColor: c.background }]}>
      <Text style={[styles.summaryLabel, { color: c.onSurfaceMuted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: c.onSurface }]}>{value}</Text>
      <Text style={[styles.summaryHint, { color: c.onSurfaceMuted }]}>{hint}</Text>
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
  handle: {
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
    marginBottom: 8,
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
  body: { gap: 12, paddingBottom: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  summaryLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  summaryHint: { fontSize: 11 },
  chartCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 140,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barValue: { fontSize: 9, fontWeight: '700', minHeight: 12 },
  bar: {
    width: '70%',
    maxWidth: 28,
    borderRadius: 6,
  },
  barLabel: { fontSize: 10, fontWeight: '700' },
  weekMeta: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  calendarBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 2,
  },
  calendarBtnText: { fontSize: 15, fontWeight: '700' },
  calendarBtnMeta: { fontSize: 12, fontWeight: '500' },
  okBtn: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  okText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
