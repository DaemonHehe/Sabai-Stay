# Supabase Setup

This app now uses the Supabase client API instead of `pg`, Drizzle, or direct
server-side SQL.

## Environment

1. Copy `.env.example` to `.env`.
2. Set `SUPABASE_URL` to your project URL.
3. Set `SUPABASE_SERVICE_ROLE_KEY` for the Express server.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the browser client.
5. If you do not want to use the service role key, set `SUPABASE_ANON_KEY`
   instead and make sure your RLS policies allow the required reads and writes.
6. If you already have Expo-style variables, the server and client also accept
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as fallback
   inputs because Vite is configured to expose that prefix.

## Schema

1. Open the Supabase SQL Editor.
2. Run [`schema.sql`](C:/Project/Sabai-Stay/schema.sql).
3. In Supabase Auth, make sure the Email provider is enabled.
4. If you use email confirmation, set the site URL / redirect URL to your app
   origin so sign-up confirmation returns to the client correctly.

## Expected Tables

This schema now includes the role model from the SabaiStay paper:

- `app_users`
- `universities`
- `student_profiles`
- `owner_profiles`
- `roommate_profiles`
- `listings`
- `bookings`
- `reviews`

The current backend still actively uses these two tables today:

- `listings`
- `bookings`

The new user tables are there so you can build the student, apartment owner,
and admin flows on top of Supabase Auth without redesigning the database again.

Role mapping used in `schema.sql`:

- `student`
- `owner`
- `admin`

`owner` covers apartment owners, landlords, and property managers from the
paper.

Expected `listings` columns:

- `id`
- `owner_user_id`
- `title`
- `location`
- `price`
- `rating`
- `category`
- `image`
- `description`
- `latitude`
- `longitude`
- `created_at`

Expected `bookings` columns:

- `id`
- `listing_id`
- `student_user_id`
- `guest_name`
- `guest_email`
- `guest_phone`
- `check_in`
- `check_out`
- `guests`
- `total_price`
- `status`
- `created_at`

Expected user/profile tables:

- `app_users` links directly to `auth.users(id)` and stores the app role plus
  shared profile fields.
- `student_profiles` stores university affiliation, student verification, and
  roommate opt-in state.
- `owner_profiles` stores business and verification data for apartment owners.
- `roommate_profiles` stores matching preferences like study habits and sleep
  schedule.
- `reviews` supports student reviews and owner responses.
- `schema.sql` also installs an `auth.users` trigger that automatically creates
  `app_users` plus the matching `student_profiles` or `owner_profiles` row from
  Supabase signup metadata.

## Commands

1. `npm run dev`
2. `npm run build`
3. `npm start`

If Supabase is reachable and the `listings` table is empty, the server seeds the
initial listing data automatically through the Supabase API.

## Runtime Behavior

- The client now uses Supabase Auth directly for sign-up, sign-in, session
  persistence, and sign-out.
- Student and owner profiles are created automatically by the SQL trigger when
  a new auth user signs up.
- In development, the app falls back to seeded in-memory data by default if
  Supabase is missing or offline.
- In production, the app fails fast by default if Supabase config is missing or
  invalid.
- You can override that behavior with `ALLOW_MEMORY_FALLBACK=true`, but that is
  not recommended for a real deployment.
