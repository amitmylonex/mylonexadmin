"use client";
import { useState } from "react";
import type { ExcelImportBatchResult, ExcelStagedRow } from "../excel/types";
import { excelImportPayloadSchema } from "../excel/row-schema";
import { buildImportPayloadRow } from "../excel/staging";
import { apiRequest } from "../../../lib/api";
import { Dialog } from "../../../components/ui/Dialog";

interface Props {
    isOpen: boolean;
    rows: ExcelStagedRow[];
    supplierName?: string;
    apiBasePath: string;
    onClose: () => void;
    onBackToEdit: () => void;
    onResetToUpload: () => void;
    onImportSuccess?: (_result: ExcelImportBatchResult) => void;
}

export default function ExcelImportConfirmPanel(props: Props) {
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<ExcelImportBatchResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!props.isOpen) return null;

    const payload = { rows: props.rows.map(buildImportPayloadRow), skipDuplicates: true };
    const validated = excelImportPayloadSchema.safeParse(payload);

    const publish = async () => {
        if (!validated.success || saving || result) return;
        setSaving(true);
        setError(null);
        try {
            const endpoint = `${props.apiBasePath}/excel-import`;
            const json = await apiRequest<any>(endpoint, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const resData = json.data || json;
            setResult(resData);
            props.onImportSuccess?.(resData);
        } catch (failure: unknown) {
            setError(failure instanceof Error ? failure.message : "Could not publish catalog.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={props.isOpen} title={result ? "Import results" : "Confirm catalog publish"} onClose={props.onClose} busy={saving}>
            <div className="space-y-4">
                {error && <p role="alert" className="text-sm rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
                {result ? (
                    <>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm font-medium space-y-1">
                            <p className="text-emerald-700 font-bold">
                                {result.createdCount ?? 0} fabrics created successfully
                            </p>
                            <p className="text-slate-600">
                                {result.skippedCount ?? 0} skipped as duplicates · {result.failedCount ?? 0} failed
                            </p>
                        </div>
                        {((result.failures || []).length > 0 || (result.skipped || []).length > 0) && (
                            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-3 text-xs">
                                {[...(result.failures || []), ...(result.skipped || [])].map((item, index) => (
                                    <p key={index} className="text-slate-700">
                                        {item.sourceSheet ? `${item.sourceSheet} · ` : ""}
                                        Row {item.rowNumber}: <span className="font-semibold">{item.fabricName || "Unnamed fabric"}</span> — {item.reason}
                                    </p>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => {
                                    props.onClose();
                                }}
                            >
                                Done & Return to Catalog
                            </button>
                            <button type="button" className="btn-ghost" onClick={props.onBackToEdit}>
                                Review Staged Rows
                            </button>
                            <button type="button" className="btn-ghost" onClick={props.onResetToUpload}>
                                Import Another File
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Each successful row is saved. Duplicate names + weaves + GSMs were safely skipped.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-slate-700">
                            Supplier: <span className="font-bold text-slate-900">{props.supplierName || "Current supplier"}</span> ·{" "}
                            <span className="font-semibold text-primary">{props.rows.length} staged rows</span>
                        </p>
                        <p className="text-xs text-slate-500">
                            Exact name + weave + GSM matches are skipped; other rows create new listings. Existing listings are never overwritten.
                        </p>
                        {!validated.success && (
                            <div className="text-sm rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900 space-y-2">
                                <p className="font-semibold">Correct highlighted fields and confirm proposed defaults before publishing:</p>
                                <ul className="list-disc pl-5 text-xs space-y-1">
                                    {validated.error.issues.slice(0, 8).map((issue, index) => (
                                        <li key={index}>
                                            <span className="font-mono">{issue.path.join(".")}</span>: {issue.message}
                                        </li>
                                    ))}
                                    {validated.error.issues.length > 8 && (
                                        <li>...and {validated.error.issues.length - 8} more issues</li>
                                    )}
                                </ul>
                            </div>
                        )}
                        <div className="flex gap-2 pt-2">
                            <button type="button" disabled={saving} className="btn-ghost" onClick={props.onBackToEdit}>
                                Back to edit
                            </button>
                            <button
                                type="button"
                                disabled={!validated.success || saving}
                                className="btn-primary"
                                onClick={publish}
                            >
                                {saving ? "Saving catalog…" : "Publish catalog"}
                            </button>
                            <button type="button" disabled={saving} className="btn-ghost" onClick={props.onClose}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Dialog>
    );
}
