-- Sabai Stay persistent Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select app_users.role = 'admin'
      from public.app_users
      where app_users.id = auth.uid()
    ),
    false
  );
$$;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'owner', 'admin')),
  full_name text,
  phone text,
  avatar_url text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.universities (
  id uuid primary key,
  name text not null unique,
  email_domain text not null unique,
  campus text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.campus_zones (
  id text primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  description text not null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  walking_radius_meters integer not null check (walking_radius_meters > 0)
);

create table if not exists public.transport_routes (
  id text primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('walk', 'shuttle', 'songthaew')),
  description text not null,
  stops jsonb not null default '[]'::jsonb
);

create table if not exists public.student_profiles (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  university_id uuid references public.universities(id) on delete set null,
  student_number text,
  university_email text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verified_at timestamptz,
  roommate_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_profiles (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  business_name text,
  business_registration_number text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verification_documents jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roommate_profiles (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete set null,
  display_name text not null default 'New Student',
  bio text not null default 'Profile pending completion.',
  study_habit text not null default 'balanced'
    check (study_habit in ('silent', 'balanced', 'social')),
  sleep_schedule text not null default 'flexible'
    check (sleep_schedule in ('early_bird', 'flexible', 'night_owl')),
  cleanliness text not null default 'tidy'
    check (cleanliness in ('relaxed', 'tidy', 'meticulous')),
  gender_preference text not null default 'no_preference'
    check (gender_preference in ('no_preference', 'female_only', 'male_only', 'same_gender')),
  budget_min integer not null default 0 check (budget_min >= 0),
  budget_max integer not null default 0 check (budget_max >= 0),
  preferred_move_in timestamptz not null default now(),
  preferred_lease_months integer not null default 4 check (preferred_lease_months > 0),
  open_to_visitors boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.app_users(id) on delete set null,
  university_id uuid references public.universities(id) on delete set null,
  title text not null,
  location text not null,
  price integer not null check (price >= 0),
  rating numeric(3,2) not null default 0.00,
  category text not null,
  room_type text not null default 'studio'
    check (room_type in ('studio', 'dorm', 'condo', 'apartment', 'loft', 'shared')),
  image text not null,
  gallery jsonb not null default '[]'::jsonb,
  description text not null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  area_sqm numeric(8,2) not null default 1,
  capacity integer not null default 1 check (capacity > 0),
  bedrooms integer not null default 1 check (bedrooms > 0),
  bathrooms numeric(4,1) not null default 1,
  featured boolean not null default false,
  listing_status text not null default 'active'
    check (listing_status in ('draft', 'active', 'archived')),
  moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'flagged')),
  amenities jsonb not null default '[]'::jsonb,
  nearest_campus_zone_id text references public.campus_zones(id) on delete set null,
  walking_minutes integer not null default 0 check (walking_minutes >= 0),
  transport_route_ids jsonb not null default '[]'::jsonb,
  utility_rates jsonb not null default '{"electricityPerUnit":0,"waterPerUnit":0,"internetFee":0,"serviceFee":0}'::jsonb,
  internet_included boolean not null default false,
  lease_options jsonb not null default '[]'::jsonb,
  available_from timestamptz,
  available_to timestamptz,
  created_at timestamptz not null default now(),
  constraint listings_available_window check (
    available_to is null or available_from is null or available_to > available_from
  )
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  student_user_id uuid not null references public.app_users(id) on delete cascade,
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  check_in timestamptz not null,
  check_out timestamptz not null,
  guests integer not null default 1 check (guests >= 1),
  total_price integer not null check (total_price >= 0),
  deposit_amount integer not null default 0 check (deposit_amount >= 0),
  deposit_paid boolean not null default false,
  request_note text not null default '',
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'deposit_pending', 'confirmed', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint bookings_check_out_after_check_in check (check_out > check_in)
);

create table if not exists public.booking_timeline_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status text not null check (status in ('requested', 'approved', 'deposit_pending', 'confirmed', 'rejected', 'cancelled')),
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  student_user_id uuid not null references public.app_users(id) on delete cascade,
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  lease_term_months integer not null check (lease_term_months > 0),
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_signature', 'active', 'completed', 'cancelled')),
  signed_by_student boolean not null default false,
  signed_by_owner boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contracts_end_after_start check (end_date > start_date)
);

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  name text not null,
  type text not null,
  file_url text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  student_user_id uuid not null references public.app_users(id) on delete cascade,
  student_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  owner_response text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  type text not null
    check (type in ('booking', 'review', 'contract', 'verification', 'match', 'system')),
  title text not null,
  body text not null,
  user_role text not null check (user_role in ('student', 'owner', 'admin')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null check (role in ('student', 'owner', 'admin')),
  name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  submitted_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved')),
  created_at timestamptz not null default now()
);

