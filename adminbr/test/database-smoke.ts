// Explicit opt-in test: writes only inside a transaction that always rolls back.
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { prisma } from "../src/infrastructure/db.js";
import { lockSupplier, saveInTransaction } from "../src/modules/catalog/catalog.service.js";
const rollback = new Error("INTENTIONAL_TEST_ROLLBACK");
let passed = 0;
try {
  await prisma.$transaction(async tx => {
    const userId = randomUUID();
    const user = await tx.user.create({ data: { id: userId, email: `admin-migration-test-${userId}@example.invalid`, role: "SUPPLIER", supplierProfile: { create: { companyName: `Migration test ${userId}`, fulfillmentRegions: [] } } }, include: { supplierProfile: true } });
    const supplierId = user.supplierProfile!.id;
    await lockSupplier(tx, supplierId);
    const collection: any = await saveInTransaction(tx, supplierId, "collections", { name: "Rollback collection", imageUrl: "https://example.invalid/cover.png" });
    const fabricInput = { fabricName: "Rollback cotton", composition: "100% Cotton", gsm: 180, widthInches: 58, weaveType: "Novel Ottoman 2/1", fabricState: "greige", pricePerMeter: 150, minimumOrderQuantity: 500, leadTimeDays: 21, fabricCollectionId: collection.id, imageUrls: [], isActive: true };
    const fabric: any = await saveInTransaction(tx, supplierId, "fabrics", fabricInput);
    const saved = await tx.supplierCatalog.findUniqueOrThrow({ where: { id: fabric.id } });
    assert.equal(saved.weaveType, "Novel Ottoman 2/1"); assert.equal(saved.fabricCollectionId, collection.id); assert.equal(saved.pricePerMeter.toNumber(), 150); assert.match(saved.mylonexCode!, /^MYLO[0-9]+$/); passed++;
    await saveInTransaction(tx, supplierId, "fabrics", { ...fabricInput, pricePerMeter: 175, isActive: false }, fabric.id);
    assert.equal((await tx.supplierCatalog.findUniqueOrThrow({ where: { id: fabric.id } })).pricePerMeter.toNumber(), 175); passed++;
    const woven: any = await saveInTransaction(tx, supplierId, "woven", { compositionText: "Cotton", weaveType: "poplin", finishCategory: "greige", gsmFinished: 120, widthFinishedIn: 58, priceInrPerM: 100, leadTimeDays: 21, specs: [{ specKey: "epi", valueNum: 100 }, { specKey: "warp_count_ply", valueText: "40/1" }] });
    assert.equal(await tx.wovenProductSpec.count({ where: { productId: woven.id } }), 2); passed++;
    const capability: any = await saveInTransaction(tx, supplierId, "capabilities", { capabilityName: "Rollback capability", fibers: ["Cotton", "Custom fibre"], gsmMin: 100, gsmMax: 200, linkedSupplierCatalogIds: [fabric.id], linkedWovenProductIds: [woven.id] });
    assert.equal((await tx.supplierCapability.findUniqueOrThrow({ where: { id: capability.id } })).fibers.length, 2); passed++;
    const renamed = "Updated rollback collection";
    await saveInTransaction(tx, supplierId, "collections", { name: renamed, imageUrl: "https://example.invalid/updated.png" }, collection.id);
    assert.equal((await tx.fabricCollection.findUniqueOrThrow({ where: { id: collection.id } })).name, renamed); passed++;
    throw rollback;
  }, { timeout: 120000 });
} catch (error) {
  if (error !== rollback) throw error;
  console.log(`PASS: ${passed} live database persistence assertions; all writes and counter changes rolled back.`);
} finally { await prisma.$disconnect(); }
