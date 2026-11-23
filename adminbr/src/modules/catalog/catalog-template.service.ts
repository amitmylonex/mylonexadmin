import ExcelJS from "exceljs";
import { EXCEL_CATALOG_COLUMNS } from "./excel/headers.js";
import { IMPORT_DEFAULTS } from "./excel/fields.js";

export async function generateCatalogTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MyloNex";
  const sheet = workbook.addWorksheet("Fabric Catalog Import", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = EXCEL_CATALOG_COLUMNS.map(column => ({ header: column.header, key: column.key, width: Math.min(45, Math.max(20, column.header.length + 4)) }));
  sheet.addRow(EXCEL_CATALOG_COLUMNS.map(column => column.example));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5FE3" } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXCEL_CATALOG_COLUMNS.length } };
  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 28 }, { width: 90 }, { width: 35 }];
  for (const rule of [
    "MyloNex supplier catalog import — at most 500 rows per batch and 10 MB per file.",
    "Upload → Mapping → Review & Edit → Buyer Preview & Import. Confirm proposed defaults before publishing.",
    "Blank fabric names are allowed; a unique MYLOXXXX display code is allocated during saving.",
    "Weave is required free text (maximum 200 characters). Color/Shade cannot map to Fabric Name.",
    "Weight supports GSM, OZ (ounces per square yard), and GLM. Label source units in the header or select them in review.",
    "GSM = round(OZ × (28.349523125 / 0.9144²)); GSM = round(GLM / (full width in inches × 0.0254)).",
    "Width supports inches or cm; inches = round((cm / 2.54) × 100) / 100. GLM requires valid full width.",
    "Warp/Weft helper columns fill Count only when Count is blank. Count merges into Construction for storage.",
    "Ready stock requires positive stock. Dyed fabric requires a dye method.",
    "Yarn Type has no storage field: copy to Buyer Notes and clear it, or leave blank. Dyed/printed images require manual shade association.",
    "The complete payload is validated before writes. Successful rows remain saved if another row fails during saving.",
    "Active supplier name + weave + GSM duplicates are skipped. Buyer visibility requires an APPROVED supplier.",
  ]) instructions.addRow([rule]);
  instructions.addRow([]); instructions.addRow(["Column", "Format / requirement", "Proposed default (confirm in review)"]);
  for (const column of EXCEL_CATALOG_COLUMNS) instructions.addRow([column.header,
    `${column.description}; ${column.required ? "required" : "optional or conditional"}${column.allowedValues?.length ? `; ${column.allowedValues.join(", ")}` : ""}`,
    String(IMPORT_DEFAULTS[column.key] ?? "None")]);
  instructions.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
