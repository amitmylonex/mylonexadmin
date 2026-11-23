# MyloNex Admin Backend

Run commands from this directory. Install with `npm ci`, configure `.env`, start with `npm run dev`. Build with `npm run build`; start the built API with `npm start`.

- `src/modules/`: domain APIs, validation, business services and repositories.
- `src/common/`: backend helpers and exact sample-cost arithmetic.
- `src/contracts/`: local transport contracts.
- `prisma/`: schema and versioned migrations.
- `test/`: backend unit/integration tests.
- `tools/`: explicit maintenance/audit commands; legacy verification scripts require their original disposable database and optional old source checkout. Run these from adminbr.
- `docs/`: migration, operations and historical integration handoffs.
- `.local/`: ignored local data/archives; never deploy this directory.

Verify with `npm run typecheck`, `npm run build`, and `npm test`. `npm run audit:backend` performs read-only API/database checks. `npm run test:db` performs database persistence checks that roll back. Repair commands are explicit and must target the intended environment.

This app installs and builds independently. Postbuild packages its locally owned sample-money ES module into dist; no root shared folder is required.
