# Technical Documentation

## 1. Purpose

Sabai Stay is a university housing platform focused on student rental discovery
and workflows around booking, contracts, roommate matching, and university-aware
navigation. The codebase is implemented as a single deployable application:

- a Vite-built React SPA in `client/`
- an Express API in `server/`
- shared runtime contracts in `shared/`
- a Supabase Postgres/Auth backend defined by `schema.sql`

## 2. High-Level Architecture

```text
Browser
  -> React SPA (client/)
  -> fetch /api/*
  -> Express API (server/routes.ts)
  -> ResilientStorage (server/storage.ts)
     -> SupabaseStorage when configured
     -> MemoryStorage fallback in development
  -> Supabase Postgres + Auth
```

Key design choices:

- The browser talks to the Express API for app workflows.
- The browser also uses Supabase Auth directly for sign-in, sign-up, and session
  management.
- Shared Zod schemas in `shared/schema.ts` are used as the contract boundary
  between the client, server, and database normalization code.
- The server uses `SUPABASE_SERVICE_ROLE_KEY` for persistent writes, and then
  enforces ownership and role rules in application code.
- Row Level Security in Supabase protects browser-side access to tables and
  keeps direct client reads scoped to the authenticated user.

## 3. Technology Stack

### Frontend

- React 19
- Vite 7
- TypeScript
- Wouter for routing
- TanStack React Query for data fetching and cache invalidation
- Tailwind CSS v4
- Leaflet and react-leaflet for map rendering
- Supabase browser client for authentication

### Backend

- Express 5
- Node.js HTTP server
- TypeScript with `tsx` in development
- Zod for validation
- esbuild for the production server bundle

### Data and Auth

- Supabase Auth for user identity
- Supabase Postgres for application data
- `schema.sql` for tables, triggers, indexes, exclusion constraints, seed data,
  and RLS policies

## 4. Repository Layout

```text
client/
  index.html
  src/
    App.tsx
    main.tsx
    pages/
    components/
    contexts/
    hooks/
    lib/
server/
  index.ts
  routes.ts
  storage.ts
  static.ts
  vite.ts
  seed-data.ts
shared/
  schema.ts
script/
  build.ts
schema.sql
SUPABASE_SETUP.md
```

Important directories:

- `client/src/pages`: routed application pages
- `client/src/lib/api.ts`: typed API client used by the SPA
- `client/src/lib/supabase.ts`: browser-side Supabase auth and profile loading
- `server/routes.ts`: HTTP API definitions and request authorization
- `server/storage.ts`: storage abstraction, data normalization, and Supabase
  persistence
- `shared/schema.ts`: shared Zod schemas and TypeScript types
- `schema.sql`: database schema and RLS source of truth

## 5. Runtime Architecture

### 5.1 Server Startup

`server/index.ts` is the main entry point.

Startup sequence:

1. Load environment variables via `env.ts`.
2. Create the Express app and HTTP server.
3. Register JSON and form middleware.
4. Call `initializeStorage()` to connect to Supabase or fall back to memory.
5. Register API routes through `registerRoutes()`.
6. In development, mount the Vite dev middleware.
7. In production, serve the built SPA from `dist/public`.

### 5.2 Storage Mode Selection

`server/storage.ts` exposes `ResilientStorage`, which lazily selects the
backing store.

