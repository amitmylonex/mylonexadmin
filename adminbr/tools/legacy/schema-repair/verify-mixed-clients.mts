import fs from 'node:fs';import assert from 'node:assert/strict';
import {createSupplierCatalogEntry} from '../../../../../mylonex-nextjs/src/domains/catalog/repo.ts';
import {db as oldDb} from '../../../../../mylonex-nextjs/src/lib/db.ts';
import {prisma} from '../../../src/infrastructure/db.ts';
import {saveCatalogItem} from '../../../src/modules/catalog/catalog.service.ts';
const target=new URL(process.env.DATABASE_URL!);assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'55489');assert.equal(target.pathname,'/schema_repair_test');
const fixtures=JSON.parse(fs.readFileSync('.local/schema-repair/fixtures.json','utf8'));
try{
 const work=Array.from({length:16},(_,i)=>i%2===0?createSupplierCatalogEntry({supplierId:fixtures.suppliers[i%4],fabricName:`Old app concurrent ${i}`,gsm:180,weaveType:'plain',pricePerMeter:100,minimumOrderQuantity:500,leadTimeDays:21}):saveCatalogItem(fixtures.suppliers[i%4],'fabrics',{fabricName:`Admin concurrent ${i}`,fabricType:'cotton',productionCycle:'made-to-order',gsm:180,weaveType:'plain',fabricState:'greige',pricePerMeter:100,minimumOrderQuantity:500,leadTimeDays:21}));
 const saved=await Promise.all(work);const codes=saved.map((row:any)=>row.mylonexCode);assert.equal(new Set(codes).size,16);assert.ok(codes.every((code:string)=>Number(code.slice(4))>15000));
 const counter=await prisma.systemCounter.findUniqueOrThrow({where:{id:'mylonex_fabric_code'}});assert.equal(counter.value,15016);
 fs.writeFileSync('docs/schema-repair-mixed-client-results.json',JSON.stringify({target:'127.0.0.1:55489/schema_repair_test',status:'PASS',oldSourceCreates:8,adminSourceCreates:8,uniqueCodes:16,startFloor:15000,finalCounter:counter.value},null,2));console.log('PASS: 8 actual old-source creates + 8 Admin creates concurrently; 16 unique codes above 15000.');
}finally{await prisma.$disconnect();await oldDb.$disconnect();}
