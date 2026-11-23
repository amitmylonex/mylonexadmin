import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const bin='C:/Program Files/PostgreSQL/18/bin/';
const sql=fs.readFileSync('prisma/migrations/20261118083000_restore_catalog_projection/migration.sql','utf8').replace(/^\uFEFF/,'');
const run=(database,statement,floor)=>spawnSync(bin+'psql.exe',['-X','-h','127.0.0.1','-p','55489','-U','repair_test','-d',database,'-v','ON_ERROR_STOP=1','-At'],{input:statement,encoding:'utf8',windowsHide:true,env:{...process.env,PGOPTIONS:floor===undefined?'':`-c mylonex.repair_code_floor=${floor}`}});
const results=[];
function guard(name,setup,floor,expected){
 const database='schema_repair_'+name;
 const created=spawnSync(bin+'createdb.exe',['-h','127.0.0.1','-p','55489','-U','repair_test',database],{encoding:'utf8',windowsHide:true});assert.equal(created.status,0,created.stderr);
 assert.equal(run(database,setup).status,0);
 const applied=run(database,sql,floor);assert.notEqual(applied.status,0);assert.match(applied.stderr,expected);
 const verification=run(database,"SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_catalog' AND column_name='weight_unit'; SELECT to_regclass('public.system_counters');");assert.equal(verification.status,0);assert.equal(verification.stdout.trim(),'0');
 results.push({name,result:'PASS',error:applied.stderr.trim().split('\n').slice(-1)[0],rollback:'new columns and canonical counter absent'});
}
guard('missing_floor','CREATE TABLE public.supplier_catalog(id text PRIMARY KEY);',undefined,/Set mylonex.repair_code_floor/);
guard('alternate_counter','CREATE TABLE public.supplier_catalog(id text PRIMARY KEY); CREATE SCHEMA legacy; CREATE TABLE legacy."SystemCounter"(id text PRIMARY KEY,value integer NOT NULL); INSERT INTO legacy."SystemCounter" VALUES(\'mylonex_fabric_code\', 7777);','0',/Alternate counter relation/);
guard('bad_index','CREATE TABLE public.supplier_catalog(id text PRIMARY KEY,mylonex_code text); CREATE INDEX supplier_catalog_mylonex_code_key ON public.supplier_catalog(mylonex_code);','0',/Existing code index is incompatible/);
guard('duplicate_codes',"CREATE TABLE public.supplier_catalog(id text PRIMARY KEY,mylonex_code text); INSERT INTO public.supplier_catalog VALUES('a','MYLO100'),('b','MYLO100');",'0',/could not create unique index/);
guard('bad_column',"CREATE TABLE public.supplier_catalog(id text PRIMARY KEY,mylonex_code integer);",'0',/Catalog columns differ/);
const main='schema_repair_test';
const before=run(main,"SELECT value FROM public.system_counters WHERE id='mylonex_fabric_code';").stdout.trim();
assert.equal(run(main,sql,'0').status,0);assert.equal(run(main,"SELECT value FROM public.system_counters WHERE id='mylonex_fabric_code';").stdout.trim(),before);
results.push({name:'replay_lower_floor',result:'PASS',preservedCounter:Number(before)});
// Local fixture allocation represents an externally/historically issued higher code.
assert.equal(run(main,"INSERT INTO public.supplier_catalog(id,supplier_id,fabric_name,price_per_meter,updated_at,mylonex_code) SELECT 'high-water-fixture',id,'Synthetic historical high code',100,CURRENT_TIMESTAMP,'MYLO12000' FROM public.\"SupplierProfile\" LIMIT 1;").status,0);
assert.equal(run(main,sql,'10000').status,0);assert.equal(run(main,"SELECT value FROM public.system_counters WHERE id='mylonex_fabric_code';").stdout.trim(),'12000');results.push({name:'catalog_max_overrides_lower_floor',result:'PASS',counter:12000});
assert.equal(run(main,"UPDATE public.system_counters SET value=15000 WHERE id='mylonex_fabric_code';").status,0);
assert.equal(run(main,sql,'10000').status,0);assert.equal(run(main,"SELECT value FROM public.system_counters WHERE id='mylonex_fabric_code';").stdout.trim(),'15000');results.push({name:'higher_existing_counter_not_reset',result:'PASS',counter:15000});
fs.writeFileSync('docs/schema-repair-guard-test-results.json',JSON.stringify({target:'127.0.0.1:55489 (disposable local databases only)',status:'PASS',checks:results},null,2));console.log(JSON.stringify(results,null,2));
