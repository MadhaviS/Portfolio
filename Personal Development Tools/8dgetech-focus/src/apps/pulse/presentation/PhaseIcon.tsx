import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import type { PomodoroPhase } from '../domain/types';
import { IconTomatoClock } from '../../../public/theme/LineIcons';

type Props = {
  phase: PomodoroPhase;
  color: string;
  size?: number;
};

/** Focus uses landing-page watch icon; breaks use matching line icons. */
export function PhaseIconGlyph({ phase, color, size = 18 }: Props) {
  if (phase === 'focus') {
    return <IconTomatoClock color={color} size={size} />;
  }
  const name = phase === 'shortBreak' ? 'coffee' : 'moon';
  return <Feather name={name} size={size} color={color} />;
}
