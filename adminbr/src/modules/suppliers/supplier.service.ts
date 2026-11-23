import {Prisma} from "@prisma/client";
import {z} from "zod";
import {supplierListSchema} from "./supplier.schema.js";
import * as repo from "./supplier.repository.js";
import {PublicError} from "../../common/errors/public-error.js";
import {normalizeConsentPhone} from "./supplier-phone.js";
export const consentSchema=z.object({consent:z.boolean(),explicitConfirmation:z.boolean().default(false),phone:z.string().trim().max(25).regex(/^$|^\+?[0-9][0-9 ()-]{6,19}$/).optional()});
export async function list(query:unknown, storage = repo){const q=supplierListSchema.parse(query);const where:Prisma.SupplierProfileWhereInput={};if(q.status&&q.status!=='ALL')where.status=q.status;if(q.supplierType)where.supplierType=q.supplierType;if(q.city)where.city={contains:q.city,mode:'insensitive'};
 if(q.catalogStatus==='active')where.OR=[{supplierCatalogEntries:{some:{isActive:true}}},{wovenProducts:{some:{isActive:true}}}];if(q.catalogStatus==='empty'){where.supplierCatalogEntries={none:{}};where.wovenProducts={none:{}};}
 if(q.search){const contains={contains:q.search,mode:'insensitive' as const};where.AND=[{OR:[{companyName:contains},{city:contains},{dispatchLocation:contains},{phone:contains},{gstNumber:contains},{user:{email:contains}},{user:{fullName:contains}},...(['PENDING','APPROVED','SUSPENDED'].includes(q.search.toUpperCase())?[{status:q.search.toUpperCase() as any}]:[])]}];}return storage.list(where,q.page,q.pageSize);}
export async function detail(id:string){const supplier=await repo.detail(id);if(!supplier)throw new PublicError(404,'Supplier not found');return{supplier};}
export async function updateConsent(id: string, body: unknown, storage = repo) {
 const input = consentSchema.parse(body);
 if (input.consent && !input.explicitConfirmation) throw new PublicError(400, 'Explicit confirmation of supplier WhatsApp consent is required');
 const supplier = await storage.detail(id);
 if (!supplier) throw new PublicError(404, 'Supplier not found');
 const phone = input.phone !== undefined ? input.phone : supplier.phone;
 const normalized = normalizeConsentPhone(phone, supplier.phoneCountryCode || 'India');
 if (input.consent && !normalized) throw new PublicError(400, 'A valid supplier WhatsApp phone number is required');
 const updated = await storage.consent(id, {
  whatsappConsent: input.consent, whatsappConsentAt: input.consent ? new Date() : null,
  ...(input.consent ? { phone: normalized } : input.phone !== undefined ? { phone: phone || null } : {}),
 });
 return { ok: true, supplier: updated };
}
