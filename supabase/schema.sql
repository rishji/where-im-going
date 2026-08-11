-- Where I'm Going — schema
-- Multi-tenant trip tracker: trips, shared "trip groups" via trip_participants,
-- public-by-default notes, and a calendar-sync feature with tokens isolated
-- from any client-facing role. See ~/Projects/where-im-going/PLAN.md for the
-- full design rationale behind every table/policy below.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous traveler',
  public_slug text unique,
  public_page_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint user_profiles_display_name_reasonable check (length(display_name) <= 80),
  constraint user_profiles_public_slug_format check (
    public_slug is null or public_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'
  )
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  date_from date not null,
  date_to date not null,

  location_name text not null,
  location_label text,
  city text,
  region text,
  country text,

  lat double precision,
  lng double precision,

  event_name text,
  flights text,

  confirmation_status text not null default 'tentative'
    check (confirmation_status in ('planned', 'tentative', 'confirmed', 'booked')),
  source text not null default 'manual'
    check (source in ('google_calendar', 'google_sheet', 'calendar_sync', 'manual')),

  visibility text not null default 'private' check (visibility in ('public', 'private')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trips_date_range_valid check (date_to >= date_from)
);

create index if not exists trips_user_id_idx on public.trips(user_id);
create index if not exists trips_date_from_idx on public.trips(date_from);

create table if not exists public.trip_participants (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  added_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_participants_user_id_idx on public.trip_participants(user_id);

create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_notes_body_not_blank check (length(trim(body)) > 0)
);

create index if not exists trip_notes_trip_id_idx on public.trip_notes(trip_id);

-- Client-facing calendar-connection status (no secrets). Any signed-in user
-- can connect their own calendar; this table is what their dashboard reads.
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  calendar_id text,
  sync_enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- OAuth tokens, split out on purpose: RLS is enabled with NO policies below,
