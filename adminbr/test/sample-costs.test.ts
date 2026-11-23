import {test} from "node:test";
import assert from "node:assert/strict";
import {Prisma} from "@prisma/client";
import {sampleTotal,sampleChargeCents} from "../src/common/money/sample-money.mjs";
import {quote,reject,list,delivered} from "../src/modules/samples/sample.service.js";
import {decideSampleQuote} from "../src/modules/samples/sample-buyer-decision.js";
import {requesterSample} from "../src/modules/samples/sample-requester.js";
import {sampleQuoteSchema,sampleDeliveredSchema} from "../src/modules/samples/sample.schema.js";
import {accepted} from "../src/modules/orders/order.repository.js";
import {buildApp} from "../src/app.js";
const id="11111111-1111-4111-8111-111111111111",buyerId="22222222-2222-4222-8222-222222222222",supplierId="33333333-3333-4333-8333-333333333333";
const future=()=>new Date(Date.now()+86400000).toISOString();
const input=()=>({quoteSampleCostInr:"100.55",quoteCourierCostInr:"20.10",quoteDeliveryTimeline:"3-5 business days",quoteRefundPolicy:"full",quoteValidUntil:future(),quoteInternalNotes:"PRIVATE SAMPLE NOTES"});
function memory(status="requested"){
  let row:any={id,buyerId,supplierId,sampleNumber:"SMPL-0001",quantityMeters:2.5,status,buyerDecision:null,quoteSampleCostInr:null,quoteCourierCostInr:null,deliveredAt:null};
  const supplier:any={id:supplierId,status:"APPROVED"};let order:any=null;let milestones:any[]=[];let gate=Promise.resolve(),failOrder=false;
  const tx:any={$queryRaw:async()=>[{id}],supplierProfile:{findFirst:async({where}:any)=>where.id===supplier.id&&supplier.status==="APPROVED"?supplier:null},
    sample:{findFirst:async({where}:any)=>where.id===id&&(!where.status||where.status===row.status)&&(!where.buyerId||where.buyerId===row.buyerId)?row:null,
      findUnique:async()=>({...row,order}),update:async({data}:any)=>Object.assign(row,data),updateMany:async({where,data}:any)=>{if(where.status&&row.status!==where.status)return {count:0};Object.assign(row,data);return {count:1};}},
    order:{create:async({data}:any)=>{if(failOrder)throw new Error("Order store failed");if(order)throw new Error("Duplicate order");order={id:"order",...data};milestones.push(data.milestones.create);return order;},
      updateMany:async({data}:any)=>{if(!order||["CANCELLED","DELIVERED"].includes(order.status))return {count:0};Object.assign(order,data);return {count:1};}},
    orderMilestone:{create:async({data}:any)=>{milestones.push(data);return data;}}};
  const client:any={...tx,$transaction:async(run:any)=>{const previous=gate;let release!:()=>void;gate=new Promise<void>(r=>release=r);await previous;const saved={row:{...row},order:order?{...order}:null,milestones:[...milestones]};try{return await run(tx);}catch(error){row=saved.row;order=saved.order;milestones=saved.milestones;throw error;}finally{release();}}};
  return {client,supplier,get row(){return row;},get order(){return order;},get milestones(){return milestones;},set failOrder(value:boolean){failOrder=value;}};
}
async function acceptedSample(){const db=memory();await quote(id,input(),"admin",db.client);await decideSampleQuote(db.client,id,buyerId,"accepted");return db;}
test("sample charge totals use integer cents, allow free samples and reject precision/overflow",()=>{
  assert.equal(sampleTotal("0.10","0.20"),"0.30");assert.equal(sampleTotal("100.55","20.10"),"120.65");assert.equal(sampleTotal(0,0),"0.00");assert.equal(sampleTotal("9999999999.99","0"),"9999999999.99");assert.equal(sampleTotal("9999999999.99","0.01"),null);
  for(const value of [-1,NaN,Infinity,null,"","1.001","1e2","-0.01"])assert.equal(sampleChargeCents(value),null);
});
test("sample quote takes a total yardage charge, preserves exact decimals and records refund/internal terms",async()=>{
  const db=memory();const result=await quote(id,input(),"admin",db.client);assert.equal(db.row.quoteSampleCostInr.toFixed(2),"100.55");assert.equal(db.row.quoteCourierCostInr.toFixed(2),"20.10");assert.equal(result.totalSampleCostInr,"120.65");assert.equal(db.row.quoteRefundPolicy,"full");assert.equal(db.row.quoteInternalNotes,"PRIVATE SAMPLE NOTES");assert.equal(db.row.status,"quoted");assert.equal(db.row.quotedByUserId,"admin");assert.ok(db.row.quotedAt instanceof Date);
  assert.equal(sampleQuoteSchema.safeParse({...input(),quoteSampleCostInr:"1.001"}).success,false);assert.equal(sampleQuoteSchema.safeParse({...input(),quoteRefundPolicy:"anything"}).success,false);
});
test("placeholder supplier samples require explicit approved fulfillment assignment",async()=>{
  const db=memory();db.row.supplierId=buyerId;await assert.rejects(quote(id,input(),"admin",db.client),/approved fulfillment supplier/);assert.equal(db.row.status,"requested");
  await quote(id,{...input(),supplierId},"admin",db.client);assert.equal(db.row.supplierId,supplierId);
});
test("rejection validates its reason and changes only requested samples",async()=>{
  const db=memory();await assert.rejects(reject(id,{rejectionReason:" "},"admin",db.client));assert.equal(db.row.status,"requested");await reject(id,{rejectionReason:"Unavailable fabric"},"admin",db.client);assert.equal(db.row.status,"rejected");assert.equal(db.row.rejectionReason,"Unavailable fabric");assert.equal(db.row.quoteSampleCostInr,null);await assert.rejects(quote(id,input(),"admin",db.client),/Only requested/);
});
test("concurrent quote reviews cannot overwrite a released quote",async()=>{
  const db=memory();const results=await Promise.allSettled([quote(id,input(),"admin",db.client),quote(id,{...input(),quoteSampleCostInr:200},"admin",db.client)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(db.row.quoteSampleCostInr.toFixed(2),"100.55");
});
test("sample list is paginated and combines legacy delivery evidence with search without overwriting filters",async()=>{
  let query:any;const db:any={sample:{findMany:async(q:any)=>{query=q;return [{id,supplierId,status:"accepted_by_buyer",deliveredAt:new Date()}];},count:async()=>1000000},supplierProfile:{findMany:async()=>[{id:supplierId,companyName:"Mill",status:"APPROVED"}]}};
  const result=await list({page:2,pageSize:10,status:"delivered",search:"SMPL"},db);assert.equal(query.take,10);assert.equal(query.skip,10);assert.equal(query.where.OR[1].deliveredAt.not,null);assert.ok(query.where.AND[0].OR.some((v:any)=>v.sampleNumber));assert.equal(result.samples[0].status,"delivered");assert.equal(result.samples[0].fulfillmentSupplier?.id,supplierId);assert.equal(result.totalCount,1000000);
});
test("owned buyer acceptance creates exactly one real sampling order and initial milestone atomically",async()=>{
  const db=await acceptedSample();assert.equal(db.row.status,"accepted_by_buyer");assert.equal(db.row.buyerDecision,"accepted");assert.equal(db.order.orderType,"sampling");assert.equal(db.order.sampleId,id);assert.equal(db.order.buyerId,buyerId);assert.equal(db.order.supplierId,supplierId);assert.equal(db.order.status,"PENDING_PAYMENT");assert.equal(db.milestones.length,1);await assert.rejects(decideSampleQuote(db.client,id,buyerId,"accepted"),/CONFLICT/);assert.equal(db.milestones.length,1);
});
test("concurrent buyer acceptance creates one order and order failure rolls back acceptance",async()=>{
  const db=memory();await quote(id,input(),"admin",db.client);const results=await Promise.allSettled([decideSampleQuote(db.client,id,buyerId,"accepted"),decideSampleQuote(db.client,id,buyerId,"accepted")]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(db.milestones.length,1);
  const broken=memory();await quote(id,input(),"admin",broken.client);broken.failOrder=true;await assert.rejects(decideSampleQuote(broken.client,id,buyerId,"accepted"),/Order store failed/);assert.equal(broken.row.status,"quoted");assert.equal(broken.row.buyerDecision,null);assert.equal(broken.order,null);
});
test("buyer acceptance rejects wrong owners, expired quotes and unavailable suppliers",async()=>{
  for(const scenario of ["owner","expired","supplier"]){const db=memory();await quote(id,input(),"admin",db.client);if(scenario==="expired")db.row.quoteValidUntil=new Date(0);if(scenario==="supplier")db.supplier.status="SUSPENDED";await assert.rejects(decideSampleQuote(db.client,id,scenario==="owner"?supplierId:buyerId,"accepted"),/CONFLICT/);assert.equal(db.row.status,"quoted");assert.equal(db.order,null);}
});
test("buyer rejection creates no order and requester projection withholds administrative notes",async()=>{
  const db=memory();await quote(id,input(),"admin",db.client);await decideSampleQuote(db.client,id,buyerId,"rejected","Not required");assert.equal(db.order,null);assert.equal(db.row.status,"rejected_by_buyer");const safe=requesterSample(db.row);assert.equal(safe.quoteInternalNotes,null);assert.ok(!JSON.stringify(safe).includes("PRIVATE SAMPLE NOTES"));assert.equal(safe.quoteRefundPolicy,"full");
});
test("physical delivery saves courier details, sample/order states and one milestone together",async()=>{
  const db=await acceptedSample();const result=await delivered(id,{courierName:"Blue Dart",courierTrackingNumber:"AWB-12345"},"admin",db.client);assert.equal(result.status,"delivered");assert.equal(db.row.courierName,"Blue Dart");assert.equal(db.row.courierTrackingNumber,"AWB-12345");assert.equal(db.row.deliveredByUserId,"admin");assert.equal(db.order.status,"DELIVERED");assert.equal(db.order.trackingNumber,"AWB-12345");assert.equal(db.milestones.length,2);assert.equal(db.row.quoteSampleCostInr.toFixed(2),"100.55");await assert.rejects(delivered(id,{courierName:"Other",courierTrackingNumber:"OTHER"},"admin",db.client),/undelivered/);assert.equal(db.milestones.length,2);
});
test("delivery refuses missing tracking, unaccepted requests, cancelled orders and legacy missing-order records",async()=>{
  assert.equal(sampleDeliveredSchema.safeParse({courierName:"",courierTrackingNumber:""}).success,false);
  for(const scenario of ["requested","cancelled","legacy"]){const db=scenario==="cancelled"?await acceptedSample():memory();if(scenario==="cancelled")db.order.status="CANCELLED";if(scenario==="legacy"){db.row.status="accepted_by_buyer";db.row.buyerDecision="accepted";}await assert.rejects(delivered(id,{courierName:"Courier",courierTrackingNumber:"ABC"},"admin",db.client));assert.equal(db.row.deliveredAt,null);assert.equal(db.order?.status,scenario==="cancelled"?"CANCELLED":undefined);}
});
test("delivered samples remain in the accepted order queue",async()=>{
  let query:any;const db:any={sample:{findMany:async(q:any)=>{query=q;return [];},count:async()=>0}};await accepted("sampling",{page:1,pageSize:25,search:"",status:"delivered",sort:"newest"},db);assert.deepEqual(query.where.status.in,["accepted_by_buyer","delivered"]);assert.equal(query.where.deliveredAt.not,null);
});
test("sample HTTP routes protect delivery and validate new quote/rejection contracts",async()=>{
  const db=memory();const handlers:any={list:(q:any)=>list(q,db.client),detail:async()=>({sample:db.row}),quote:(id:any,body:any,actor:any)=>quote(id,body,actor,db.client),reject:(id:any,body:any,actor:any)=>reject(id,body,actor,db.client),delivered:(id:any,body:any,actor:any)=>delivered(id,body,actor,db.client)};
  const app=buildApp({resolveSession:async()=>({id:"admin",email:"admin@example.invalid",fullName:null,role:"ADMIN"}),sampleHandlers:handlers});
  try{assert.equal((await app.inject({method:"POST",url:`/api/v1/admin/samples/${id}/delivered`})).statusCode,401);const headers={authorization:"Bearer synthetic"};assert.equal((await app.inject({method:"POST",url:`/api/v1/admin/samples/${id}/reject`,headers,payload:{rejectionReason:""}})).statusCode,400);const result=await app.inject({method:"POST",url:`/api/v1/admin/samples/${id}/quote`,headers,payload:input()});assert.equal(result.statusCode,200);assert.equal(result.json().totalSampleCostInr,"120.65");}finally{await app.close();}
});
