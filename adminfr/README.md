# MyloNex Admin Frontend

Run commands from this directory. Install with `npm ci`, configure the public API/Supabase settings in `.env`, then run `npm run dev`. Build with `npm run build`; preview with `npm run preview`.

- `src/features/`: domain UI, pages and forms.
- `src/components/`: reusable presentation/layout components.
- `src/lib/`: browser API/auth clients and UI utilities.
- `src/contracts/`: browser-safe HTTP contract snapshots; keep compatible with API changes.
- `test/browser/`: Playwright tests using HTTP response fixtures, without backend imports.
- `docs/screenshots/`: generated, ignored verification images.

Verify with `npm run typecheck`, `npm run build`, and `npm run test:browser`. The backend is accessed through HTTP at runtime. Database clients, server secrets and backend services do not belong in this app. Historical integration handoffs are retained in backend documentation and are not required to install or build this frontend.
