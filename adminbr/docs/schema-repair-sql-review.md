# Schema repair SQL review

## Comparison findings

- Read-only capture: 2026-11-18T08:15:59.070Z; catalog count visible to configured administrative role: 0. No counter-like relation found by pg_class inspection across non-system schemas. Six requested columns absent. Existing catalog indexes are retained.
- At initial review SupplierCatalog and SystemCounter models matched byte-for-byte. Verification subsequently required the narrow Admin weave_type enum binding correction below; no SQL type alteration was made. SystemCounter still matches exactly.
- Live Prisma history contains 34 completed entries; final entry `20261030100000_buyer_rfq_batches`. Source history has no SQL adding these six supplier_catalog fields or system_counters. A search hit for sample_availability in 20260406093355 applies to communication_request_responses, NOT supplier_catalog. The old history therefore does not deploy all fields declared in its current schema. Never reapply that historical file: it includes unrelated DROP COLUMN statements.
- Original SQL weaknesses corrected: unqualified object names; unchecked IF NOT EXISTS masking wrong definitions; implicit zero restart on empty catalog; no explicit transaction/timeouts; implicit counter default 0. Revised SQL uses public qualification, aborts on incompatible definitions, requires historical floor and preserves the maximum counter. No existing counter default is changed.

## Statement safety confirmation

No DROP TABLE, DROP COLUMN, TRUNCATE, DELETE, reset/reseed of existing codes, auth-user modification, index drop/replacement, or existing catalog/business-row UPDATE. ALTER statements only ADD nullable columns. CREATE statements only add table/index if absent and subsequently assert compatibility. BEGIN/COMMIT, SET LOCAL, locks and validation DO blocks govern execution. The sole ON CONFLICT DO UPDATE advances one technical allocation row via GREATEST; it can never reduce an existing counter. This exception is explicitly justified to prevent duplicate/reused MYLO codes. This is additive schema repair plus monotonic technical metadata reconciliation, not strictly DDL-only SQL.

## Target and scope

Inspected shared target (NOT modified): `postgresql://postgres.[REDACTED]:REDACTED@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?schema=public`. Exact credential-free target-identity SHA-256: `d971bdf1817236c92f6e149a8851c261801991a92139465141116072d054d8ca`. PostgreSQL 17.6. Both `adminbr/.env` and old `mylonex-nextjs/.env` DATABASE_URL resolve to that same identity. Old DIRECT_URL uses the same host/user/database on port 5432; use an operator-confirmed direct or session connection for deployment, not an unreviewed pooler endpoint. Environment labels cannot prove that this is the intended production tenant.

Disposable target only: `postgresql://repair_test@127.0.0.1:55489/schema_repair_test?schema=public`. PostgreSQL 18.2 in this workspace's private `.schema-repair/pgdata`; synthetic rows only, no live row data copied, no Supabase Auth/email/storage operations. Schema-only public dump is local/private, not a backup of production data. Port 55439 was already occupied and was not used or changed.

Affected objects: public.supplier_catalog (six nullable columns and new unique code index); public.system_counters (new table/primary-key index if absent; one technical allocator row inserted or advanced). Existing business rows, auth users, unrelated tables/indexes, and existing codes are not updated.

## Exact reviewed SQL

Full contents of the migration directory: one file, `migration.sql`, reproduced completely here. The original 1,264-byte SQL is preserved separately in `docs/schema-repair-original.sql`; it has been superseded, not applied.

