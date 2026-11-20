"use client";
import ExcelImportDropzone from "./ExcelImportDropzone";
import ExcelImportMappingWorkspace from "./ExcelImportMappingWorkspace";
import ExcelImportEditableGrid from "./ExcelImportEditableGrid";
import ExcelImportBuyerPreview from "./ExcelImportBuyerPreview";
import ExcelImportConfirmPanel from "./ExcelImportConfirmPanel";
import { useExcelImportWorkspace, type ImportStep } from "./useExcelImportWorkspace";

interface Props {
    supplierId: string;
    apiBasePath?: string;
    existingCatalogFabrics?: string[];
    supplierName?: string;
    onImportComplete?: () => void;
}

const EMPTY_NAMES: string[] = [];

export default function ExcelCatalogImportSection({
    supplierId,
    apiBasePath,
    existingCatalogFabrics = EMPTY_NAMES,
    supplierName,
    onImportComplete,
}: Props) {
    const effectiveBasePath = apiBasePath || `/api/v1/admin/suppliers/${supplierId}/catalog`;
    const state = useExcelImportWorkspace(existingCatalogFabrics);

    return (
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-7 shadow-xs space-y-6 min-w-0 overflow-hidden">
            <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">Import Fabrics from Excel</h2>
                <p className="text-sm text-slate-600">
                    Verify source columns, correct rows, confirm proposed defaults, and preview the saved catalog values.
                </p>
                <div className="flex flex-wrap gap-2">
                    {(["upload", "mapping", "edit", "preview"] as ImportStep[]).map((step, index) => (
                        <button
                            key={step}
                            type="button"
                            disabled={!state.workbook && step !== "upload"}
                            onClick={() => state.setImportStep(step)}
                            className={state.importStep === step ? "btn-primary" : "btn-ghost"}
                        >
                            {index + 1}. {step === "edit" ? "Review & Edit" : step === "preview" ? "Buyer Preview & Import" : step === "mapping" ? "Mapping" : "Upload"}
                        </button>
                    ))}
                </div>
            </div>

            {state.errorMessage && (
                <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
                    {state.errorMessage}
                </p>
            )}

            {state.importStep === "upload" && (
                <ExcelImportDropzone
                    onWorkbookLoaded={state.handleWorkbookLoaded}
                    onError={state.setErrorMessage}
                    templateDownloadUrl={effectiveBasePath + "/excel-template"}
                />
            )}

            {state.importStep === "mapping" && state.analysis && (
                <ExcelImportMappingWorkspace
                    filename={state.filename}
                    analysis={state.analysis}
                    mappings={state.mappings}
                    onSheetChange={state.handleSheetChange}
                    onHeaderRowChange={state.handleHeaderRowChange}
                    onMappingChange={state.handleMappingChange}
                    onContinueToPreview={() => state.setImportStep("edit")}
                    onUploadDifferentFile={state.handleUploadDifferentFile}
                />
            )}

            {state.importStep === "edit" && (
                <ExcelImportEditableGrid
                    rows={state.stagedRows}
                    mappings={state.mappings}
                    detectedColumns={state.analysis?.columns ?? []}
                    activeFilter={state.activeFilter}
                    onFilterChange={state.setActiveFilter}
                    onCellChange={state.handleCellChange}
                    onResetCell={state.handleResetCell}
                    onResetRow={state.handleResetRow}
                    onDuplicateRow={state.handleDuplicateRow}
                    onDeleteRow={state.handleDeleteRow}
                    onAddRow={state.handleAddRow}
                    onMappingChange={state.handleMappingChange}
                    onConfirmDefaults={state.handleConfirmDefaults}
                    onConfirmAllDefaults={state.handleConfirmAllDefaults}
                    onBackToMapping={() => state.setImportStep("mapping")}
                    onContinueToPreview={() => state.setImportStep("preview")}
                />
            )}

            {state.importStep === "preview" && (
                <ExcelImportBuyerPreview
                    rows={state.stagedRows}
                    onBackToEdit={() => state.setImportStep("edit")}
                    onProceedToImport={() => state.setIsConfirmOpen(true)}
                />
            )}

            <ExcelImportConfirmPanel
                key={`${state.filename}:${state.analysis?.selectedSheet}:${state.revision}`}
                isOpen={state.isConfirmOpen}
                rows={state.stagedRows}
                supplierName={supplierName}
                apiBasePath={effectiveBasePath}
                onClose={() => state.setIsConfirmOpen(false)}
                onBackToEdit={() => {
                    state.setIsConfirmOpen(false);
                    state.setImportStep("edit");
                }}
                onResetToUpload={state.handleUploadDifferentFile}
                onImportSuccess={() => {
                    onImportComplete?.();
                }}
            />
        </section>
    );
}
