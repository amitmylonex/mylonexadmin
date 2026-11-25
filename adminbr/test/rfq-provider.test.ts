import {test} from "node:test";
import assert from "node:assert/strict";
import {createWhatsAppSender} from "../src/modules/rfqs/notifications/provider.js";
const env={WHATSAPP_ACCESS_TOKEN:"test-only",WHATSAPP_PHONE_NUMBER_ID:"123456",WHATSAPP_SUPPLIER_RFQ_TEMPLATE:"mylonex_supplier_rfq_forward_v1"};
const match:any={id:"match",supplierId:"supplier",status:"FORWARDED_TO_SUPPLIER",supplier:{status:"APPROVED",whatsappConsent:true,whatsappConsentAt:new Date(),companyName:"Test Mill"},communicationRequest:{rfqNumber:"RFQ-TEST",fabricName:"Cotton",quantity:10000,deliveryPincode:"400001"}};
const client:any={communicationRequestMatch:{findUnique:async()=>match}};
const input={matchId:"match",rfqId:"request",attemptId:"attempt",phone:"919876543210",deadline:null};
test("provider adapter preserves correlation and uses finite timeout without sending real messages",async()=>{
  let calls=0;
  const send:typeof fetch=async(url,options)=>{calls++;assert.match(String(url),/^https:\/\/graph.facebook.com\/v[\d.]+\/123456\/messages$/);assert.ok(options?.signal);const body=JSON.parse(String(options?.body));assert.equal(body.biz_opaque_callback_data,"attempt");assert.equal(body.to,input.phone);assert.equal(body.template.components[0].parameters.length,5);assert.equal(body.template.components[0].parameters[3].text,"10,000 m");return new Response(JSON.stringify({messages:[{id:"provider-id"}]}),{status:200});};
  assert.deepEqual(await createWhatsAppSender(env,client,send)(input),{messageId:"provider-id"});assert.equal(calls,1);
});
test("provider adapter rejects ineligible suppliers, unconfirmed delivery and invalid configuration",async()=>{
  assert.throws(()=>createWhatsAppSender({},client),/configuration/);
  let calls=0;const send:typeof fetch=async()=>{calls++;return new Response('{}',{status:503});};
  const sender=createWhatsAppSender(env,client,send);await assert.rejects(sender(input),/confirm/);
  match.supplier.status="SUSPENDED";await assert.rejects(sender(input),/eligible/);assert.equal(calls,1);match.supplier.status="APPROVED";
});
