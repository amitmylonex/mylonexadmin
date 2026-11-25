import { test, expect, type Page } from "@playwright/test";
import { seedAdminSession } from "./admin-session";
const rfqId = "11111111-1111-4111-8111-111111111111", supplierId = "22222222-2222-4222-8222-222222222222";
async function setup(page: Page, initialStatus = "PENDING") {
  await seedAdminSession(page);
  const writes: Array<{path: string; body: any}> = [];
  const matches: any[] = [];
  let fail = false;
  const supplier = { id: supplierId, companyName: "Picker Test Mill", status: initialStatus, city: "Surat", phone: null, phoneCountryCode: "91", fulfillmentRegions: [], whatsappConsent: false, whatsappConsentAt: null, createdAt: "2026-11-01",
    user: { email: "mill@example.invalid", fullName: "Test Supplier", createdAt: "2026-11-01" }, _count: { supplierCatalogEntries: 0, fabricCollections: 0, communicationRequestMatches: 0, wovenProducts: 0, capabilities: 0 } };
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({json:{}}));
  await page.route("http://127.0.0.1:4183/**", route => {
    const request = route.request(), url = new URL(request.url());
    const send = (body: object, status = 200) => route.fulfill({status,json:{success:status<400,...body}});
    if (url.pathname.endsWith("/auth/me")) return send({user:{id:"synthetic-admin",role:"ADMIN"}});
    if (url.pathname === "/api/v1/admin/suppliers") {
      if (fail) return send({error:{message:"Supplier lookup unavailable"}},503);
      const found = supplier.status === url.searchParams.get("status") && supplier.companyName.toLowerCase().includes((url.searchParams.get("search") || "").toLowerCase());
      return send({suppliers:found?[supplier]:[],totalCount:found?1:0,totalPages:1});
    }
    if (request.method() !== "GET") {
      const body = request.postDataJSON(); writes.push({path:url.pathname,body});
      if (url.pathname.endsWith("/status")) {supplier.status=body.nextStatus;return send({supplier});}
      if (url.pathname.endsWith("/manual-match")) {
        if (supplier.status !== "APPROVED") return send({error:{message:"Approved supplier required"}},409);
        matches.push({id:"manual",supplier,sourceType:"manual",score:0,status:"PENDING_ADMIN_REVIEW",response:null});
        return send({notification:{message:"Manual match staged for review."}});
      }
    }
    if (url.pathname === `/api/v1/admin/suppliers/${supplierId}`) return send({supplier});
    if (url.pathname === `/api/v1/admin/rfqs/${rfqId}`) return send({rfq:{id:rfqId,rfqNumber:"RFQ-PICKER-0001",fabricName:"Twill",quantity:62,status:"pending",requesterRole:"BUYER",buyer:{fullName:"Test Buyer",email:"buyer@example.invalid"},matches,_count:{matches:matches.length}},totalPages:1,totalCount:matches.length});
    return send({});
  });
  return {writes,setFailure:(value:boolean)=>{fail=value;}};
}

test("pending supplier is explained and can be reviewed, approved and retrieved for manual matching", async ({page}) => {
  const api=await setup(page);
  await page.goto(`/admin/rfqs/${rfqId}`);
  await expect(page.getByText("Picker Test Mill — Pending approval.",{exact:false})).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Supplier",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Add match for review"})).toBeDisabled();
  expect(api.writes).toHaveLength(0);
  await page.getByRole("link",{name:"Review supplier approval"}).click();
  await page.getByRole("button",{name:"Approve Supplier",exact:true}).click();
  const modal=page.getByRole("dialog",{name:"Update Supplier Status"});
  await modal.getByLabel("Audit reason").fill("Verified synthetic supplier for test");
  await modal.getByRole("button",{name:"Approve Supplier",exact:true}).click();
  await expect(page.getByRole("button",{name:"Suspend Supplier",exact:true})).toBeVisible();
  await page.goBack();
  const select=page.getByRole("combobox",{name:"Supplier",exact:true});
  await expect(select.locator("option",{hasText:"Picker Test Mill"})).toHaveCount(1);
  await expect(select).toBeEnabled();
  await select.selectOption(supplierId);
  await page.getByLabel("Matching reason").fill("Capacity verified");
  await page.getByRole("button",{name:"Add match for review"}).click();
  await expect(page.getByRole("status").filter({hasText:"Manual match staged"})).toBeVisible();
  expect(api.writes.at(-1)).toEqual({path:`/api/v1/admin/rfqs/${rfqId}/manual-match`,body:{supplierId,note:"Capacity verified"}});
});

test("approved suppliers load immediately and search reports a genuine no-result state", async ({page}) => {
  await setup(page,"APPROVED");
  await page.goto(`/admin/rfqs/${rfqId}`);
  const select=page.getByRole("combobox",{name:"Supplier",exact:true});
  await expect(select.locator("option",{hasText:"Picker Test Mill"})).toHaveCount(1);
  await page.getByLabel("Find approved supplier").fill("No such mill");
  await expect(page.getByText("No approved suppliers match this search.",{exact:false})).toBeVisible();
  await expect(select).toBeDisabled();
  await page.getByLabel("Find approved supplier").fill("");
  await expect(select).toBeEnabled();
});

test("supplier request failures are visible beside the picker and Refresh retries", async ({page}) => {
  const api=await setup(page,"APPROVED");api.setFailure(true);
  await page.goto(`/admin/rfqs/${rfqId}`);
  await expect(page.getByRole("alert").filter({hasText:"Could not load suppliers"})).toBeVisible();
  api.setFailure(false);
  await page.getByRole("button",{name:"Refresh suppliers"}).click();
  await expect(page.getByRole("combobox",{name:"Supplier",exact:true})).toBeEnabled();
});
