import { z } from "zod";
import { validateExcelRow } from "./validation";
import type { ExcelCatalogRowMapped } from "./row-types";

const numberOrText = z.union([z.number().finite(), z.string()]).optional();
const text = z.string().optional();
export const excelImportRowSchema = z.object({
    fabricName: text,
    composition: text, yarnType: text, count: text, construction: text,
    weightUnit: z.enum(["GSM", "OZ", "GLM"]).optional(), weightValue: numberOrText, gsm: numberOrText,
    weightBasis: z.enum(["oz-per-square-yard", "glm-full-width"]).optional(),
    widthUnit: z.enum(["inches", "cm"]).optional(), widthValue: numberOrText, widthInches: numberOrText,
    unitConflicts: z.object({ weight: text, width: text }).optional(),
    weaveType: text, fabricState: text, dyeMethod: text, productionCycle: text,
    stockQuantity: numberOrText, pricePerMeter: numberOrText, minimumOrderQuantity: numberOrText, leadTimeDays: numberOrText,
    sampleAvailability: text, city: text, locationState: text, description: text, fabricCollectionName: text,
    finishOptions: z.array(z.string()).optional(), imageUrl: text,
    sourceSheet: z.string().max(255).optional(), sourceRowNumber: z.number().int().positive().optional(),
    clientRowId: z.string().max(300).optional(),
    sourceRawCells: z.array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])).optional(),
    defaultedFields: z.array(z.string()).optional(),
}).transform((row, ctx) => {
    const validated = validateExcelRow(row, row.sourceRowNumber ?? 1);
    if (validated.status !== "ready") {
        for (const issue of validated.issues) ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
        return z.NEVER;
    }
    const count = String(validated.data.count ?? "").trim();
    const construction = String(validated.data.construction ?? "").trim();
    const combined = count && construction ? (construction.includes(count) ? construction : count + " / " + construction) : construction || count || undefined;
    return { ...row, ...validated.data, construction: combined } as ExcelCatalogRowMapped & {
        fabricName: string; gsm: number; widthInches: number; weightValue: number; widthValue: number;
        pricePerMeter: number; minimumOrderQuantity: number; leadTimeDays: number; stockQuantity: number;
        sourceSheet?: string; sourceRowNumber?: number; clientRowId?: string;
    };
});

export const excelImportPayloadSchema = z.object({
    rows: z.array(excelImportRowSchema).min(1, "At least one row is required for import").max(500, "Import at most 500 rows per batch"),
    skipDuplicates: z.boolean().optional().default(true),
});
export type ExcelImportPayload = z.infer<typeof excelImportPayloadSchema>;
