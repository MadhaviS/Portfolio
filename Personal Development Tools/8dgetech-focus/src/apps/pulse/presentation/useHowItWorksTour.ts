import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../public/auth/AuthProvider';
import {
  storageGet,
  storageGetBool,
  storageRemove,
  storageSet,
  storageSetBool,
} from '../../../public/storage/webStorage';

function tourKey(userId: string) {
  return `8dgetech.pomodoro.user.${userId}.tourSeen`;
}

function legacyTourKey(userId: string) {
  return `eightedge.pomodoro.user.${userId}.tourSeen`;
}

function hasSeenTour(userId: string): boolean {
  if (storageGetBool(tourKey(userId), false)) return true;
  const legacy = storageGet(legacyTourKey(userId));
  if (legacy === '1' || legacy === 'true') {
    storageSetBool(tourKey(userId), true);
    storageRemove(legacyTourKey(userId));
    return true;
  }
  return false;
}

export function useHowItWorksTour() {
  const { user } = useAuth();
  const userId = user?.id ?? 'local-guest';
  const [open, setOpen] = useState(() => !hasSeenTour(userId));

  useEffect(() => {
    setOpen(!hasSeenTour(userId));
  }, [userId]);

  const complete = useCallback(() => {
    storageSetBool(tourKey(userId), true);
    storageRemove(legacyTourKey(userId));
    setOpen(false);
  }, [userId]);

  const reopen = useCallback(() => {
    setOpen(true);
  }, []);

  return { open, complete, reopen };
}