alter table if exists public.listings
  add column if not exists owner_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists university_id uuid references public.universities(id) on delete set null,
  add column if not exists room_type text not null default 'studio',
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists area_sqm numeric(8,2) not null default 1,
  add column if not exists capacity integer not null default 1,
  add column if not exists bedrooms integer not null default 1,
  add column if not exists bathrooms numeric(4,1) not null default 1,
  add column if not exists featured boolean not null default false,
  add column if not exists listing_status text not null default 'active',
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists amenities jsonb not null default '[]'::jsonb,
  add column if not exists nearest_campus_zone_id text references public.campus_zones(id) on delete set null,
  add column if not exists walking_minutes integer not null default 0,
  add column if not exists transport_route_ids jsonb not null default '[]'::jsonb,
  add column if not exists utility_rates jsonb not null default '{"electricityPerUnit":0,"waterPerUnit":0,"internetFee":0,"serviceFee":0}'::jsonb,
  add column if not exists internet_included boolean not null default false,
  add column if not exists lease_options jsonb not null default '[]'::jsonb,
  add column if not exists available_from timestamptz,
  add column if not exists available_to timestamptz;

alter table if exists public.bookings
  add column if not exists student_user_id uuid references public.app_users(id) on delete cascade,
  add column if not exists owner_user_id uuid references public.app_users(id) on delete cascade,
  add column if not exists deposit_amount integer not null default 0,
  add column if not exists deposit_paid boolean not null default false,
  add column if not exists request_note text not null default '';

alter table if exists public.reviews
  add column if not exists student_name text not null default 'Student';
alter table if exists public.roommate_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists university_id uuid references public.universities(id) on delete set null,
  add column if not exists display_name text not null default 'New Student',
  add column if not exists study_habit text not null default 'balanced',
  add column if not exists cleanliness text not null default 'tidy',
  add column if not exists cleanliness_level text,
  add column if not exists budget_min integer not null default 0,
  add column if not exists budget_max integer not null default 0,
  add column if not exists preferred_move_in timestamptz not null default now(),
  add column if not exists preferred_lease_months integer not null default 4,
  add column if not exists open_to_visitors boolean not null default false,
  add column if not exists is_active boolean not null default true;

update public.roommate_profiles
set
  id = coalesce(id, gen_random_uuid()),
  display_name = case
    when nullif(trim(display_name), '') is null then 'New Student'
    else display_name
  end,
  bio = case
    when nullif(trim(bio), '') is null then 'Profile pending completion.'
    else bio
  end,
  study_habit = case
    when nullif(trim(study_habit), '') is null then 'balanced'
    else study_habit
  end,
  sleep_schedule = case
    when nullif(trim(sleep_schedule), '') is null then 'flexible'
    else sleep_schedule
  end,
  cleanliness = case
    when nullif(trim(cleanliness), '') is null then
      case
        when nullif(trim(cleanliness_level), '') is null then 'tidy'
        else cleanliness_level
      end
    else cleanliness
  end,
  gender_preference = case
    when nullif(trim(gender_preference), '') is null then 'no_preference'
    else gender_preference
  end
where true;

alter table if exists public.roommate_profiles
  alter column id set not null;

alter table if exists public.notifications
  add column if not exists user_id uuid references public.app_users(id) on delete cascade;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_listing_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_listing_no_overlap
      exclude using gist (
        listing_id with =,
        tstzrange(check_in, check_out, '[)') with &&
      )
      where (status in ('requested', 'approved', 'deposit_pending', 'confirmed'));
  end if;
end
$$;

create unique index if not exists roommate_profiles_id_idx
  on public.roommate_profiles (id);

create table if not exists public.roommate_matches (
  id text primary key,
  profile_id uuid not null references public.roommate_profiles(id) on delete cascade,
  matched_profile_id uuid not null references public.roommate_profiles(id) on delete cascade,
  compatibility_score integer not null check (compatibility_score between 0 and 100),
  shared_highlights jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint roommate_matches_distinct_profiles check (profile_id <> matched_profile_id)
);

create table if not exists public.roommate_messages (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.roommate_matches(id) on delete cascade,
  sender_profile_id uuid not null references public.roommate_profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists campus_zones_university_id_idx
  on public.campus_zones (university_id);

create index if not exists transport_routes_university_id_idx
  on public.transport_routes (university_id);

create index if not exists listings_owner_user_id_idx
  on public.listings (owner_user_id);

create index if not exists listings_university_id_idx
  on public.listings (university_id);

create index if not exists listings_status_idx
  on public.listings (listing_status, moderation_status);

create index if not exists bookings_listing_id_idx
  on public.bookings (listing_id);

create index if not exists bookings_student_user_id_idx
  on public.bookings (student_user_id);

create index if not exists bookings_owner_user_id_idx
  on public.bookings (owner_user_id);

create index if not exists booking_timeline_events_booking_id_idx
  on public.booking_timeline_events (booking_id, created_at);

create index if not exists contracts_booking_id_idx
  on public.contracts (booking_id);

create index if not exists contracts_student_user_id_idx
  on public.contracts (student_user_id);

create index if not exists contracts_owner_user_id_idx
  on public.contracts (owner_user_id);

create index if not exists reviews_listing_id_idx
  on public.reviews (listing_id);

create index if not exists roommate_profiles_university_id_idx
  on public.roommate_profiles (university_id);

create index if not exists roommate_matches_profile_id_idx
  on public.roommate_matches (profile_id, matched_profile_id);

create index if not exists roommate_messages_match_id_idx
  on public.roommate_messages (match_id, created_at);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id, created_at desc);

