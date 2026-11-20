"use client";
import type { ExcelStagedRow } from "../excel/types";
import { excelImportRowSchema } from "../excel/row-schema";
import { buildImportPayloadRow } from "../excel/staging";
interface Props { rows: ExcelStagedRow[]; onBackToEdit: () => void; onProceedToImport: () => void }
export default function ExcelImportBuyerPreview({ rows, onBackToEdit, onProceedToImport }: Props) {
    return <div className="space-y-5">
        <div className="flex flex-wrap justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div><h3 className="font-bold">Catalog preview</h3><p className="mt-1 text-xs text-slate-600">Buyer titles use the generated MyloNex code after creation. No code is reserved by this preview.</p></div>
            <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={onBackToEdit}>Back to edit</button>
                <button type="button" className="btn-primary" disabled={!rows.length} onClick={onProceedToImport}>Review publish</button></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">{rows.map(row => {
            const parsed = excelImportRowSchema.safeParse(buildImportPayloadRow(row));
            const data = parsed.success ? parsed.data : null;
            const specs = data ? [
                ["Composition", data.composition],
                ["Weight", data.gsm + " GSM"], ["Width", data.widthInches + " inches"], ["Construction", data.construction],
                ["Weave", data.weaveType], ["Production cycle", data.productionCycle],
                ["Price", "INR " + data.pricePerMeter + " / m"], ["MOQ", data.minimumOrderQuantity + " m per shade"],
                ["Lead time", data.leadTimeDays + " days"], ["Finish", data.finishOptions?.join(", ")],
                ["Location", [data.city, data.locationState].filter(Boolean).join(", ")], ["Buyer notes", data.description],
            ] : [];
            return <article key={row.id} className="rounded-xl border border-slate-200 p-4 space-y-4">
                <div><h4 className="font-bold">MyloNex code assigned after publish</h4>
                    <p className="text-sm">Supplier article/name: {row.data.fabricName || "Blank (allowed)"}</p>
                    <p className="text-xs text-slate-500">{row.sourceSheet ? row.sourceSheet + " · Excel row " + row.sourceRowNumber : "Manually added row"}</p></div>
                {data ? <><dl className="grid grid-cols-2 gap-3 text-xs">{specs.filter(([,value]) => value).map(([label,value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold break-words">{value}</dd></div>)}</dl>
                    <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1"><p className="font-semibold">Saved metadata (not currently shown in buyer specifications)</p>
                        <p>Source weight: {data.weightValue} {data.weightUnit}; source width: {data.widthValue} {data.widthUnit}</p>
                        <p>Sample availability: {data.sampleAvailability}; stock: {data.stockQuantity} m; fabric state: {data.fabricState}</p>
                        {data.fabricCollectionName && <p>Collection: {data.fabricCollectionName}</p>}
                        {data.imageUrl && <p>Fabric image: {data.imageUrl}</p>}
                    </div></> : <div role="status" className="text-sm text-rose-800"><p>Resolve these issues before this row can be saved:</p><ul className="list-disc pl-5">{row.issues.map(issue => <li key={issue.field + issue.message}>{issue.message}</li>)}</ul></div>}
                <div className="text-xs text-slate-600 space-y-1"><p className="font-semibold">Normalization and confirmed defaults</p>
                    {["weightValue", "widthValue", "minimumOrderQuantity", "leadTimeDays"].map(key => {
                        const meta = row.cellMeta?.[key];
                        return meta?.originalRaw !== undefined ? <p key={key}>Source {key}: {String(meta.originalRaw)} → catalog {String(meta.normalizedValue ?? "requires review")} {meta.detectedUnit}</p> : null;
                    })}
                    {!!row.defaultedFields?.length && <p>Confirmed defaults, absent in source: {row.defaultedFields.join(", ")}</p>}
                    {row.isDuplicateInFile && <p>Exact duplicate: skipped if an earlier matching row is saved.</p>}
                </div>
            </article>;
        })}</div>
        <p className="text-xs text-slate-600">Only active entries from approved suppliers appear to buyers. Full source ranges are not stored; the existing scalar normalization remains in use.</p>
    </div>;
}