```sql
-- Repair only the existing canonical public catalog projection. No business-row backfill.
-- REQUIRED: pause ALL catalog/code writers; confirm backup, target and historical code floor.
-- Supply PGOPTIONS='-c mylonex.repair_code_floor=<confirmed high-water mark>'.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(73118083000);
DO $$
DECLARE floor_text text := current_setting('mylonex.repair_code_floor', true);
BEGIN
  IF floor_text IS NULL OR floor_text !~ '^[0-9]{1,10}$'
     OR floor_text::numeric > 2147483646 THEN
    RAISE EXCEPTION 'Set mylonex.repair_code_floor to the reviewed historical high-water mark (0..2147483646); never guess zero';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p','v','m','S','f')
      AND lower(regexp_replace(c.relname, '[^a-zA-Z0-9]', '', 'g'))
        IN ('systemcounters','systemcounter','mylonexcounters','mylonexcodecounter')
      AND NOT (n.nspname = 'public' AND c.relname = 'system_counters' AND c.relkind = 'r')
  ) THEN RAISE EXCEPTION 'Alternate counter relation exists; reconcile it before repair'; END IF;
END $$;
LOCK TABLE public.supplier_catalog IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.supplier_catalog
  ADD COLUMN IF NOT EXISTS mylonex_code TEXT,
  ADD COLUMN IF NOT EXISTS weight_unit TEXT,
  ADD COLUMN IF NOT EXISTS weight_value DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS width_unit TEXT,
  ADD COLUMN IF NOT EXISTS width_value DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS sample_availability TEXT;
CREATE TABLE IF NOT EXISTS public.system_counters (
  id TEXT NOT NULL PRIMARY KEY,
  value INTEGER NOT NULL
);
LOCK TABLE public.system_counters IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='supplier_catalog'
        AND is_nullable='YES' AND column_default IS NULL
        AND ((column_name IN ('mylonex_code','weight_unit','width_unit','sample_availability') AND data_type='text')
          OR (column_name IN ('weight_value','width_value') AND data_type='numeric' AND numeric_precision=8 AND numeric_scale=2))) <> 6
  THEN RAISE EXCEPTION 'Catalog columns differ from reviewed nullable Prisma projection'; END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='system_counters' AND is_nullable='NO'
        AND ((column_name='id' AND data_type='text') OR (column_name='value' AND data_type='integer'))) <> 2
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.system_counters'::regclass
       AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id)')
  THEN RAISE EXCEPTION 'Existing counter table is incompatible; do not replace it'; END IF;
  IF EXISTS (SELECT 1 FROM public.system_counters WHERE value < 0)
  THEN RAISE EXCEPTION 'Negative existing counter requires investigation'; END IF;
  IF EXISTS (SELECT 1 FROM public.supplier_catalog WHERE mylonex_code ~ '^MYLO[0-9]+$'
      AND length(substring(mylonex_code FROM '^MYLO([0-9]+)$')) > 10)
  THEN RAISE EXCEPTION 'Oversized numeric code requires manual reconciliation'; END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_catalog_mylonex_code_key
  ON public.supplier_catalog(mylonex_code);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attname='mylonex_code'
    WHERE i.indexrelid='public.supplier_catalog_mylonex_code_key'::regclass
      AND i.indrelid='public.supplier_catalog'::regclass AND i.indisunique AND i.indisvalid
      AND i.indisready AND i.indnatts=1 AND i.indkey::text=a.attnum::text
      AND i.indpred IS NULL AND i.indexprs IS NULL
  ) THEN RAISE EXCEPTION 'Existing code index is incompatible; do not replace it'; END IF;
END $$;
-- Only technical allocation metadata is inserted/advanced. Never reduce an existing counter.
INSERT INTO public.system_counters(id,value)
SELECT 'mylonex_fabric_code', GREATEST(
  current_setting('mylonex.repair_code_floor')::numeric,
  COALESCE(MAX(substring(mylonex_code FROM '^MYLO([0-9]+)$')::numeric),0)
)::integer
FROM public.supplier_catalog
ON CONFLICT(id) DO UPDATE
SET value=GREATEST(public.system_counters.value, EXCLUDED.value);
DO $$
BEGIN
  IF (SELECT value FROM public.system_counters WHERE id='mylonex_fabric_code') >= 2147483647
  THEN RAISE EXCEPTION 'Counter is exhausted; widen schema and generators before deployment'; END IF;
END $$;
COMMIT;
```

## Lock and operational impact

