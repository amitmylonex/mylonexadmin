import {test} from "node:test";
import assert from "node:assert/strict";
import {registry,registrySchema,registryWhere,registryStatus} from "../src/modules/rfqs/registry.js";
import {lifecycleSteps} from "../src/modules/rfqs/tracking/lifecycle.js";
import {getTrackingDetailRecord} from "../src/modules/rfqs/tracking/repo.js";
import {trackingState} from "../src/modules/rfqs/tracking/state.js";
import {projectTrackingSupplier} from "../src/modules/rfqs/tracking/projection.js";
import {manualRoute,queueResend} from "../src/modules/rfqs/tracking/actions.js";
import {drainQueuedRfqNotifications} from "../src/modules/notifications/rfq-queue.js";
import {drainRfqResends} from "../src/modules/notifications/rfq-resends.js";
import {recordDispatchReceipt} from "../src/modules/notifications/rfq-receipts.js";
import {receiptSignature,verifyReceiptBridge} from "../src/modules/notifications/receipt-bridge.routes.js";
import {dispatchLogs} from "../src/modules/rfqs/tracking/dispatch-logs.js";
import {match,inquiry,now as fixtureNow} from "./tracking-fixtures.js";
import {buildApp} from "../src/app.js";
const id="11111111-1111-4111-8111-111111111111",mill="22222222-2222-4222-8222-222222222222",matchId="33333333-3333-4333-8333-333333333333";
const now=new Date();
function memory(status="approved") {
  const rfq={id,status},supplier={id:mill,status:"APPROVED",companyName:"Approved Mill",phone:"9876548099",phoneCountryCode:"91",whatsappConsent:true,whatsappConsentAt:new Date()};
  const retained:any={id:matchId,communicationRequestId:id,supplierId:mill,status:"FORWARDED_TO_SUPPLIER",communicationRequest:rfq,supplier,response:null,
    whatsappStatus:"READ",whatsappMessageId:"original-message",whatsappSentAt:new Date(now.getTime()-3600000),whatsappDeliveredAt:new Date(now.getTime()-3500000),whatsappReadAt:new Date(now.getTime()-3400000),quoteDeadlineAt:new Date(now.getTime()+86400000),reminderCount:0,lastReminderSentAt:null};
  const attempts:any[]=[];const created:any[]=[];const locks:string[]=[];let accepted=false;let gate=Promise.resolve();
  const tx:any={
    $queryRaw:async (sql:any,...values:any[])=>{const text=Array.isArray(sql)?sql.join(""):sql.sql;locks.push(text);return text.includes("rfq_dispatch_attempts")?attempts.filter(a=>a.providerMessageId===values[0]).map(a=>({id:a.id})):[{id}];},
    communicationRequest:{findUnique:async()=>rfq},supplierProfile:{findFirst:async()=>supplier.status==="APPROVED"?supplier:null},
    communicationRequestMatch:{findUnique:async()=>retained,findFirst:async({where}:any)=>where.response?(accepted?{id:"accepted"}:null):created.find(r=>r.supplierId===where.supplierId)||null,
      create:async({data}:any)=>{const result={id:"manual",...data};created.push(result);return result;},
      update:async({data}:any)=>{if(data.reminderCount)retained.reminderCount+=data.reminderCount.increment;retained.lastReminderSentAt=data.lastReminderSentAt;return retained;},
      updateMany:async()=>({count:0})},
    rfqDispatchAttempt:{findMany:async({where}:any)=>attempts.filter(a=>(!where.kind||a.kind===where.kind)&&(!where.status||a.status===where.status)),
      findFirst:async({where}:any)=>[...attempts].reverse().find(a=>a.matchId===where.matchId&&(!where.kind||a.kind===where.kind)&&(!where.status||where.status.in.includes(a.status)))||null,
      findUnique:async({where}:any)=>{const result=attempts.find(a=>a.id===where.id);return result?{...result,match:retained}:null;},
      count:async({where}:any)=>attempts.filter(a=>a.matchId===where.matchId&&(!where.kind||a.kind===where.kind)&&(!where.requestedAt||a.requestedAt>=where.requestedAt.gte)).length,
      create:async({data}:any)=>{const result={id:`attempt-${attempts.length}`,sentAt:null,deliveredAt:null,readAt:null,...data};attempts.push(result);return result;},
      upsert:async({where,create}:any)=>{const old=attempts.find(a=>a.providerMessageId===where.providerMessageId);if(old)return old;const result={id:`attempt-${attempts.length}`,...create};attempts.push(result);return result;},
      updateMany:async({where,data}:any)=>{const row=attempts.find(a=>a.id===where.id&&a.status===where.status);if(!row)return {count:0};Object.assign(row,data);return {count:1};},
      update:async({where,data}:any)=>{const row=attempts.find(a=>a.id===where.id);Object.assign(row,data);return row;},
    },
  };
  const client:any={...tx,$transaction:async(run:any)=>{const before=gate;let release!:()=>void;gate=new Promise<void>(r=>release=r);await before;try{return await run(tx);}finally{release();}}};
  return {client,retained,rfq,supplier,attempts,created,locks,set accepted(value:boolean){accepted=value;}};
}
test("registry validates quantity/date/status filters and applies full IST calendar boundaries",()=>{
  for(const input of [{quantityMin:5,quantityMax:4},{from:"2026-02-30"},{from:"2026-11-20",to:"2026-11-19"},{status:"sql"}])assert.equal(registrySchema.safeParse(input).success,false);
  const where:any=registryWhere(registrySchema.parse({from:"2026-11-19",to:"2026-11-19",quantityMin:100,quantityMax:500,status:"quoted"}));
  assert.equal(where.createdAt.gte.toISOString(),"2026-11-18T18:30:00.000Z");assert.equal(where.createdAt.lt.toISOString(),"2026-11-19T18:30:00.000Z");assert.deepEqual(where.quantity,{gte:100,lte:500});assert.ok(where.AND);
  assert.equal(registryStatus("cancelled",true,true),"cancelled");assert.equal(registryStatus("approved",false,false),"active");assert.equal(registryStatus("pending",true,false),"quoted");
});
test("registry paginates all RFQ roles/states without loading all supplier matches",async()=>{
  const queries:any[]=[];const client:any={communicationRequest:{findMany:async(q:any)=>{queries.push(q);return queries.length===1?[{id,status:"pending",matches:[],_count:{matches:0}}]:[];},count:async()=>1000000}};
  const result=await registry({page:2,pageSize:10},client);assert.equal(result.totalCount,1000000);assert.equal(queries[0].take,10);assert.equal(queries[0].skip,10);assert.equal(queries[0].where.requesterRole,undefined);assert.equal(queries[0].select.matches.take,1);
});
test("lifecycle never fabricates approval, acceptance or an order from routing/quotes",()=>{
  const evidence={dispatchedAt:now,quotedAt:now,acceptedAt:null,accepted:false,orderAt:null,availableQuote:true,rejectedQuote:false,supplierDeclined:false,forwarded:true};
  const steps=lifecycleSteps({...inquiry,status:"approved"},evidence);assert.equal(steps[1].recorded,false);assert.equal(steps[2].recorded,true);assert.equal(steps[4].recorded,false);assert.equal(steps[5].recorded,false);
  const accepted=lifecycleSteps({...inquiry,status:"approved",adminReviewedAt:now},{...evidence,accepted:true});assert.equal(accepted[1].recorded,true);assert.equal(accepted[4].recorded,true);assert.equal(accepted[4].at,null);assert.equal(accepted[5].recorded,false);
});
test("detail lifecycle aggregates cover all matches while supplier rows remain paginated",async()=>{
  let query:any,sql="";const db:any={communicationRequest:{findFirst:async()=>({...inquiry,adminReviewedAt:null})},communicationRequestMatch:{findMany:async(q:any)=>{query=q;return [];},count:async()=>1000000},$queryRaw:async(q:any,...params:any[])=>{sql=q.join("");assert.equal(params[0],id);return [{accepted:false,orderAt:null}];}};
  const result=await getTrackingDetailRecord(id,3,db);assert.equal(result?.total,1000000);assert.equal(query.take,25);assert.equal(query.skip,50);assert.ok(sql.includes("MIN(o.created_at)"));
});
test("delivered is not read, lowercase statuses work, and queued does not imply sent",()=>{
  assert.equal(trackingState(match({whatsappStatus:"delivered"}),fixtureNow).read,false);
  assert.equal(trackingState(match({whatsappStatus:"delivered"}),fixtureNow).delivered,true);
  const queued=trackingState(match({whatsappStatus:"QUEUED"}),fixtureNow);assert.equal(queued.sent,false);assert.equal(queued.attempted,false);
  const projected=projectTrackingSupplier(inquiry,match({whatsappStatus:"READ",whatsappReadAt:null}),fixtureNow);assert.equal(projected.deliveryStatus,"Read");assert.equal(projected.readAt,null);assert.ok(projected.unavailableEvents.includes("Read timestamp"));
});
test("manual route is immediate for active RFQs, staged for pending, and consent-free routing stays on portal",async()=>{
  for(const state of ["approved","pending"]){const db=memory(state);db.supplier.whatsappConsent=false;const result=await manualRoute(id,{supplierId:mill,note:"Additional capacity"},"admin",db.client);assert.equal(result.match.status,state==="pending"?"PENDING_ADMIN_REVIEW":"FORWARDED_TO_SUPPLIER");assert.equal(db.created[0].whatsappStatus,state==="pending"?undefined:"SKIPPED_NO_CONSENT");}
});
test("manual routing refuses suspended, closed and accepted RFQs, and concurrent duplicates",async()=>{
  for(const setup of ["suspended","closed","accepted"]){const db=memory(setup==="closed"?"closed":"approved");if(setup==="suspended")db.supplier.status="SUSPENDED";if(setup==="accepted")db.accepted=true;await assert.rejects(manualRoute(id,{supplierId:mill,note:"Extra"},"admin",db.client));assert.equal(db.created.length,0);}
  const db=memory();const results=await Promise.allSettled([manualRoute(id,{supplierId:mill,note:"Extra"},"admin",db.client),manualRoute(id,{supplierId:mill,note:"Extra"},"admin",db.client)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
});
test("resend queues independently and preserves original message ID/read receipts",async()=>{
  const db=memory();const original=db.retained.whatsappReadAt;const result=await queueResend(matchId,{reason:"Supplier requested reminder"},"admin",db.client,now);
  assert.equal(result.state,"QUEUED");assert.equal(db.retained.whatsappMessageId,"original-message");assert.equal(db.retained.whatsappReadAt,original);assert.equal(db.attempts.filter(a=>a.kind==="LEGACY_SNAPSHOT").length,1);assert.equal(db.attempts.filter(a=>a.kind==="RESEND").length,1);
  await assert.rejects(queueResend(matchId,{reason:"Duplicate"},"admin",db.client,now),/already queued/);
});
test("resend limits persist across workers and reject revocation, ambiguity, quotes and expired deadlines",async()=>{
  for(const scenario of ["recent","daily","revoked","ambiguous","quoted","expired","accepted"]){const db=memory();
    if(scenario==="recent")db.retained.whatsappSentAt=now;
    if(scenario==="daily")for(let n=0;n<3;n++)db.attempts.push({id:`old-${n}`,matchId,kind:"RESEND",status:"SENT",requestedAt:new Date(now.getTime()-3600000)});
    if(scenario==="revoked")db.supplier.whatsappConsent=false;
    if(scenario==="ambiguous")db.retained.whatsappStatus="AMBIGUOUS_ERROR";
    if(scenario==="quoted")db.retained.response={id:"quote"};
    if(scenario==="expired")db.retained.quoteDeadlineAt=new Date(0);
    if(scenario==="accepted")db.accepted=true;
    await assert.rejects(queueResend(matchId,{reason:"Reminder"},"admin",db.client,now));assert.equal(db.attempts.filter(a=>a.status==="QUEUED").length,0);
  }
});
test("resend worker claims once, rechecks eligibility and does not replace historical receipt fields",async()=>{
  const db=memory();await queueResend(matchId,{reason:"Reminder"},"admin",db.client,now);let sends=0;
  const sender=async(input:any)=>{sends++;assert.ok(input.attemptId);return {messageId:"resend-message"};};
  await Promise.all([drainRfqResends(sender,db.client),drainRfqResends(sender,db.client)]);assert.equal(sends,1);assert.equal(db.retained.whatsappMessageId,"original-message");assert.equal(db.retained.reminderCount,1);assert.equal(db.attempts.find(a=>a.kind==="RESEND").providerMessageId,"resend-message");
  const revoked=memory();await queueResend(matchId,{reason:"Reminder"},"admin",revoked.client,now);revoked.supplier.whatsappConsent=false;await drainRfqResends(sender,revoked.client);assert.equal(sends,1);assert.equal(revoked.attempts.find(a=>a.kind==="RESEND").status,"SKIPPED_INELIGIBLE");
});
test("dispatch receipts remain per message, monotonic and never invent delivery timestamps",async()=>{
  const db=memory();db.attempts.push({id:"receipt",matchId,providerMessageId:"resend-message",status:"SENT",sentAt:now,deliveredAt:null,readAt:null});
  await recordDispatchReceipt({messageId:"resend-message",status:"READ",at:now},db.client);
  await recordDispatchReceipt({messageId:"resend-message",status:"SENT",at:now},db.client);
  assert.equal(db.attempts[0].status,"READ");assert.equal(db.attempts[0].deliveredAt,null);assert.deepEqual(db.attempts[0].readAt,now);
  await recordDispatchReceipt({messageId:"resend-message",status:"DELIVERED",at:now},db.client);assert.equal(db.attempts[0].status,"READ");assert.deepEqual(db.attempts[0].deliveredAt,now);assert.equal(db.retained.whatsappMessageId,"original-message");
});
test("receipt bridge authenticates canonical payload and rejects tampering, stale timestamps and missing secret",()=>{
  const body={messageId:"provider-id",status:"READ",at:now.toISOString()},timestamp=String(Math.floor(now.getTime()/1000)),secret="synthetic-bridge-secret";
  const signature=receiptSignature(body,timestamp,secret);assert.equal(verifyReceiptBridge(body,timestamp,signature,secret,now.getTime()).status,"READ");
  assert.throws(()=>verifyReceiptBridge({...body,status:"SENT"},timestamp,signature,secret,now.getTime()));assert.throws(()=>verifyReceiptBridge(body,timestamp,signature,secret,now.getTime()+301000));assert.throws(()=>verifyReceiptBridge(body,timestamp,signature,""));
});
test("dispatch log pages omit provider IDs, private reasons and phones",async()=>{
  let query:any;const client:any={rfqDispatchAttempt:{findMany:async(q:any)=>{query=q;return [];},count:async()=>100}};
  const result=await dispatchLogs(matchId,{page:2,pageSize:10},client);assert.equal(query.take,10);assert.equal(query.skip,10);assert.equal(query.select.providerMessageId,undefined);assert.equal(query.select.reason,undefined);assert.equal(result.totalPages,10);
});
test("tracking mutation/log HTTP endpoints remain ADMIN-only; signed receipt bridge works independently",async()=>{
  const oldSecret=process.env.ADMIN_DISPATCH_RECEIPT_SECRET;process.env.ADMIN_DISPATCH_RECEIPT_SECRET="synthetic-secret";
  const app=buildApp({receiptRecorder:async()=>({recorded:true,status:"READ"})});
  try {
    for(const [method,path]of [["POST",`/rfqs/${id}/manual-match`],["POST",`/rfq-tracking/${matchId}/resend-whatsapp`],["GET",`/rfq-tracking/${matchId}/dispatch-logs`]]as const)assert.equal((await app.inject({method,url:"/api/v1/admin"+path})).statusCode,401);
    const body={messageId:"provider-id",status:"READ",at:now.toISOString()},timestamp=String(Math.floor(Date.now()/1000));
    assert.equal((await app.inject({method:"POST",url:"/api/v1/internal/rfq-dispatch-receipts",payload:body})).statusCode,401);
    const response=await app.inject({method:"POST",url:"/api/v1/internal/rfq-dispatch-receipts",headers:{"x-mylonex-timestamp":timestamp,"x-mylonex-signature":receiptSignature(body,timestamp,"synthetic-secret")},payload:body});assert.equal(response.statusCode,200);assert.equal(response.json().recorded,true);
  }finally{await app.close();if(oldSecret===undefined)delete process.env.ADMIN_DISPATCH_RECEIPT_SECRET;else process.env.ADMIN_DISPATCH_RECEIPT_SECRET=oldSecret;}
});

test("a signed provider callback can reconcile an ambiguous send through the provider-echoed attempt ID",async()=>{
  const attemptId="44444444-4444-4444-8444-444444444444";
  const row:any={id:attemptId,matchId,providerMessageId:null,status:"AMBIGUOUS_ERROR",sentAt:null,deliveredAt:null,readAt:null};let calls=0;
  const tx:any={$queryRaw:async()=>++calls===1?[]:[{id:attemptId}],rfqDispatchAttempt:{findUnique:async()=>row,update:async({data}:any)=>Object.assign(row,data)}};
  const client:any={$transaction:async(run:any)=>run(tx),communicationRequestMatch:{updateMany:async()=>({count:0})}};
  const result=await recordDispatchReceipt({messageId:"recovered-provider-id",attemptId,status:"READ",at:now},client);
  assert.equal(result.recorded,true);assert.equal(row.providerMessageId,"recovered-provider-id");assert.equal(row.status,"READ");assert.equal(row.sentAt,null);assert.equal(row.deliveredAt,null);assert.deepEqual(row.readAt,now);
});

test("an early read receipt cannot be downgraded when the original provider acknowledgement completes",async()=>{
  const db=memory();db.retained.whatsappStatus="SENDING";db.retained.whatsappMessageId=null;let final:any;
  const client:any={communicationRequestMatch:{findMany:async()=>[{id:matchId}],findFirst:async()=>null,findUnique:async()=>db.retained,updateMany:async({data}:any)=>{if(data.whatsappStatus!=="SENDING")final=data;return {count:1};}},
    rfqDispatchAttempt:{create:async()=>({id:"attempt"}),updateMany:async()=>({count:0}),findUnique:async()=>({status:"READ",providerMessageId:"provider-early",sentAt:null,deliveredAt:null,readAt:now})}};
  await drainQueuedRfqNotifications(async()=>({messageId:"provider-early"}),client);
  assert.equal(final.whatsappStatus,"READ");assert.equal(final.whatsappReadAt,now);assert.equal(final.whatsappSentAt,undefined);assert.equal(final.whatsappDeliveredAt,undefined);
});
