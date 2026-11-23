import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
test("all sensitive supplier/catalog endpoints reject unauthenticated access", async () => {
  const app = buildApp();
  const supplier = "11111111-1111-4111-8111-111111111111";
  const root = `/api/v1/admin/suppliers/${supplier}`;
  try {
    for (const [method, url] of [["GET", "/api/v1/admin/suppliers"], ["POST", "/api/v1/admin/suppliers"], ["POST", `${root}/status`], ["GET", `${root}/catalog`], ["POST", `${root}/catalog/excel-import`], ["POST", `${root}/catalog/images`], ...["collections", "fabrics", "woven", "capabilities"].flatMap(kind => [["POST", `${root}/catalog/manage/${kind}`], ["PUT", `${root}/catalog/manage/${kind}/${supplier}`]])]) {
      const response = await app.inject({ method: method as any, url, ...(method === "GET" ? {} : { payload: {} }) });
      assert.equal(response.statusCode, 401, `${method} ${url}`);
    }
    assert.equal((await app.inject({ url: "/health" })).statusCode, 200);
  } finally { await app.close(); }
});

import { resolveAdminSession } from "../src/modules/auth/admin-session.js";
import { transitionSupplier } from "../src/modules/suppliers/supplier-status.service.js";
test("a valid supplier token cannot impersonate an admin, even if token metadata claims ADMIN", async () => {
  const auth = { getUser: async () => ({ data: { user: { id: "supplier", user_metadata: { role: "ADMIN" } } } }) };
  await assert.rejects(resolveAdminSession("token", auth, { findUnique: async () => ({ id: "supplier", role: "SUPPLIER" }) }), (err: any) => err.statusCode === 403);
  assert.equal((await resolveAdminSession("token", auth, { findUnique: async () => ({ id: "admin", role: "ADMIN" }) })).role, "ADMIN");
});
test("expired and unknown sessions fail closed", async () => {
  await assert.rejects(resolveAdminSession("expired", { getUser: async () => ({ data: { user: null }, error: {} }) }, { findUnique: async () => { throw new Error("must not query"); } }), (err: any) => err.statusCode === 401);
});
test("approval, suspension and reactivation use atomic expected-status updates", async () => {
  let status = "PENDING";
  const profiles: any = { findUnique: async () => ({ id: "supplier", status }), updateMany: async ({ where, data }: any) => { if (where.status !== status) return { count: 0 }; status = data.status; return { count: 1 }; } };
  for (const next of ["APPROVED", "SUSPENDED", "APPROVED"]) await transitionSupplier("supplier", { expectedCurrentStatus: status, nextStatus: next, reason: "Verified by administrator" }, profiles);
  assert.equal(status, "APPROVED");
  await assert.rejects(transitionSupplier("supplier", { expectedCurrentStatus: "PENDING", nextStatus: "SUSPENDED", reason: "Stale action" }, profiles), (err: any) => err.statusCode === 409);
  await assert.rejects(transitionSupplier("supplier", { expectedCurrentStatus: status, nextStatus: "SUSPENDED", reason: "     " }, profiles));
  assert.equal(status, "APPROVED");
});

test('all restored parity mutation/detail endpoints require Admin auth before data access',async()=>{const app=buildApp(),id='11111111-1111-4111-8111-111111111111';try{for(const[method,url]of [['GET',`/api/v1/admin/buyers/${id}`],['GET',`/api/v1/admin/rfqs/${id}`],['GET',`/api/v1/admin/rfq-tracking/${id}`],['POST','/api/v1/admin/rfq-approvals/bulk'],['POST',`/api/v1/admin/rfqs/${id}/manual-match`],['POST',`/api/v1/admin/quote-approvals/${id}/approve`],['POST',`/api/v1/admin/quote-approvals/${id}/reject`],['POST',`/api/v1/admin/samples/${id}/quote`],['POST',`/api/v1/admin/samples/${id}/reject`],['GET','/api/v1/admin/accepted-orders/production'],['POST',`/api/v1/admin/accepted-orders/production/${id}/delivered`]]){assert.equal((await app.inject({method:method as any,url,...(method==='POST'?{payload:{}}:{})})).statusCode,401,`${method} ${url}`);}}finally{await app.close();}});

test('a verified token cannot open the console when the database role lookup fails',async()=>{
 const auth={getUser:async()=>({data:{user:{id:'admin'}}})};
 await assert.rejects(resolveAdminSession('token',auth,{findUnique:async()=>{throw new Error('private database credentials');}}),(error:any)=>error.statusCode===503&&error.code==='ADMIN_ROLE_LOOKUP_UNAVAILABLE'&&!error.message.includes('credentials'));
});