Metadata additions without defaults do not backfill or rewrite existing tuples. The explicit ACCESS EXCLUSIVE lock blocks reads and writes on supplier_catalog for the transaction, including the non-concurrent unique-index build/scan. The counter table is locked exclusively during reconciliation. Repair invocations serialize on a transaction advisory lock. Lock acquisition times out after 5 seconds; statements after 120 seconds. A large actual production catalog can require a separately reviewed concurrent-index rollout; do not simply increase timeouts. Inspected target currently has zero catalog rows. Pause ALL old/new application and background catalog/code writers, drain in-flight allocations and prevent new writes for the whole repair. A table lock alone cannot reconcile codes already issued outside an insertion transaction by the old generator.

## Backup and code-floor prerequisites

Before any shared execution, an authorized operator must confirm the exact tenant/connection, current full backup/PITR restore point, retention, secure backup location, and a tested isolated restore. Backup schema AND data, migration history, existing counter state if present, and historical code allocation evidence. This work made only a schema-only dump; it does not satisfy that backup prerequisite. Confirm the highest historically issued numeric MYLO code across backups/exports/other systems. Provide it with session PGOPTIONS `-c mylonex.repair_code_floor=<confirmed integer>`. Zero is allowed ONLY when an authorized person confirms no codes were ever issued. The empty current table is not proof. No unknown floor is silently replaced with zero. Maximum supported allocator value is a PostgreSQL INTEGER; repair fails rather than wrapping/exhausting it.

## Verification queries

```sql
-- READ ONLY: preflight identity, namespaces and catalog size.
BEGIN READ ONLY;
SELECT current_database(),current_schema(),current_user,inet_server_addr(),inet_server_port(),version();
SHOW search_path;
SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND
 (c.relname ILIKE '%counter%' OR c.relname ILIKE '%mylo%' OR c.relname ILIKE '%fabric%code%');
SELECT count(*) FROM public.supplier_catalog;
SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default,numeric_precision,numeric_scale
FROM information_schema.columns WHERE table_name IN ('supplier_catalog','system_counters') ORDER BY 1,2,ordinal_position;
SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE tablename IN ('supplier_catalog','system_counters');
SELECT migration_name,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY started_at;
COMMIT;
-- READ ONLY, AFTER repair: verify shape as above, duplicates and allocator floor.
SELECT mylonex_code,count(*) FROM public.supplier_catalog WHERE mylonex_code IS NOT NULL
GROUP BY mylonex_code HAVING count(*)>1;
SELECT id,value FROM public.system_counters WHERE id='mylonex_fabric_code';
SELECT max(substring(mylonex_code FROM '^MYLO([0-9]+)$')::numeric) AS max_numeric_code FROM public.supplier_catalog;
-- Compare business-row counts/checksums with the verified pre-change backup/snapshot.
-- Old-column-only checksums must exclude the six added columns. Compare under writer maintenance.
```

## Rollback and old-app compatibility

If any statement fails before COMMIT, PostgreSQL rolls back all DDL/counter changes; do not mark migration applied. For a failed Prisma migration, inspect `_prisma_migrations.logs` and schema, then use `prisma migrate resolve --rolled-back <migration>` only after verified full rollback; this changes tracking metadata, not business data. Never resolve a successful deployment as rolled back merely to rerun it.

After a committed repair, preferred rollback is application rollback while KEEPING all additive columns/index/table and the highest counter value. Never remove generated codes, lower/reset the counter, delete its row, or drop the unique index. Preserve production data and use a forward fix. If an emergency database restore is necessary, an authorized operator must quiesce writers, restore the verified full backup into an isolated database first, reconcile every post-backup write and externally issued code, then explicitly approve cutover. Do not restore a stale counter without lifting it to the highest ever issued floor. No destructive down migration is supplied.

