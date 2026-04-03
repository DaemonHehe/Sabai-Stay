# Supabase Setup

This app now uses the Supabase client API instead of `pg`, Drizzle, or direct
server-side SQL.

## Environment

1. Copy `.env.example` to `.env`.
2. Set `SUPABASE_URL` to your project URL.
3. Set `SUPABASE_SERVICE_ROLE_KEY` for the Express server.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the browser client.
5. If you already have Expo-style variables, the server and client also accept
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as fallback
   inputs because Vite is configured to expose that prefix.

## Schema

1. Open the Supabase SQL Editor.
2. Run [`schema.sql`](./schema.sql).
3. In Supabase Auth, make sure the Email provider is enabled.
4. If you use email confirmation, set the site URL / redirect URL to your app
   origin so sign-up confirmation returns to the client correctly.

## Expected Tables

This schema now includes the role and workflow model from the SabaiStay paper:

- `app_users`
- `universities`
- `student_profiles`
- `owner_profiles`
- `roommate_profiles`
- `campus_zones`
- `transport_routes`
- `listings`
- `bookings`
- `booking_timeline_events`
- `contracts`
- `contract_documents`
- `reviews`
- `roommate_matches`
- `roommate_messages`
- `notifications`
- `verification_tasks`
- `disputes`

The current backend now reads and writes the full persisted workflow model above.

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

The SQL script seeds shared discovery reference data (`universities`,
`campus_zones`, and `transport_routes`). User-linked records such as listings,
bookings, contracts, roommate messages, and notifications are created by the
application at runtime.

## Runtime Behavior

- The client now uses Supabase Auth directly for sign-up, sign-in, session
  persistence, and sign-out.
- Student and owner profiles are created automatically by the SQL trigger when
  a new auth user signs up.
- In development, the app falls back to seeded in-memory data by default if
  Supabase is missing, offline, or the SQL schema has not been applied yet.
- In production, the app fails fast by default if Supabase config is missing or
  invalid.
- Persistent server storage requires `SUPABASE_SERVICE_ROLE_KEY`; the backend
  no longer supports an anon-key write mode.
- You can override that behavior with `ALLOW_MEMORY_FALLBACK=true`, but that is
  not recommended for a real deployment.
