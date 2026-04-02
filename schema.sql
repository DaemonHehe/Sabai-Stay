-- Sabai-Stay Supabase schema
-- Run this in the Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Supabase Auth owns credentials in auth.users. This table stores
-- application roles and shared profile data for students, owners, and admins.
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'owner', 'admin')),
  full_name text check (full_name is null or char_length(trim(full_name)) > 0),
  phone text,
  avatar_url text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  email_domain text not null unique check (char_length(trim(email_domain)) > 0),
  campus text,
  city text,
  created_at timestamptz not null default now()
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
  study_habits text,
  sleep_schedule text,
  cleanliness_level text,
  gender_preference text,
  smoking_preference text,
  pets_preference text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  location text not null check (char_length(trim(location)) > 0),
  price integer not null check (price >= 0),
  rating numeric(3,2) not null default 0.00,
  category text not null check (char_length(trim(category)) > 0),
  image text not null check (char_length(trim(image)) > 0),
  description text not null check (char_length(trim(description)) > 0),
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  guest_name text not null check (char_length(trim(guest_name)) > 0),
  guest_email text not null check (char_length(trim(guest_email)) > 0),
  guest_phone text not null check (char_length(trim(guest_phone)) > 0),
  check_in timestamptz not null,
  check_out timestamptz not null,
  guests integer not null default 1 check (guests >= 1),
  total_price integer not null check (total_price >= 0),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint bookings_check_out_after_check_in check (check_out > check_in)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  student_user_id uuid not null references public.app_users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) > 0),
  owner_response text,
  created_at timestamptz not null default now()
);

alter table public.listings
  add column if not exists owner_user_id uuid references public.app_users(id) on delete set null;

alter table public.bookings
  add column if not exists student_user_id uuid references public.app_users(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
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
  university_email text;
  user_full_name text;
  user_phone text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'));
  normalized_role := case
    when requested_role in ('student', 'owner', 'admin') then requested_role
    else 'student'
  end;

  user_full_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  user_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  university_email := nullif(trim(new.raw_user_meta_data ->> 'university_email'), '');

  if coalesce(new.raw_user_meta_data ->> 'university_id', '') ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    requested_university_id := (new.raw_user_meta_data ->> 'university_id')::uuid;
  end if;

  if requested_university_id is not null then
    select universities.id
      into matched_university_id
      from public.universities
      where universities.id = requested_university_id
      limit 1;
  end if;

  if matched_university_id is null and university_email is not null then
    select universities.id
      into matched_university_id
      from public.universities
      where lower(universities.email_domain) =
        lower(split_part(university_email, '@', 2))
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
        full_name = coalesce(public.app_users.full_name, excluded.full_name),
        phone = coalesce(public.app_users.phone, excluded.phone);

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
      university_email,
      case
        when matched_university_id is not null and university_email is not null
          then 'verified'
        else 'pending'
      end,
      case
        when matched_university_id is not null and university_email is not null
          then now()
        else null
      end,
      coalesce((new.raw_user_meta_data ->> 'roommate_opt_in')::boolean, false)
    )
    on conflict (user_id) do nothing;
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
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

create index if not exists listings_owner_user_id_idx
  on public.listings (owner_user_id);

create index if not exists bookings_listing_id_idx
  on public.bookings (listing_id);

create index if not exists bookings_listing_id_check_in_check_out_idx
  on public.bookings (listing_id, check_in, check_out);

create index if not exists bookings_student_user_id_idx
  on public.bookings (student_user_id);

create index if not exists student_profiles_university_id_idx
  on public.student_profiles (university_id);

create index if not exists reviews_listing_id_idx
  on public.reviews (listing_id);

create index if not exists reviews_student_user_id_idx
  on public.reviews (student_user_id);

alter table public.app_users enable row level security;
alter table public.universities enable row level security;
alter table public.student_profiles enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.roommate_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "public can read universities" on public.universities;
create policy "public can read universities"
  on public.universities
  for select
  to anon, authenticated
  using (true);

drop policy if exists "users can read own app user" on public.app_users;
create policy "users can read own app user"
  on public.app_users
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users can insert own app user" on public.app_users;
create policy "users can insert own app user"
  on public.app_users
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users can update own app user" on public.app_users;
create policy "users can update own app user"
  on public.app_users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "students can read own student profile" on public.student_profiles;
create policy "students can read own student profile"
  on public.student_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "students can insert own student profile" on public.student_profiles;
create policy "students can insert own student profile"
  on public.student_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "students can update own student profile" on public.student_profiles;
create policy "students can update own student profile"
  on public.student_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owners can read own owner profile" on public.owner_profiles;
create policy "owners can read own owner profile"
  on public.owner_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "owners can insert own owner profile" on public.owner_profiles;
create policy "owners can insert own owner profile"
  on public.owner_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "owners can update own owner profile" on public.owner_profiles;
create policy "owners can update own owner profile"
  on public.owner_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can read own roommate profile" on public.roommate_profiles;
create policy "users can read own roommate profile"
  on public.roommate_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own roommate profile" on public.roommate_profiles;
create policy "users can insert own roommate profile"
  on public.roommate_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own roommate profile" on public.roommate_profiles;
create policy "users can update own roommate profile"
  on public.roommate_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public listing reads are safe for the current app.
drop policy if exists "public can read listings" on public.listings;
create policy "public can read listings"
  on public.listings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public can read reviews" on public.reviews;
create policy "public can read reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

-- The current backend is expected to use SUPABASE_SERVICE_ROLE_KEY for writes
-- and booking access, so no public booking policies are created here.
-- Listings, bookings, and review writes still flow through the server today.
-- Browser auth is used for sign-up, sign-in, and profile ownership only.
