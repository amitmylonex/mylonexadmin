import {test} from "node:test";
import assert from "node:assert/strict";
import {rematchRfq} from "../src/modules/rfqs/matching/rematch.service.js";
import {decideMatch} from "../src/modules/rfqs/matching/match-decision.service.js";
import {buildApp} from "../src/app.js";
const id="11111111-1111-4111-8111-111111111111",supplierId="22222222-2222-4222-8222-222222222222",matchId="33333333-3333-4333-8333-333333333333";
function memory(){
  const request:any={id,status:"approved",updatedAt:new Date("2026-11-24T00:00:00Z"),quantity:100,deliveryPincode:"400001",specPayload:{},requesterRole:"BUYER"};
  const supplier:any={id:supplierId,status:"APPROVED",phone:"9876543210",phoneCountryCode:"91",whatsappConsent:true,whatsappConsentAt:new Date()};
  const matches:any[]=[];let accepted=false,active=true,gate=Promise.resolve();
  const tx:any={
    $queryRaw:async()=>[{id}],
    communicationRequest:{findUnique:async()=>request,update:async({data}:any)=>Object.assign(request,data)},
    supplierProfile:{findMany:async()=>supplier.status==="APPROVED"?[supplier]:[]},
    communicationRequestMatch:{
      findFirst:async()=>accepted?{id:"accepted"}:null,
      findUnique:async({where,include}:any)=>{const row=matches.find(m=>m.id===where.id);return row?(include?{...row,supplier,communicationRequest:request}:row):null;},
      createMany:async({data,skipDuplicates}:any)=>{assert.equal(skipDuplicates,true);let count=0;for(const item of data){if(matches.some(m=>m.sourceId===item.sourceId&&m.supplierId===item.supplierId))continue;matches.push({id:matchId,...item});count++;}return {count};},
      count:async()=>matches.length,
      update:async({where,data}:any)=>Object.assign(matches.find(m=>m.id===where.id),data),
    },
    supplierCatalog:{findFirst:async()=>null,findMany:async()=>active?[{id:"listing",supplierId}]:[]},wovenProduct:{findFirst:async()=>null,findMany:async()=>[]},
  };
  const client:any={...tx,$transaction:async(fn:any)=>{const previous=gate;let release!:()=>void;gate=new Promise<void>(r=>release=r);await previous;try{return await fn(tx);}finally{release();}}};
  return {client,request,supplier,matches,set accepted(value:boolean){accepted=value;},set active(value:boolean){active=value;}};
}
const candidate={supplierId,supplierName:"Test Mill",sourceType:"supplier_catalog" as const,sourceId:"listing",score:90,explanation:"Specs align",listingSnapshot:{}};

test("re-running matching is duplicate-safe, stages review and preserves old decisions",async()=>{
  const db=memory();
  const first=await rematchRfq(id,{},"admin",db.client,async()=>[candidate]);
  assert.equal(first.createdCount,1);assert.equal(first.queuedCount,0);
  assert.equal(db.matches[0].status,"PENDING_ADMIN_REVIEW");assert.equal(db.matches[0].whatsappStatus,undefined);
  db.matches[0].status="REJECTED_BY_ADMIN";db.matches[0].adminReviewNote="Keep history";
  const next=await rematchRfq(id,{note:"Catalog updated"},"admin",db.client,async()=>[candidate]);
  assert.equal(next.createdCount,0);assert.equal(db.matches.length,1);assert.equal(db.matches[0].adminReviewNote,"Keep history");assert.equal(db.matches[0].status,"REJECTED_BY_ADMIN");
});
test("concurrent re-match calls insert each unique listing once",async()=>{
  const db=memory();
  const results=await Promise.all([rematchRfq(id,{},"admin",db.client,async()=>[candidate]),rematchRfq(id,{},"admin",db.client,async()=>[candidate])]);
  assert.equal(results.reduce((sum,r)=>sum+r.createdCount,0),1);assert.equal(db.matches.length,1);
});
test("terminal, accepted and changed RFQs reject re-matching; unknown input is invalid",async()=>{
  for(const state of ["closed","cancelled","rejected"]){const db=memory();db.request.status=state;await assert.rejects(rematchRfq(id,{},"admin",db.client,async()=>[candidate]));}
  const db=memory();db.accepted=true;await assert.rejects(rematchRfq(id,{},"admin",db.client,async()=>[candidate]),/accepted/);
  await assert.rejects(rematchRfq(id,{supplierId},"admin",db.client,async()=>[candidate]));
});
test("only explicit forwarding queues notification; replay cannot queue a duplicate",async()=>{
  const db=memory();db.request.status="pending";db.matches.push({id:matchId,communicationRequestId:id,supplierId,sourceType:"manual",status:"PENDING_ADMIN_REVIEW"});
  const forwarded=await decideMatch(matchId,"forward","admin","Verified",db.client);
  assert.equal(forwarded.queuedCount,1);assert.equal(db.matches[0].whatsappStatus,"QUEUED");assert.equal(db.matches[0].status,"FORWARDED_TO_SUPPLIER");assert.equal(db.request.status,"approved");
  const replay=await decideMatch(matchId,"forward","admin","Replay",db.client);assert.equal(replay.queuedCount,0);assert.equal(replay.alreadyReviewedCount,1);assert.equal(db.matches[0].adminReviewNote,"Verified");
});
test("rejection never queues; suspended supplier and closed sourcing block forwarding",async()=>{
  for(const scenario of ["reject","suspended","accepted"]){const db=memory();db.matches.push({id:matchId,communicationRequestId:id,supplierId,sourceType:"manual",status:"PENDING_ADMIN_REVIEW"});
    if(scenario==="suspended")db.supplier.status="SUSPENDED";if(scenario==="accepted")db.accepted=true;
    if(scenario==="reject"){await decideMatch(matchId,"reject","admin","Reason",db.client);assert.equal(db.matches[0].status,"REJECTED_BY_ADMIN");}
    else await assert.rejects(decideMatch(matchId,"forward","admin",undefined,db.client));
    assert.equal(db.matches[0].whatsappStatus,undefined);
  }
});
test("a supplier session cannot inspect or mutate any other supplier's Admin RFQ, quote or matches",async()=>{
  const app=buildApp({resolveSession:async()=>({id:supplierId,email:"supplier@example.invalid",fullName:null,role:"SUPPLIER"})});
  try{for(const [method,path]of [["GET",`rfqs/${id}`],["POST",`rfqs/${id}/matches/re-run`],["POST",`rfq-match-approvals/${matchId}/forward`],["POST",`quote-approvals/${matchId}/approve`]]as const){const response=await app.inject({method,url:"/api/v1/admin/"+path,headers:{authorization:"Bearer synthetic"},...(method==="POST"?{payload:{}}:{})});assert.equal(response.statusCode,403);assert.ok(response.json().requestId);assert.ok(!response.body.includes("specPayload"));}}finally{await app.close();}
});

test("re-match excludes deactivated listings and rejects requirements changed during matching",async()=>{
  const db=memory();db.active=false;
  assert.equal((await rematchRfq(id,{},"admin",db.client,async()=>[candidate])).createdCount,0);
  await assert.rejects(rematchRfq(id,{},"admin",db.client,async()=>{db.request.updatedAt=new Date("2026-11-25T00:00:00Z");return [candidate];}),/requirements changed/);
});
