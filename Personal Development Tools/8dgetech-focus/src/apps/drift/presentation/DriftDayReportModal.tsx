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
  type DriftTodayInsight,
} from '../domain/types';
import { DriftDayRibbon } from './DriftDayRibbon';
import { DriftCausePieChart } from './DriftCausePieChart';
import { PHASE_THEME } from '../../pulse/domain/types';

const SHORT = PHASE_THEME.shortBreak;

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenWeekReport?: () => void;
};

export function DriftDayReportModal({
  open,
  onClose,
  onOpenWeekReport,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isCompact = width < 560;
  const accent = DRIFT_TEAL.orb;

  const insight = useMemo((): DriftTodayInsight | null => {
    if (!open) return null;
    return driftRepository.getTodayInsight();
  }, [open]);

  const causes = useMemo((): DriftCauseCount[] => {
    if (!open) return [];
    return driftRepository.getDayLog(todayKey()).causes;
  }, [open]);

  const hasData =
    !!insight && (insight.watchedSeconds > 0 || insight.drifts > 0);

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
                Day report
              </Text>
              <Text style={[styles.subtitle, { color: c.onSurfaceMuted }]}>
                Today · focus vs drifted by hour
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.close, { backgroundColor: c.backgroundAlt }]}
              accessibilityLabel="Close day report"
            >
              <Text style={[styles.closeText, { color: c.onSurface }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {insight ? (
              <View style={styles.summaryRow}>
                <Summary
                  label="Drifts"
                  value={`${insight.drifts}`}
                  hint="today"
                />
                <Summary
                  label="Focus"
                  value={formatAway(insight.focusSeconds)}
                  hint="on task"
                />
                <Summary
                  label="Drifted"
                  value={formatAway(insight.driftedSeconds)}
                  hint="away"
                />
              </View>
            ) : null}

            {hasData && insight ? (
              <DriftDayRibbon
                insight={insight}
                ink={c.onSurface}
                muted={c.onSurfaceMuted}
                track={`${SHORT.bg}12`}
              />
            ) : (
              <Text style={[styles.empty, { color: c.onSurfaceMuted }]}>
                Start watching — this chart fills with focus and drifted time
                for each hour.
              </Text>
            )}

            <DriftCausePieChart
              causes={causes}
              ink={c.onSurface}
              muted={c.onSurfaceMuted}
              track={c.background}
              title="Reasons today"
            />

            {onOpenWeekReport ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenWeekReport();
                }}
                style={[
                  styles.weekLink,
                  { borderColor: c.border, backgroundColor: c.background },
                ]}
              >
                <Text style={[styles.weekLinkText, { color: c.onSurface }]}>
                  Week report →
                </Text>
                <Text
                  style={[styles.weekLinkMeta, { color: c.onSurfaceMuted }]}
                >
                  Focus vs drifted · last 7 days
                </Text>
              </Pressable>
            ) : null}
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
    borderRadius: 20,
  },
  cardCompact: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    fontFamily: fontBody,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  body: {
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  summaryLabel: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontFamily: fontBody,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  summaryHint: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '500',
  },
  empty: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  weekLink: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  weekLinkText: {
    fontFamily: fontBody,
    fontSize: 15,
    fontWeight: '700',
  },
  weekLinkMeta: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '500',
  },
  okBtn: {
    marginHorizontal: 18,
    marginBottom: Platform.OS === 'ios' ? 28 : 16,
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okText: {
    fontFamily: fontBody,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
