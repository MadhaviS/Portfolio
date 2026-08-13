-- 8dgeTech Focus — free-tier schema (Supabase Free plan)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Phone/SMS OTP is NOT included (paid). Email OTP/magic link is free.

-- Profiles (admin uses role = 'admin' in Dashboard)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pomodoro_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.pomodoro_tasks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  note text not null default '',
  estimate_pomodoros int not null default 1,
  completed_pomodoros int not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pomodoro_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  phase text not null,
  planned_seconds int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean not null default false,
  task_id text,
  created_at timestamptz not null default now()
);

create index if not exists pomodoro_tasks_user_idx on public.pomodoro_tasks (user_id);
create index if not exists pomodoro_sessions_user_idx on public.pomodoro_sessions (user_id);
create index if not exists pomodoro_sessions_started_idx on public.pomodoro_sessions (user_id, started_at desc);

-- Avoid recursive RLS when checking admin role
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.pomodoro_settings enable row level security;
alter table public.pomodoro_tasks enable row level security;
alter table public.pomodoro_sessions enable row level security;

-- Users: own rows only
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists settings_all_own on public.pomodoro_settings;
create policy settings_all_own on public.pomodoro_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists tasks_all_own on public.pomodoro_tasks;
create policy tasks_all_own on public.pomodoro_tasks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists sessions_all_own on public.pomodoro_sessions;
create policy sessions_all_own on public.pomodoro_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin read-all (set role = 'admin' on your user in Table Editor)
drop policy if exists settings_admin_read on public.pomodoro_settings;
create policy settings_admin_read on public.pomodoro_settings
  for select using (public.is_admin());

drop policy if exists tasks_admin_read on public.pomodoro_tasks;
create policy tasks_admin_read on public.pomodoro_tasks
  for select using (public.is_admin());

drop policy if exists sessions_admin_read on public.pomodoro_sessions;
create policy sessions_admin_read on public.pomodoro_sessions
  for select using (public.is_admin());
