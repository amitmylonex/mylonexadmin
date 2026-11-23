import {prisma} from '../src/infrastructure/db.js';
import {checkDatabaseSchema} from '../src/infrastructure/readiness.js';
import {config} from '../src/config.js';
const target=new URL(config.supabaseUrl).hostname.split('.')[0];
const db=new URL(config.databaseUrl);
const sameProject=db.hostname===`db.${target}.supabase.co`||decodeURIComponent(db.username)===`postgres.${target}`;
console.log(JSON.stringify({sameProject,missingSchema:await checkDatabaseSchema(),tables:await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`}));
await prisma.$disconnect();
