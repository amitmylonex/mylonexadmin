import {test,expect,type Page} from "@playwright/test";
import {seedAdminSession} from "./admin-session";
const id="11111111-1111-4111-8111-111111111111",acceptedId="22222222-2222-4222-8222-222222222222",supplierId="33333333-3333-4333-8333-333333333333";
async function sampleApi(page:Page,conflict=false){
  await seedAdminSession(page);const calls:any[]=[];
  const common={buyer:{email:"buyer@example.invalid",fullName:"Test Buyer"},fabricName:"Plain Cotton",composition:"100% Cotton",gsm:120,quantityMeters:2.5,pincode:"395001",deliveryAddress:"Test buyer office, Surat",supplierId,fulfillmentSupplier:{id:supplierId,status:"APPROVED",companyName:"Approved Sample Mill"}};
  const rows:any[]=[{...common,id,sampleNumber:"SMPL-0001",status:"requested",quoteSampleCostInr:null,quoteCourierCostInr:null,order:null},
    {...common,id:acceptedId,sampleNumber:"SMPL-0002",status:"accepted_by_buyer",buyerDecision:"accepted",quoteSampleCostInr:"10.10",quoteCourierCostInr:"20.20",quoteRefundPolicy:"none",quoteDeliveryTimeline:"3-5 business days",quoteValidUntil:"2027-01-01T00:00:00Z",order:{id:"order-2",orderNumber:"ORD-SMPL-2",status:"PENDING_PAYMENT"}}];
  await page.route("http://127.0.0.1:4184/**",route=>route.fulfill({json:{}}));
  await page.route("http://127.0.0.1:4183/**",route=>{
    const url=new URL(route.request().url()),method=route.request().method(),body=method==="POST"?route.request().postDataJSON():undefined;
    calls.push({path:url.pathname,query:url.search,body});const send=(data:any,status=200)=>route.fulfill({status,json:{success:status<400,...data}});
    if(url.pathname.endsWith("/auth/me"))return send({user:{id:"admin",role:"ADMIN",email:"admin@example.invalid"}});
    if(url.pathname==="/api/v1/admin/samples"){const status=url.searchParams.get("status"),term=url.searchParams.get("search")||"";const found=rows.filter(s=>(!status||s.status===status)&&`${s.sampleNumber} ${s.fabricName}`.toLowerCase().includes(term.toLowerCase()));return send({samples:found,totalCount:found.length,totalPages:1});}
    if(url.pathname==="/api/v1/admin/suppliers")return send({suppliers:[common.fulfillmentSupplier]});
    if(url.pathname==="/api/v1/admin/accepted-orders/sampling")return send({orders:rows.filter(s=>["accepted_by_buyer","delivered"].includes(s.status)),totalCount:1,totalPages:1});
    if(url.pathname==="/api/v1/admin/orders")return send({orders:[],totalCount:0,totalPages:1});
    if(url.pathname.startsWith("/api/v1/admin/samples/")&&method==="POST"){
      if(conflict)return send({error:{code:"CONFLICT",message:"The sample order is cancelled or already delivered"}},409);
      const target=rows.find(s=>s.id===url.pathname.split("/").at(-2));
      if(url.pathname.endsWith("/quote")){Object.assign(target,body,{status:"quoted"});return send({totalSampleCostInr:"0.30",notification:{message:"Quote saved; external delivery is not enabled."}});}
      if(url.pathname.endsWith("/reject")){Object.assign(target,body,{status:"rejected"});return send({});}
      if(url.pathname.endsWith("/delivered")){Object.assign(target,body,{status:"delivered",deliveredAt:new Date().toISOString()});target.order.status="DELIVERED";return send({status:"delivered"});}
    }
    return send({});
  });return calls;
}
test("sample quote drawer calculates exact total and submits total charges, refund and IST expiry",async({page})=>{
  const calls=await sampleApi(page);await page.goto("/admin/samples");await page.getByRole("button",{name:"Prepare Sample Quote",exact:true}).click();const drawer=page.getByRole("dialog",{name:"Prepare Sample Quote",exact:true});
  const bounds=await drawer.boundingBox();expect(bounds?.y).toBe(0);expect(bounds?.height).toBe(await page.evaluate(()=>window.innerHeight));
  await drawer.getByLabel("Sample yardage charge (INR)").fill("0.10");await drawer.getByLabel("Courier charge (INR)").fill("0.20");await expect(drawer.getByRole("status")).toContainText("₹0.30");
  await drawer.getByLabel("Delivery timeline",{exact:true}).fill("3-5 business days");await drawer.getByLabel("Refund policy",{exact:true}).selectOption("full");await drawer.getByLabel("Quote valid until (IST)").fill("2027-01-01T12:30");await drawer.getByLabel("Admin internal notes").fill("PRIVATE COST NOTE");
  await drawer.evaluate(el=>el.scrollTop=0);await page.screenshot({path:"docs/screenshots/phase8-sample-quote.png",fullPage:true,animations:"disabled"});await drawer.getByRole("button",{name:"Release sample quote",exact:true}).click();await expect(drawer).not.toBeVisible();
  const request=calls.find(c=>c.path.endsWith(`${id}/quote`));expect(request.body).toEqual({supplierId,quoteSampleCostInr:"0.10",quoteCourierCostInr:"0.20",quoteDeliveryTimeline:"3-5 business days",quoteRefundPolicy:"full",quoteValidUntil:"2027-01-01T07:00:00.000Z",quoteInternalNotes:"PRIVATE COST NOTE"});
  await expect(page.getByRole("status").filter({hasText:"Sample quote released"})).toContainText("₹0.30");
});
test("invalid precision blocks quote release and rejection uses a separate required reason",async({page})=>{
  const calls=await sampleApi(page);await page.goto("/admin/samples");await page.getByRole("button",{name:"Prepare Sample Quote",exact:true}).click();const drawer=page.getByRole("dialog");await drawer.getByLabel("Sample yardage charge (INR)").fill("1.001");await drawer.getByLabel("Courier charge (INR)").fill("0");await expect(drawer.getByRole("button",{name:"Release sample quote"})).toBeDisabled();await expect(drawer.getByRole("button",{name:"Reject sample request"})).toBeDisabled();await drawer.getByLabel("Rejection reason").fill("Sample unavailable");await drawer.getByRole("button",{name:"Reject sample request"}).click();await expect(drawer).not.toBeVisible();expect(calls.find(c=>c.path.endsWith("/reject")).body).toEqual({rejectionReason:"Sample unavailable"});
});
test("accepted sample delivery requires courier details and refreshes the delivered queue",async({page})=>{
  const calls=await sampleApi(page);await page.goto("/admin/samples");await page.getByRole("button",{name:"Mark Delivered",exact:true}).click();const modal=page.getByRole("dialog",{name:"Mark sample delivered"});await expect(modal.getByRole("button",{name:"Confirm physical delivery"})).toBeDisabled();await modal.getByLabel("Courier name").fill("Blue Dart");await modal.getByLabel("Tracking code").fill("AWB-12345");await page.screenshot({path:"docs/screenshots/phase8-sample-delivery.png",fullPage:true,animations:"disabled"});await modal.getByRole("button",{name:"Confirm physical delivery"}).click();await expect(modal).not.toBeVisible();expect(calls.find(c=>c.path.endsWith("/delivered")).body).toEqual({courierName:"Blue Dart",courierTrackingNumber:"AWB-12345"});
  await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("delivered");await expect(page.getByRole("cell",{name:"SMPL-0002",exact:true})).toBeVisible();await expect(page.getByRole("cell",{name:"SMPL-0001",exact:true})).toHaveCount(0);
});
test("accepted orders link to the tracked sample delivery workflow",async({page})=>{
  await sampleApi(page);await page.goto("/admin/accepted-orders");await page.getByRole("button",{name:"Accepted samples",exact:true}).click();const link=page.getByRole("link",{name:"Manage sample delivery"});await expect(link).toHaveAttribute("href","/admin/samples?search=SMPL-0002");await link.click();await expect(page.getByRole("cell",{name:"SMPL-0002",exact:true})).toBeVisible();await expect(page.getByRole("cell",{name:"SMPL-0001",exact:true})).toHaveCount(0);
});
test("mobile sample delivery preserves entered tracking details on a conflict",async({page})=>{
  await sampleApi(page,true);await page.setViewportSize({width:390,height:844});await page.goto("/admin/samples");await page.getByRole("button",{name:"Mark Delivered",exact:true}).click();const modal=page.getByRole("dialog",{name:"Mark sample delivered"});await modal.getByLabel("Courier name").fill("Courier");await modal.getByLabel("Tracking code").fill("ABC");await modal.getByRole("button",{name:"Confirm physical delivery"}).click();await expect(modal.getByRole("alert")).toContainText("cancelled or already delivered");await expect(modal.getByLabel("Tracking code")).toHaveValue("ABC");expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
