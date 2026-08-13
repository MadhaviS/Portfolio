export type MiniAppId = 'pulse' | 'drift' | 'depth';

export type MiniAppStory = {
  kicker: string;
  title: string;
  lead: string;
  points: { mark: string; title: string; body: string }[];
};

export type MiniAppDefinition = {
  id: MiniAppId;
  title: string;
  subtitle: string;
  route: string | null;
  enabled: boolean;
  /** Shown on the Focus landing “next apps” list when not enabled. */
  comingSoon: boolean;
  accentHint: string;
  /** Expandable history / usefulness copy on the landing page. */
  story: MiniAppStory;
};

/**
 * Focus suite registry — Pulse ships now; Drift & Depth are next.
 */
export const APP_REGISTRY: MiniAppDefinition[] = [
  {
    id: 'pulse',
    title: 'Pulse',
    subtitle: 'Pomodoro timer',
    route: '/pomodoro',
    enabled: true,
    comingSoon: false,
    accentHint: 'blue',
    story: {
      kicker: 'The method behind Pulse',
      title: 'Named for a kitchen timer shaped like a tomato.',
      lead: 'In the late 1980s, student Francesco Cirillo used a tomato-shaped timer to split study into short sprints and real breaks. He called it the Pomodoro Technique — Italian for tomato. Decades later, the same rhythm still helps people ship work without burning out.',
      points: [
        {
          mark: '01',
          title: 'Starts stay small',
          body: 'Twenty-five minutes is short enough to begin — and long enough to matter.',
        },
        {
          mark: '02',
          title: 'Attention gets a fence',
          body: 'One timer, one task. Interruptions wait outside the circle.',
        },
        {
          mark: '03',
          title: 'Rest is part of the work',
          body: 'Breaks are scheduled, not stolen — so focus can return fresh.',
        },
      ],
    },
  },
  {
    id: 'drift',
    title: 'Drift',
    subtitle: 'Catch distractions before they take over',
    route: null,
    enabled: false,
    comingSoon: true,
    accentHint: 'teal',
    story: {
      kicker: 'Coming next in Focus',
      title: 'Notice the moment attention slips — then steer back.',
      lead: 'Most focus tools only measure time on a task. Drift watches the other half: when you wander into tabs, chats, and “just one more” loops. The idea is gentle accountability — catch the slide early, before an hour disappears.',
      points: [
        {
          mark: '01',
          title: 'See the slide early',
          body: 'Small signals when attention leaves the lane — not a lecture after the fact.',
        },
        {
          mark: '02',
          title: 'Return without shame',
          body: 'A soft nudge back to the work, so restarting feels normal, not like failure.',
        },
        {
          mark: '03',
          title: 'Patterns over guilt',
          body: 'Learn when and why you drift, then redesign the day around it.',
        },
      ],
    },
  },
  {
    id: 'depth',
    title: 'Depth',
    subtitle: 'Long deep-work blocks, fewer interruptions',
    route: null,
    enabled: false,
    comingSoon: true,
    accentHint: 'amber',
    story: {
      kicker: 'Coming next in Focus',
      title: 'Protect the long stretch where real work happens.',
      lead: 'Pulse is for rhythm. Depth is for immersion — multi-hour blocks with clear boundaries, quieter notifications, and a single intention. Inspired by deep-work practice: fewer context switches, more finished thinking.',
      points: [
        {
          mark: '01',
          title: 'One intention',
          body: 'Name the outcome before the block starts, so the hours have a destination.',
        },
        {
          mark: '02',
          title: 'Fewer switches',
          body: 'Guard the window from pings and half-opens that shatter concentration.',
        },
        {
          mark: '03',
          title: 'Exit with proof',
          body: 'End with a short note of what moved — so deep time compounds.',
        },
      ],
    },
  },
];

export function getEnabledApps(): MiniAppDefinition[] {
  return APP_REGISTRY.filter((app) => app.enabled);
}

export function getComingSoonApps(): MiniAppDefinition[] {
  return APP_REGISTRY.filter((app) => app.comingSoon);
}

export function getAppById(id: MiniAppId): MiniAppDefinition | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}
