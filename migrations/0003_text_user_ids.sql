-- Better Auth user ids are text (not uuid). The optional supabase/schema.sql
-- used uuid + auth.users, which rejects ids such as
-- "QdZJWx6NbZHNwFSUVs70JkT0NRlkSeD6". Rebuild Acuity tables to match 0002.

do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
exception
  when undefined_table then null;
  when insufficient_privilege then null;
end $$;

drop function if exists public.accept_observer_invitation(text) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.current_observes_user_id() cascade;
drop function if exists public.is_observer_of(uuid) cascade;
drop function if exists public.observer_count(uuid) cascade;

drop table if exists public.observer_logs cascade;
drop table if exists public.daily_logs cascade;
drop table if exists public.observer_invitations cascade;
drop table if exists public.titration_profiles cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  user_id text primary key references "user" ("id") on delete cascade,
  role text not null default 'primary'
    check (role in ('primary', 'observer')),
  observes_user_id text references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_has_subject check (
    (role = 'observer' and observes_user_id is not null)
    or (role = 'primary' and observes_user_id is null)
  )
);

create index profiles_observes_user_id_idx
  on public.profiles (observes_user_id);

create table public.titration_profiles (
  id text primary key,
  user_id text not null references public.profiles (user_id) on delete cascade,
  medication_name text not null,
  dose_mg numeric(10, 2) not null check (dose_mg > 0),
  daily_frequency numeric(6, 2) not null check (daily_frequency > 0),
  is_active boolean not null default true,
  started_on date not null default current_date,
  ended_on date,
  created_at timestamptz not null default now()
);

create index titration_profiles_user_id_idx
  on public.titration_profiles (user_id);

create unique index titration_profiles_one_active_per_user
  on public.titration_profiles (user_id)
  where is_active = true;

create table public.daily_logs (
  id text primary key,
  user_id text not null references public.profiles (user_id) on delete cascade,
  titration_profile_id text not null references public.titration_profiles (id),
  log_date date not null,
  executive_function smallint not null check (executive_function between 1 and 5),
  hyperactivity smallint not null check (hyperactivity between 1 and 5),
  mental_acuity smallint not null check (mental_acuity between 1 and 5),
  focus smallint not null check (focus between 1 and 5),
  mental_noise smallint not null check (mental_noise between 1 and 5),
  sleep smallint not null check (sleep between 1 and 5),
  crash smallint not null check (crash between 1 and 5),
  medication_taken boolean not null default false,
  side_effects text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index daily_logs_user_date_idx
  on public.daily_logs (user_id, log_date desc);

create table public.observer_logs (
  id text primary key,
  observer_user_id text not null references public.profiles (user_id) on delete cascade,
  subject_user_id text not null references public.profiles (user_id) on delete cascade,
  titration_profile_id text not null references public.titration_profiles (id),
  log_date date not null,
  executive_function smallint check (executive_function between 1 and 5),
  hyperactivity smallint check (hyperactivity between 1 and 5),
  mental_acuity smallint check (mental_acuity between 1 and 5),
  focus smallint check (focus between 1 and 5),
  mental_noise smallint check (mental_noise between 1 and 5),
  sleep smallint check (sleep between 1 and 5),
  crash smallint check (crash between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (observer_user_id, subject_user_id, log_date)
);

create index observer_logs_subject_date_idx
  on public.observer_logs (subject_user_id, log_date desc);

create table public.observer_invitations (
  id text primary key,
  primary_user_id text not null references public.profiles (user_id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id text references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index observer_invitations_primary_user_id_idx
  on public.observer_invitations (primary_user_id);
