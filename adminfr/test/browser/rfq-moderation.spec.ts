import { test, expect, type Page } from "@playwright/test";
import { seedAdminSession } from "./admin-session";
const id = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
async function queueApi(page: Page, empty = false, partial = false) {
  await seedAdminSession(page); const writes: any[] = [];
  let rows = empty ? [] : [
    {id,rfqNumber:"RFQ-0001",fabricName:"Plain Cotton",quantity:1000,targetPriceMin:80,targetPriceMax:100,deliveryPincode:"395001",requiredDeliveryDate:"2026-12-15",priority:"urgent",buyerReference:"BUYER-001",buyerAnonymized:true,buyerRemarks:"Please supply greige fabric",specPayload:{composition:"100% Cotton",fabricStructure:"woven",data:{weaveType:"Plain",gsm:120,width:"58",count:"40s",yarnType:"combed"}},proposedMatches:[{supplierId:"mill",companyName:"Approved Test Mill",score:92,explanation:"Weave, blend and dimensions matched",whatsappConsent:false}]},
    {id:other,rfqNumber:"RFQ-0002",fabricName:"Special Twill",quantity:500,targetPriceMin:null,targetPriceMax:null,deliveryPincode:"400001",priority:"normal",buyerReference:"BUYER-002",buyerAnonymized:true,specPayload:{composition:"Cotton",data:{}},proposedMatches:[]},
  ];
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({json:{}}));
  await page.route("http://127.0.0.1:4183/**", route => {
    const req=route.request(), url=new URL(req.url()); const send=(body:any,status=200) => route.fulfill({status,json:{success:status<400,...body}});
    if(url.pathname.endsWith("/auth/me")) return send({user:{id:"admin",role:"ADMIN",email:"admin@example.invalid"}});
    if(url.pathname === "/api/v1/admin/rfq-approvals" && req.method()==="GET") {
      const search=url.searchParams.get("search")?.toLowerCase() || "";
      const found=rows.filter(r => `${r.rfqNumber} ${r.fabricName}`.toLowerCase().includes(search));
      return send({rfqs:found,totalCount:found.length,totalPages:1,metrics:{pendingCount:rows.length,urgentCount:rows.filter(r => r.priority==="urgent").length}});
    }
    if(url.pathname.includes("/rfq-approvals/") && req.method()==="POST") {
      const input=req.postDataJSON();writes.push({path:url.pathname,...input});
      if(url.pathname.endsWith("/bulk")) {
        const failed=partial ? [other] : []; rows=rows.filter(r => !input.ids.includes(r.id) || failed.includes(r.id));
        return send({changedCount:input.ids.length-failed.length,matchedSupplierCount:1,queuedCount:0,failures:failed.map(rfqId => ({rfqId,message:"No eligible approved supplier matches"}))});
      }
      const target=url.pathname.split("/").at(-2);rows=rows.filter(r => r.id!==target);
      return send({rfqId:target,matchedSupplierCount:url.pathname.endsWith("/approve")?1:0,queuedCount:0});
    }
    return send({});
  });
  return writes;
}
test("RFQ queue shows anonymized buyer specs and dashboard-only routing preview", async ({page}) => {
  await queueApi(page);await page.goto("/admin/rfq-approvals");
  await expect(page.getByRole("heading",{name:"RFQ Approval Queue"})).toBeVisible();
  await expect(page.getByLabel("Queue metrics")).toContainText("Pending review2");
  await expect(page.getByRole("region",{name:"Matched suppliers for RFQ-0001"})).toContainText("Approved Test Mill");
  await expect(page.getByText("Dashboard routing only",{exact:true})).toBeVisible();
  await expect(page.getByText("Identity anonymized",{exact:true})).toHaveCount(2);
  await expect(page.getByRole("button",{name:"Approve & Route"}).nth(1)).toBeDisabled();
  await page.getByRole("button",{name:"Inspect detailed specs"}).first().click();
  const dialog=page.getByRole("dialog",{name:"RFQ-0001 specifications"});await expect(dialog).toContainText("100% Cotton");await expect(dialog).toContainText("40s");await expect(dialog).toContainText("combed");
  await dialog.getByRole("button",{name:"Close",exact:true}).click();
  await page.screenshot({path:"docs/screenshots/phase5-rfq-queue.png",fullPage:true,animations:"disabled"});
});
test("single approval refreshes queue and reports routing separately from delivery", async ({page}) => {
  const writes=await queueApi(page);await page.goto("/admin/rfq-approvals");await page.getByRole("button",{name:"Approve & Route"}).first().click();
  await expect(page.getByRole("status").filter({hasText:"supplier routes saved"})).toContainText("1 supplier routes saved; 0 WhatsApp notifications queued");
  await expect(page.getByRole("button",{name:"RFQ-0001",exact:true})).toHaveCount(0);expect(writes[0].path).toBe(`/api/v1/admin/rfq-approvals/${id}/approve`);
});
test("reject dialog requires a reason and submits it with the RFQ ID", async ({page}) => {
  const writes=await queueApi(page);await page.goto("/admin/rfq-approvals");await page.getByRole("button",{name:"Reject",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"Reject 1 RFQ(s)"});await expect(dialog.getByRole("button",{name:"Confirm rejection"})).toBeDisabled();
  await dialog.getByLabel("Rejection reason").fill("Incomplete GSM specification");await dialog.getByRole("button",{name:"Confirm rejection"}).click();
  await expect(dialog).not.toBeVisible();expect(writes[0].reason).toBe("Incomplete GSM specification");expect(writes[0].path).toBe(`/api/v1/admin/rfq-approvals/${id}/reject`);
});
test("bulk approval retains failed RFQs and reports isolated failures", async ({page}) => {
  const writes=await queueApi(page,false,true);await page.goto("/admin/rfq-approvals");await page.getByLabel("Select all on this page").check();await page.getByRole("button",{name:"Approve Selected (2)",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("No eligible approved supplier matches");await expect(page.getByRole("button",{name:"RFQ-0002",exact:true})).toBeVisible();
  expect(writes[0].ids).toEqual([id,other]);expect(writes[0].decision).toBe("approve");await expect(page.getByRole("button",{name:"Approve Selected (0)",exact:true})).toBeDisabled();
});
test("mobile empty queue fits the viewport", async ({page}) => {
  await queueApi(page,true);await page.setViewportSize({width:390,height:844});await page.goto("/admin/rfq-approvals");await expect(page.getByText("No pending RFQs found.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:"docs/screenshots/phase5-rfq-mobile-empty.png",fullPage:true,animations:"disabled"});
});
