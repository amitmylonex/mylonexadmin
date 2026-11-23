# Deploy MyloNex Admin

This repository contains the current admin frontend and backend. Deploy them as two services from the same commit on `main`.

| Setting | Frontend | Backend |
| --- | --- | --- |
| Root directory | `adminfr` | `adminbr` |
| Install | `npm ci` | `npm ci` |
| Build | `npm run build` | `npm run build` |
| Publish directory | `dist` | Not applicable |
| Start command | Static hosting | `npm start` |

Both applications were built locally with Node.js 24.14.1. Configure these environment variables on your hosting provider; local `.env` files are intentionally excluded from Git.

Frontend build variables:

- `VITE_API_URL`: deployed backend HTTPS origin, without an API path.
- `VITE_SUPABASE_URL`: your Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the same project's public publishable key.

Backend runtime variables:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT`: use your provider's assigned port.
- `FRONTEND_ORIGIN`: deployed frontend HTTPS origin.
- `APP_BASE_URL`: deployed frontend HTTPS origin for application links.
- `DATABASE_URL`: your Supabase PostgreSQL connection URI, with a URL-encoded password.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`: matching project credentials. The secret key belongs only on the backend.
- See `adminbr/.env.example` for optional storage and mail settings.

Configure the static frontend host to rewrite application routes to `/index.html`. Add the deployed frontend URL to the Supabase Auth URL configuration as appropriate for your login flow. Rebuild the frontend whenever its `VITE_*` values change.

Before serving production traffic, verify that the target database schema matches `adminbr/prisma/schema.prisma`. Review `adminbr/prisma/migrations` and the backend operational documentation before applying migrations to an existing database; do not reset the database. No database changes are performed by the normal build command.

After deploying, check the backend `/health` endpoint, then sign in with an existing admin account and confirm that dashboard requests reach the deployed API. Local builds and automated tests do not verify production credentials or database connectivity.

The earlier repository version tracked `.env`, `node_modules`, and build output. They are removed from the current tree, but previous commits still contain the old files. Rotate any previously published private credentials; removing a file does not revoke a credential or remove it from Git history.
