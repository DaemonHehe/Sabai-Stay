# Sabai Stay

Sabai Stay is a web app for student housing around Rangsit University.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Backend: Express 5, TypeScript
- Auth and Database: Supabase Auth + Postgres
- Shared contracts: Zod (`shared/schema.ts`)

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create `.env`

Copy `.env.example` to `.env` and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. Apply database schema

Run `schema.sql` in Supabase SQL Editor.

Optional for larger datasets:

- `script/add-performance-indexes.sql`

4. (Optional) reset demo data

```bash
node script/reset-demo-database.mjs
```

5. Run development server

```bash
npm run dev
```

App runs on port `5000` by default.

## Scripts

- `npm run dev` start API + Vite middleware
- `npm run build` build production bundle
- `npm start` run production server (`dist/index.cjs`)
- `npm run check` TypeScript checks
- `npm test` run tests

## Project Layout

```text
client/
server/
shared/
script/
schema.sql
SUPABASE_SETUP.md
```

## Notes

- `schema.sql` is the database source of truth.
- The app can fall back to in-memory storage in development when enabled.
- Server-side writes require `SUPABASE_SERVICE_ROLE_KEY`.
