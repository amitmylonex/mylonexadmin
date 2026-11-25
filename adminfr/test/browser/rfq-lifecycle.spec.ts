import {test,expect,type Page} from "@playwright/test";
import {seedAdminSession} from "./admin-session";
const id="11111111-1111-4111-8111-111111111111",matchId="33333333-3333-4333-8333-333333333333",mill="22222222-2222-4222-8222-222222222222";
async function trackingApi(page:Page,throttle=false){
  await seedAdminSession(page);const calls:any[]=[];let routed=false,resent=false;
  await page.route("http://127.0.0.1:4184/**",route=>route.fulfill({json:{}}));
  await page.route("http://127.0.0.1:4183/**",route=>{
    const url=new URL(route.request().url()),method=route.request().method();const send=(body:any,status=200)=>route.fulfill({status,json:{success:status<400,...body}});
    if(url.pathname.endsWith("/auth/me"))return send({user:{id:"admin",role:"ADMIN",email:"admin@example.invalid"}});
    calls.push({path:url.pathname,query:url.search,body:method==="POST"?route.request().postDataJSON():undefined});
    if(url.pathname==="/api/v1/admin/rfqs")return send({rfqs:[{id,rfqNumber:"RFQ-007",fabricName:"Plain Cotton",quantity:3000,deliveryPincode:"395001",createdAt:"2026-11-19T08:00:00Z",buyer:{email:"buyer@example.invalid",fullName:"Buyer Reference"},requesterRole:"BUYER",status:"approved",displayStatus:{label:"active"},_count:{matches:2}}],totalCount:1,totalPages:1});
    if(url.pathname==="/api/v1/admin/suppliers")return send({suppliers:[{id:mill,companyName:"Additional Approved Mill",status:"APPROVED"}]});
    if(url.pathname.endsWith("/manual-match")){routed=true;return send({notification:{message:"Manual match staged for Admin review. No notifications sent."}});}
    if(url.pathname.endsWith("/resend-whatsapp")){if(throttle)return send({error:{code:"RATE_LIMITED",message:"Wait at least 10 minutes between notifications"}},429);resent=true;return send({state:"QUEUED",message:"WhatsApp resend queued; previous receipts are preserved."});}
    if(url.pathname.endsWith("/dispatch-logs")){const second=url.searchParams.get("page")==="2";return send({logs:[{id:second?"old":"new",kind:second?"LEGACY_SNAPSHOT":"RESEND",status:second?"READ":"DELIVERED",requestedAt:"2026-11-19T08:00:00Z",sentAt:"2026-11-19T08:01:00Z",deliveredAt:"2026-11-19T08:02:00Z",readAt:second?"2026-11-19T08:03:00Z":null}],totalCount:11,totalPages:2});}
    if(url.pathname===`/api/v1/admin/rfq-tracking/${id}`)return send({inquiry:{id,rfqNumber:"RFQ-007",fabricName:"Plain Cotton",recordedStatus:"approved"},lifecycle:[
      {key:"submitted",label:"Submitted",recorded:true,at:"2026-11-19T08:00:00Z"},{key:"approved",label:"Admin Approved",recorded:false,at:null},{key:"dispatched",label:"Dispatched to Mills",recorded:true,at:"2026-11-19T08:01:00Z"},{key:"quoted",label:"Quotes Received",recorded:false,at:null},{key:"accepted",label:"Buyer Accepted",recorded:false,at:null},{key:"ordered",label:"Order Placed",recorded:false,at:null}],suppliers:[{id:matchId,supplierId:"existing-mill",supplierName:"Approved Test Mill",sourceType:"manual",sourceId:"admin",matchStatus:"FORWARDED_TO_SUPPLIER",notificationStatus:resent?"Resend queued":"Sent evidence recorded",deliveryStatus:"Delivered",responseStatus:"Awaiting response",consentStatus:"Recorded",dispatchChannel:"Web Portal + WhatsApp",sentAt:"2026-11-19T08:01:00Z",deliveredAt:"2026-11-19T08:02:00Z",readAt:null,deadline:"2026-11-22T08:00:00Z",deadlinePassed:false,reminderCount:0,eligibilityReason:"Current consent is recorded",resendBlockedReason:resent?"A dispatch job is pending":null,timeline:[{key:"sent",label:"Send accepted",at:"2026-11-19T08:01:00Z"}],unavailableEvents:[],quote:null},...(routed?[{id:"new-match",supplierId:"new-mill",supplierName:"Additional Approved Mill",sourceType:"manual",sourceId:"admin",matchStatus:"PENDING_ADMIN_REVIEW",notificationStatus:"Not attempted",deliveryStatus:"No receipt recorded",responseStatus:"No recorded response",consentStatus:"Recorded",dispatchChannel:"Web Portal",sentAt:null,deliveredAt:null,readAt:null,deadline:null,deadlinePassed:false,reminderCount:0,eligibilityReason:"Eligible",resendBlockedReason:"Queued",timeline:[],unavailableEvents:[],quote:null}]:[])],totalMatches:routed?2:1,totalCount:routed?2:1,totalPages:1});
    return send({});
  });return calls;
}
test("RFQ registry exposes status chips, quantity/date filters and deep tracking links",async({page})=>{
  const calls=await trackingApi(page);await page.goto("/admin/rfqs");await expect(page.getByRole("button",{name:"RFQ-007",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"active",exact:true}).click();await page.getByLabel("Minimum quantity (m)").fill("1000");await page.getByLabel("Maximum quantity (m)").fill("5000");
  await page.getByLabel("Submitted from (IST)").fill("2026-11-01");await page.getByLabel("Submitted through (IST)").fill("2026-11-19");
  await expect.poll(()=>calls.some(c=>c.query.includes("quantityMin=1000")&&c.query.includes("quantityMax=5000")&&c.query.includes("status=active")&&c.query.includes("to=2026-11-19"))).toBe(true);
  await expect(page.getByRole("link",{name:"Track RFQ"})).toHaveAttribute("href",`/admin/rfq-tracking/${id}`);
  await page.screenshot({path:"docs/screenshots/phase7-rfq-registry.png",fullPage:true,animations:"disabled"});
});
test("tracking shows missing lifecycle evidence and delivered without implying read",async({page})=>{
  await trackingApi(page);await page.goto(`/admin/rfq-tracking/${id}`);
  const steps=page.getByRole("list",{name:"RFQ lifecycle"});await expect(steps.locator("li").filter({hasText:"Admin Approved"})).toContainText("Not recorded");await expect(steps.locator("li").filter({hasText:"Order Placed"})).toContainText("Not recorded");
  await expect(page.getByText("Delivered",{exact:true})).toBeVisible();await expect(page.getByText("Read",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Consent: Recorded · Dispatch channel: Web Portal + WhatsApp")).toBeVisible();
  await page.getByRole("button",{name:"View dispatch logs"}).click();const modal=page.getByRole("dialog",{name:"WhatsApp dispatch logs"});await expect(modal).toContainText("RESEND · DELIVERED");await expect(modal).toContainText("Read: —");
  await modal.getByRole("button",{name:"Next",exact:true}).click();await expect(modal).toContainText("LEGACY_SNAPSHOT · READ");await modal.getByRole("button",{name:"Close",exact:true}).click();
  await page.screenshot({path:"docs/screenshots/phase7-rfq-tracking.png",fullPage:true,animations:"disabled"});
});
test("manual routing searches only approved mills and refreshes the supplier grid",async({page})=>{
  const calls=await trackingApi(page);await page.goto(`/admin/rfq-tracking/${id}`);const form=page.getByRole("region",{name:"Manual supplier routing"});
  await form.getByLabel("Search approved suppliers").fill("Additional");await expect(form.getByRole("combobox",{name:/Approved supplier/}).locator("option")).toHaveCount(2);await form.getByRole("combobox",{name:/Approved supplier/}).selectOption(mill);await form.getByLabel("Routing reason").fill("Additional capacity requested");await form.getByRole("button",{name:"Stage manual match",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Additional Approved Mill",exact:true})).toBeVisible();expect(calls.find(c=>c.path.endsWith("manual-match"))?.body).toEqual({supplierId:mill,note:"Additional capacity requested"});expect(calls.some(c=>c.path.endsWith("suppliers")&&c.query.includes("status=APPROVED"))).toBe(true);
});
test("resend requires reason and reports queued, while rate limits stay visible in the dialog",async({page})=>{
  const calls=await trackingApi(page);await page.goto(`/admin/rfq-tracking/${id}`);await page.getByRole("button",{name:"Resend WhatsApp",exact:true}).click();const modal=page.getByRole("dialog",{name:"Resend WhatsApp notification"});await expect(modal.getByRole("button",{name:"Queue resend"})).toBeDisabled();await modal.getByLabel("Resend reason").fill("Mill requested a reminder");await modal.getByRole("button",{name:"Queue resend"}).click();await expect(modal).not.toBeVisible();await expect(page.getByRole("status").filter({hasText:"resend queued"})).toBeVisible();expect(calls.find(c=>c.path.endsWith("resend-whatsapp"))?.body.reason).toBe("Mill requested a reminder");
});
test("mobile rate-limit feedback preserves receipt details",async({page})=>{
  await trackingApi(page,true);await page.setViewportSize({width:390,height:844});await page.goto(`/admin/rfq-tracking/${id}`);await page.getByRole("button",{name:"Resend WhatsApp",exact:true}).click();const modal=page.getByRole("dialog");await modal.getByLabel("Resend reason").fill("Reminder");await modal.getByRole("button",{name:"Queue resend"}).click();await expect(modal.getByRole("alert")).toContainText("10 minutes");expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:"docs/screenshots/phase7-mobile-resend.png",fullPage:true,animations:"disabled"});
});
