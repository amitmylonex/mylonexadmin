import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
export async function checkDatabaseSchema() {
  const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string }>>`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'`;
  const existing = new Set(columns.map(c => `${c.table_name}.${c.column_name}`));
  const required = ["RfqDispatchAttempt", "User", "SupplierProfile", "SupplierCatalog", "FabricCollection", "WovenProduct", "WovenProductSpec", "SupplierCapability", "SystemCounter", "BuyerProfile", "CommunicationRequest", "CommunicationRequestMatch", "CommunicationRequestResponse", "Sample", "Order", "OrderMilestone", "Inquiry", "InquiryMatch", "InquiryResponse", "WhatsAppWebhookEvent"];
  const missing = Prisma.dmmf.datamodel.models.filter(m => required.includes(m.name)).flatMap(model => model.fields.filter(f => f.kind !== "object" && !existing.has(`${model.dbName || model.name}.${f.dbName || f.name}`)).map(f => `${model.dbName || model.name}.${f.dbName || f.name}`));
  const weave = columns.find(c => c.table_name === "supplier_catalog" && c.column_name === "weave_type");
  if (weave && !["text", "character varying"].includes(weave.data_type)) missing.push("supplier_catalog.weave_type must support free text");
  return missing;
}