- `SupabaseStorage` is used when `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are configured and the schema is ready.
- `MemoryStorage` is used only as a fallback, primarily for development.

Behavior:

- Development defaults to allowing memory fallback.
- Production defaults to failing fast if Supabase is unavailable.
- A startup schema probe checks whether the required tables exist.
- When the persistent database is empty, the server seeds discovery/listing
  records and demo owner accounts for a usable initial environment.

### 5.3 Shared Validation

`shared/schema.ts` is the runtime contract layer for:

- listing, booking, contract, review, and roommate models
- discovery and dashboard payloads
- insert/update payload validation
- enum definitions shared across client and server

The server parses request bodies and query parameters with Zod before touching
storage. The client parses most API responses with the same schemas.

## 6. Frontend Architecture

### 6.1 Entry Points

- `client/src/main.tsx`: mounts the app, global theme provider
- `client/src/App.tsx`: route registration and React Query provider

### 6.2 Active Routes

- `/`: home page with a map-first housing discovery experience
- `/list`: filterable listing search page
- `/listing/:id`: listing details, utilities, reviews, and booking request flow
- `/dashboard`: owner and student workflow page

### 6.3 Data Layer

The SPA uses:

- React Query for remote state and cache invalidation
- `client/src/lib/api.ts` as the typed fetch layer
- `client/src/lib/queryClient.ts` for query client configuration

Patterns used in the client:

- public discovery and listings are fetched without auth
- private routes attach the Supabase Bearer token when available
- mutations invalidate related query keys such as `dashboard`, `listings`, and
  `reviews`

### 6.4 Authentication

Authentication is implemented in:

- `client/src/lib/supabase.ts`
- `client/src/contexts/auth-context.tsx`

Flow:

1. The browser creates a Supabase client from Vite env vars or
   `/api/config/public`.
2. Sign-up and sign-in happen directly against Supabase Auth.
3. The access token is later attached to API requests as
   `Authorization: Bearer <token>`.
4. The app lazily loads the authenticated profile from `app_users`,
   `student_profiles`, and `owner_profiles`.

The auth context is implemented as a lazy external store rather than a global
provider mounted at startup, which keeps initial bundle work lower.

### 6.5 Bundle Strategy

`vite.config.ts` manually splits heavy vendor groups into separate chunks:

- `map-vendor`: Leaflet and react-leaflet
- `supabase-vendor`: Supabase browser client
- `query-vendor`: React Query
- `ui-vendor`: remaining Radix-related UI dependencies
- `icon-vendor`: lucide-react

Routes and some large components are also lazy-loaded.

## 7. Backend Architecture

### 7.1 Request Handling

`server/routes.ts` defines the API and uses helper guards:

- `requireAuth()`
- `requireRole()`

Role model:

- `student`
- `owner`

Authentication is based on the Supabase access token sent by the browser.
`getAuthActor()` resolves the current auth user, then loads the matching
`app_users` row to determine the app role.

### 7.2 Error Handling

The server:

- returns `400` on validation failures
- returns `401` when authentication is required
- returns `403` on role or ownership violations
- returns `404` when records are missing
- returns `409` on booking overlap conflicts
- falls back to `500` for unexpected errors

`StorageError` is used for storage-specific failure cases, including booking
conflict signaling.

### 7.3 API Surface

#### Public Endpoints

- `GET /api/config/public`
- `GET /api/discovery`
- `GET /api/listings`
- `GET /api/listings/:id`
- `GET /api/listings/:id/utilities`
- `GET /api/reviews?listingId=...`

#### Authenticated Endpoints

- `GET /api/dashboard`
- `POST /api/bookings`
- `GET /api/bookings`
- `GET /api/contracts`
- `GET /api/roommates/profiles`
- `GET /api/roommates/matches`
- `GET /api/roommates/messages/:matchId`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`

#### Owner Endpoints

- `POST /api/listings`
- `PATCH /api/listings/:id`
- `PATCH /api/bookings/:id/status`
- `PATCH /api/contracts/:id/status`
- `PATCH /api/reviews/:id/response`

#### Student Endpoints

- `POST /api/reviews`
- `POST /api/roommates/profiles`
- `POST /api/roommates/messages`

## 8. Core Domain Workflows

### 8.1 Discovery and Listing Search

- Universities, campus zones, and transport routes are fetched through
  `/api/discovery`.
- Listings are filtered by search query, category, university, campus zone,
  room type, price, capacity, and walking time.
- Utilities can be estimated per listing through
  `/api/listings/:id/utilities`.

### 8.2 Booking Workflow

Booking statuses:

- `requested`
- `approved`
- `deposit_pending`
- `confirmed`
- `rejected`
- `cancelled`

Current flow:

1. Student submits a booking request.
2. Server calculates the stay total from the monthly price and date range.
3. Owner updates the booking state.
4. Booking timeline events are stored.
5. Related notifications and contracts are updated as the workflow advances.

Overlap protection exists at the database layer using an exclusion constraint on
`bookings` by `listing_id` and `tstzrange(check_in, check_out, '[)')`.

### 8.3 Contract Workflow

Contract statuses:

- `draft`
- `pending_signature`
- `active`
- `completed`
- `cancelled`

Contracts are linked one-to-one with bookings. Contract documents are stored as
metadata records in `contract_documents`.

### 8.4 Reviews

- Students can create listing reviews.
- Owners can respond to reviews for their own listings.
- Reviews are publicly readable.

### 8.5 Roommate Matching

- Students maintain a roommate profile with preferences and budget range.
- Match compatibility is calculated in the application layer.
- Match rows are persisted in `roommate_matches`.
- Messages are persisted in `roommate_messages`.

### 8.6 Notifications and Operational Queues

- Notifications are stored in `notifications`.
- Verification requests are stored in `verification_tasks`.
- Disputes are stored in `disputes`.

## 9. Database Design

### 9.1 Source of Truth

`schema.sql` is the authoritative database definition. It contains:

- extensions
- functions
- tables
- alter statements for existing projects
- indexes and constraints
- triggers
- RLS policies
- seed data

### 9.2 Table Groups

#### Identity and Profiles

- `app_users`
- `student_profiles`
- `owner_profiles`
- `roommate_profiles`

