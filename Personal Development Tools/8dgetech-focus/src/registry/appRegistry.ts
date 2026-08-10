export type MiniAppId = 'pomodoro';

export type MiniAppDefinition = {
  id: MiniAppId;
  title: string;
  subtitle: string;
  route: string;
  enabled: boolean;
  accentHint: string;
};

/**
 * App registry — enable more tools here as you add feature modules.
 */
export const APP_REGISTRY: MiniAppDefinition[] = [
  {
    id: 'pomodoro',
    title: 'Pomodoro',
    subtitle: 'Focus · breaks · tasks',
    route: '/pomodoro',
    enabled: true,
    accentHint: 'tomato',
  },
  // Future modules (disabled until built):
  // { id: 'habits', title: 'Habits', ... enabled: false }
];

export function getEnabledApps(): MiniAppDefinition[] {
  return APP_REGISTRY.filter((app) => app.enabled);
}

export function getAppById(id: MiniAppId): MiniAppDefinition | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}
