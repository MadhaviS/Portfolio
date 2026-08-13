import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '../../core/auth/AuthProvider';
import { useTheme } from '../../core/theme/ThemeProvider';
import { PHASE_THEME } from '../pomodoro/domain/types';
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

const ACCENT = PHASE_THEME.focus.bg;
const fontBody = Platform.select({
  web: 'Outfit, system-ui, sans-serif',
  default: 'System',
});

type Tab = 'overview' | 'users' | 'sessions' | 'tasks';

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

export function AdminScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ready, isAuthenticated, isGuest, isAdmin, cloudEnabled } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [tasks, setTasks] = useState<AdminTaskRow[]>([]);

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

  if (ready && (!isAuthenticated || isGuest || !isAdmin)) {
    return <Redirect href="/pomodoro" />;
  }

  if (!ready || (isAdmin && loading)) {
    return (
      <View style={[styles.center, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'tasks', label: 'Tasks' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={20} color={c.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: c.onSurface }]}>Admin</Text>
        <View style={{ width: 36 }} />
      </View>

      {!cloudEnabled ? (
        <Text style={[styles.banner, { color: c.onSurfaceMuted }]}>
          Cloud not configured — admin needs Supabase.
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[
                styles.tab,
                {
                  borderColor: on ? ACCENT : c.border,
                  backgroundColor: on ? ACCENT : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: on ? '#FFF' : c.onSurfaceMuted, fontFamily: fontBody },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? (
        <Text style={[styles.error, { color: ACCENT }]}>{error}</Text>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={ACCENT}
          />
        }
      >
        {tab === 'overview' && stats ? (
          <View style={styles.grid}>
            <StatCard label="Users" value={String(stats.userCount)} color={c} />
            <StatCard label="Sessions" value={String(stats.sessionCount)} color={c} />
            <StatCard label="Focus done" value={String(stats.completedFocus)} color={c} />
            <StatCard label="Tasks" value={String(stats.taskCount)} color={c} />
          </View>
        ) : null}

        {tab === 'users'
          ? users.map((u) => (
              <View
                key={u.id}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={[styles.cardTitle, { color: c.onSurface }]}>
                  {u.displayName || u.email || 'User'}
                </Text>
                <Text style={[styles.cardMeta, { color: c.onSurfaceMuted }]}>
                  {u.email ?? '—'} · {u.role} · {shortDate(u.createdAt)}
                </Text>
              </View>
            ))
          : null}

        {tab === 'sessions'
          ? sessions.map((s) => (
              <View
                key={s.id}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={[styles.cardTitle, { color: c.onSurface }]}>
                  {s.phase} · {Math.round(s.plannedSeconds / 60)}m
                  {s.completed ? ' ✓' : ''}
                </Text>
                <Text style={[styles.cardMeta, { color: c.onSurfaceMuted }]}>
                  {s.email ?? s.userId.slice(0, 8)} · {shortDate(s.startedAt)}
                </Text>
              </View>
            ))
          : null}

        {tab === 'tasks'
          ? tasks.map((t) => (
              <View
                key={t.id}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={[styles.cardTitle, { color: c.onSurface }]}>
                  {t.title}
                  {t.done ? ' ✓' : ''}
                </Text>
                <Text style={[styles.cardMeta, { color: c.onSurfaceMuted }]}>
                  {t.email ?? t.userId.slice(0, 8)} · {t.completedPomodoros}/
                  {t.estimatePomodoros} · {shortDate(t.createdAt)}
                </Text>
              </View>
            ))
          : null}

        {((tab === 'users' && !users.length) ||
          (tab === 'sessions' && !sessions.length) ||
          (tab === 'tasks' && !tasks.length)) &&
        !error ? (
          <Text style={[styles.empty, { color: c.onSurfaceMuted }]}>
            No data yet. Users must sign in and use the timer.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: { surface: string; border: string; onSurface: string; onSurfaceMuted: string };
}) {
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: color.surface, borderColor: color.border },
      ]}
    >
      <Text style={[styles.statValue, { color: color.onSurface }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: color.onSurfaceMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800' },
  banner: {
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
  },
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  tab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stat: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMeta: { fontSize: 12, fontWeight: '500' },
  error: { paddingHorizontal: 16, fontWeight: '600', marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14 },
});
