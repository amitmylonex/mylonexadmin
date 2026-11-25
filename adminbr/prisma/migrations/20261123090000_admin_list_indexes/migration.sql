-- Additive only. For large tables, use the documented concurrent rollout.
CREATE INDEX IF NOT EXISTS "users_role_created_page_idx" ON "User" ("role", "createdAt" DESC, "id");
CREATE INDEX IF NOT EXISTS "suppliers_status_created_page_idx" ON "SupplierProfile" ("status", "createdAt" DESC, "id");
CREATE INDEX IF NOT EXISTS "suppliers_created_page_idx" ON "SupplierProfile" ("createdAt" DESC, "id");
CREATE INDEX IF NOT EXISTS "supplier_catalog_supplier_page_idx" ON "supplier_catalog" ("supplier_id", "created_at" DESC, "id");
CREATE INDEX IF NOT EXISTS "woven_products_supplier_page_idx" ON "woven_products" ("supplier_id", "created_at" DESC, "id");
CREATE INDEX IF NOT EXISTS "supplier_capabilities_supplier_page_idx" ON "supplier_capabilities" ("supplier_id", "created_at" DESC, "id");
CREATE INDEX IF NOT EXISTS "fabric_collections_supplier_page_idx" ON "fabric_collections" ("supplier_id", "created_at" DESC, "id");
