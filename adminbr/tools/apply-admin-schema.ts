import {readFile} from 'node:fs/promises';
import {prisma} from '../src/infrastructure/db.js';
if(!process.argv.includes('--apply'))throw new Error('Use --apply to run the reviewed admin schema repair');
const sql=await readFile(new URL('../prisma/migrations/20261119124000_complete_admin_schema/migration.sql',import.meta.url),'utf8');
const statements=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(Boolean);
try{
 await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
  await tx.$executeRaw`SET LOCAL statement_timeout = '60s'`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261119124000)`;
  const before=await tx.$queryRaw<any[]>`SELECT weave_type::text AS weave,COUNT(*)::text AS count FROM public.supplier_catalog GROUP BY weave_type::text ORDER BY weave_type::text`;
  for(const statement of statements)await tx.$executeRawUnsafe(statement);
  const after=await tx.$queryRaw<any[]>`SELECT weave_type::text AS weave,COUNT(*)::text AS count FROM public.supplier_catalog GROUP BY weave_type::text ORDER BY weave_type::text`;
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Catalog preservation check failed; rolling back');
 },{timeout:120000,maxWait:10000});
 console.log('Admin schema repair committed; existing catalog weave values and row counts preserved.');
}finally{await prisma.$disconnect();}

