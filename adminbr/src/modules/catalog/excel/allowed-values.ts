import { SUPPLIER_CATALOG_FABRIC_TYPES, SUPPLIER_WEAVE_TYPES, SUPPLIER_FABRIC_STATES, SUPPLIER_DYE_METHODS, SUPPLIER_PRODUCTION_CYCLES } from "../constants.js";

export const EXCEL_ALLOWED_FABRIC_TYPES = SUPPLIER_CATALOG_FABRIC_TYPES;
export const EXCEL_ALLOWED_WEAVE_TYPES = SUPPLIER_WEAVE_TYPES;
export const EXCEL_ALLOWED_FABRIC_STATES = SUPPLIER_FABRIC_STATES;
export const EXCEL_ALLOWED_DYE_METHODS = SUPPLIER_DYE_METHODS;
export const EXCEL_ALLOWED_PRODUCTION_CYCLES = SUPPLIER_PRODUCTION_CYCLES;
export const EXCEL_ALLOWED_MATERIAL_PURITY = ["pure", "blended"] as const;

export type ExcelFabricType = (typeof EXCEL_ALLOWED_FABRIC_TYPES)[number];
export type ExcelWeaveType = (typeof EXCEL_ALLOWED_WEAVE_TYPES)[number];
export type ExcelFabricState = (typeof EXCEL_ALLOWED_FABRIC_STATES)[number];
export type ExcelDyeMethod = (typeof EXCEL_ALLOWED_DYE_METHODS)[number];
export type ExcelProductionCycle = (typeof EXCEL_ALLOWED_PRODUCTION_CYCLES)[number];
export type ExcelMaterialPurity = (typeof EXCEL_ALLOWED_MATERIAL_PURITY)[number];