create index if not exists verification_tasks_user_id_idx
  on public.verification_tasks (user_id, submitted_at desc);
drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
  before update on public.app_users
  for each row
  execute function public.set_updated_at();

drop trigger if exists student_profiles_set_updated_at on public.student_profiles;
create trigger student_profiles_set_updated_at
  before update on public.student_profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists owner_profiles_set_updated_at on public.owner_profiles;
create trigger owner_profiles_set_updated_at
  before update on public.owner_profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists roommate_profiles_set_updated_at on public.roommate_profiles;
create trigger roommate_profiles_set_updated_at
  before update on public.roommate_profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists roommate_matches_set_updated_at on public.roommate_matches;
create trigger roommate_matches_set_updated_at
  before update on public.roommate_matches
  for each row
  execute function public.set_updated_at();

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  normalized_role text;
  requested_university_id uuid;
  matched_university_id uuid;
  account_email text;
  account_email_domain text;
  user_full_name text;
  user_phone text;
  wants_roommate_profile boolean;
  default_display_name text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'));
  normalized_role := case
    when requested_role in ('student', 'owner', 'admin') then requested_role
    else 'student'
  end;

  user_full_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  user_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  account_email := nullif(lower(trim(new.email)), '');
  account_email_domain := nullif(split_part(account_email, '@', 2), '');
  if coalesce(new.raw_user_meta_data ->> 'university_id', '') ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    requested_university_id := (new.raw_user_meta_data ->> 'university_id')::uuid;
  end if;
  wants_roommate_profile :=
    coalesce((new.raw_user_meta_data ->> 'roommate_opt_in')::boolean, false);
  default_display_name := coalesce(
    user_full_name,
    nullif(trim(split_part(coalesce(account_email, ''), '@', 1)), ''),
    'New Student'
  );

  if requested_university_id is not null then
    select universities.id
    into matched_university_id
    from public.universities
    where universities.id = requested_university_id
      and lower(universities.email_domain) = account_email_domain
    limit 1;
  end if;

  if matched_university_id is null and account_email_domain is not null then
    select universities.id
    into matched_university_id
    from public.universities
    where lower(universities.email_domain) = account_email_domain
    limit 1;
  end if;

  insert into public.app_users (
    id,
    role,
    full_name,
    phone
  )
  values (
    new.id,
    normalized_role,
    user_full_name,
    user_phone
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = coalesce(excluded.full_name, public.app_users.full_name),
        phone = coalesce(excluded.phone, public.app_users.phone),
        updated_at = now();

  if normalized_role = 'student' then
    insert into public.student_profiles (
      user_id,
      university_id,
      student_number,
      university_email,
      verification_status,
      verified_at,
      roommate_opt_in
    )
    values (
      new.id,
      matched_university_id,
      nullif(trim(new.raw_user_meta_data ->> 'student_number'), ''),
      account_email,
      case
        when matched_university_id is not null and new.email_confirmed_at is not null
          then 'verified'
        else 'pending'
      end,
      case
        when matched_university_id is not null and new.email_confirmed_at is not null
          then now()
        else null
      end,
      wants_roommate_profile
    )
    on conflict (user_id) do update
      set university_id = excluded.university_id,
          student_number = excluded.student_number,
          university_email = excluded.university_email,
          verification_status = excluded.verification_status,
          verified_at = excluded.verified_at,
          roommate_opt_in = excluded.roommate_opt_in,
          updated_at = now();

    if wants_roommate_profile then
      insert into public.roommate_profiles (
        user_id,
        university_id,
        display_name,
        bio,
        study_habit,
        sleep_schedule,
        cleanliness,
        gender_preference,
        budget_min,
        budget_max,
        preferred_move_in,
        preferred_lease_months,
        open_to_visitors,
        is_active
      )
      values (
        new.id,
        matched_university_id,
        default_display_name,
        'Profile pending completion.',
        'balanced',
        'flexible',
        'tidy',
        'no_preference',
        0,
        0,
        now(),
        4,
        false,
        true
      )
      on conflict (user_id) do update
        set university_id = excluded.university_id,
            display_name = coalesce(public.roommate_profiles.display_name, excluded.display_name),
            is_active = true,
            updated_at = now();
    end if;
  elsif normalized_role = 'owner' then
    insert into public.owner_profiles (
      user_id,
      business_name,
      business_registration_number
    )
    values (
      new.id,
      nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'business_registration_number'), '')
    )
    on conflict (user_id) do update
      set business_name = excluded.business_name,
          business_registration_number = excluded.business_registration_number,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.sync_auth_user_profile();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row
  execute function public.sync_auth_user_profile();
do $$
declare
  rsu_university_id uuid;
  seed_owner_id uuid;
