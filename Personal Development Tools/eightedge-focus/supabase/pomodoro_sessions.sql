-- Future Supabase schema for Pomodoro sync (run when you connect Supabase)
-- RLS: users only see their own rows

create table if not exists public.pomodoro_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  phase text not null check (phase in ('focus', 'shortBreak', 'longBreak')),
  planned_seconds int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean not null default false
);

alter table public.pomodoro_sessions enable row level security;

create policy "own sessions"
  on public.pomodoro_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
