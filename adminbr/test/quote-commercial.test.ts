import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { decide, list } from "../src/modules/quotes/quote.service.js";
import { quoteApprovalSchema, quoteRejectionSchema, expiryFromDate } from "../src/modules/quotes/quote.schema.js";
import { notifyReleasedQuote, sendBuyerQuoteEmail } from "../src/modules/quotes/quote-notification.js";
import { buyerQuote } from "../src/modules/quotes/buyer-quote.js";
import { quoteMargins } from "../src/common/money/quote-margins.js";
import { buildApp } from "../src/app.js";
import { config } from "../src/config.js";
const id = "11111111-1111-4111-8111-111111111111";
const base = { id, price: new Prisma.Decimal("100.25"), supplierOriginalPrice: null, status: "PENDING_ADMIN_REVIEW", leadTimeDays: 10, moq: 100,
  additionalNotes: '{"submittedVia":"whatsapp","originalPrice":100.25}', notes:"supplier terms", totalValueEstimate:{total:100250}, submissionRevision:1, validUntilDate:null,
  requestMatch:{communicationRequest:{id:"rfq",rfqNumber:"RFQ-001",requesterRole:"BUYER",quantity:1000,buyer:{email:"buyer@example.invalid"}}} };
function memory(overrides:any={}) {
  let row:any={...base,...overrides}, writes=0; let locked=Promise.resolve();
  const response:any={findFirst:async ({where}:any) => row.status===where.status ? row : null,findUnique:async () => row,
    updateMany:async ({where,data}:any) => {if(where.status && where.status!==row.status || where.buyerNotificationStatus && where.buyerNotificationStatus!==row.buyerNotificationStatus) return {count:0};Object.assign(row,data);writes++;return {count:1};}};
  const tx:any={$queryRaw:async () => [],communicationRequestResponse:response};
  const client:any={...tx,$transaction:async (run:any) => {const before=locked;let release!:()=>void;locked=new Promise<void>(resolve=>release=resolve);await before;const snapshot={...row};try{return await run(tx);}catch(e){row=snapshot;throw e;}finally{release();}}};
  return {client,get row(){return row;},get writes(){return writes;}};
}
const queued=async () => ({state:"QUEUED",message:"Buyer email queued"});
test("approval inputs enforce positive precise INR prices, calendar-valid expiry and explicit rejection reason", () => {
  for(const markupPriceInr of [0,-1,NaN,Infinity,1.001,10000000000,"100",null]) assert.equal(quoteApprovalSchema.safeParse({markupPriceInr}).success,false);
  assert.equal(quoteApprovalSchema.safeParse({markupPriceInr:150.55}).success,true);
  assert.equal(quoteApprovalSchema.safeParse({validUntilDate:"2027-02-30"}).success,false);
  assert.equal(quoteApprovalSchema.safeParse({validUntilDate:"2000-01-01"}).success,false);
  assert.equal(quoteApprovalSchema.safeParse({edits:{price:200}}).success,false);
  assert.equal(quoteRejectionSchema.safeParse({rejectionReason:"   "}).success,false);
  assert.equal(expiryFromDate("2027-01-01")?.toISOString(),"2027-01-01T18:29:59.999Z");
});
test("approval without a markup always snapshots the original supplier price", async () => {
  const db=memory();await decide(id,"approve",{},"admin",db.client,queued);
  assert.equal(db.row.price.toString(),"100.25");assert.equal(db.row.supplierOriginalPrice.toString(),"100.25");assert.equal(db.row.status,"APPROVED_FOR_REQUESTER");assert.equal(db.row.buyerNotificationStatus,"QUEUED");assert.equal(db.row.adminReviewedByUserId,"admin");
});
test("markup changes only final price and preserves supplier metadata and previously recorded original price", async () => {
  const db=memory({supplierOriginalPrice:new Prisma.Decimal("95.00")});
  await decide(id,"approve",{markupPriceInr:125.55,adminReviewNote:"Internal margin review",validUntilDate:"2027-01-01"},"admin",db.client,queued);
  assert.equal(db.row.price.toString(),"125.55");assert.equal(db.row.supplierOriginalPrice.toString(),"95");assert.equal(db.row.additionalNotes,base.additionalNotes);assert.equal(db.row.notes,base.notes);assert.deepEqual(db.row.totalValueEstimate,base.totalValueEstimate);
  assert.equal(db.row.validUntilDate.toISOString(),"2027-01-01T18:29:59.999Z");assert.equal(db.row.adminReviewNote,"Internal margin review");
});
test("rejection requires a reason before database access and never alters commercial prices or queues email", async () => {
  const db=memory();let notifications=0;
  await assert.rejects(decide(id,"reject",{rejectionReason:""},"admin",db.client,queued));assert.equal(db.writes,0);
  await decide(id,"reject",{rejectionReason:"Please revise lead time"},"admin",db.client,async () => {notifications++;return queued();});
  assert.equal(db.row.status,"REJECTED_BY_ADMIN");assert.equal(db.row.adminReviewNote,"Please revise lead time");assert.equal(db.row.price.toString(),"100.25");assert.equal(db.row.supplierOriginalPrice,null);assert.equal(notifications,0);
});
test("concurrent reviews release once without replacing the supplier price or queueing twice", async () => {
  const db=memory();let notifications=0;
  const notify=async () => {notifications++;return queued();};
  const outcomes=await Promise.allSettled([decide(id,"approve",{markupPriceInr:120},"admin",db.client,notify),decide(id,"approve",{markupPriceInr:130},"admin",db.client,notify)]);
  assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);assert.equal(db.row.price.toString(),"120");assert.equal(db.row.supplierOriginalPrice.toString(),"100.25");assert.equal(notifications,1);
});
test("notification failure after commit does not undo release or financial audit fields", async () => {
  const db=memory();const result=await decide(id,"approve",{markupPriceInr:120},"admin",db.client,async () => {throw new Error("mail unavailable");});
  assert.equal(db.row.status,"APPROVED_FOR_REQUESTER");assert.equal(db.row.supplierOriginalPrice.toString(),"100.25");assert.match(result.notification!.message,/reconciliation/);
});
test("buyer serialization exposes final price only and excludes supplier estimates, metadata and internal notes", () => {
  const projected=buyerQuote({...base,status:"APPROVED_FOR_REQUESTER",price:new Prisma.Decimal("150.50"),supplierOriginalPrice:new Prisma.Decimal("100.25"),adminReviewNote:"PRIVATE MARGIN",buyerNotificationMessageId:"private-message"});
  const json=JSON.stringify(projected);assert.equal(projected?.price,"150.5");
  for(const privateValue of ["supplierOriginalPrice","100.25","100250","PRIVATE MARGIN","buyerNotificationMessageId","private-message","submittedVia"]) assert.ok(!json.includes(privateValue),privateValue);
  assert.equal(projected?.totalValueEstimate,null);assert.equal(buyerQuote(base),null);assert.equal(buyerQuote({...base,status:"REJECTED_BY_ADMIN"}),null);
});
test("calculator distinguishes final-price margin from cost-based markup and supports discounts honestly", () => {
  const result=quoteMargins(100,125,1000)!;assert.equal(result.marginPercent,20);assert.equal(result.markupPercent,25);assert.equal(result.estimatedGrossProfit,25000);
  assert.ok(quoteMargins(100,90)!.marginPercent<0);assert.equal(quoteMargins(100,0),null);assert.equal(quoteMargins(0,100),null);
});
test("quote list bounds database pagination and includes buyer price targets, sample, dispatch and images", async () => {
  let query:any;const db:any={communicationRequestResponse:{findMany:async (q:any) => {query=q;return [{...base,supplier:{companyName:"Mill"},responseImageUrls:["https://example.invalid/fabric.png"],sampleAvailability:"Available",dispatchLocation:"Surat"}];},count:async () => 1000000}};
  const result=await list({page:2,pageSize:25,search:"RFQ"},db);assert.equal(query.take,25);assert.equal(query.skip,25);assert.equal(query.where.status,"PENDING_ADMIN_REVIEW");assert.equal(query.include.requestMatch.select.communicationRequest.select.targetPriceMin,true);assert.equal(result.totalCount,1000000);assert.equal(result.quotes[0].sampleAvailability,"Available");
});
test("buyer notification claim sends only final price once, never supplier audit metadata", async () => {
  const db=memory({status:"APPROVED_FOR_REQUESTER",price:new Prisma.Decimal(125),supplierOriginalPrice:new Prisma.Decimal("100.25"),buyerNotificationStatus:"QUEUED"});let calls=0;
  const sender=async (event:any) => {calls++;assert.equal(event.price,"125.00");assert.equal(event.email,"buyer@example.invalid");assert.ok(!JSON.stringify(event).includes("100.25"));return "email-id";};
  await Promise.all([notifyReleasedQuote(id,db.client,sender),notifyReleasedQuote(id,db.client,sender)]);assert.equal(calls,1);assert.equal(db.row.buyerNotificationStatus,"SENT");assert.equal(db.row.buyerNotificationMessageId,"email-id");
});
test("ambiguous buyer delivery is not retried; expired quotes are not emailed", async () => {
  const db=memory({status:"APPROVED_FOR_REQUESTER",buyerNotificationStatus:"QUEUED"});let calls=0;const sender=async () => {calls++;throw new Error("network timeout");};
  await notifyReleasedQuote(id,db.client,sender);await notifyReleasedQuote(id,db.client,sender);assert.equal(calls,1);assert.equal(db.row.buyerNotificationStatus,"AMBIGUOUS_ERROR");
  const expired=memory({status:"APPROVED_FOR_REQUESTER",buyerNotificationStatus:"QUEUED",validUntilDate:new Date(0)});await notifyReleasedQuote(id,expired.client,sender);assert.equal(calls,1);assert.equal(expired.row.buyerNotificationStatus,"SKIPPED_INELIGIBLE");
});
test("Postmark HTTP-200 provider errors cannot be reported as sent", async () => {
  const saved={postmarkToken:config.postmarkToken,postmarkFrom:config.postmarkFrom,appBaseUrl:config.appBaseUrl};Object.assign(config,{postmarkToken:"synthetic",postmarkFrom:"sender@example.invalid",appBaseUrl:"https://example.invalid"});
  try { await assert.rejects(sendBuyerQuoteEmail({email:"buyer@example.invalid",rfqNumber:"RFQ-1",rfqId:"rfq",requesterRole:"BUYER",price:"150.00",quoteId:id,revision:1},async () => new Response(JSON.stringify({ErrorCode:422,MessageID:""}),{status:200})),/not confirmed/); } finally {Object.assign(config,saved);}
});
test("quote HTTP endpoints require ADMIN and reject blank reasons before mutation", async () => {
  const db=memory();const handlers:any={list:(query:any)=>list(query,db.client),decide:(quote:any,decision:any,body:any,actor:any)=>decide(quote,decision,body,actor,db.client,queued)};
  const app=buildApp({resolveSession:async()=>({id:"admin",email:"admin@example.invalid",fullName:null,role:"ADMIN"}),quoteHandlers:handlers});
  try {const headers={authorization:"Bearer synthetic"};assert.equal((await app.inject({url:"/api/v1/admin/quote-approvals"})).statusCode,401);
    assert.equal((await app.inject({method:"POST",url:`/api/v1/admin/quote-approvals/${id}/reject`,headers,payload:{rejectionReason:""}})).statusCode,400);
    const released=await app.inject({method:"POST",url:`/api/v1/admin/quote-approvals/${id}/approve`,headers,payload:{markupPriceInr:125}});assert.equal(released.statusCode,200);assert.equal(db.row.price.toString(),"125");
  } finally {await app.close();}
});

test("disabled or incomplete buyer-email configuration leaves the durable queue unclaimed", async () => {
  const previous={postmarkEnabled:config.postmarkEnabled,postmarkToken:config.postmarkToken,postmarkFrom:config.postmarkFrom,appBaseUrl:config.appBaseUrl};
  const db=memory({status:"APPROVED_FOR_REQUESTER",buyerNotificationStatus:"QUEUED"});
  try {
    Object.assign(config,{postmarkEnabled:false});assert.equal((await notifyReleasedQuote(id,db.client)).state,"QUEUED");
    Object.assign(config,{postmarkEnabled:true,postmarkToken:"",postmarkFrom:"",appBaseUrl:""});assert.equal((await notifyReleasedQuote(id,db.client)).state,"QUEUED");
    assert.equal(db.row.buyerNotificationStatus,"QUEUED");assert.equal(db.writes,0);
  } finally {Object.assign(config,previous);}
});