begin
  insert into public.universities (id, name, email_domain, campus, city)
  values (
    gen_random_uuid(),
    'Rangsit University',
    'rsu.ac.th',
    'Rangsit Main Campus',
    'Pathum Thani'
  )
  on conflict (email_domain) do update
    set name = excluded.name,
        campus = excluded.campus,
        city = excluded.city
  returning id into rsu_university_id;

  if rsu_university_id is null then
    select id
    into rsu_university_id
    from public.universities
    where email_domain = 'rsu.ac.th'
    limit 1;
  end if;

  insert into public.campus_zones (
    id,
    university_id,
    name,
    description,
    latitude,
    longitude,
    walking_radius_meters
  )
  values
    ('rsu-main-gate', rsu_university_id, 'Main Gate', 'Primary arrival point with strongest food and transport access.', 13.9649000, 100.5878000, 300),
    ('rsu-library', rsu_university_id, 'Central Library', 'Library area with quieter surroundings.', 13.9666000, 100.5904000, 220),
    ('rsu-engineering', rsu_university_id, 'Engineering Faculty', 'Engineering side of campus with regular shuttle traffic.', 13.9692000, 100.5926000, 240),
    ('rsu-design', rsu_university_id, 'Design And Media', 'Creative cluster used by loft and studio residents.', 13.9624000, 100.5861000, 200)
  on conflict (id) do update
    set university_id = excluded.university_id,
        name = excluded.name,
        description = excluded.description,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        walking_radius_meters = excluded.walking_radius_meters;

  insert into public.transport_routes (
    id,
    university_id,
    name,
    mode,
    description,
    stops
  )
  values
    (
      'rsu-shuttle-green',
      rsu_university_id,
      'RSU Shuttle Green',
      'shuttle',
      'University shuttle loop covering library, main gate, and dorm clusters.',
      '[
        {"latitude": 13.9649, "longitude": 100.5878},
        {"latitude": 13.9666, "longitude": 100.5904},
        {"latitude": 13.9692, "longitude": 100.5926},
        {"latitude": 13.9720, "longitude": 100.5980}
      ]'::jsonb
    ),
    (
      'songthaew-muang-ake',
      rsu_university_id,
      'Muang Ake Songthaew',
      'songthaew',
      'Low-cost local route connecting Muang Ake and the campus gate.',
      '[
        {"latitude": 13.9640, "longitude": 100.5860},
        {"latitude": 13.9630, "longitude": 100.5890},
        {"latitude": 13.9649, "longitude": 100.5878},
        {"latitude": 13.9660, "longitude": 100.5920}
      ]'::jsonb
    )
  on conflict (id) do update
    set university_id = excluded.university_id,
        name = excluded.name,
        mode = excluded.mode,
        description = excluded.description,
        stops = excluded.stops;

  select id
  into seed_owner_id
  from public.app_users
  where role = 'owner'
  order by created_at
  limit 1;

  if seed_owner_id is null then
    select id
    into seed_owner_id
    from public.app_users
    order by created_at
    limit 1;
  end if;

  insert into public.listings (
    id,
    owner_user_id,
    university_id,
    title,
    location,
    price,
    rating,
    category,
    room_type,
    image,
    gallery,
    description,
    latitude,
    longitude,
    area_sqm,
    capacity,
    bedrooms,
    bathrooms,
    featured,
    listing_status,
    moderation_status,
    amenities,
    nearest_campus_zone_id,
    walking_minutes,
    transport_route_ids,
    utility_rates,
    internet_included,
    lease_options,
    available_from,
    available_to
  )
  values
    (
      'd9ea734a-ea2b-4479-9112-0f4ae9f36e01',
      seed_owner_id,
      rsu_university_id,
      'Plum Condo Park Rangsit',
      'Khlong Nueng, Pathum Thani',
      8500,
      4.80,
      'CONDO',
      'condo',
      '/images/condo-exterior.png',
      '["/images/condo-exterior.png","/images/condo-interior.png","/images/condo-pool.png"]'::jsonb,
      'Modern student condo near RSU main gate with study-friendly common areas and stable utilities.',
      13.9612000,
      100.6015000,
      28,
      2,
      1,
      1.0,
      true,
      'active',
      'approved',
      '["Pool","Gym","24/7 Security","Study Lounge","Laundry","Air Conditioning"]'::jsonb,
      'rsu-main-gate',
      11,
      '["rsu-shuttle-green","songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":7,"waterPerUnit":20,"internetFee":0,"serviceFee":350}'::jsonb,
      true,
      '[{"months":1,"label":"Short Stay"},{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-05-01T00:00:00+07'::timestamptz,
      null
    ),
    (
      '4f57f411-d847-448b-a7ca-a64906db4b7a',
      seed_owner_id,
      rsu_university_id,
      'Kave Town Space',
      'Chiang Rak, Pathum Thani',
      12000,
      4.90,
      'LUXURY',
      'studio',
      '/images/condo-interior.png',
      '["/images/condo-interior.png","/images/co-working.png","/images/condo-pool.png"]'::jsonb,
      'Premium studio inventory with co-working floors, smart locks, and fast owner response.',
      13.9680000,
      100.6050000,
      32,
      2,
      1,
      1.0,
      true,
      'active',
      'approved',
      '["Co-working","Rooftop","Fiber Internet","Smart Lock","Fitness Center"]'::jsonb,
      'rsu-library',
      14,
      '["rsu-shuttle-green"]'::jsonb,
      '{"electricityPerUnit":8,"waterPerUnit":18,"internetFee":0,"serviceFee":500}'::jsonb,
      true,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-05-15T00:00:00+07'::timestamptz,
      null
    ),
    (
      'd74d268f-2095-42cf-a6ef-0934ecf4cc95',
      seed_owner_id,
      rsu_university_id,
      'Dcondo Campus Resort',
      'Rangsit-Pathum Thani',
      9500,
      4.70,
      'RESORT',
      'apartment',
      '/images/condo-pool.png',
      '["/images/condo-pool.png","/images/condo-exterior.png","/images/condo-interior.png"]'::jsonb,
      'Resort-style student apartment with shuttle access and stable semester utility rates.',
      13.9720000,
      100.5980000,
      30,
      2,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Pool","Garden","Study Pods","Laundry","Shuttle Pickup"]'::jsonb,
      'rsu-engineering',
      18,
      '["rsu-shuttle-green"]'::jsonb,
      '{"electricityPerUnit":6,"waterPerUnit":17,"internetFee":450,"serviceFee":300}'::jsonb,
      false,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-04-20T00:00:00+07'::timestamptz,
      null
    ),
    (
      '62f8115f-54c8-4292-a049-8b678f5c2af3',
      seed_owner_id,
      rsu_university_id,
      'The Sky Loft RSU',
      'Lak Hok, Rangsit',
      15000,
      4.95,
      'LOFT',
      'loft',
      '/images/co-working.png',
      '["/images/co-working.png","/images/condo-interior.png"]'::jsonb,
      'Creative loft space popular with design and media students, with premium contract handling.',
      13.9630000,
      100.5890000,
      42,
      3,
      1,
      1.5,
      true,
      'active',
      'approved',
      '["Creative Studio","Meeting Room","Coffee Bar","Security"]'::jsonb,
      'rsu-design',
      7,
      '["songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":8,"waterPerUnit":20,"internetFee":600,"serviceFee":500}'::jsonb,
      false,
      '[{"months":1,"label":"Short Stay"},{"months":4,"label":"Semester"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-06-01T00:00:00+07'::timestamptz,
      null
    ),
    (
      '0c402d9e-c361-458f-897f-4e4ea50eb703',
      seed_owner_id,
      rsu_university_id,
      'Common TU Connect',
      'Khlong Luang',
      13500,
      4.88,
      'LUXURY',
      'condo',
      '/images/condo-interior.png',
      '["/images/condo-interior.png","/images/condo-pool.png"]'::jsonb,
      'High-rise condo stock with premium common areas and consistent owner-managed support.',
      13.9900000,
      100.6000000,
      35,
      2,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Infinity Pool","Reading Room","Gym","Lobby Concierge"]'::jsonb,
      'rsu-library',
      16,
      '["rsu-shuttle-green"]'::jsonb,
      '{"electricityPerUnit":7,"waterPerUnit":19,"internetFee":0,"serviceFee":550}'::jsonb,
      true,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-05-01T00:00:00+07'::timestamptz,
      null
    ),
    (
      'd7622d5f-f487-42e2-973a-9f0f1d1226bb',
      seed_owner_id,
      rsu_university_id,
      'Be Condo Phaholyothin',
      'Near Rangsit University',
      7500,
      4.60,
      'BUDGET',
      'studio',
      '/images/condo-interior.png',
      '["/images/condo-interior.png"]'::jsonb,
      'Budget studio units with straightforward semester contracts and reliable essentials.',
      13.9660000,
      100.5920000,
      24,
      2,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Laundry","Security","Mini Mart"]'::jsonb,
      'rsu-main-gate',
      9,
      '["songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":6,"waterPerUnit":16,"internetFee":300,"serviceFee":180}'::jsonb,
      false,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-04-15T00:00:00+07'::timestamptz,
      null
    ),
    (
      'f5e130b2-d3fe-4cc5-a5f4-c5eaed049be4',
      seed_owner_id,
      rsu_university_id,
      'Urban Cube Dorm',
      'Muang Ake',
      6000,
      4.50,
      'DORM',
      'dorm',
      '/images/co-working.png',
      '["/images/co-working.png","/images/condo-exterior.png"]'::jsonb,
      'Social dorm inventory near the cafe strip with roommate-friendly facilities.',
      13.9640000,
      100.5860000,
      22,
      2,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Shared Kitchen","Gaming Room","Cafe Strip","Laundry"]'::jsonb,
      'rsu-main-gate',
      6,
      '["songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":5,"waterPerUnit":15,"internetFee":250,"serviceFee":150}'::jsonb,
      false,
      '[{"months":1,"label":"Short Stay"},{"months":4,"label":"Semester"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-04-10T00:00:00+07'::timestamptz,
      null
    ),
    (
      'f9dbed3c-93ec-449a-92d5-8074a2d94091',
      seed_owner_id,
      rsu_university_id,
      'Muang Ake Garden Rooms',
      'Muang Ake Soi 7',
      6800,
      4.55,
      'BUDGET',
      'apartment',
      '/images/condo-exterior.png',
      '["/images/condo-exterior.png","/images/condo-interior.png"]'::jsonb,
      'Quiet low-rise apartment with practical amenities and short walk access to the main gate.',
      13.9655000,
      100.5882000,
      26,
      2,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Parking","Laundry","Security","Mini Mart"]'::jsonb,
      'rsu-main-gate',
      8,
      '["songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":6,"waterPerUnit":16,"internetFee":300,"serviceFee":200}'::jsonb,
      false,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"}]'::jsonb,
      '2026-04-12T00:00:00+07'::timestamptz,
      null
    ),
    (
      '82d73667-eeec-48d9-94d1-c804d3559be1',
      seed_owner_id,
      rsu_university_id,
      'Rangsit Scholar Residence',
      'Near Central Library',
      9800,
      4.72,
      'CONDO',
      'studio',
      '/images/condo-interior.png',
      '["/images/condo-interior.png","/images/co-working.png"]'::jsonb,
      'Study-focused residence with dedicated reading rooms and quiet hours policy.',
      13.9669000,
      100.5908000,
      27,
      2,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Reading Room","Fiber Internet","Security","Laundry"]'::jsonb,
      'rsu-library',
      10,
      '["rsu-shuttle-green"]'::jsonb,
      '{"electricityPerUnit":7,"waterPerUnit":18,"internetFee":0,"serviceFee":320}'::jsonb,
      true,
      '[{"months":4,"label":"Semester"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-04-25T00:00:00+07'::timestamptz,
      null
    ),
    (
      'e68db38c-3dd2-4a66-95bc-4171ea7229db',
      seed_owner_id,
      rsu_university_id,
      'Design Hub Studios',
      'Design And Media Quarter',
      11200,
      4.83,
      'CREATIVE',
      'studio',
      '/images/co-working.png',
      '["/images/co-working.png","/images/condo-interior.png"]'::jsonb,
      'Creative-friendly studios with project rooms and extended late-night access.',
      13.9627000,
      100.5865000,
      29,
      2,
      1,
      1.0,
      true,
      'active',
      'approved',
      '["Project Room","Co-working","High-Speed WiFi","Security"]'::jsonb,
      'rsu-design',
      7,
      '["songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":7,"waterPerUnit":19,"internetFee":0,"serviceFee":420}'::jsonb,
      true,
      '[{"months":1,"label":"Short Stay"},{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"}]'::jsonb,
      '2026-05-05T00:00:00+07'::timestamptz,
      null
    ),
    (
      '4877107f-98af-4f8f-ab4b-8ca253f5f75e',
      seed_owner_id,
      rsu_university_id,
      'Engineering Gate Apartments',
      'Engineering Faculty Zone',
      8900,
      4.68,
      'CONDO',
      'apartment',
      '/images/condo-exterior.png',
      '["/images/condo-exterior.png","/images/condo-interior.png"]'::jsonb,
      'Practical apartment blocks favored by engineering students needing shuttle access.',
      13.9693000,
      100.5928000,
      30,
      3,
      1,
      1.0,
      false,
      'active',
      'approved',
      '["Shuttle Stop","Laundry","Parking","Security"]'::jsonb,
      'rsu-engineering',
      12,
      '["rsu-shuttle-green"]'::jsonb,
      '{"electricityPerUnit":6,"waterPerUnit":17,"internetFee":350,"serviceFee":260}'::jsonb,
      false,
      '[{"months":4,"label":"Semester"},{"months":6,"label":"Half-Year"},{"months":12,"label":"Annual"}]'::jsonb,
      '2026-04-30T00:00:00+07'::timestamptz,
      null
    ),
    (
      '24a6f577-a9e9-4e22-b229-b7c80f2b3fd6',
      seed_owner_id,
      rsu_university_id,
      'Gateway Family Short Stay',
      'Rangsit Main Gate',
      10500,
      4.66,
      'RESORT',
      'shared',
      '/images/condo-pool.png',
      '["/images/condo-pool.png","/images/condo-exterior.png"]'::jsonb,
      'Flexible short-stay units suitable for visiting parents and guardians.',
      13.9651000,
      100.5879000,
      33,
      4,
      2,
      1.5,
      false,
      'active',
      'approved',
      '["Family Room","Security","Parking","Laundry"]'::jsonb,
      'rsu-main-gate',
      9,
      '["rsu-shuttle-green","songthaew-muang-ake"]'::jsonb,
      '{"electricityPerUnit":7,"waterPerUnit":18,"internetFee":400,"serviceFee":320}'::jsonb,
      false,
      '[{"months":1,"label":"Short Stay"},{"months":4,"label":"Semester"}]'::jsonb,
      '2026-05-03T00:00:00+07'::timestamptz,
      null
    )
  on conflict (id) do update
    set owner_user_id = coalesce(excluded.owner_user_id, listings.owner_user_id),
        university_id = excluded.university_id,
        title = excluded.title,
        location = excluded.location,
        price = excluded.price,
        rating = excluded.rating,
        category = excluded.category,
        room_type = excluded.room_type,
        image = excluded.image,
        gallery = excluded.gallery,
        description = excluded.description,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        area_sqm = excluded.area_sqm,
        capacity = excluded.capacity,
        bedrooms = excluded.bedrooms,
        bathrooms = excluded.bathrooms,
        featured = excluded.featured,
        listing_status = excluded.listing_status,
        moderation_status = excluded.moderation_status,
        amenities = excluded.amenities,
        nearest_campus_zone_id = excluded.nearest_campus_zone_id,
        walking_minutes = excluded.walking_minutes,
        transport_route_ids = excluded.transport_route_ids,
        utility_rates = excluded.utility_rates,
        internet_included = excluded.internet_included,
        lease_options = excluded.lease_options,
        available_from = excluded.available_from,
        available_to = excluded.available_to;
