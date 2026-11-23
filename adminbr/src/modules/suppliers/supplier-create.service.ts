import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { PublicError } from "../../common/errors/public-error.js";
import { prisma } from "../../infrastructure/db.js";
import { createSupplierSchema } from "./supplier.schema.js";
import { supplierProvisioner, type SupplierProvisioner } from "./supplier-provisioning.provider.js";

export async function createSupplierAccount(payload: unknown, client = prisma, provider?: SupplierProvisioner) {
  const input = createSupplierSchema.parse(payload);
  const checkDuplicates = async (tx: Prisma.TransactionClient) => {
    if (await tx.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } })) {
      throw new PublicError(409, "An account already exists for this email address.");
    }
    if (await tx.supplierProfile.findFirst({ where: { OR: [{ companyName: { equals: input.companyName, mode: "insensitive" } },
      ...(input.gstNumber ? [{ gstNumber: { equals: input.gstNumber, mode: "insensitive" as const } }] : [])] }, select: { id: true } })) {
      throw new PublicError(409, "A supplier with this company name or GST already exists.");
    }
  };
  // No remote auth or email call runs inside a database transaction.
  await client.$transaction(checkDuplicates);
  const provision = provider || supplierProvisioner();
  const userId = await provision.createUser({ email: input.email, password: randomBytes(32).toString("base64url"),
    email_confirm: true, user_metadata: { fullName: input.fullName } });
  let user;
  try {
    user = await client.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('mylonex_admin_supplier_create'))::text`;
      await checkDuplicates(tx);
      return tx.user.create({ data: { id: userId, email: input.email, fullName: input.fullName, role: "SUPPLIER",
        supplierProfile: { create: { companyName: input.companyName, city: input.city || null,
          dispatchLocation: [input.city, input.locationState].filter(Boolean).join(", ") || null,
          phone: input.phone, gstNumber: input.gstNumber || null, supplierType: input.supplierType,
          fulfillmentRegions: [], status: "PENDING" } },
      }, include: { supplierProfile: true } });
    });
  } catch (failure) {
    // A lost connection during COMMIT is ambiguous. Check before deleting an
    // identity that may now own a committed profile.
    try { user = await client.user.findUnique({ where: { id: userId }, include: { supplierProfile: true } }); }
    catch { throw new PublicError(502, "Supplier setup could not be verified. Contact support to reconcile the account before retrying."); }
    if (!user?.supplierProfile) {
      try { await provision.deleteUser(userId); }
      catch { throw new PublicError(502, "Supplier setup failed and account cleanup needs attention. Contact support before retrying."); }
      if (failure instanceof PublicError) throw failure;
      throw new PublicError(502, "Supplier profile could not be saved. The new authentication account was removed. Please retry.");
    }
  }
  let emailStatus: "sent" | "disabled" | "failed" = "disabled";
  if (provision.sendPasswordSetup) {
    try { emailStatus = await provision.sendPasswordSetup(input.email) ? "sent" : "failed"; }
    catch { emailStatus = "failed"; }
  }
  return { ...user!, emailSent: emailStatus === "sent", emailStatus };
}
