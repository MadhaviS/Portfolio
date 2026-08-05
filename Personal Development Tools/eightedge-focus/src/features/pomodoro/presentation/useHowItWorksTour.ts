import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/auth/AuthProvider';
import { storageGetBool, storageSetBool } from '../../../core/storage/webStorage';

function tourKey(userId: string) {
  return `eightedge.pomodoro.user.${userId}.tourSeen`;
}

export function useHowItWorksTour() {
  const { user } = useAuth();
  const userId = user?.id ?? 'local-guest';
  const [open, setOpen] = useState(() => !storageGetBool(tourKey(userId), false));

  useEffect(() => {
    setOpen(!storageGetBool(tourKey(userId), false));
  }, [userId]);

  const complete = useCallback(() => {
    storageSetBool(tourKey(userId), true);
    setOpen(false);
  }, [userId]);

  const reopen = useCallback(() => {
    setOpen(true);
  }, []);

  return { open, complete, reopen };
}
