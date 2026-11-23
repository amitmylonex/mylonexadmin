/** Browser-safe transport contracts. No database client or server runtime imports. */
export type CatalogKind = "collections" | "fabrics" | "woven" | "capabilities";
export type SupplierStatus = "PENDING" | "APPROVED" | "SUSPENDED";
export interface Pagination { page: number; pageSize: number; totalPages: number }
export interface ImportFailure { rowNumber: number; reason: string }
export interface ImportResult { ok: boolean; createdCount: number; skippedCount: number; failedCount: number; failures: ImportFailure[]; message: string }
export interface ImportPreview { ok: boolean; failures: ImportFailure[]; validCount: number; totalRows: number }
