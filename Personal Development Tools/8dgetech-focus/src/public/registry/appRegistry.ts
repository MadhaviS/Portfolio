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
 * Focus suite registry — product cards on the landing page.
 * Implementation lives in `src/apps/<id>`; shared platform in `src/public`.
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
    subtitle: 'See where focus leaks — then steer back',
    route: '/drift',
    enabled: true,
    comingSoon: false,
    accentHint: 'teal',
    story: {
      kicker: 'The idea behind Drift',
      title: 'Named for the quiet slide away from what you meant to do.',
      lead: 'Attention rarely fails in one dramatic leap. It drifts — a new tab, a chat ping, a “quick check” that becomes twenty minutes. Drift is built for that soft leave: notice it, name the cause, and return to the intention without turning focus into shame.',
      points: [
        {
          mark: '01',
          title: 'The leave is the signal',
          body: 'Leaving the tab (or tapping a cause) logs a drift while it happens — not a lecture after the day is already gone.',
        },
        {
          mark: '02',
          title: 'Return without shame',
          body: 'A soft nudge brings you back to the intention you named, so restarting feels normal, not like failure.',
        },
        {
          mark: '03',
          title: 'Patterns over guilt',
          body: 'Day and week views show when and why attention usually slips — so you can redesign the day, not just try harder.',
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
