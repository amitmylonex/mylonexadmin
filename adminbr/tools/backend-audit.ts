import {buildApp} from '../src/app.js';
import {prisma} from '../src/infrastructure/db.js';
import {checkDatabaseSchema} from '../src/infrastructure/readiness.js';
const app=buildApp({resolveSession:async()=>({id:'read-only-audit',email:'audit@example.invalid',fullName:null,role:'ADMIN'})});
try{
 console.log('SCHEMA',JSON.stringify(await checkDatabaseSchema()));
 const paths=['/health','/ready','/api/v1/admin/dashboard','/api/v1/admin/suppliers','/api/v1/admin/buyers','/api/v1/admin/rfq-approvals','/api/v1/admin/quote-approvals','/api/v1/admin/rfqs','/api/v1/admin/rfq-tracking','/api/v1/admin/samples','/api/v1/admin/orders','/api/v1/admin/accepted-orders/production','/api/v1/admin/accepted-orders/sampling'];
 const [suppliers,buyers,rfqs]=await Promise.all([prisma.supplierProfile.findMany({take:3,select:{id:true}}),prisma.user.findMany({where:{role:'BUYER'},take:3,select:{id:true}}),prisma.communicationRequest.findMany({take:3,select:{id:true}})]);
 for(const {id} of suppliers)paths.push(`/api/v1/admin/suppliers/${id}`,`/api/v1/admin/suppliers/${id}/catalog`);
 for(const {id} of buyers)paths.push(`/api/v1/admin/buyers/${id}`);
 for(const {id} of rfqs)paths.push(`/api/v1/admin/rfqs/${id}`,`/api/v1/admin/rfq-tracking/${id}`);
 const results=[];
 for(const url of paths){const start=Date.now();const response=await app.inject({method:'GET',url,headers:{authorization:'Bearer read-only-audit'}});let body:any;try{body=response.json();}catch{}results.push({url,status:response.statusCode,ms:Date.now()-start,...(response.statusCode>=400?{error:body?.error}:{})});}
 console.log('AUDIT_RESULTS',JSON.stringify(results));
 if(results.some(result=>result.status>=400))process.exitCode=1;
}finally{await app.close();await prisma.$disconnect();}
