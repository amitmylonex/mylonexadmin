import { test, expect, type Page } from "@playwright/test";
import { seedAdminSession } from "./admin-session";
const id="11111111-1111-4111-8111-111111111111";
async function quotesApi(page:Page, empty=false, conflict=false) {
  await seedAdminSession(page);const writes:any[]=[];let pending=!empty;
  await page.route("http://127.0.0.1:4184/**",route=>route.fulfill({json:{}}));
  await page.route("https://images.example.invalid/**",route=>route.fulfill({status:200,contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"><rect width="120" height="100" fill="#dbeafe"/></svg>'}));
  await page.route("http://127.0.0.1:4183/**",route=>{
    const url=new URL(route.request().url());const send=(body:any,status=200)=>route.fulfill({status,json:{success:status<400,...body}});
    if(url.pathname.endsWith("/auth/me"))return send({user:{id:"admin",role:"ADMIN",email:"admin@example.invalid"}});
    if(url.pathname==="/api/v1/admin/quote-approvals")return send({quotes:pending?[{id,price:"100.00",supplierOriginalPrice:null,leadTimeDays:14,moq:1000,sampleAvailability:"Available",dispatchLocation:"Surat warehouse",responseImageUrls:["https://images.example.invalid/fabric.svg"],supplier:{companyName:"Approved Test Mill"},requestMatch:{communicationRequest:{rfqNumber:"RFQ-0001",fabricName:"Plain Cotton",quantity:1000,targetPriceMin:110,targetPriceMax:130}}}]:[],totalCount:pending?1:0,totalPages:1});
    if(url.pathname.includes("/quote-approvals/")&&route.request().method()==="POST") {
      const body=route.request().postDataJSON();writes.push({path:url.pathname,...body});
      if(conflict)return send({error:{code:"CONFLICT",message:"Quote is no longer pending. Refresh the queue."}},409);
      pending=false;return send({quote:{id},notification:url.pathname.endsWith("/approve")?{state:"QUEUED",message:"Buyer quote-ready email queued."}:undefined});
    }
    return send({});
  });return writes;
}
test("quote review compares targets, calculates margin versus markup and releases final price with expiry",async({page})=>{
  const writes=await quotesApi(page);await page.goto("/admin/quote-approvals");
  await expect(page.getByRole("columnheader",{name:"Supplier Price (INR/m)",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Review Quote",exact:true}).click();const modal=page.getByRole("dialog",{name:"Review Quote",exact:true});
  await expect(modal).toContainText("Surat warehouse");await expect(modal.getByRole("img",{name:"Supplier fabric 1"})).toBeVisible();
  await modal.getByLabel("Final buyer price (INR/m)").fill("125");
  await expect(modal.getByRole("region",{name:"Commercial calculator"})).toContainText("Platform margin: 20.00%");
  await expect(modal.getByRole("region",{name:"Commercial calculator"})).toContainText("Markup: 25.00%");
  await modal.getByLabel("Quote expiry (inclusive, IST)").fill("2027-01-01");await modal.getByLabel("Admin internal notes").fill("Internal margin review");
  await page.screenshot({path:"../docs/phase6-quote-review.png",fullPage:true,animations:"disabled"});
  await modal.getByRole("button",{name:"Release Quote to Buyer",exact:true}).click();await expect(modal).not.toBeVisible();
  await expect(page.getByRole("status").filter({hasText:"released to buyer"})).toContainText("email queued");
  expect(writes[0]).toEqual({path:`/api/v1/admin/quote-approvals/${id}/approve`,markupPriceInr:125,adminReviewNote:"Internal margin review",validUntilDate:"2027-01-01"});
  await expect(page.getByText("No quotes awaiting review.")).toBeVisible();
});
test("invalid prices block release; rejection requires its own reason and does not send markup",async({page})=>{
  const writes=await quotesApi(page);await page.goto("/admin/quote-approvals");await page.getByRole("button",{name:"Review Quote",exact:true}).click();const modal=page.getByRole("dialog");
  await modal.getByLabel("Final buyer price (INR/m)").fill("0");await expect(modal.getByRole("button",{name:"Release Quote to Buyer"})).toBeDisabled();
  await expect(modal.getByRole("button",{name:"Reject Quote to Supplier"})).toBeDisabled();await modal.getByLabel("Rejection reason").fill("Please revise MOQ");
  await modal.getByRole("button",{name:"Reject Quote to Supplier"}).click();await expect(modal).not.toBeVisible();
  expect(writes[0]).toEqual({path:`/api/v1/admin/quote-approvals/${id}/reject`,rejectionReason:"Please revise MOQ"});
});
test("a conflicting release stays in the dialog with actionable server feedback",async({page})=>{
  await quotesApi(page,false,true);await page.goto("/admin/quote-approvals");await page.getByRole("button",{name:"Review Quote",exact:true}).click();const modal=page.getByRole("dialog");
  await modal.getByRole("button",{name:"Release Quote to Buyer"}).click();await expect(modal.getByRole("alert")).toContainText("no longer pending");await expect(modal).toBeVisible();
});
test("quote calculator fits a mobile modal and shows a negative margin honestly",async({page})=>{
  await quotesApi(page);await page.setViewportSize({width:390,height:844});await page.goto("/admin/quote-approvals");await page.getByRole("button",{name:"Review Quote",exact:true}).click();const modal=page.getByRole("dialog");
  await modal.getByLabel("Final buyer price (INR/m)").fill("90");await expect(modal.getByText("The final buyer price is below the supplier bid.")).toBeVisible();
  expect(await modal.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await page.screenshot({path:"../docs/phase6-quote-mobile.png",fullPage:true,animations:"disabled"});
});
