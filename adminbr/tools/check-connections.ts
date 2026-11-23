import {PrismaClient} from '@prisma/client';
import {config} from '../src/config.js';
const db=new PrismaClient({datasourceUrl:config.databaseUrl,log:[]});
try{await db.$queryRaw`SELECT 1`;console.log('DATABASE_OK');}catch(e:any){console.log(JSON.stringify({databaseError:e.code||e.name,message:e.message?.split('\n').slice(-2).join(' ').replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]')}));}finally{await db.$disconnect();}
try{const response=await fetch(`${config.supabaseUrl}/auth/v1/health`,{headers:{apikey:config.supabasePublishableKey},signal:AbortSignal.timeout(10000)});console.log('AUTH_PROVIDER_STATUS',response.status);}catch(e:any){console.log('AUTH_PROVIDER_ERROR',e.cause?.code||e.name);}
