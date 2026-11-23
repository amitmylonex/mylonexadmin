# Phase 1: foundation, authentication and layout

## Backend

Fastify registers CORS and Helmet before the namespace auth hook. All methods
under `/api/v1/admin` require authentication, including future or unknown routes.
OPTIONS preflight is handled by CORS. `app.authenticate` is available for plugin
routes. Older per-route hooks reuse `request.admin` instead of verifying twice.

The provider is Supabase Auth `getUser(bearerToken)`, which verifies the session
with Supabase; no JWT metadata role is trusted. A fresh User-table lookup must
return role ADMIN. Missing/invalid/expired tokens return 401, authenticated
non-admin or absent database users return 403, provider outages return 503.
Existing per-IP authentication and per-admin write limits remain in place.

All JSON errors use:

```json
{
  "success": false,
  "error": { "code": "UNAUTHENTICATED", "message": "Missing or invalid authorization header", "details": null },
  "ok": false,
  "requestId": "req-1"
}
```

Zod failures have code VALIDATION_ERROR and field-path/message details. Unexpected
server exceptions and database internals are masked. `ok`, existing response
fields, and request IDs remain available for existing screens. Successful JSON
objects have `success: true`; collection data shapes are preserved.

`GET /health` is public process liveness. `GET /ready` checks database connectivity
and required schema, including free-text fabric weave compatibility. It returns
503 while the database is unavailable or schema deployment remains pending.
No database schema changes are performed by startup or these endpoints.

Prisma has one client per API process, error/warning logging, and URL-based pool
limits. Defaults: DATABASE_CONNECTION_LIMIT=10 and DATABASE_POOL_TIMEOUT=10 seconds.
Existing connection_limit/pool_timeout URL settings override these defaults;
provider parameters such as pgbouncer=true are preserved. Use the deployment's
Supabase pooled DATABASE_URL and budget connections across all API replicas.
SIGINT/SIGTERM close Fastify and disconnect Prisma.

Configuration uses existing DATABASE_URL, SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY, FRONTEND_ORIGIN and optional FRONTEND_ORIGINS.
Signing secrets/service keys must stay in backend environment configuration.

## Frontend

AdminSidebar provides the branded responsive navigation shell with email,
semantic route links, aria-current active state and all ten requested routes.
The mobile drawer has a toggle, backdrop, Escape handling, focus trap, and makes
closed navigation inert. The top Header is connected to the shared layout.
Both sign-out actions use the existing confirmation dialog and local sign-out.

AdminAccess verifies every new session identity through `/auth/me` before
rendering the shell. Unauthenticated deep links redirect to `/login?returnTo=…`;
successful login restores a safe local admin route. No protected children are
rendered while identity verification is pending or denied.

The Fetch client attaches the current Supabase JWT to the configured API only,
parses structured/legacy errors, and retains status/code/details/requestId.
401 reports a deduplicated session toast before clearing local auth and
redirecting to login, so request cancellation during unmount cannot suppress it.
403 keeps the session but denies access. Other API/network failures use the same
dismissible toast host. Aborted requests do not produce connection-error toasts.
Login verification also uses this client.

Existing frontend configuration: VITE_API_URL, VITE_SUPABASE_URL and
VITE_SUPABASE_PUBLISHABLE_KEY. No backend secrets are exposed.

## Verification

- `npm test`: 45 backend/domain/API-client tests, including namespace 401,
  ADMIN success, provider/role failures, error details, CORS, Helmet and readiness.
- `npm run test:browser`: six Chromium tests for unauthenticated deep links,
  desktop links/highlights/email/header, mobile drawer/focus/navigation, 401
  redirect plus toast, sign-out, and non-admin denial.
- `npm run build`, `npm run lint`, `npm run typecheck`.

Browser tests start an isolated Vite server on 5183 and use synthetic credentials
and mocked API/Supabase origins on 4183/4184. They do not authenticate real users,
contact the real API, or read/write business data. Backend auth integration uses
injected provider responses; real Supabase credentials and a deployed database
were not verified. Shared database migration prerequisites from the earlier
catalog handoff remain pending.

Screenshots `phase1-desktop.png` and `phase1-mobile.png` use synthetic empty data.
Build retains the pre-existing warning about the lazy Excel import chunk size;
this phase does not claim large-workbook performance work.
