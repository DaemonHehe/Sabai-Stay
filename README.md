# Sabai Stay

Sabai Stay is a student housing web app for finding rooms near Rangsit University and nearby Bangkok campuses. It includes map and list discovery, Supabase Auth, student/owner profiles, booking requests, owner dashboard workflows, reviews, contract document uploads, error states, and skeleton loading views.

Live app: https://sabai-stay.vercel.app/

## Tech Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Routing and data: Wouter, TanStack Query
- Maps: Leaflet, React Leaflet
- Backend: Express 5, TypeScript
- Auth and database: Supabase Auth + Supabase Postgres
- Validation/contracts: Zod in `shared/schema.ts`
- Tests: Node test runner, Playwright

## Features

- Map view and paginated list view for room discovery
- Search and filters for category, campus zone, room type, walking time, capacity, and price
- Listing detail pages with reviews, utilities estimate, transport/campus context, and booking requests
- Student and owner account flows through Supabase Auth
- Owner dashboard for listing drafts, listing status updates, bookings, contracts, uploads, roommate matching, messages, and notifications
- Footer pages for Help, Contact, FAQ, Privacy, and Terms
- User-facing error pages and retry states for failed API calls
- Skeleton loading states for route, map, dashboard, list, and listing detail views
- Production CSP and cache headers configured for fonts, maps, remote listing images, and static assets

## Getting Started

### Prerequisites

- Node.js 22 or newer recommended
- npm
- A Supabase project

### Install

```bash
npm install
```

### Environment

Copy the example file:

```bash
cp .env.example .env
```

Set the required Supabase values:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
APP_BASE_URL=http://localhost:5000
```

For production, set `APP_BASE_URL` to your deployed app URL. If you need multiple allowed browser origins, set `CORS_ALLOWED_ORIGINS` as a comma-separated list.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. Only `VITE_*` variables are intended for client-side use.

### Database

Run the database schema in the Supabase SQL Editor:

```text
schema.sql
```

Optional performance indexes:

```text
script/add-performance-indexes.sql
```

Optional demo reset:

```bash
node script/reset-demo-database.mjs
```

More detail is available in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

### Development

```bash
npm run dev
```

The app runs at `http://localhost:5000` by default.

## Scripts

```bash
npm run dev       # Start Express with Vite middleware
npm run build     # Build client, server, and serverless API bundle
npm start         # Run production server from dist/index.cjs
npm run check     # TypeScript check
npm test          # Unit/integration tests
npm run test:e2e  # Playwright smoke and interaction tests
```

## Validation

Before opening a pull request or deploying, run:

```bash
npm run check
npm test
npm run build
npm run test:e2e
```

The e2e suite starts the local dev server automatically and checks the public routes, listing details, dashboard protection, and text input focus behavior.

## Deployment

The repo includes `vercel.json` for Vercel:

- `npm run build` produces `dist/public` for static assets.
- API requests are rewritten to the serverless API entrypoint.
- Non-API routes fall back to `index.html` for client-side routing.

Required production environment variables:

```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
APP_BASE_URL=https://your-app-domain.example
```

Recommended production variables:

```env
CORS_ALLOWED_ORIGINS=https://your-app-domain.example
METRICS_API_KEY=replace-with-strong-random-value
LISTING_IMAGES_BUCKET=listing-images
CONTRACT_DOCUMENTS_BUCKET=contract-documents
```

In Supabase Auth, configure the Site URL and allowed redirect URLs for your deployed domain.

## Project Layout

```text
api/                 Vercel serverless API entry
client/              React app
client/src/pages/    Route components
client/src/components/
server/              Express API, storage, routes, observability
shared/              Shared TypeScript and Zod contracts
script/              Build and database utility scripts
test/                Node test runner tests
e2e/                 Playwright tests
schema.sql           Supabase database schema
vercel.json          Vercel deployment config
```

## Troubleshooting

### Listings show as zero or API returns 500

Check that `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the database schema are configured. In production, also check `APP_BASE_URL` or `CORS_ALLOWED_ORIGINS`.

### Supabase Auth does not redirect correctly

Update Supabase Auth Site URL and redirect URLs to include the deployed app domain and local development URL.

### Remote images, fonts, or maps do not load

The production CSP allows Google Fonts, Leaflet CSS, Supabase images, RentHub listing images, OpenStreetMap tiles, and CARTO basemaps. If adding a new asset host, update the Helmet CSP directives in `server/app.ts`.

## CI

GitHub Actions runs typecheck, tests, and build through `.github/workflows/ci.yml`. The workflow uses current `actions/checkout@v5` and `actions/setup-node@v5`.
