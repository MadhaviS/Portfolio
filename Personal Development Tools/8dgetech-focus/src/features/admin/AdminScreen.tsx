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
import { useAuth } from '../../core/auth/AuthProvider';
import { useTheme } from '../../core/theme/ThemeProvider';
import { fontBody } from '../../core/theme/fonts';
import { IconMoon, IconSun } from '../../core/theme/LineIcons';
import { PHASE_THEME, type PomodoroPhase } from '../pomodoro/domain/types';
import {
  fetchAdminProfiles,
  fetchAdminSessions,
  fetchAdminStats,
  fetchAdminTasks,
  type AdminProfile,
  type AdminSessionRow,
  type AdminStats,
  type AdminTaskRow,
} from './adminApi';

type Tab = 'overview' | 'users' | 'sessions' | 'tasks';

const TABS: { id: Tab; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'sessions', label: 'Sessions', icon: 'clock' },
  { id: 'tasks', label: 'Tasks', icon: 'check-square' },
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

export function AdminScreen() {
  const { theme, resolved, toggleLightDark } = useTheme();
  const c = theme.colors;
  const isLight = resolved === 'light';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { ready, isAuthenticated, isGuest, isAdmin, cloudEnabled, user } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [tasks, setTasks] = useState<AdminTaskRow[]>([]);

  const contentWidth = Math.min(width, 720);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, u, se, t] = await Promise.all([
        fetchAdminStats(),
        fetchAdminProfiles(),
        fetchAdminSessions(),
        fetchAdminTasks(),
      ]);
      setStats(s);
      setUsers(u);
      setSessions(se);
      setTasks(t);
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
    switch (tab) {
      case 'overview':
        return 'Live totals across all accounts';
      case 'users':
        return `${users.length} registered`;
      case 'sessions':
        return `${sessions.length} most recent`;
      case 'tasks':
        return `${tasks.length} most recent`;
    }
  }, [tab, users.length, sessions.length, tasks.length]);

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
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/pomodoro'))}
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

        {/* Segmented control — equal columns, always a row */}
        <View
          style={[
            styles.segment,
            { backgroundColor: c.backgroundAlt, borderColor: c.border },
          ]}
        >
          {TABS.map((t) => {
            const on = tab === t.id;
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
                  color={on ? c.primary : c.onSurfaceMuted}
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
            {TABS.find((t) => t.id === tab)?.label}
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
              tintColor={c.primary}
            />
          }
        >
          {tab === 'overview' && stats ? (
            <View style={styles.metrics}>
              <Metric
                icon="users"
                label="Users"
                value={stats.userCount}
                colors={c}
              />
              <Metric
                icon="activity"
                label="Sessions"
                value={stats.sessionCount}
                colors={c}
              />
              <Metric
                icon="zap"
                label="Focus done"
                value={stats.completedFocus}
                colors={c}
                accent
              />
              <Metric
                icon="check-square"
                label="Tasks"
                value={stats.taskCount}
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

          {tab === 'sessions'
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

          {tab === 'tasks'
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

          {((tab === 'users' && !users.length) ||
            (tab === 'sessions' && !sessions.length) ||
            (tab === 'tasks' && !tasks.length)) &&
          !error &&
          tab !== 'overview' ? (
            <EmptyState colors={c} />
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
}) {
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
            backgroundColor: accent ? `${colors.primary}22` : colors.backgroundAlt,
          },
        ]}
      >
        <Feather
          name={icon}
          size={15}
          color={accent ? colors.primary : colors.onSurfaceMuted}
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
}: {
  colors: { onSurfaceMuted: string; backgroundAlt: string; border: string };
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
        Data appears after people sign in and run Pulse sessions.
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