end
$$;

alter table public.app_users enable row level security;
alter table public.universities enable row level security;
alter table public.campus_zones enable row level security;
alter table public.transport_routes enable row level security;
alter table public.student_profiles enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.roommate_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_timeline_events enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_documents enable row level security;
alter table public.reviews enable row level security;
alter table public.roommate_matches enable row level security;
alter table public.roommate_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_tasks enable row level security;
alter table public.disputes enable row level security;
drop policy if exists "public can read universities" on public.universities;
create policy "public can read universities"
  on public.universities
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public can read campus zones" on public.campus_zones;
create policy "public can read campus zones"
  on public.campus_zones
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public can read transport routes" on public.transport_routes;
create policy "public can read transport routes"
  on public.transport_routes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "users can read app users" on public.app_users;
create policy "users can read app users"
  on public.app_users
  for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "users can insert app users" on public.app_users;
create policy "users can insert app users"
  on public.app_users
  for insert
  to authenticated
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "users can update app users" on public.app_users;
create policy "users can update app users"
  on public.app_users
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "users can manage student profiles" on public.student_profiles;
create policy "users can manage student profiles"
  on public.student_profiles
  for all
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "users can manage owner profiles" on public.owner_profiles;
create policy "users can manage owner profiles"
  on public.owner_profiles
  for all
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "users can read roommate profiles" on public.roommate_profiles;
create policy "users can read roommate profiles"
  on public.roommate_profiles
  for select
  to authenticated
  using (is_active or auth.uid() = user_id or public.is_admin());

