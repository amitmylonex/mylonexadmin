import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../../src/infrastructure/db.ts';
const target=new URL(process.env.DATABASE_URL!);
assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'55489');assert.equal(target.pathname,'/schema_repair_test');
try {
 const suppliers=[];
 for(let i=0;i<4;i++){
  const user=await prisma.user.create({data:{id:randomUUID(),email:`fixture-${i}@example.invalid`,role:'SUPPLIER',supplierProfile:{create:{companyName:`Synthetic pre-repair ${i}`,fulfillmentRegions:[],status:'APPROVED'}}},include:{supplierProfile:true}});
  suppliers.push(user.supplierProfile!.id);
 }
 for(let i=0;i<3;i++) await prisma.$executeRaw`INSERT INTO public.supplier_catalog(id,supplier_id,fabric_name,price_per_meter,gsm,width_inches,is_active,updated_at) VALUES(${randomUUID()},${suppliers[0]},${'Synthetic legacy '+i},125.50,180,58.00,${i!==2},CURRENT_TIMESTAMP)`;
 const before=await prisma.$queryRaw`SELECT id,md5(to_jsonb(s)::text) AS fingerprint FROM public.supplier_catalog s ORDER BY id`;
 fs.writeFileSync('.local/schema-repair/fixtures.json',JSON.stringify({suppliers,before},null,2));
 console.log('Seeded 4 synthetic supplier organizations and 3 pre-repair catalog rows on local-only target.');
}finally{await prisma.$disconnect();}
