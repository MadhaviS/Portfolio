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
import { useTheme } from '../../../public/theme/ThemeProvider';
import { fontBody } from '../../../public/theme/fonts';
import { driftRepository } from '../data/driftRepository';
import {
  DRIFT_TEAL,
  formatAway,
  todayKey,
  type DriftCauseCount,
  type DriftWeekPoint,
} from '../domain/types';
import { DriftWeekLineChart } from './DriftWeekLineChart';
import { DriftCausePieChart } from './DriftCausePieChart';

type DriftReportModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenCalendar: () => void;
};

export function DriftReportModal({
  open,
  onClose,
  onOpenCalendar,
}: DriftReportModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isCompact = width < 560;
  const accent = DRIFT_TEAL.orb;

  const { week, totals, todayDrifts, causes } = useMemo(() => {
    if (!open) {
      return {
        week: [] as DriftWeekPoint[],
        totals: { drifts: 0, returns: 0, sessions: 0, awaySeconds: 0 },
        todayDrifts: 0,
        causes: [] as DriftCauseCount[],
      };
    }
    const series = driftRepository.weekLineSeries(7);
    const today = series.find((d) => d.date === todayKey());
    return {
      week: series,
      totals: driftRepository.totalsRecent(7),
      todayDrifts: today?.drifts ?? 0,
      causes: driftRepository.causeBreakdownRecent(7),
    };
  }, [open]);

  const focusWeekMin = week.reduce((s, p) => s + p.focusMinutes, 0);
  const driftWeekMin = week.reduce((s, p) => s + p.driftedMinutes, 0);

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
              width: isCompact ? '100%' : Math.min(520, width - 48),
            },
          ]}
        >
          {isCompact ? (
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          ) : null}

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.onSurface }]}>
                Week report
              </Text>
              <Text style={[styles.subtitle, { color: c.onSurfaceMuted }]}>
                Focus vs drifted · last 7 days
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.close, { backgroundColor: c.backgroundAlt }]}
              accessibilityLabel="Close report"
            >
              <Text style={[styles.closeText, { color: c.onSurface }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            <View style={styles.summaryRow}>
              <Summary
                label="Today"
                value={`${todayDrifts}`}
                hint="drifts"
              />
              <Summary
                label="7 days"
                value={`${totals.drifts}`}
                hint="drifts"
              />
              <Summary
                label="Focus share"
                value={
                  focusWeekMin + driftWeekMin > 0
                    ? `${Math.round(
                        (focusWeekMin / (focusWeekMin + driftWeekMin)) * 100,
                      )}%`
                    : '—'
                }
                hint={formatAway(totals.awaySeconds) + ' away'}
              />
            </View>

            <Text style={[styles.sectionLabel, { color: c.onSurfaceMuted }]}>
              Week
            </Text>
            {week.length > 0 ? (
              <DriftWeekLineChart
                points={week}
                ink={c.onSurface}
                muted={c.onSurfaceMuted}
                track={c.background}
              />
            ) : (
              <Text style={[styles.empty, { color: c.onSurfaceMuted }]}>
                No watch data this week yet.
              </Text>
            )}

            <DriftCausePieChart
              causes={causes}
              ink={c.onSurface}
              muted={c.onSurfaceMuted}
              track={c.background}
              title="Reasons · last 7 days"
            />

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
              <Text
                style={[styles.calendarBtnMeta, { color: c.onSurfaceMuted }]}
              >
                Day-by-day drifts and sessions
              </Text>
            </Pressable>
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
    <View
      style={[
        styles.summary,
        { borderColor: c.border, backgroundColor: c.background },
      ]}
    >
      <Text style={[styles.summaryLabel, { color: c.onSurfaceMuted }]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color: c.onSurface }]}>{value}</Text>
      <Text style={[styles.summaryHint, { color: c.onSurfaceMuted }]}>
        {hint}
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
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  title: { fontFamily: fontBody, fontSize: 20, fontWeight: '700' },
  subtitle: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
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
  body: { gap: 12, paddingBottom: 12 },
  sectionLabel: {
    fontFamily: fontBody,
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
  summaryLabel: {
    fontFamily: fontBody,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontFamily: fontBody,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  summaryHint: { fontFamily: fontBody, fontSize: 11 },
  empty: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  calendarBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 2,
  },
  calendarBtnText: { fontFamily: fontBody, fontSize: 15, fontWeight: '700' },
  calendarBtnMeta: { fontFamily: fontBody, fontSize: 12, fontWeight: '500' },
  okBtn: {
    marginTop: 4,
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