drop policy if exists "users can write roommate profiles" on public.roommate_profiles;
create policy "users can write roommate profiles"
  on public.roommate_profiles
  for all
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "public can read live listings" on public.listings;
create policy "public can read live listings"
  on public.listings
  for select
  to anon, authenticated
  using (
    (listing_status <> 'archived' and moderation_status = 'approved')
    or auth.uid() = owner_user_id
    or public.is_admin()
  );

drop policy if exists "owners can insert listings" on public.listings;
create policy "owners can insert listings"
  on public.listings
  for insert
  to authenticated
  with check (auth.uid() = owner_user_id or public.is_admin());

drop policy if exists "owners can update listings" on public.listings;
create policy "owners can update listings"
  on public.listings
  for update
  to authenticated
  using (auth.uid() = owner_user_id or public.is_admin())
  with check (auth.uid() = owner_user_id or public.is_admin());

drop policy if exists "owners can delete listings" on public.listings;
create policy "owners can delete listings"
  on public.listings
  for delete
  to authenticated
  using (auth.uid() = owner_user_id or public.is_admin());

drop policy if exists "users can manage own bookings" on public.bookings;
create policy "users can manage own bookings"
  on public.bookings
  for all
  to authenticated
  using (
    auth.uid() = student_user_id
    or auth.uid() = owner_user_id
    or public.is_admin()
  )
  with check (
    auth.uid() = student_user_id
    or auth.uid() = owner_user_id
    or public.is_admin()
  );