#### University Discovery

- `universities`
- `campus_zones`
- `transport_routes`

#### Listings and Booking

- `listings`
- `bookings`
- `booking_timeline_events`
- `contracts`
- `contract_documents`

#### Trust and Community

- `reviews`
- `notifications`
- `verification_tasks`
- `disputes`
- `roommate_matches`
- `roommate_messages`

### 9.3 Important Functions and Triggers

- `public.set_updated_at()`: updates `updated_at` columns
- `public.is_admin()`: legacy helper retained for compatibility in existing SQL
  policies
- `public.sync_auth_user_profile()`: syncs Supabase Auth users into app tables

Trigger coverage includes:

- profile `updated_at` maintenance
- auth user insert/update synchronization

The auth sync trigger creates and updates:

- `app_users`
- `student_profiles`
- `owner_profiles`
- optional `roommate_profiles` when signup metadata opts in

### 9.4 Indexes and Constraints

Notable protection and performance rules:

- foreign keys between listings, bookings, contracts, and profiles
- check constraints for enum-like status fields
- check constraints for date windows
- indexes on foreign keys and common query paths
- booking overlap exclusion constraint
- unique index on `roommate_profiles.id`

## 10. Row Level Security Model

RLS is enabled on all app tables.

High-level policy model:

- Public:
  - can read universities, campus zones, transport routes
  - can read approved non-archived listings
  - can read reviews
- Authenticated users:
  - can manage their own app/profile rows
  - can read and manage their own bookings and contracts
  - can access roommate data only when they participate in the match
  - can read notifications targeted to them or their role
- Owners:
  - can manage only their own listings
  - can respond to reviews for their own listings

Important operational note:

- The Express backend uses the Supabase service-role key, which bypasses RLS.
- Because of that, the backend must continue to enforce ownership and role
  checks in application code.
- RLS is still critical because the browser also talks directly to Supabase Auth
  and may read profile data through the browser client.

## 11. Environment Configuration

Environment variables from `.env.example`:

- `PORT`: Express port, defaults to `5000`
- `SUPABASE_URL`: server-side Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: required for persistent server writes
- `VITE_SUPABASE_URL`: browser-side Supabase URL
- `VITE_SUPABASE_ANON_KEY`: browser-side Supabase anon key
- `SUPABASE_ANON_KEY`: optional public config fallback for the server
- `ALLOW_MEMORY_FALLBACK`: controls development fallback behavior

The client also accepts Expo-style fallback variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 12. Build, Run, and Deployment

### 12.1 Development

```bash
npm install
cp .env.example .env
npm run dev
```

Development behavior:

- Express starts first
- Vite runs in middleware mode
- the app is served on the same port as the API

### 12.2 Production Build

```bash
npm run build
npm start
```

Build outputs:

- client assets -> `dist/public`
- bundled server -> `dist/index.cjs`

`script/build.ts` uses:

- Vite to build the client
- esbuild to bundle the production server

### 12.3 Deployment Requirements

Required for real persistence:

1. Apply `schema.sql` to the target Supabase project.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Enable email auth in Supabase.
5. Configure auth redirect URLs for the deployed frontend origin.

## 13. Developer Notes

### 13.1 Current Setup Documents

- `README.md`: quick-start and entry documentation
- `SUPABASE_SETUP.md`: environment and database setup
- this file: architecture and implementation reference

### 13.2 Seed Data

Seed behavior currently comes from two places:

- `schema.sql` seeds shared university discovery data
- `server/storage.ts` seeds initial listings and demo owner accounts if the
  persistent database has no listings yet

### 13.3 API Client Contract

`client/src/lib/api.ts` mirrors the Express route surface and parses responses
with shared Zod schemas. This is the main place to update when:

- an endpoint path changes
- a payload shape changes
- a new authenticated route is added

## 14. Known Limitations

The implementation is functional, but there are still architectural and product
boundaries worth noting:

- Baseline automated tests and CI are included (`npm test` and GitHub Actions).
- Payment processing is not integrated.
- Contract documents are metadata rows, not a full signed file workflow.
- Notifications are in-app records only; email/push delivery is not wired in.
- Campus route timing is stored metadata, not a live routing engine.
- The memory fallback is useful for development only and should not be treated
  as a production mode.

## 15. Recommended Next Technical Steps

If the project is moving toward production readiness, the highest-value next
engineering steps are:

1. Add API and storage integration tests against a disposable Supabase project.
2. Add migrations/versioning around `schema.sql` instead of relying on one large
   replayed script.
3. Introduce structured logging and request correlation IDs.
4. Add object storage support for real listing photo and contract document
   uploads.
5. Integrate payment and notification providers if the booking workflow needs to
   be operational beyond demo-managed states.

