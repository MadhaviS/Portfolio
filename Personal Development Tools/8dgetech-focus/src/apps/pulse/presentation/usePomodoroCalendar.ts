import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../public/auth/AuthProvider';
import { pomodoroRepository } from '../data/pomodoroRepository';
import {
  buildDayLog,
  buildMonthGrid,
  monthLabel,
  toDateKey,
  type CalendarCell,
  type DayLog,
} from '../domain/types';

export function usePomodoroCalendar() {
  const { user } = useAuth();
  const userId = user?.id ?? 'local-guest';

  const now = new Date();
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selectedKey, setSelectedKey] = useState(toDateKey(now));
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    pomodoroRepository.switchUser(userId);
    refresh();
    return pomodoroRepository.subscribe(refresh);
  }, [userId, refresh]);

  const { sessions, tasks } = useMemo(() => {
    void tick;
    return {
      sessions: pomodoroRepository.listSessions(),
      tasks: pomodoroRepository.listTasks(),
    };
  }, [tick]);

  const cells: CalendarCell[] = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, sessions, tasks),
    [cursor.year, cursor.month, sessions, tasks],
  );

  const selectedLog: DayLog = useMemo(
    () => buildDayLog(selectedKey, sessions, tasks),
    [selectedKey, sessions, tasks],
  );

  const label = monthLabel(cursor.year, cursor.month);

  const goPrev = useCallback(() => {
    setCursor((c) => {
      const month = c.month - 1;
      if (month < 0) return { year: c.year - 1, month: 11 };
      return { year: c.year, month };
    });
  }, []);

  const goNext = useCallback(() => {
    setCursor((c) => {
      const month = c.month + 1;
      if (month > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month };
    });
  }, []);

  const goToday = useCallback(() => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedKey(toDateKey(d));
  }, []);

  return {
    label,
    cells,
    selectedKey,
    selectedLog,
    setSelectedKey,
    goPrev,
    goNext,
    goToday,
    refresh,
  };
}