drop policy if exists "users can read booking timeline" on public.booking_timeline_events;
create policy "users can read booking timeline"
  on public.booking_timeline_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings
      where bookings.id = booking_timeline_events.booking_id
        and (
          bookings.student_user_id = auth.uid()
          or bookings.owner_user_id = auth.uid()
          or public.is_admin()
        )
    )
  );

drop policy if exists "users can insert booking timeline" on public.booking_timeline_events;
create policy "users can insert booking timeline"
  on public.booking_timeline_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.bookings
      where bookings.id = booking_timeline_events.booking_id
        and (
          bookings.student_user_id = auth.uid()
          or bookings.owner_user_id = auth.uid()
          or public.is_admin()
        )
    )
  );
drop policy if exists "users can manage own contracts" on public.contracts;
create policy "users can manage own contracts"
  on public.contracts
  for all
  to authenticated
  using (
    auth.uid() = student_user_id
    or auth.uid() = owner_user_id
    or public.is_admin()
  )
  with check (
    auth.uid() = student_user_id
    or auth.uid() = owner_user_id
    or public.is_admin()
  );

drop policy if exists "users can manage contract documents" on public.contract_documents;
create policy "users can manage contract documents"
  on public.contract_documents
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.contracts
      where contracts.id = contract_documents.contract_id
        and (
          contracts.student_user_id = auth.uid()
          or contracts.owner_user_id = auth.uid()
          or public.is_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.contracts
      where contracts.id = contract_documents.contract_id
        and (
          contracts.student_user_id = auth.uid()
          or contracts.owner_user_id = auth.uid()
          or public.is_admin()
        )
    )
  );

