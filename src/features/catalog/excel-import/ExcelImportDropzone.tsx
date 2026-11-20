"use client";

import { useRef, useState } from "react";
import { apiRequest } from "../../../lib/api";

interface ExcelImportDropzoneProps {
    onWorkbookLoaded: (_buffer: ArrayBuffer, _filename: string) => void;
    onError: (_message: string) => void;
    templateDownloadUrl?: string;
    isProcessing?: boolean;
}

export default function ExcelImportDropzone({
    onWorkbookLoaded,
    onError,
    templateDownloadUrl,
    isProcessing = false,
}: ExcelImportDropzoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const downloadTemplate = async () => {
        if (!templateDownloadUrl || downloading) return;
        setDownloading(true);
        try {
            const blob = await apiRequest<Blob>(templateDownloadUrl, { responseType: "blob" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url; anchor.download = "mylonex_supplier_catalog_template.xlsx";
            document.body.appendChild(anchor); anchor.click(); anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (failure) { onError(failure instanceof Error ? failure.message : "Could not download the template"); }
        finally { setDownloading(false); }
    };

    const handleFile = async (file: File) => {
        if (!file) return;

        const validExtensions = [".xlsx", ".xls", ".csv"];
        const lowerName = file.name.toLowerCase();
        const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

        if (!hasValidExt) {
            onError("Please upload a valid spreadsheet (.xlsx, .xls or .csv).");
            return;
        }

        // Limit file size to 10MB
        if (file.size > 10 * 1024 * 1024) {
            onError("File size exceeds 10MB limit. Please upload a smaller spreadsheet.");
            return;
        }

        setIsReading(true);
        try {
            const buffer = await file.arrayBuffer();
            onWorkbookLoaded(buffer, file.name);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to read file.";
            onError(`Error reading file: ${message}`);
        } finally {
            setIsReading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (isProcessing || isReading) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    return (
        <div className="space-y-4">
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={event => { if (event.target !== fileInputRef.current && !isProcessing && !isReading) fileInputRef.current?.click(); }}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-colors cursor-pointer ${
                    isDragging
                        ? "border-primary bg-primary/5"
                        : "border-slate-300 hover:border-primary/60 hover:bg-slate-50/70"
                } ${isProcessing || isReading ? "opacity-60 pointer-events-none" : ""}`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    aria-label="Supplier spreadsheet"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                    }}
                />

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                    {isReading ? (
                        <svg className="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    )}
                </div>

                <p className="text-base font-semibold text-slate-900">
                    {isReading ? "Reading Excel file..." : "Drop your supplier Excel file here, or browse"}
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Upload any supplier spreadsheet (.xlsx, .xls or .csv), up to 10 MB. Columns, headers, and sheets will be dynamically detected and mapped.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button type="button" disabled={isProcessing || isReading} onClick={event => { event.stopPropagation(); fileInputRef.current?.click(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Browse Excel File
                    </button>

                    <button
                        type="button"
                        disabled={downloading || !templateDownloadUrl}
                        onClick={(e) => {
                            e.stopPropagation();
                            void downloadTemplate();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                        title="Optional reference spreadsheet template"
                    >
                        <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {downloading ? "Downloading…" : "Download official template (.xlsx)"}
                    </button>
                </div>
            </div>
        </div>
    );
}

