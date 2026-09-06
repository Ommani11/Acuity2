-- Acuity: daily ADHD medication tracking.
-- Comments use British English. Access control is enforced in server
-- functions (Better Auth), not Postgres RLS — the driver has full access.

create table if not exists profiles (
  user_id text primary key references "user" ("id") on delete cascade,
  role text not null default 'primary'
    check (role in ('primary', 'observer')),
  observes_user_id text references profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_has_subject check (
    (role = 'observer' and observes_user_id is not null)
    or (role = 'primary' and observes_user_id is null)
  )
);

create index if not exists profiles_observes_user_id_idx
  on profiles (observes_user_id);

create table if not exists titration_profiles (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  medication_name text not null,
  dose_mg numeric(10, 2) not null check (dose_mg > 0),
  daily_frequency numeric(6, 2) not null check (daily_frequency > 0),
  is_active boolean not null default true,
  started_on date not null default current_date,
  ended_on date,
  created_at timestamptz not null default now()
);

create index if not exists titration_profiles_user_id_idx
  on titration_profiles (user_id);

create unique index if not exists titration_profiles_one_active_per_user
  on titration_profiles (user_id)
  where is_active = true;

create table if not exists daily_logs (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  titration_profile_id text not null references titration_profiles (id),
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

create index if not exists daily_logs_user_date_idx
  on daily_logs (user_id, log_date desc);

-- Observer ratings are nullable: they only score behaviour they actually saw.
create table if not exists observer_logs (
  id text primary key,
  observer_user_id text not null references profiles (user_id) on delete cascade,
  subject_user_id text not null references profiles (user_id) on delete cascade,
  titration_profile_id text not null references titration_profiles (id),
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

create index if not exists observer_logs_subject_date_idx
  on observer_logs (subject_user_id, log_date desc);

-- Primary users invite observers with a shareable token. Observers never
-- read the primary user's self-report daily logs. Several observers may
-- watch the same person.
create table if not exists observer_invitations (
  id text primary key,
  primary_user_id text not null references profiles (user_id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id text references profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists observer_invitations_primary_user_id_idx
  on observer_invitations (primary_user_id);
