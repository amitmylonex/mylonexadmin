import {test,expect,type Page} from "@playwright/test";
import {seedAdminSession} from "./admin-session";
const id="11111111-1111-4111-8111-111111111111",mill="22222222-2222-4222-8222-222222222222",matchId="33333333-3333-4333-8333-333333333333";
async function setup(page:Page){
 await seedAdminSession(page);const writes:Array<{path:string;body:any}>=[],matches:any[]=[];
 await page.route("http://127.0.0.1:4184/**",r=>r.fulfill({json:{}}));
 await page.route("http://127.0.0.1:4183/**",r=>{
  const request=r.request(),path=new URL(request.url()).pathname;
  const send=(value:object)=>r.fulfill({json:{success:true,...value}});
  if(path.endsWith('/auth/me'))return send({user:{id:'synthetic-admin',role:'ADMIN'}});
  if(request.method()==='POST'){
   const body=request.postDataJSON();writes.push({path,body});
   if(path.endsWith('/matches/re-run')){if(!matches.length)matches.push({id:matchId,supplierId:mill,sourceType:'supplier_catalog',score:95,explanation:'Specs aligned',createdAt:'2026-11-24T00:00:00Z',status:'PENDING_ADMIN_REVIEW',supplier:{companyName:'Parity Mill',status:'APPROVED',user:{email:'mill@example.invalid'}},response:null});return send({createdCount:1,totalMatchCount:1,message:'1 new match awaiting Admin review. No notifications sent.'});}
   if(path.endsWith('/forward')){matches[0].status='FORWARDED_TO_SUPPLIER';matches[0].whatsappStatus='QUEUED';return send({changedCount:1,requestedCount:1,notification:{message:'1 WhatsApp notification queued. Delivery not confirmed.'}});}
  }
  if(path==='/api/v1/admin/suppliers')return send({suppliers:[{id:mill,companyName:'Parity Mill',status:'APPROVED'}],totalCount:1,totalPages:1});
  if(path===`/api/v1/admin/rfqs/${id}`)return send({rfq:{id,rfqNumber:'RFQ-PARITY-001',fabricName:'Cotton twill',quantity:10000,requesterRole:'BUYER',status:'approved',buyer:{fullName:'Test Buyer',email:'buyer@example.invalid'},buyerMessage:'Please source cotton twill.\nYarn Type: undefined\nOriginally inferred GSM from uploaded text.',productionCycle:'running_production',createdAt:'2026-11-24T00:00:00Z',deliveryPincode:'400001',specPayload:{composition:'100% Cotton',originalRequirement:'10000 metres cotton twill',extractionNotes:['Extracted GSM from reference'],data:{weaveType:'twill',fabricState:'rfd',yarnType:'undefined',gsm:120,templateSpecs:[{specKey:'warpCount',valueNum:20},{specKey:'epi',valueNum:52}]}},matches,_count:{matches:matches.length}},totalPages:1,totalCount:matches.length});
  return send({rfqs:[],rows:[],totalCount:0,totalPages:1});
 });return writes;
}
test('detail separates buyer content, technical requirements and extraction notes; rematching stages before forwarding',async({page})=>{
 const writes=await setup(page);await page.setViewportSize({width:1600,height:1000});await page.goto(`/admin/rfqs/${id}`);
 await expect(page.getByRole('heading',{name:'Request details',exact:true})).toBeVisible();
 await expect(page.getByText('10,000 m',{exact:true})).toBeVisible();await expect(page.getByText('Running production',{exact:true})).toBeVisible();await expect(page.getByText('RFD',{exact:true})).toBeVisible();
 const buyer=page.locator('section').filter({has:page.getByRole('heading',{name:'Buyer message',exact:true})}).last();
 await expect(buyer).toContainText('Please source cotton twill.');await expect(buyer).not.toContainText('Originally inferred');await expect(page.getByText('Yarn Type: undefined',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Technical specs',exact:true})).toBeVisible();
 await page.getByText('Extraction notes (Admin only)',{exact:true}).click();await expect(page.getByText('Originally inferred GSM from uploaded text.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'No Matches Found'})).toBeVisible();await page.getByRole('button',{name:'Re-Run Matching Engine'}).click();
 await expect(page.getByRole('heading',{name:'Pending matches (1)'})).toBeVisible();expect(writes).toHaveLength(1);
 await page.getByLabel('Review note for Parity Mill').fill('Verified requirements');await page.getByRole('button',{name:'Forward to Supplier',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Forwarded to suppliers (1)'})).toBeVisible();expect(writes[1]).toEqual({path:`/api/v1/admin/rfq-match-approvals/${matchId}/forward`,body:{note:'Verified requirements'}});
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/rfq-parity-desktop.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#admin-sidebar')).toHaveCSS('transform','matrix(1, 0, 0, 1, -288, 0)');await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'docs/screenshots/rfq-parity-mobile.png',fullPage:true});
});
test('desktop sidebar collapses without losing accessible navigation',async({page})=>{
 await setup(page);await page.setViewportSize({width:1440,height:900});await page.goto(`/admin/rfqs/${id}`);
 await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await expect(page.locator('#admin-sidebar')).toHaveCSS('width','80px');
 await page.locator('#admin-sidebar').getByRole('link',{name:'All RFQs'}).click();await expect(page).toHaveURL(/\/admin\/rfqs$/);await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();await expect(page.locator('#admin-sidebar')).toHaveCSS('width','288px');
});