-- so no anon/authenticated client can ever read or write this table — only
-- the service role (used exclusively by Edge Functions) can touch it.
create table if not exists public.calendar_credentials (
  connection_id uuid primary key references public.calendar_connections(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_type text not null check (sync_type in ('initial_import', 'calendar_sync', 'manual')),
  status text not null check (status in ('success', 'error')),
  entries_created integer not null default 0,
  entries_updated integer not null default 0,
  entries_skipped integer not null default 0,
  error_message text,
  run_at timestamptz not null default now(),
  duration_ms integer
);

create index if not exists sync_logs_user_id_idx on public.sync_logs(user_id);

-- Optional debugging trail. No client writes; nothing depends on this yet.
create table if not exists public.trip_audit (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  before_json jsonb,
  after_json jsonb,
  changed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_notes_updated_at on public.trip_notes;
create trigger set_trip_notes_updated_at
before update on public.trip_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_connections_updated_at on public.calendar_connections;
create trigger set_calendar_connections_updated_at
before update on public.calendar_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_credentials_updated_at on public.calendar_credentials;
create trigger set_calendar_credentials_updated_at
before update on public.calendar_credentials
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions
--
-- trips and trip_participants each need to read the other table to decide
-- read access (owner-or-companion), which would create a direct RLS-policy
-- cycle if done with inline subqueries in both tables' policies. These
-- SECURITY DEFINER functions run as their owner (bypassing RLS on the table
-- they touch, since RLS is not FORCE'd), breaking the cycle. trip_notes'
-- policies reuse them for the same reason.
-- ---------------------------------------------------------------------------

create or replace function public.trip_owner_id(p_trip_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select user_id from public.trips where id = p_trip_id;
$$;

create or replace function public.is_trip_participant(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_participants
    where trip_id = p_trip_id and user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_participants enable row level security;
alter table public.trip_notes enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_credentials enable row level security;
alter table public.sync_logs enable row level security;
alter table public.trip_audit enable row level security;

-- calendar_credentials and trip_audit intentionally get NO policies below —
-- RLS enabled + zero policies means anon/authenticated are denied entirely;
-- only the service role (which bypasses RLS) can read/write them.

-- user_profiles: owner-only
drop policy if exists "Users can read their profile" on public.user_profiles;
drop policy if exists "Users can insert their profile" on public.user_profiles;
drop policy if exists "Users can update their profile" on public.user_profiles;
drop policy if exists "Users can delete their profile" on public.user_profiles;

create policy "Users can read their profile"
on public.user_profiles for select to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their profile"
on public.user_profiles for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their profile"
on public.user_profiles for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their profile"
on public.user_profiles for delete to authenticated
using (auth.uid() = user_id);

-- trips: owner writes; owner or companion reads
drop policy if exists "Owner or companion can read trips" on public.trips;
drop policy if exists "Owner can insert trips" on public.trips;
drop policy if exists "Owner can update trips" on public.trips;
drop policy if exists "Owner can delete trips" on public.trips;

create policy "Owner or companion can read trips"
on public.trips for select to authenticated
using (
  auth.uid() = user_id
  or public.is_trip_participant(trips.id, auth.uid())
);

create policy "Owner can insert trips"
on public.trips for insert to authenticated
with check (auth.uid() = user_id);

create policy "Owner can update trips"
on public.trips for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Owner can delete trips"
on public.trips for delete to authenticated
using (auth.uid() = user_id);

-- trip_participants: companion or trip owner reads; owner manages membership;
-- companion controls only their own visibility
drop policy if exists "Companion or owner can read participants" on public.trip_participants;
drop policy if exists "Owner can add participants" on public.trip_participants;
drop policy if exists "Owner can remove participants" on public.trip_participants;
drop policy if exists "Companion can update own visibility" on public.trip_participants;

create policy "Companion or owner can read participants"
on public.trip_participants for select to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = public.trip_owner_id(trip_participants.trip_id)
);

create policy "Owner can add participants"
on public.trip_participants for insert to authenticated
with check (auth.uid() = public.trip_owner_id(trip_participants.trip_id));

create policy "Owner can remove participants"
on public.trip_participants for delete to authenticated
using (auth.uid() = public.trip_owner_id(trip_participants.trip_id));

create policy "Companion can update own visibility"
on public.trip_participants for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- trip_notes: readable by anyone with read access to the parent trip;
-- writable (insert) by owner or companion; edit/delete restricted to the author
drop policy if exists "Trip readers can read notes" on public.trip_notes;
drop policy if exists "Trip readers can add notes" on public.trip_notes;
drop policy if exists "Author can update own notes" on public.trip_notes;
drop policy if exists "Author can delete own notes" on public.trip_notes;

create policy "Trip readers can read notes"
on public.trip_notes for select to authenticated
using (
  auth.uid() = public.trip_owner_id(trip_notes.trip_id)
  or public.is_trip_participant(trip_notes.trip_id, auth.uid())
);

create policy "Trip readers can add notes"
on public.trip_notes for insert to authenticated
with check (
  auth.uid() = author_user_id
  and (
    auth.uid() = public.trip_owner_id(trip_notes.trip_id)
    or public.is_trip_participant(trip_notes.trip_id, auth.uid())
  )
);

create policy "Author can update own notes"
on public.trip_notes for update to authenticated
using (auth.uid() = author_user_id)
with check (auth.uid() = author_user_id);

create policy "Author can delete own notes"
on public.trip_notes for delete to authenticated
using (auth.uid() = author_user_id);

-- calendar_connections: status-only, owner manages their own row.
-- Tokens never live here — see calendar_credentials above.
drop policy if exists "Owner can read own connection" on public.calendar_connections;
drop policy if exists "Owner can insert own connection" on public.calendar_connections;
drop policy if exists "Owner can update own connection" on public.calendar_connections;
drop policy if exists "Owner can delete own connection" on public.calendar_connections;

create policy "Owner can read own connection"
on public.calendar_connections for select to authenticated
using (auth.uid() = user_id);

create policy "Owner can insert own connection"
on public.calendar_connections for insert to authenticated
with check (auth.uid() = user_id);

create policy "Owner can update own connection"
on public.calendar_connections for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Owner can delete own connection"
on public.calendar_connections for delete to authenticated
using (auth.uid() = user_id);

-- sync_logs: owner-only read; writes come from Edge Functions via service role
drop policy if exists "Owner can read own sync logs" on public.sync_logs;

create policy "Owner can read own sync logs"
on public.sync_logs for select to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Public read functions (SECURITY DEFINER, narrow, no direct table SELECT
-- is ever granted to the anon role)
-- ---------------------------------------------------------------------------

create or replace function public.list_public_trips(slug text)
returns table (
  trip_id uuid,
  date_from date,
  date_to date,
  location_name text,
  location_label text,
  city text,
  region text,
  country text,
  lat double precision,
  lng double precision,
  event_name text,
  flights text,
  confirmation_status text,
  notes jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with target as (
    select up.user_id
    from public.user_profiles up
    where up.public_slug = slug and up.public_page_enabled = true
  ),
  visible_trips as (
    -- owned trips the owner has made public
    select t.*
    from public.trips t
    join target on target.user_id = t.user_id
    where t.visibility = 'public'

    union all

    -- trips this person is a companion on, where THEY have made it public
    select t.*
    from public.trips t
    join public.trip_participants tp on tp.trip_id = t.id
    join target on target.user_id = tp.user_id
    where tp.visibility = 'public'
  )
  select
    vt.id as trip_id,
    vt.date_from,
    vt.date_to,
    vt.location_name,
    vt.location_label,
    vt.city,
    vt.region,
    vt.country,
    vt.lat,
    vt.lng,
    vt.event_name,
    vt.flights,
    vt.confirmation_status,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at)
                          order by n.created_at)
        from public.trip_notes n
        where n.trip_id = vt.id
      ),
      '[]'::jsonb
    ) as notes
  from visible_trips vt
  order by vt.date_from;
$$;

revoke all on function public.list_public_trips(text) from public;
grant execute on function public.list_public_trips(text) to anon, authenticated;

create or replace function public.list_public_gallery()
returns table (
  public_slug text,
  display_name text,
  current_location text,
  next_trip_date date
)
language sql
security definer
set search_path = public
stable
as $$
  with person_visible_trips as (
    -- trips a person owns and has made public on their own page
    select t.user_id as person_id, t.location_name, t.date_from, t.date_to
    from public.trips t
    where t.visibility = 'public'

    union all

    -- trips a person is a companion on, that THEY have made public
    select tp.user_id as person_id, t.location_name, t.date_from, t.date_to
    from public.trip_participants tp
    join public.trips t on t.id = tp.trip_id
    where tp.visibility = 'public'
  )
  select
    up.public_slug,
    up.display_name,
    (
      select pvt.location_name
      from person_visible_trips pvt
      where pvt.person_id = up.user_id
        and current_date between pvt.date_from and pvt.date_to
      order by pvt.date_from
      limit 1
    ) as current_location,
    (
      select min(pvt.date_from)
      from person_visible_trips pvt
      where pvt.person_id = up.user_id
        and pvt.date_from >= current_date
    ) as next_trip_date
  from public.user_profiles up
  where up.public_page_enabled = true and up.public_slug is not null
  order by up.display_name;
$$;

revoke all on function public.list_public_gallery() from public;
grant execute on function public.list_public_gallery() to anon, authenticated;

-- Narrow companion lookup: exact match only, never a searchable directory.
create or replace function public.find_user_by_contact(email_or_slug text)
returns table (
  user_id uuid,
  display_name text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select up.user_id, up.display_name
  from public.user_profiles up
  where up.public_slug = email_or_slug

  union all

  select u.id as user_id, up.display_name
  from auth.users u
  join public.user_profiles up on up.user_id = u.id
  where lower(u.email) = lower(email_or_slug)
  limit 1;
$$;

revoke all on function public.find_user_by_contact(text) from public;
grant execute on function public.find_user_by_contact(text) to authenticated;