Old MyloNex schema's six optional catalog fields and SystemCounter definition match this SQL projection; Admin weave_type binding is additionally aligned to the already-existing database enum (see compatibility corrections below); old Prisma readers tolerate NULL in all six fields. Old generation uses atomic upsert/increment on id=mylonex_fabric_code, compatible with the new INTEGER counter. Existing old readers that do not select these columns are unaffected. Repairs restore fields already selected by newer old-app readers, which otherwise fail today. Availability/units remain unknown (NULL), not guessed from GSM or width; no buyer pricing, approval, stock, names, or listings change. Compatibility is established by source/schema review and local database reads, not a claimed authenticated end-to-end test. Do not run the old `backfillMylonexCodes` helper as part of this repair.

## Disposable test results (completed)

Local target ONLY: `127.0.0.1:55489/schema_repair_test`, PostgreSQL 18.2; shared server is PostgreSQL 17.6, so a version-matched staging rehearsal remains recommended. All fixture data is synthetic. Public schema was cloned schema-only from the shared database; no live rows/auth records were copied. The schema-only baseline was tracked locally separately from the repair. Initial baseline restoration exposed pg_dump's empty search_path setting; the local-only baseline was corrected to restore public search_path and marked applied after confirming all tables had restored. This was not an error in the repair SQL. An intentionally missing-floor Prisma deployment was confirmed fully rolled back locally and resolved as rolled-back; the subsequent reviewed deployment succeeded.

- Prisma `migrate deploy` applied the reviewed repair successfully with connection option `options=-c%20mylonex.repair_code_floor%3D9000` (synthetic approved floor 9000). `PGOPTIONS` works for psql; Prisma was verified using the URL options parameter, not an assumed PGOPTIONS behavior.
- All 13 workflow assertions passed: 3 pre-repair row fingerprints unchanged; NULLs in six new columns; actual old-project Prisma 6.19.2 PostgreSQL-adapter reads; supplier creation with stubbed invitation provider; collection create/edit; quick-add saving MYLO9001; woven/spec persistence; capabilities; normalized Excel validation, transaction save and duplicate handling; 32 concurrent creates across 4 supplier organizations with 32 unique codes (9003–9034); post-test legacy fingerprints unchanged.
- All 8 guard assertions passed: missing floor, alternate counter, incompatible index, duplicate existing code, incompatible column each aborted and rolled back added columns/table; lower-floor replay preserved 9034; existing catalog code MYLO12000 advanced the counter to 12000 despite lower floor; existing technical counter 15000 survived replay unchanged.
- A second concurrency test used actual old-source `createSupplierCatalogEntry` and new Admin service concurrently: 8+8 successful saves, 16 unique codes above 15000, final counter 15016. No duplicates across old/new generators.
- Existing database smoke test passed 5 additional assertions, all inside its deliberately rolled-back LOCAL transaction.
- `npm run build`, `npm run typecheck`, `npm run lint` passed for both projects; `npm test` passed 20/20. Lint scripts are the existing TypeScript-based checks, not ESLint.
- Shared database rechecked READ ONLY at 2026-11-18T08:27:21.959Z: zero catalog rows, all six columns still absent, counter table still absent, repair not in migration history. All 34 live migration checksums match the 34 old-project migration files (raw/LF-normalized checks). This confirms the declared missing fields were never added by that history.
- No live migration, business write, Supabase Auth modification, email, image upload or authenticated browser action was performed. Supplier invitation delivery and authenticated old/new UI flows remain unverified.

### Narrow compatibility corrections found by real local tests

The shared `supplier_catalog.weave_type` is the existing PostgreSQL `SupplierWeaveType` enum from old migration `20260310100000_flow2_catalog_cutover`. Both source schemas originally declared String; Admin Prisma 5 native engine failed with P2032 on the enum, while the old app's actual Prisma 6/pg adapter successfully reads/writes it. Corrected ONLY the Admin Prisma declaration to SupplierWeaveType/default(plain) and regenerated its client; **no database type conversion and no old-project file change**. The two source models therefore no longer match byte-for-byte, deliberately: Admin now reflects the real DB type.

