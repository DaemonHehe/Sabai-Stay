# Supabase Setup

## Environment

Create `.env` from `.env.example` and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:

- `ALLOW_MEMORY_FALLBACK`
- `SUPABASE_ANON_KEY`
- `CORS_ALLOWED_ORIGINS`
- `APP_BASE_URL`

## Database

1. Open Supabase SQL Editor.
2. Run `schema.sql`.
3. Ensure Email auth provider is enabled.
4. Configure site URL / redirect URL for your app domain.

Optional performance indexes:

- `script/add-performance-indexes.sql`

## Demo Reset

To reset the demo database state and reseed baseline data:

```bash
node script/reset-demo-database.mjs
```

## Runtime Behavior

- Client uses Supabase Auth for sign-in/session.
- Server uses the Supabase token to resolve current user.
- Persistent writes require service role key.
- In development, memory fallback can be enabled with `ALLOW_MEMORY_FALLBACK=true`.
