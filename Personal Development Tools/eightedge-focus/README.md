# Focus — personal development toolkit

Expo shell with feature modules. Company branding (**8dgeTech**) appears only on the landing page header.

**First module:** Pomodoro timer.

## Stack

- **Expo** (web, Android, iOS) — one `package.json`
- Feature modules under `src/features/`
- Shared theme / auth stub / app registry under `src/core` + `src/registry`
- Supabase-ready (SQL stub in `supabase/`; wire later)

## Architecture

```
app/                      # Expo Router screens
src/
  core/                   # auth stub, theme, doodle background
  registry/               # enable/disable mini-apps
  features/
    home/
    pomodoro/             # data · domain · presentation
```

Add a new tool later: create `src/features/<name>/`, register in `appRegistry.ts`, add a route under `app/`.

## Setup (you run locally)

```bash
cd "Personal Development Tools/eightedge-focus"
npm install
npx expo start
```

Then press `w` (web), `a` (Android), or `i` (iOS).

## Pomodoro

Pomofocus-inspired flow:

- Mode tabs: Pomodoro (25) · Short Break (5) · Long Break (15)
- Colored backgrounds per mode
- START / PAUSE continuous timer
- Tasks with pomodoro estimates, active task selection
- Est. finish time + focus report
- Settings modal for durations
- Usage history persisted (web localStorage)