The local supplier-create service also exposed a pre-existing P2010: Prisma cannot deserialize PostgreSQL void returned by `SELECT pg_advisory_xact_lock(...)`. Added `::text` to that result; lock semantics are unchanged. These are repair/verification compatibility fixes, not new features. Windows required stopping the previously started Admin dev server to release its Prisma DLL for regeneration; restart with `npm run dev:backend` when needed.

### Reproduction and evidence

- Exact migration bytes SHA-256: `25e7c4a857afce7afadcdc1a325e8061e943ef9a1b4d402c1476f81ee13b388a`. Review/approve this hash; any edit requires rerunning review/tests.
- Original contents: `docs/schema-repair-original.sql`; reviewed directory contains only `migration.sql`.
- Evidence: `docs/schema-repair-test-results.json`, `docs/schema-repair-guard-test-results.json`, `docs/schema-repair-mixed-client-results.json`, `docs/schema-repair-live-verification.json`, `docs/schema-repair-unit-test-results.txt`.
- Test helpers: `tools/schema-repair/seed-test-db.mts`, `verify-test-db.mts`, `verify-guards.mjs`, `verify-mixed-clients.mts`. Each is local-only, requires the private test cluster, and uses no real invitation provider. Seed/guard helpers are intended for a freshly prepared disposable database, not blind repeated runs. The private baseline, schema-only dump and cluster are ignored under `.schema-repair/`.
- Main local deploy command (environment MUST be the explicit disposable connection, with URL option for floor): `node adminbr/node_modules/prisma/build/index.js migrate deploy --schema .schema-repair/prisma/schema.prisma`.
- Seed then verify: `node adminbr/node_modules/tsx/dist/cli.mjs tools/schema-repair/seed-test-db.mts`; apply repair locally; then `node adminbr/node_modules/tsx/dist/cli.mjs tools/schema-repair/verify-test-db.mts`.
- Guards: `node tools/schema-repair/verify-guards.mjs` (creates specifically named disposable databases on 127.0.0.1:55489 only).
- Mixed old/new test: `node adminbr/node_modules/tsx/dist/cli.mjs --tsconfig ../mylonex-nextjs/tsconfig.json tools/schema-repair/verify-mixed-clients.mts`.
- Existing smoke: set explicit LOCAL DATABASE_URL, then `npm --prefix adminbr run test:db`. Never run against the shared target for this review.

## Production application checklist — NOT production-ready

1. Authorized operator verifies exact tenant/database fingerprint and direct/session endpoint; compares reviewed migration hash above. Reconcile this single migration with existing shared Prisma history; do not apply the synthetic local baseline or all historical SQL.
2. Confirm current full backup/PITR point, retention and successful isolated restore; record backup identifier/time. A schema-only dump is insufficient.
3. Confirm historical MYLO high-water mark from authoritative records; explicitly certify no issued codes if using 0. Record the value and configure it on the migration connection. Validate current_setting on that same connection.
4. Pause/drain old/new code-generation and catalog writers, including background jobs and in-flight standalone old generator allocations. Review catalog row count/locking window and choose a version-matched staging rehearsal where appropriate.
5. Obtain explicit approval; operator applies only this reviewed transaction to the intended database using a direct/session connection. Prisma will also write its normal tracking metadata; no auth or business rows are modified by the migration. Confirm successful migration history, exact columns/index/counter state and unchanged legacy-row counts/fingerprints before restoring traffic.
6. Deploy regenerated compatible Admin Prisma client, run readiness/type checks and authenticated old/new browser workflows (supplier onboarding, CRUD, publish visibility, imports, error states), verify Auth/email/storage integration, then resume writers with monitoring. This review does not grant production-ready status.

## Single shared-database approval question

Do you authorize applying the reviewed migration (SHA-256 above) to the intended shared database identified above, and confirm the exact backup/restore-point identifier, verified restore, historical MYLO code floor, direct/session connection and approved writer-pause window?


The private disposable cluster was stopped after verification; its data and evidence are retained. To rerun locally, start only `.schema-repair/pgdata` with pg_ctl on 127.0.0.1:55489. No other local PostgreSQL instance was stopped or deleted.
