import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../../src/infrastructure/db.ts';
import { saveCatalogItem } from '../../../src/modules/catalog/catalog.service.ts';
import { importCatalog } from '../../../src/modules/catalog/catalog.import.ts';
import { createSupplierAccount } from '../../../src/modules/suppliers/supplier-create.service.ts';
const url=new URL(process.env.DATABASE_URL!);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55489');assert.equal(url.pathname,'/schema_repair_test');
const fixtures=JSON.parse(fs.readFileSync('.local/schema-repair/fixtures.json','utf8'));
const results:any={target:'127.0.0.1:55489/schema_repair_test',syntheticOnly:true,checks:[]};
const check=(name:string,detail:any=true)=>{results.checks.push({name,result:'PASS',detail});console.log('PASS: '+name);};
try{
 const after=await prisma.$queryRaw`SELECT id,md5((to_jsonb(s)-ARRAY['mylonex_code','weight_unit','weight_value','width_unit','width_value','sample_availability'])::text) AS fingerprint FROM public.supplier_catalog s ORDER BY id`;
 assert.deepEqual(after,fixtures.before);check('all 3 pre-repair business-row fingerprints unchanged');
 const oldRows=await prisma.supplierCatalog.findMany({where:{id:{in:fixtures.before.map((r:any)=>r.id)}}});
 assert.equal(oldRows.length,3);assert.ok(oldRows.every(r=>r.mylonexCode===null && r.weightUnit===null && r.weightValue===null && r.widthUnit===null && r.widthValue===null && r.sampleAvailability===null));check('all six new fields nullable without invented backfill');
 const {db:oldClient}=await import('../../../../../mylonex-nextjs/src/lib/db.ts');
 try{assert.equal((await oldClient.supplierCatalog.findMany({where:{id:{in:fixtures.before.map((r:any)=>r.id)}}})).length,3);check('actual old-project Prisma 6.19.2 PostgreSQL adapter reads legacy rows');}finally{await oldClient.$disconnect();}
 const supplier=await createSupplierAccount({fullName:'Local Test',companyName:'Local repair verified supplier',email:'local-repair@example.invalid',phone:'9876543210',supplierType:'mill',city:'Surat',locationState:'Gujarat'},prisma,async()=>randomUUID());
 assert.equal(supplier.supplierProfile!.status,'PENDING');check('supplier creation persists; invitation adapter stubbed, no Auth/email call');
 const id=supplier.supplierProfile!.id;
 const collection:any=await saveCatalogItem(id,'collections',{name:'Local repair collection',imageUrl:'https://example.invalid/cover.png'});
 await saveCatalogItem(id,'collections',{name:'Local repair collection edited',imageUrl:'https://example.invalid/edit.png'},collection.id);
 assert.equal((await prisma.fabricCollection.findUniqueOrThrow({where:{id:collection.id}})).name,'Local repair collection edited');check('collection create/edit persists');
 const fabric={fabricName:'Local verified cotton',fabricType:'cotton',productionCycle:'made-to-order',gsm:180,widthInches:58,weaveType:'plain',fabricState:'greige',pricePerMeter:150,minimumOrderQuantity:500,leadTimeDays:21,fabricCollectionId:collection.id};
 const listing:any=await saveCatalogItem(id,'fabrics',fabric);
 const stored=await prisma.supplierCatalog.findUniqueOrThrow({where:{id:listing.id}});assert.equal(stored.pricePerMeter.toNumber(),150);assert.equal(stored.fabricCollectionId,collection.id);assert.equal(stored.mylonexCode,'MYLO9001');check('quick-add persists above approved synthetic floor 9000');
 const woven:any=await saveCatalogItem(id,'woven',{compositionText:'Cotton',weaveType:'poplin',finishCategory:'greige',gsmFinished:120,widthFinishedIn:58,priceInrPerM:125,leadTimeDays:21,specs:[{specKey:'epi',valueNum:100},{specKey:'warp_count_ply',valueText:'40/1'}]});
 assert.equal(await prisma.wovenProductSpec.count({where:{productId:woven.id}}),2);check('woven listing and technical specs persist');
 const capability:any=await saveCatalogItem(id,'capabilities',{capabilityName:'Local capability',gsmMin:100,gsmMax:250,fibers:['Cotton','Custom fibre'],linkedSupplierCatalogIds:[listing.id],linkedWovenProductIds:[woven.id]});
 assert.equal((await prisma.supplierCapability.findUniqueOrThrow({where:{id:capability.id}})).fibers.length,2);check('capability persists with owned links');
 const preview:any=await importCatalog(id,{rows:[{...fabric,fabricName:'Imported valid'},{...fabric,fabricName:'Invalid',pricePerMeter:0}],preview:true},prisma);
 assert.equal(preview.failures.length,1);assert.equal(preview.failures[0].rowNumber,3);check('Excel normalized-row validation returns original row error');
 const imported:any=await importCatalog(id,{rows:[{...fabric,fabricName:'Imported valid'}],fileName:'synthetic.xlsx'},prisma);assert.equal(imported.createdCount,1);
 const duplicate:any=await importCatalog(id,{rows:[{...fabric,fabricName:'Imported valid'}]},prisma);assert.equal(duplicate.skippedCount,1);check('Excel import transaction and duplicate retry handling');
 const firstCounter=await prisma.systemCounter.findUniqueOrThrow({where:{id:'mylonex_fabric_code'}});
 const concurrent=await Promise.all(Array.from({length:32},(_,i)=>saveCatalogItem(fixtures.suppliers[i%4],'fabrics',{...fabric,fabricCollectionId:null,fabricName:`Concurrent local ${i}`})));
 const codes=concurrent.map((r:any)=>r.mylonexCode);assert.equal(new Set(codes).size,32);assert.ok(codes.every(c=>Number(c.slice(4))>firstCounter.value));
 const finalCounter=await prisma.systemCounter.findUniqueOrThrow({where:{id:'mylonex_fabric_code'}});assert.equal(finalCounter.value,firstCounter.value+32);check('32 concurrent creates across 4 organizations have unique increasing MYLO codes',{firstCounter:firstCounter.value,finalCounter:finalCounter.value,uniqueCodes:32});
 const duplicates=await prisma.$queryRaw`SELECT mylonex_code,count(*) FROM public.supplier_catalog WHERE mylonex_code IS NOT NULL GROUP BY mylonex_code HAVING count(*)>1`;assert.deepEqual(duplicates,[]);check('database has no duplicate nonnull MYLO code');
 const preserved=await prisma.$queryRaw`SELECT id,md5((to_jsonb(s)-ARRAY['mylonex_code','weight_unit','weight_value','width_unit','width_value','sample_availability'])::text) AS fingerprint FROM public.supplier_catalog s WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(fixtures.before.map((r:any)=>r.id))}::jsonb)) ORDER BY id`;
 assert.deepEqual(preserved,fixtures.before);check('legacy fingerprints remain unchanged after workflow/concurrency tests');
 results.status='PASS';
}catch(error){results.status='FAIL';results.error=error instanceof Error?error.message:String(error);throw error;}
finally{fs.writeFileSync('docs/schema-repair-test-results.json',JSON.stringify(results,null,2));await prisma.$disconnect();}
