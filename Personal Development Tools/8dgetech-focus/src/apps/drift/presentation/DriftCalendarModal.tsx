import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTheme } from '../../../public/theme/ThemeProvider';
import { fontBody } from '../../../public/theme/fonts';
import { driftRepository } from '../data/driftRepository';
import {
  DRIFT_CAUSES,
  DRIFT_TEAL,
  formatAway,
  monthLabel,
  todayKey,
  type DriftCalendarCell,
  type DriftCause,
  type DriftDayLog,
  type DriftEvent,
  type DriftSession,
} from '../domain/types';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function causeLabel(id?: DriftCause): string {
  if (!id) return 'Unspecified';
  return DRIFT_CAUSES.find((c) => c.id === id)?.label ?? id;
}

function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function eventTitle(ev: DriftEvent): string {
  if (ev.kind === 'return') return 'Returned';
  if (ev.kind === 'manual') return `Logged · ${causeLabel(ev.cause)}`;
  return `Left · ${causeLabel(ev.cause)}`;
}

type DriftCalendarModalProps = {
  open: boolean;
  onClose: () => void;
};

export function DriftCalendarModal({ open, onClose }: DriftCalendarModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isCompact = width < 560;
  const accent = DRIFT_TEAL.orb;

  const now = new Date();
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selectedKey, setSelectedKey] = useState(todayKey());
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const t = new Date();
    setCursor({ year: t.getFullYear(), month: t.getMonth() });
    setSelectedKey(todayKey());
  }, [open, refresh]);

  const cells = useMemo(
    () => driftRepository.buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month, tick],
  );

  const selectedLog = useMemo(
    () => driftRepository.getDayLog(selectedKey),
    [selectedKey, tick],
  );

  const label = monthLabel(cursor.year, cursor.month);
  const year = String(cursor.year);
  const monthOnly = label.replace(` ${year}`, '');

  const dayHeading = useMemo(() => {
    const d = new Date(`${selectedKey}T12:00:00`);
    return d.toLocaleDateString([], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [selectedKey]);

  const goPrev = () => {
    setCursor((cur) => {
      const m = cur.month - 1;
      if (m < 0) return { year: cur.year - 1, month: 11 };
      return { ...cur, month: m };
    });
  };

  const goNext = () => {
    setCursor((cur) => {
      const m = cur.month + 1;
      if (m > 11) return { year: cur.year + 1, month: 0 };
      return { ...cur, month: m };
    });
  };

  const goToday = () => {
    const t = new Date();
    setCursor({ year: t.getFullYear(), month: t.getMonth() });
    setSelectedKey(todayKey());
  };

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
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          ) : null}

          <View style={styles.header}>
            <Text style={[styles.title, { color: c.onSurface }]}>Calendar</Text>
            <Pressable
              onPress={onClose}
              style={[styles.close, { backgroundColor: c.backgroundAlt }]}
              accessibilityLabel="Close calendar"
            >
              <Text style={[styles.closeText, { color: c.onSurface }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            <View style={[styles.calendarPanel, { backgroundColor: accent }]}>
              <View style={styles.calTopBar}>
                <Text style={styles.yearText}>{year}</Text>
                <Pressable onPress={goToday} hitSlop={8}>
                  <Text style={styles.todayTop}>Today</Text>
                </Pressable>
              </View>

              <View style={styles.monthNav}>
                <Pressable onPress={goPrev} hitSlop={12} style={styles.monthArrowHit}>
                  <Text style={styles.monthArrow}>‹</Text>
                </Pressable>
                <Text style={styles.monthTitle}>{monthOnly.toUpperCase()}</Text>
                <Pressable onPress={goNext} hitSlop={12} style={styles.monthArrowHit}>
                  <Text style={styles.monthArrow}>›</Text>
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((d) => (
                  <Text key={d} style={styles.weekday}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {cells.map((cell) => (
                  <DayCell
                    key={cell.key}
                    cell={cell}
                    selected={cell.key === selectedKey}
                    onSelect={setSelectedKey}
                  />
                ))}
              </View>
            </View>

            <DayDetail log={selectedLog} heading={dayHeading} />
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={[styles.okBtn, { backgroundColor: accent }]}
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
  cell: DriftCalendarCell;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const has = cell.drifts > 0 || cell.sessions > 0;
  return (
    <Pressable
      onPress={() => onSelect(cell.key)}
      style={[
        styles.dayCell,
        selected && styles.daySelected,
        !cell.inMonth && styles.dayOut,
      ]}
    >
      <Text
        style={[
          styles.dayNum,
          !cell.inMonth && styles.dayNumOut,
          selected && styles.dayNumSelected,
        ]}
      >
        {cell.day}
      </Text>
      {has ? (
        <View style={styles.dotRow}>
          {cell.drifts > 0 ? <View style={styles.dotDrift} /> : null}
          {cell.sessions > 0 && cell.drifts === 0 ? (
            <View style={styles.dotSession} />
          ) : null}
        </View>
      ) : (
        <View style={styles.dotSpacer} />
      )}
    </Pressable>
  );
}

function DayDetail({ log, heading }: { log: DriftDayLog; heading: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.detail}>
      <Text style={[styles.detailHeading, { color: c.onSurface }]}>{heading}</Text>
      <View style={styles.statRow}>
        <Stat label="Sessions" value={`${log.sessions}`} />
        <Stat label="Drifts" value={`${log.drifts}`} />
        <Stat label="Away" value={formatAway(log.totalAwaySeconds)} />
      </View>

      {log.sessionsList.length === 0 ? (
        <Text style={[styles.empty, { color: c.onSurfaceMuted }]}>
          No Drift sessions this day.
        </Text>
      ) : (
        log.sessionsList.map((session) => (
          <SessionBlock key={session.id} session={session} />
        ))
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View
      style={[
        styles.stat,
        { borderColor: c.border, backgroundColor: c.background },
      ]}
    >
      <Text style={[styles.statLabel, { color: c.onSurfaceMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: c.onSurface }]}>{value}</Text>
    </View>
  );
}

function SessionBlock({ session }: { session: DriftSession }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const start = eventTime(session.startedAt);
  const end = session.endedAt ? eventTime(session.endedAt) : 'open';
  const drifts = session.events.filter(
    (e) => e.kind === 'leave' || e.kind === 'manual',
  );

  return (
    <View
      style={[
        styles.sessionCard,
        { borderColor: c.border, backgroundColor: c.background },
      ]}
    >
      <Text style={[styles.sessionTitle, { color: c.onSurface }]} numberOfLines={2}>
        {session.intention || 'Untitled session'}
      </Text>
      <Text style={[styles.sessionMeta, { color: c.onSurfaceMuted }]}>
        {start} – {end} · {drifts.length} drifts
      </Text>
      {session.events.length > 0 ? (
        <View style={styles.eventList}>
          {session.events.map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <Text style={[styles.eventTime, { color: c.onSurfaceMuted }]}>
                {eventTime(ev.at)}
              </Text>
              <Text style={[styles.eventTitle, { color: c.onSurface }]}>
                {eventTitle(ev)}
                {ev.kind === 'return' && ev.awaySeconds
                  ? ` · ${formatAway(ev.awaySeconds)}`
                  : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
  title: { fontFamily: fontBody, fontSize: 20, fontWeight: '700' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fontBody,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  scrollBody: { gap: 14, paddingBottom: 8 },
  calendarPanel: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  calTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yearText: {
    fontFamily: fontBody,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  todayTop: {
    fontFamily: fontBody,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrowHit: { paddingHorizontal: 8, paddingVertical: 4 },
  monthArrow: {
    fontFamily: fontBody,
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  monthTitle: {
    fontFamily: fontBody,
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  weekday: {
    fontFamily: fontBody,
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  daySelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dayOut: {
    opacity: 0.4,
  },
  dayNum: {
    fontFamily: fontBody,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  dayNumOut: {
    color: 'rgba(255,255,255,0.7)',
  },
  dayNumSelected: {
    fontWeight: '800',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 3,
    alignItems: 'center',
  },
  dotSpacer: { height: 6, marginTop: 3 },
  dotDrift: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  dotSession: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  detail: { gap: 10 },
  detailHeading: {
    fontFamily: fontBody,
    fontSize: 16,
    fontWeight: '700',
  },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  statLabel: {
    fontFamily: fontBody,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: fontBody,
    fontSize: 16,
    fontWeight: '800',
  },
  empty: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 8,
  },
  sessionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sessionTitle: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionMeta: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '500',
  },
  eventList: { gap: 4, marginTop: 4 },
  eventRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  eventTime: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '600',
    width: 64,
  },
  eventTitle: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  okBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  okText: {
    fontFamily: fontBody,
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
