/**
 * Suite app modules — one folder per product under `src/apps/<id>`.
 * Shared platform code lives in `src/public` (auth, theme, storage, supabase, registry).
 * Shell (landing / sign-in / admin) lives in `src/shell`.
 *
 * To add a future app (e.g. Depth):
 * 1. Create `src/apps/<id>/` with domain / data / presentation + `index.ts`
 * 2. Register it in `src/public/registry/appRegistry.ts`
 * 3. Add a thin route in `app/<route>.tsx`
 * 4. Export it here
 */

export type SuiteAppModuleId = 'pulse' | 'drift' | 'depth';

export const SUITE_APP_MODULES: {
  id: SuiteAppModuleId;
  title: string;
  /** Folder under src/apps */
  folder: string;
  /** Expo Router path when shipped; null while stubbed */
  route: string | null;
  status: 'shipped' | 'stub';
}[] = [
  {
    id: 'pulse',
    title: 'Pulse',
    folder: 'pulse',
    route: '/pomodoro',
    status: 'shipped',
  },
  {
    id: 'drift',
    title: 'Drift',
    folder: 'drift',
    route: '/drift',
    status: 'shipped',
  },
  {
    id: 'depth',
    title: 'Depth',
    folder: 'depth',
    route: null,
    status: 'stub',
  },
];
