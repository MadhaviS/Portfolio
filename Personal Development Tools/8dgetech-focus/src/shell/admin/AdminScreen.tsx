import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '../../public/auth/AuthProvider';
import { useTheme } from '../../public/theme/ThemeProvider';
import { fontBody } from '../../public/theme/fonts';
import { IconMoon, IconSun } from '../../public/theme/LineIcons';
import { PHASE_THEME, type PomodoroPhase } from '../../apps/pulse/domain/types';
import { DRIFT_CAUSES, DRIFT_TEAL, type DriftCause } from '../../apps/drift/domain/types';
import {
  fetchAdminProfiles,
  fetchAdminSessions,
  fetchAdminPulseStats,
  fetchAdminDriftStats,
  fetchAdminTasks,
  fetchAdminDriftSessions,
  fetchAdminDriftCauses,
  type AdminProfile,
  type AdminSessionRow,
  type AdminPulseStats,
  type AdminDriftStats,
  type AdminTaskRow,
  type AdminDriftSessionRow,
  type AdminCauseRow,
} from './adminApi';

type Product = 'pulse' | 'drift';
type Tab = 'overview' | 'users' | 'sessions' | 'tasks' | 'reasons';

const PULSE_TABS: { id: Tab; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'sessions', label: 'Sessions', icon: 'clock' },
  { id: 'tasks', label: 'Tasks', icon: 'check-square' },
];

const DRIFT_TABS: { id: Tab; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'sessions', label: 'Watches', icon: 'eye' },
  { id: 'reasons', label: 'Reasons', icon: 'pie-chart' },
];

function shortDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const raw = (name || email || '?').trim();
  const parts = raw.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

function phaseColor(phase: string, fallback: string) {
  if (phase === 'focus' || phase === 'shortBreak' || phase === 'longBreak') {
    return PHASE_THEME[phase as PomodoroPhase].bg;
  }
  return fallback;
}

function phaseLabel(phase: string) {
  if (phase === 'shortBreak') return 'Short break';
  if (phase === 'longBreak') return 'Long break';
  if (phase === 'focus') return 'Focus';
  return phase;
}

function causeLabel(id: DriftCause) {
  return DRIFT_CAUSES.find((c) => c.id === id)?.label ?? id;
}

const CAUSE_COLORS: Record<DriftCause, string> = {
  tabs: '#3D8B7A',
  chat: '#5B7C99',
  social: '#C47B5A',
  email: '#8B6BAE',
  other: '#7A8A86',
};