drop policy if exists "public can read reviews" on public.reviews;
create policy "public can read reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists "students can insert reviews" on public.reviews;
create policy "students can insert reviews"
  on public.reviews
  for insert
  to authenticated
  with check (auth.uid() = student_user_id or public.is_admin());

drop policy if exists "owners can update reviews" on public.reviews;
create policy "owners can update reviews"
  on public.reviews
  for update
  to authenticated
  using (
    auth.uid() = student_user_id
    or public.is_admin()
    or exists (
      select 1
      from public.listings
      where listings.id = reviews.listing_id
        and listings.owner_user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = student_user_id
    or public.is_admin()
    or exists (
      select 1
      from public.listings
      where listings.id = reviews.listing_id
        and listings.owner_user_id = auth.uid()
    )
  );

drop policy if exists "users can read roommate matches" on public.roommate_matches;
create policy "users can read roommate matches"
  on public.roommate_matches
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.roommate_profiles profile_a
      join public.roommate_profiles profile_b
        on profile_b.id = roommate_matches.matched_profile_id
      where profile_a.id = roommate_matches.profile_id
        and (
          profile_a.user_id = auth.uid()
          or profile_b.user_id = auth.uid()
        )
    )
  );

drop policy if exists "users can manage roommate matches" on public.roommate_matches;
create policy "users can manage roommate matches"
  on public.roommate_matches
  for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.roommate_profiles profile_a
      join public.roommate_profiles profile_b
        on profile_b.id = roommate_matches.matched_profile_id
      where profile_a.id = roommate_matches.profile_id
        and (
          profile_a.user_id = auth.uid()
          or profile_b.user_id = auth.uid()
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.roommate_profiles profile_a
      join public.roommate_profiles profile_b
        on profile_b.id = roommate_matches.matched_profile_id
      where profile_a.id = roommate_matches.profile_id
        and (
          profile_a.user_id = auth.uid()
          or profile_b.user_id = auth.uid()
        )
    )
  );

drop policy if exists "users can read roommate messages" on public.roommate_messages;
create policy "users can read roommate messages"
  on public.roommate_messages
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.roommate_matches
      join public.roommate_profiles profile_a
        on profile_a.id = roommate_matches.profile_id
      join public.roommate_profiles profile_b
        on profile_b.id = roommate_matches.matched_profile_id
      where roommate_matches.id = roommate_messages.match_id
        and (
          profile_a.user_id = auth.uid()
          or profile_b.user_id = auth.uid()
        )
    )
  );

drop policy if exists "users can send roommate messages" on public.roommate_messages;
create policy "users can send roommate messages"
  on public.roommate_messages
  for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.roommate_profiles
      where roommate_profiles.id = roommate_messages.sender_profile_id
        and roommate_profiles.user_id = auth.uid()
    )
  );
drop policy if exists "users can read notifications" on public.notifications;
create policy "users can read notifications"
  on public.notifications
  for select
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or (
      user_id is null
      and user_role = (
        select app_users.role
        from public.app_users
        where app_users.id = auth.uid()
      )
    )
  );

drop policy if exists "users can update notifications" on public.notifications;
create policy "users can update notifications"
  on public.notifications
  for update
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or (
      user_id is null
      and user_role = (
        select app_users.role
        from public.app_users
        where app_users.id = auth.uid()
      )
    )
  )
  with check (
    public.is_admin()
    or user_id = auth.uid()
    or (
      user_id is null
      and user_role = (
        select app_users.role
        from public.app_users
        where app_users.id = auth.uid()
      )
    )
  );

drop policy if exists "users can insert notifications" on public.notifications;
create policy "users can insert notifications"
  on public.notifications
  for insert
  to authenticated
  with check (
    public.is_admin()
    or user_id = auth.uid()
  );

drop policy if exists "users can read verification tasks" on public.verification_tasks;
create policy "users can read verification tasks"
  on public.verification_tasks
  for select
  to authenticated
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "users can insert verification tasks" on public.verification_tasks;
create policy "users can insert verification tasks"
  on public.verification_tasks
  for insert
  to authenticated
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "admins can update verification tasks" on public.verification_tasks;
create policy "admins can update verification tasks"
  on public.verification_tasks
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can read disputes" on public.disputes;
create policy "admins can read disputes"
  on public.disputes
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "authenticated users can create disputes" on public.disputes;
create policy "authenticated users can create disputes"
  on public.disputes
  for insert
  to authenticated
  with check (true);

drop policy if exists "admins can update disputes" on public.disputes;
create policy "admins can update disputes"
  on public.disputes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The Express backend is expected to use SUPABASE_SERVICE_ROLE_KEY for writes.

