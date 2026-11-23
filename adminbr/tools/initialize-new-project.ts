import {prisma} from '../src/infrastructure/db.js';
import {Prisma} from '@prisma/client';
import {config} from '../src/config.js';
import {createClient} from '@supabase/supabase-js';
import fs from 'node:fs';
const admin=createClient(config.supabaseUrl,config.supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}});
try{
 await prisma.systemCounter.upsert({where:{id:'mylonex_fabric_code'},update:{},create:{id:'mylonex_fabric_code',value:0}});
 // Application rows are accessed through the role-checked API and Prisma only.
 await prisma.$transaction(async tx=>{for(const model of Prisma.dmmf.datamodel.models){const table=(model.dbName||model.name).replaceAll('"','""');await tx.$executeRawUnsafe(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`);}},{timeout:30000});
 const bucketName=process.env.SUPABASE_PRODUCT_IMAGES_BUCKET||'product-images';
 const existing=await admin.storage.getBucket(bucketName);
 if(existing.error){const result=await admin.storage.createBucket(bucketName,{public:true,fileSizeLimit:10*1024*1024,allowedMimeTypes:['image/jpeg','image/png','image/webp']});if(result.error)throw new Error('Storage bucket setup failed');}
 let front=fs.readFileSync('../adminfr/.env','utf8');
 for(const [key,value] of Object.entries({VITE_SUPABASE_URL:config.supabaseUrl,VITE_SUPABASE_PUBLISHABLE_KEY:config.supabasePublishableKey})){
 const expression=new RegExp(`^${key}=.*$`,'m');front=expression.test(front)?front.replace(expression,()=>`${key}=${value}`):front+`\n${key}=${value}\n`;
 }
 fs.writeFileSync('../adminfr/.env',front);
 console.log('Catalog counter, table access protection, image storage and frontend project configuration are ready.');
}catch(error){console.error('Project initialization failed; inspect configuration without logging credentials.');process.exitCode=1;}finally{await prisma.$disconnect();}
