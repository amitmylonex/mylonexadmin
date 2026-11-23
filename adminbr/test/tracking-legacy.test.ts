import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Prisma} from '@prisma/client';
import {readTrackingInquiry,readTrackingMatches} from '../src/modules/rfqs/tracking/repo.js';
const missing=(code:string,meta:Record<string,string>)=>new Prisma.PrismaClientKnownRequestError('Missing legacy schema',{code,meta,clientVersion:'5.22.0'});
test('tracking retains older inquiries without inventing approval timestamps',async()=>{
  const client:any={communicationRequest:{findFirst:async({select}:any)=>{if(select.adminReviewedAt)throw missing('P2022',{column:'communication_requests.admin_reviewed_at'});return {id:'rfq',status:'approved'};}}};
  const result=await readTrackingInquiry('rfq',client);
  assert.equal(result?.id,'rfq');assert.equal(result?.adminReviewedAt,null);
});
test('tracking keeps supplier routes without a newer dispatch ledger',async()=>{
  const client:any={communicationRequestMatch:{findMany:async({select,take,skip}:any)=>{assert.equal(take,25);assert.equal(skip,25);if(select.dispatchAttempts)throw missing('P2021',{table:'public.rfq_dispatch_attempts'});return [{id:'match',whatsappStatus:'DELIVERED'}];}}};
  const result=await readTrackingMatches('rfq',2,client);
  assert.equal(result[0].whatsappStatus,'DELIVERED');assert.deepEqual(result[0].dispatchAttempts,[]);
});
test('tracking does not swallow unrelated database errors',async()=>{
  const error=missing('P2022',{column:'communication_requests.quantity'});
  const client:any={communicationRequest:{findFirst:async()=>{throw error;}}};
  await assert.rejects(readTrackingInquiry('rfq',client),e=>e===error);
});

test('tracking HTTP errors retain their status and structured error code',async()=>{
 const {buildApp}=await import('../src/app.js');
 const app=buildApp({resolveSession:async()=>({id:'admin',email:'test@example.invalid',fullName:null,role:'ADMIN'}),rfqHandlers:{getRfqTrackingDetail:async()=>({ok:false,status:404,error:{code:'NOT_FOUND',message:'Buyer RFQ not found'}})} as any});
 try{const response=await app.inject({method:'GET',url:'/api/v1/admin/rfq-tracking/11111111-1111-4111-8111-111111111111',headers:{authorization:'Bearer test'}});assert.equal(response.statusCode,404);assert.equal(response.json().error.code,'NOT_FOUND');}
 finally{await app.close();}
});
