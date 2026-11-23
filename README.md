# MyloNex Admin

Two independently installable applications:

```text
MylonexAdmin/
  adminfr/       React/Vite frontend, browser contracts and UI tests
  adminbr/       Fastify/Prisma backend, migrations and backend tests
  package.json   Optional convenience commands; no root dependencies
  .gitignore
  README.md
```

Install with `npm ci` inside each application, then run `npm run dev` in each of two terminals. Backend defaults to port 4000; frontend defaults to port 5173. Each application owns its package manifest, lockfile, dependencies, environment configuration and build output. No root install is needed.

Frontend code and browser tests do not import backend modules. Backend builds do not require frontend or root shared files. Browser-safe contracts and arithmetic utilities are local to each app; keep both contract snapshots compatible when changing the HTTP API.

Migration and historical integration handoffs are in `adminbr/docs/`. Maintenance tools are in `adminbr/tools/`; optional disposable-database/old-project verification scripts are in `adminbr/tools/legacy/`. Preserved local database files are in ignored `adminbr/.local/schema-repair/`. Old root shared/cache folders were reversibly archived in ignored `adminbr/.local/retired-root/` because automatic safety review blocked deletion. Neither location is an application dependency or deployment artifact.

Browser tests generate screenshots under ignored `adminfr/docs/screenshots/`. The root scripts only forward commands: `npm run build`, `npm run typecheck`, `npm test`, and `npm run test:browser`.