export function AdminScreen() {
  const { theme, resolved, toggleLightDark } = useTheme();
  const c = theme.colors;
  const isLight = resolved === 'light';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { ready, isAuthenticated, isGuest, isAdmin, cloudEnabled, user } = useAuth();

  const [product, setProduct] = useState<Product>('pulse');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulseStats, setPulseStats] = useState<AdminPulseStats | null>(null);
  const [driftStats, setDriftStats] = useState<AdminDriftStats | null>(null);
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [tasks, setTasks] = useState<AdminTaskRow[]>([]);
  const [driftSessions, setDriftSessions] = useState<AdminDriftSessionRow[]>([]);
  const [driftCauses, setDriftCauses] = useState<AdminCauseRow[]>([]);

  const contentWidth = Math.min(width, 720);
  const tabs = product === 'pulse' ? PULSE_TABS : DRIFT_TABS;
  const driftAccent = DRIFT_TEAL.orb;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ps, ds, u, se, t, dse, dc] = await Promise.all([
        fetchAdminPulseStats(),
        fetchAdminDriftStats(),
        fetchAdminProfiles(),
        fetchAdminSessions(),
        fetchAdminTasks(),
        fetchAdminDriftSessions(),
        fetchAdminDriftCauses(),
      ]);
      setPulseStats(ps);
      setDriftStats(ds);
      setUsers(u);
      setSessions(se);
      setTasks(t);
      setDriftSessions(dse);
      setDriftCauses(dc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    void load();
  }, [ready, isAdmin, load]);

  const sectionHint = useMemo(() => {
    if (product === 'pulse') {
      switch (tab) {
        case 'overview':
          return 'Pulse totals across all accounts';
        case 'users':
          return `${users.length} registered`;
        case 'sessions':
          return `${sessions.length} most recent`;
        case 'tasks':
          return `${tasks.length} most recent`;
        default:
          return '';
      }
    }
    switch (tab) {
      case 'overview':
        return 'Drift totals across all accounts';
      case 'users':
        return `${users.length} registered`;
      case 'sessions':
        return `${driftSessions.length} most recent watches`;
      case 'reasons':
        return driftCauses.length
          ? `${driftCauses.reduce((s, r) => s + r.count, 0)} tagged drifts`
          : 'No tagged reasons yet';
      default:
        return '';
    }
  }, [
    product,
    tab,
    users.length,
    sessions.length,
    tasks.length,
    driftSessions.length,
    driftCauses,
  ]);

  if (ready && (!isAuthenticated || isGuest || !isAdmin)) {
    return <Redirect href="/pomodoro" />;
  }

  if (!ready || (isAdmin && loading)) {
    return (
      <View style={[styles.center, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={c.primary} />
        <Text style={[styles.loadingLabel, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
          Loading workspace…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={[styles.shell, { maxWidth: contentWidth }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={12}
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: c.backgroundAlt,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Feather name="arrow-left" size={18} color={c.onSurface} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={[styles.kicker, { color: c.primary, fontFamily: fontBody }]}>
              8dgeTech Focus
            </Text>
            <Text style={[styles.title, { color: c.onSurface, fontFamily: fontBody }]}>
              Admin
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={toggleLightDark}
              hitSlop={12}
              accessibilityLabel="Toggle color theme"
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: c.backgroundAlt,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              {isLight ? (
                <IconSun color={c.onSurface} size={16} />
              ) : (
                <IconMoon color={c.onSurface} size={16} />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setRefreshing(true);
                void load();
              }}
              hitSlop={12}
              accessibilityLabel="Refresh"
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: c.backgroundAlt,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather name="refresh-cw" size={16} color={c.onSurface} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.signedIn, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
          Signed in as {user?.email ?? 'admin'}
        </Text>

        {/* Product switcher */}
        <View
          style={[
            styles.productRow,
            { backgroundColor: c.backgroundAlt, borderColor: c.border },
          ]}
        >
          {(
            [
              { id: 'pulse' as const, label: 'Pulse', color: c.primary },
              { id: 'drift' as const, label: 'Drift', color: driftAccent },
            ] as const
          ).map((p) => {
            const on = product === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  setProduct(p.id);
                  setTab('overview');
                }}
                style={({ pressed }) => [
                  styles.productItem,
                  on && { backgroundColor: c.surface },
                  pressed && !on && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.productLabel,
                    {
                      color: on ? p.color : c.onSurfaceMuted,
                      fontFamily: fontBody,
                      fontWeight: on ? '800' : '600',
                    },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Segmented control */}
        <View
          style={[
            styles.segment,
            { backgroundColor: c.backgroundAlt, borderColor: c.border },
          ]}
        >
          {tabs.map((t) => {
            const on = tab === t.id;
            const accent = product === 'drift' ? driftAccent : c.primary;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={({ pressed }) => [
                  styles.segmentItem,
                  on && { backgroundColor: c.surface },
                  pressed && !on && { opacity: 0.7 },
                  Platform.OS === 'web' &&
                    on &&
                    ({ boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } as object),
                ]}
              >
                <Feather
                  name={t.icon}
                  size={14}
                  color={on ? accent : c.onSurfaceMuted}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    {
                      color: on ? c.onSurface : c.onSurfaceMuted,
                      fontFamily: fontBody,
                      fontWeight: on ? '700' : '600',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: c.onSurface, fontFamily: fontBody }]}>
            {tabs.find((t) => t.id === tab)?.label}
          </Text>
          <Text style={[styles.sectionHint, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
            {sectionHint}
          </Text>
        </View>

        {!cloudEnabled ? (
          <View style={[styles.notice, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>
            <Feather name="cloud-off" size={16} color={c.onSurfaceMuted} />
            <Text style={[styles.noticeText, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              Cloud not configured — connect Supabase to load live data.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.notice, { backgroundColor: `${c.danger}18`, borderColor: c.danger }]}>
            <Feather name="alert-circle" size={16} color={c.danger} />
            <Text style={[styles.noticeText, { color: c.danger, fontFamily: fontBody }]}>{error}</Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={product === 'drift' ? driftAccent : c.primary}
            />
          }
        >
          {tab === 'overview' && product === 'pulse' && pulseStats ? (
            <View style={styles.metrics}>
              <Metric icon="users" label="Users" value={pulseStats.userCount} colors={c} />
              <Metric icon="activity" label="Sessions" value={pulseStats.sessionCount} colors={c} />
              <Metric
                icon="zap"
                label="Focus done"
                value={pulseStats.completedFocus}
                colors={c}
                accent
              />
              <Metric icon="check-square" label="Tasks" value={pulseStats.taskCount} colors={c} />
            </View>
          ) : null}

          {tab === 'overview' && product === 'drift' && driftStats ? (
            <View style={styles.metrics}>
              <Metric icon="users" label="Users" value={driftStats.userCount} colors={c} />
              <Metric icon="eye" label="Watches" value={driftStats.watchCount} colors={c} />
              <Metric
                icon="activity"
                label="Drifts"
                value={driftStats.driftEventCount}
                colors={c}
                accent
                accentColor={driftAccent}
              />
              <Metric
                icon="radio"
                label="Active"
                value={driftStats.activeWatches}
                colors={c}
              />
            </View>
          ) : null}

          {tab === 'users'
            ? users.map((u) => (
                <Row
                  key={u.id}
                  colors={c}
                  avatar={initials(u.displayName, u.email)}
                  title={u.displayName || u.email || 'User'}
                  subtitle={u.email ?? 'No email'}
                  trailing={
                    <Badge
                      label={u.role}
                      bg={u.role === 'admin' ? c.primary : c.backgroundAlt}
                      fg={u.role === 'admin' ? '#FFF' : c.onSurfaceMuted}
                    />
                  }
                  meta={shortDate(u.createdAt)}
                />
              ))
            : null}

          {tab === 'sessions' && product === 'pulse'
            ? sessions.map((s) => (
                <Row
                  key={s.id}
                  colors={c}
                  avatarIcon="clock"
                  title={phaseLabel(s.phase)}
                  subtitle={s.email ?? `${s.userId.slice(0, 8)}…`}
                  trailing={
                    <View style={styles.trailStack}>
                      <Badge
                        label={`${Math.round(s.plannedSeconds / 60)} min`}
                        bg={phaseColor(s.phase, c.primary)}
                        fg="#FFF"
                      />
                      {s.completed ? (
                        <Badge label="Done" bg={c.success} fg="#FFF" />
                      ) : (
                        <Badge label="Open" bg={c.backgroundAlt} fg={c.onSurfaceMuted} />
                      )}
                    </View>
                  }
                  meta={shortDate(s.startedAt)}
                />
              ))
            : null}

          {tab === 'sessions' && product === 'drift'
            ? driftSessions.map((s) => (
                <Row
                  key={s.id}
                  colors={c}
                  avatarIcon="eye"
                  title={s.intention}
                  subtitle={s.email ?? `${s.userId.slice(0, 8)}…`}
                  trailing={
                    <View style={styles.trailStack}>
                      <Badge
                        label={`${s.driftCount} drifts`}
                        bg={driftAccent}
                        fg="#FFF"
                      />
                      {s.endedAt ? (
                        <Badge label="Ended" bg={c.backgroundAlt} fg={c.onSurfaceMuted} />
                      ) : (
                        <Badge label="Live" bg={c.success} fg="#FFF" />
                      )}
                    </View>
                  }
                  meta={shortDate(s.startedAt)}
                />
              ))
            : null}

          {tab === 'tasks' && product === 'pulse'
            ? tasks.map((t) => (
                <Row
                  key={t.id}
                  colors={c}
                  avatarIcon={t.done ? 'check' : 'circle'}
                  title={t.title}
                  subtitle={t.email ?? `${t.userId.slice(0, 8)}…`}
                  trailing={
                    <Text style={[styles.progress, { color: c.onSurface, fontFamily: fontBody }]}>
                      {t.completedPomodoros}/{t.estimatePomodoros}
                    </Text>
                  }
                  meta={shortDate(t.createdAt)}
                />
              ))
            : null}

          {tab === 'reasons' && product === 'drift'
            ? driftCauses.map((r) => (
                <Row
                  key={r.cause}
                  colors={c}
                  avatarIcon="tag"
                  title={causeLabel(r.cause)}
                  subtitle="Drift reason"
                  trailing={
                    <Badge
                      label={`${r.count}`}
                      bg={CAUSE_COLORS[r.cause]}
                      fg="#FFF"
                    />
                  }
                  meta={`${r.count} event${r.count === 1 ? '' : 's'}`}
                />
              ))
            : null}

          {((tab === 'users' && !users.length) ||
            (tab === 'sessions' &&
              product === 'pulse' &&
              !sessions.length) ||
            (tab === 'sessions' &&
              product === 'drift' &&
              !driftSessions.length) ||
            (tab === 'tasks' && !tasks.length) ||
            (tab === 'reasons' && !driftCauses.length)) &&
          !error &&
          tab !== 'overview' ? (
            <EmptyState
              colors={c}
              hint={
                product === 'drift'
                  ? 'Data appears after people sign in and run Drift watches.'
                  : 'Data appears after people sign in and run Pulse sessions.'
              }
            />
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
  colors,
  accent,
  accentColor,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: number;
  colors: {
    surface: string;
    border: string;
    onSurface: string;
    onSurfaceMuted: string;
    backgroundAlt: string;
    primary: string;
  };
  accent?: boolean;
  accentColor?: string;
}) {
  const tone = accentColor ?? colors.primary;
  return (
    <View
      style={[
        styles.metric,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.metricIcon,
          {
            backgroundColor: accent ? `${tone}22` : colors.backgroundAlt,
          },
        ]}
      >
        <Feather
          name={icon}
          size={15}
          color={accent ? tone : colors.onSurfaceMuted}
        />
      </View>
      <Text style={[styles.metricValue, { color: colors.onSurface, fontFamily: fontBody }]}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.onSurfaceMuted, fontFamily: fontBody }]}>
        {label}
      </Text>
    </View>
  );
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg, fontFamily: fontBody }]}>{label}</Text>
    </View>
  );
}

function Row({
  colors,
  avatar,
  avatarIcon,
  title,
  subtitle,
  trailing,
  meta,
}: {
  colors: {
    surface: string;
    border: string;
    onSurface: string;
    onSurfaceMuted: string;
    backgroundAlt: string;
  };
  avatar?: string;
  avatarIcon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  meta: string;
}) {
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.backgroundAlt }]}>
        {avatar ? (
          <Text style={[styles.avatarText, { color: colors.onSurface, fontFamily: fontBody }]}>
            {avatar}
          </Text>
        ) : (
          <Feather name={avatarIcon ?? 'circle'} size={14} color={colors.onSurfaceMuted} />
        )}
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowTitle, { color: colors.onSurface, fontFamily: fontBody }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {trailing}
        </View>
        <Text
          style={[styles.rowSub, { color: colors.onSurfaceMuted, fontFamily: fontBody }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.onSurfaceMuted, fontFamily: fontBody }]}>
          {meta}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({
  colors,
  hint,
}: {
  colors: { onSurfaceMuted: string; backgroundAlt: string; border: string };
  hint?: string;
}) {
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
      ]}
    >
      <Feather name="inbox" size={22} color={colors.onSurfaceMuted} />
      <Text style={[styles.emptyTitle, { color: colors.onSurfaceMuted, fontFamily: fontBody }]}>
        Nothing here yet
      </Text>
      <Text style={[styles.emptyBody, { color: colors.onSurfaceMuted, fontFamily: fontBody }]}>
        {hint ?? 'Data appears after people sign in and run sessions.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  shell: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingLabel: { fontSize: 14, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  signedIn: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 14,
    marginLeft: 52,
  },
  productRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 10,
  },
  productItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  productLabel: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 0,
  },
  segmentLabel: {
    fontSize: 12,
  },
  sectionHead: {
    marginTop: 20,
    marginBottom: 12,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 13,
    fontWeight: '500',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  scroll: { flex: 1 },
  body: {
    gap: 8,
    paddingBottom: 40,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 36,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowMeta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  trailStack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end',
    maxWidth: 140,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  progress: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});
