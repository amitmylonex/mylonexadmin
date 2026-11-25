import {test,expect,type Page} from '@playwright/test';
import {seedAdminSession} from './admin-session';
const id='11111111-1111-4111-8111-111111111111',mill='22222222-2222-4222-8222-222222222222';
async function setup(page:Page,{failure='',status='approved',hold=false}={}) {
 await seedAdminSession(page);let staged=false;const posts:any[]=[];let release=()=>{};
 const gate=hold?new Promise<void>(r=>release=r):Promise.resolve();
 await page.route('http://127.0.0.1:4184/**',r=>r.fulfill({json:{}}));
 await page.route('http://127.0.0.1:4183/**',async r=>{
  const req=r.request(),url=new URL(req.url());const send=(data:object,code=200)=>r.fulfill({status:code,json:{success:code<400,...data}});
  if(url.pathname.endsWith('/auth/me'))return send({user:{id:'admin',role:'ADMIN'}});
  if(req.method()==='POST'){posts.push({path:url.pathname,body:req.postDataJSON()});await gate;if(failure)return send({error:{code:'CONFLICT',message:failure}},409);staged=true;return send({match:{id:'manual',status:'PENDING_ADMIN_REVIEW'},notification:{state:'PENDING_REVIEW'}});}
  if(url.pathname.endsWith('/suppliers')){
   expect(url.searchParams.get('status')).toBe('APPROVED');expect(url.searchParams.get('unmatchedForRfq')).toBe(id);
   return send({suppliers:[{id:mill,companyName:'Amit Mill',status:'APPROVED',user:{email:'amit@example.invalid'},_count:{supplierCatalogEntries:4,wovenProducts:2}},{id:'suspended',companyName:'Suspended Mill',status:'SUSPENDED'},{id:'inactive',companyName:'Inactive Mill',status:'APPROVED',isActive:false}],totalCount:3});
  }
  return send({inquiry:{id,rfqNumber:'RFQ-MANUAL',fabricName:'Cotton',recordedStatus:status},lifecycle:[],suppliers:staged?[{id:'manual',supplierId:mill,supplierName:'Amit Mill',matchStatus:'PENDING_ADMIN_REVIEW',sourceType:'manual',notificationStatus:'Not attempted',timeline:[],unavailableEvents:[],quote:null}]:[],totalPages:1,totalCount:staged?1:0,totalMatches:staged?1:0});
 });
 await page.goto(`/admin/rfq-tracking/${id}`);
 const form=page.getByRole('region',{name:'Manual supplier routing'});
 return {form,posts,release};
}
test('manual route has real default selection, explains required reason and only offers eligible suppliers',async({page})=>{
 const {form,posts}=await setup(page);const picker=form.getByRole('combobox',{name:'Approved supplier'}),reason=form.getByLabel('Routing reason *'),button=form.getByRole('button',{name:'Stage manual match'});
 await expect(picker.locator('option')).toHaveCount(2);await expect(picker).toHaveValue('');await expect(picker.locator('option:checked')).toHaveText('Select an approved supplier');
 await expect(picker).toContainText('Amit Mill · amit@example.invalid · APPROVED · 4 catalog fabrics · 2 woven listings');
 await reason.fill('Capacity checked');await expect(button).toBeDisabled();await picker.selectOption(mill);await expect(button).toBeEnabled();
 await reason.fill('   ');await expect(button).toBeDisabled();await expect(form.getByText('Enter a routing reason before staging this supplier match.')).toBeVisible();await expect(reason).toHaveAttribute('aria-invalid','true');
 await expect(form.getByText('Required for audit history. Explain why this supplier can fulfil this RFQ.')).toBeVisible();expect(posts).toHaveLength(0);
 await form.getByLabel('Search approved suppliers').fill('Amit');await expect(picker).toHaveValue('');await expect(button).toBeDisabled();
});
test('manual staging stays pending, prevents duplicate clicks, refreshes without navigation and clears fields',async({page})=>{
 const {form,posts,release}=await setup(page,{hold:true});await form.getByRole('combobox',{name:'Approved supplier'}).selectOption(mill);await form.getByLabel('Routing reason *').fill('  Extra capacity verified  ');
 const documents:string[]=[];page.on('request',r=>{if(r.isNavigationRequest())documents.push(r.url());});
 await form.getByRole('button',{name:'Stage manual match'}).click();await expect(form.getByRole('button',{name:'Staging supplier match…'})).toBeDisabled();release();
 await expect(form.getByRole('status')).toHaveText('Supplier match staged for Admin review. No supplier notification has been sent.');
 await expect(page.getByRole('heading',{name:'Amit Mill',exact:true})).toBeVisible();await expect(page.getByText('PENDING ADMIN REVIEW',{exact:true})).toBeVisible();
 await expect(form.getByLabel('Routing reason *')).toHaveValue('');await expect(form.getByRole('combobox',{name:'Approved supplier'})).toHaveValue('');await expect(form.locator(`option[value="${mill}"]`)).toHaveCount(0);
 expect(posts).toEqual([{path:`/api/v1/admin/rfqs/${id}/manual-match`,body:{supplierId:mill,note:'Extra capacity verified'}}]);expect(documents).toEqual([]);
});
for(const failure of ['This supplier already has a match for this RFQ','Choose a currently approved supplier','Only pending or active RFQs can receive manual matches','RFQ requirements changed. Refresh and retry.'])test(`manual route displays backend conflict: ${failure}`,async({page})=>{
 const {form,posts}=await setup(page,{failure});await form.getByRole('combobox',{name:'Approved supplier'}).selectOption(mill);await form.getByLabel('Routing reason *').fill('Verified');await form.getByRole('button',{name:'Stage manual match'}).click();await expect(form.getByRole('alert')).toHaveText(failure);await expect(form.getByLabel('Routing reason *')).toHaveValue('Verified');expect(posts).toHaveLength(1);
});
test('closed RFQ explains why staging is unavailable',async({page})=>{const {form,posts}=await setup(page,{status:'closed'});await expect(form).toContainText('Sourcing is closed for this RFQ.');await expect(form.getByRole('button',{name:'Stage manual match'})).toHaveCount(0);expect(posts).toHaveLength(0);});
