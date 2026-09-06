-- DO NOT RUN THIS FILE against the Vercel DATABASE_URL.
-- The live app uses Better Auth (`"user"` table, text ids) and
-- migrations/0001–0003. This file was an unused Supabase Auth draft
-- (uuid + auth.users) and will break sign-in if applied again.

-- Several observers may watch one person (cap of eight). Observers cannot
-- read the primary user's self-report daily logs.
--
-- Access is enforced by Row Level Security. Helper functions are
-- security definer so policies do not recurse.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'primary'
    check (role in ('primary', 'observer')),
  observes_user_id uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_has_subject check (
    (role = 'observer' and observes_user_id is not null)
    or (role = 'primary' and observes_user_id is null)
  )
);

create index if not exists profiles_observes_user_id_idx
  on public.profiles (observes_user_id);

create table if not exists public.titration_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  medication_name text not null,
  dose_mg numeric(10, 2) not null check (dose_mg > 0),
  daily_frequency numeric(6, 2) not null check (daily_frequency > 0),
  is_active boolean not null default true,
  started_on date not null default current_date,
  ended_on date,
  created_at timestamptz not null default now()
);

create index if not exists titration_profiles_user_id_idx
  on public.titration_profiles (user_id);

create unique index if not exists titration_profiles_one_active_per_user
  on public.titration_profiles (user_id)
  where is_active = true;

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  titration_profile_id uuid not null references public.titration_profiles (id),
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
  on public.daily_logs (user_id, log_date desc);

-- Observer ratings are nullable: they only score behaviour they actually saw.
create table if not exists public.observer_logs (
  id uuid primary key default gen_random_uuid(),
  observer_user_id uuid not null references public.profiles (user_id) on delete cascade,
  subject_user_id uuid not null references public.profiles (user_id) on delete cascade,
  titration_profile_id uuid not null references public.titration_profiles (id),
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
  on public.observer_logs (subject_user_id, log_date desc);

-- Primary users invite observers with a shareable token.
create table if not exists public.observer_invitations (
  id uuid primary key default gen_random_uuid(),
  primary_user_id uuid not null references public.profiles (user_id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists observer_invitations_primary_user_id_idx
  on public.observer_invitations (primary_user_id);

-- ---------------------------------------------------------------------------
-- New Google accounts default to primary
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'primary')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer so policies do not recurse)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create or replace function public.current_observes_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select observes_user_id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_observer_of(subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'observer'
      and observes_user_id = subject
  )
$$;

create or replace function public.observer_count(subject uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles
  where role = 'observer'
    and observes_user_id = subject
$$;

-- ---------------------------------------------------------------------------
-- Invite acceptance (one Google account → one person, max eight observers)
-- ---------------------------------------------------------------------------

create or replace function public.accept_observer_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.observer_invitations%rowtype;
  already integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into invite
  from public.observer_invitations
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if invite.accepted_at is not null then
    raise exception 'Invite already used';
  end if;

  if invite.expires_at < now() then
    raise exception 'Invite has expired';
  end if;

  if invite.primary_user_id = auth.uid() then
    raise exception 'You cannot observe yourself';
  end if;

  if exists (
    select 1 from public.daily_logs where user_id = auth.uid()
  ) then
    raise exception 'This account already has its own daily logs';
  end if;

  select count(*) into already
  from public.profiles
  where role = 'observer'
    and observes_user_id = invite.primary_user_id;

  if already >= 8 then
    raise exception 'This person already has the maximum number of observers';
  end if;

  update public.profiles
  set
    role = 'observer',
    observes_user_id = invite.primary_user_id,
    updated_at = now()
  where user_id = auth.uid();

  update public.observer_invitations
  set
    accepted_at = now(),
    accepted_by_user_id = auth.uid()
  where id = invite.id;

  return invite.primary_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.titration_profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.observer_logs enable row level security;
alter table public.observer_invitations enable row level security;

-- profiles
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy profiles_select_subject
  on public.profiles for select
  to authenticated
  using (public.is_observer_of(user_id));

create policy profiles_select_own_observers
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() = 'primary'
    and role = 'observer'
    and observes_user_id = auth.uid()
  );

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- titration_profiles: primary CRUD own; observer may read the subject's
create policy titration_select_own
  on public.titration_profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy titration_select_as_observer
  on public.titration_profiles for select
  to authenticated
  using (public.is_observer_of(user_id));

create policy titration_insert_own
  on public.titration_profiles for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_user_role() = 'primary'
  );

create policy titration_update_own
  on public.titration_profiles for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_user_role() = 'primary'
  )
  with check (user_id = auth.uid());

create policy titration_delete_own
  on public.titration_profiles for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_user_role() = 'primary'
  );

-- daily_logs: primary only. Observers cannot read self-reports.
create policy daily_logs_own
  on public.daily_logs for all
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_user_role() = 'primary'
  )
  with check (
    user_id = auth.uid()
    and public.current_user_role() = 'primary'
  );

-- observer_logs: observer manages own rows; primary reads logs about themselves
create policy observer_logs_select_own
  on public.observer_logs for select
  to authenticated
  using (observer_user_id = auth.uid());

create policy observer_logs_select_as_subject
  on public.observer_logs for select
  to authenticated
  using (
    subject_user_id = auth.uid()
    and public.current_user_role() = 'primary'
  );

create policy observer_logs_insert_own
  on public.observer_logs for insert
  to authenticated
  with check (
    observer_user_id = auth.uid()
    and public.current_user_role() = 'observer'
    and public.is_observer_of(subject_user_id)
  );

create policy observer_logs_update_own
  on public.observer_logs for update
  to authenticated
  using (observer_user_id = auth.uid())
  with check (observer_user_id = auth.uid());

create policy observer_logs_delete_own
  on public.observer_logs for delete
  to authenticated
  using (observer_user_id = auth.uid());

-- invitations: primary manages own; signed-in users may read a token to accept
create policy invitations_select_own
  on public.observer_invitations for select
  to authenticated
  using (primary_user_id = auth.uid());

create policy invitations_select_pending_token
  on public.observer_invitations for select
  to authenticated
  using (accepted_at is null and expires_at > now());

create policy invitations_insert_own
  on public.observer_invitations for insert
  to authenticated
  with check (
    primary_user_id = auth.uid()
    and public.current_user_role() = 'primary'
  );

create policy invitations_update_own
  on public.observer_invitations for update
  to authenticated
  using (
    primary_user_id = auth.uid()
    and public.current_user_role() = 'primary'
  )
  with check (primary_user_id = auth.uid());

create policy invitations_delete_own
  on public.observer_invitations for delete
  to authenticated
  using (
    primary_user_id = auth.uid()
    and public.current_user_role() = 'primary'
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.titration_profiles to authenticated;
grant select, insert, update, delete on public.daily_logs to authenticated;
grant select, insert, update, delete on public.observer_logs to authenticated;
grant select, insert, update, delete on public.observer_invitations to authenticated;
grant execute on function public.accept_observer_invitation(text) to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_observes_user_id() to authenticated;
grant execute on function public.is_observer_of(uuid) to authenticated;
grant execute on function public.observer_count(uuid) to authenticated;
