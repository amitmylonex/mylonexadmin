"use client";

import { useId, useRef, useState } from "react";
import type { ExcelCellMeta, ExcelRowIssue } from "../excel/types";

interface ExcelImportEditableCellProps {
    rowId: string;
    fieldKey: string;
    currentValue: unknown;
    originalValue: unknown;
    cellMeta?: ExcelCellMeta;
    isEdited?: boolean;
    isManuallyAdded?: boolean;
    issue?: ExcelRowIssue;
    type?: "text" | "number" | "select";
    options?: { label: string; value: string }[];
    placeholder?: string;
    hidePlaceholder?: boolean;
    prefix?: string;
    badgeText?: string;
    onChange: (_value: unknown) => void;
    onReset?: () => void;
}

// ── Traceability Popover ────────────────────────────────────────────────────

interface TracePopoverProps {
    cellMeta: ExcelCellMeta;
    currentDisplayValue: string;
    fieldKey: string;
}

function TracePopover({ cellMeta, currentDisplayValue, fieldKey: _fieldKey }: TracePopoverProps) {
    const isRange = Boolean(cellMeta.isRange);
    const isOpenEnded = Boolean((cellMeta as Record<string, unknown>).isOpenEnded);
    const hasEditedValue =
        cellMeta.originalRaw !== undefined &&
        cellMeta.originalRaw !== null &&
        String(cellMeta.originalRaw).trim() !== "" &&
        String(cellMeta.originalRaw).trim() !== currentDisplayValue.trim();

    // Determine detected type label
    let detectedTypeLabel = "Scalar";
    if (isOpenEnded) detectedTypeLabel = "Open-ended range";
    else if (isRange) detectedTypeLabel = "Range";

    return (
        <div
            className="absolute bottom-full left-0 mb-1.5 z-50 w-72 rounded-xl bg-slate-900 text-slate-100 shadow-2xl border border-slate-700 pointer-events-auto overflow-hidden"
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/80 bg-slate-800/60">
                <span className="text-[11px] font-bold text-white tracking-wide">Value Traceability</span>
                <div className="flex items-center gap-1">
                    {isOpenEnded && (
                        <span className="text-[9px] font-semibold bg-purple-500/25 text-purple-300 px-1.5 py-0.5 rounded">
                            Open-ended
                        </span>
                    )}
                    {isRange && !isOpenEnded && (
                        <span className="text-[9px] font-semibold bg-amber-500/25 text-amber-300 px-1.5 py-0.5 rounded">
                            Range
                        </span>
                    )}
                    {hasEditedValue && (
                        <span className="text-[9px] font-semibold bg-blue-500/25 text-blue-300 px-1.5 py-0.5 rounded">
                            Edited
                        </span>
                    )}
                </div>
            </div>

            {/* Rows */}
            <div className="px-3 py-2.5 space-y-2 text-[11px]">
                {/* Excel Value */}
                {cellMeta.originalRaw !== undefined && (
                    <div className="flex justify-between gap-2 items-start">
                        <span className="text-slate-400 shrink-0">Excel Value</span>
                        <span className="font-mono text-slate-200 text-right">{String(cellMeta.originalRaw)}</span>
                    </div>
                )}

                {/* Current (if edited) */}
                {hasEditedValue && (
                    <div className="flex justify-between gap-2 items-start">
                        <span className="text-slate-400 shrink-0">Current Value</span>
                        <span className="font-mono text-blue-300 text-right">{currentDisplayValue}</span>
                    </div>
                )}

                {/* Detected type */}
                <div className="flex justify-between gap-2 items-start">
                    <span className="text-slate-400 shrink-0">Detected Type</span>
                    <span className="text-slate-200 text-right">{detectedTypeLabel}</span>
                </div>

                {/* Unit */}
                {cellMeta.detectedUnit && (
                    <div className="flex justify-between gap-2 items-start">
                        <span className="text-slate-400 shrink-0">Unit</span>
                        <span className="text-slate-200 text-right">{cellMeta.detectedUnit}</span>
                    </div>
                )}

                {/* Range row */}
                {(isRange || isOpenEnded) && (
                    <div className="flex justify-between gap-2 items-start">
                        <span className="text-slate-400 shrink-0">Range</span>
                        <span className="text-amber-300 text-right font-medium">
                            {isOpenEnded
                                ? `${cellMeta.min?.toLocaleString() ?? "?"} ${cellMeta.detectedUnit ?? ""} minimum (no maximum)`
                                : cellMeta.min !== undefined && cellMeta.max !== undefined
                                ? `${cellMeta.min.toLocaleString()} – ${cellMeta.max.toLocaleString()} ${cellMeta.detectedUnit ?? ""}`
                                : cellMeta.rangeText ?? cellMeta.displayValue ?? "—"}
                        </span>
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-slate-700/60" />

                {/* DB value */}
                <div className="flex justify-between gap-2 items-start">
                    <span className="text-slate-400 shrink-0">Database Value</span>
                    <span className="font-bold text-emerald-400 text-right">
                        {cellMeta.normalizedValue !== undefined && cellMeta.normalizedValue !== null
                            ? `${String(cellMeta.normalizedValue)} ${cellMeta.detectedUnit ?? ""}`
                            : currentDisplayValue || "—"}
                    </span>
                </div>

                {/* Interpretation */}
                {cellMeta.interpretation && (
                    <div className="pt-1 border-t border-slate-700/40">
                        <p className="text-[10px] text-slate-400 leading-snug">{cellMeta.interpretation}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Cell ────────────────────────────────────────────────────────────────

export default function ExcelImportEditableCell({
    fieldKey: _fieldKey,
    currentValue,
    originalValue,
    cellMeta,
    isEdited = false,
    isManuallyAdded = false,
    issue,
    type = "text",
    options,
    placeholder = "—",
    hidePlaceholder = false,
    prefix,
    badgeText,
    onChange,
    onReset,
}: ExcelImportEditableCellProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [showTraceTooltip, setShowTraceTooltip] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [draftValue, setDraftValue] = useState("");
    const inputId = useId();
    const traceRef = useRef<HTMLDivElement>(null);

    const hasError = issue?.severity === "error";
    const hasWarning = issue?.severity === "warning";

    const displayValue = currentValue === undefined || currentValue === null ? "" : String(currentValue);
    const beginEditing = () => { setDraftValue(displayValue); setIsFocused(true); };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDraftValue(val);
        if (val === "") {
            onChange("");
        } else {
            const num = Number(val);
            onChange(isNaN(num) ? val : num);
        }
    };

    // ── Compact range badge data ─────────────────────────────────────────
    const isRange = Boolean(cellMeta?.isRange);
    const isOpenEnded = Boolean((cellMeta as Record<string, unknown> | undefined)?.isOpenEnded);
    const hasDifferentOriginal =
        cellMeta?.originalRaw !== undefined &&
        cellMeta.originalRaw !== null &&
        String(cellMeta.originalRaw).trim() !== "" &&
        String(cellMeta.originalRaw).trim() !== displayValue.trim();

    // Badge label: show the compact range/original notice
    let compactBadge: string | undefined;
    if (badgeText) {
        compactBadge = badgeText;
    } else if (isOpenEnded) {
        compactBadge = cellMeta?.rangeText ?? "Open-ended";
    } else if (isRange) {
        // Prefer clean rangeText (e.g. "10,000–20,000 m") over raw supplier text
        compactBadge = cellMeta?.rangeText ?? String(cellMeta?.originalRaw ?? cellMeta?.displayValue ?? "range");
    } else if (cellMeta?.rangeText) {
        // Non-isRange but has a rangeText (e.g. unit conversions like "56 days (8 WEEKS)")
        compactBadge = cellMeta.rangeText;
    } else if (hasDifferentOriginal) {
        compactBadge = `Orig: ${String(cellMeta?.originalRaw).trim()}`;
    }

    const hasTraceInfo = Boolean(
        cellMeta &&
            (cellMeta.originalRaw !== undefined ||
                cellMeta.isRange ||
                cellMeta.interpretation ||
                cellMeta.normalizedValue !== undefined)
    );

    const inputBorderClass = hasError
        ? "border-rose-500 bg-rose-50/50 text-rose-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-200"
        : hasWarning
        ? "border-amber-400 bg-amber-50/40 text-amber-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        : isEdited
        ? "border-blue-400 bg-blue-50/30 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

    return (
        <div
            className="group/cell relative flex flex-col justify-center min-h-[44px] w-full px-2 py-1.5"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                // Don't close popover on mouse leave from cell — only close via button
            }}
        >
            {/* Input row */}
            <div className="relative flex items-center w-full">
                {prefix && (
                    <span className="absolute left-2 text-slate-500 font-semibold pointer-events-none text-xs z-10">
                        {prefix}
                    </span>
                )}
                {type === "select" ? (
                    <select
                        id={inputId} aria-label={_fieldKey}
                        value={displayValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full rounded-md border text-xs py-1.5 ${prefix ? "pl-5 pr-2" : "px-2"} font-medium transition-all focus:outline-hidden ${inputBorderClass}`}
                        aria-invalid={hasError}
                    >
                        {!hidePlaceholder && <option value="">{placeholder}</option>}
                        {options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ) : type === "number" ? (
                    <input
                        id={inputId} aria-label={_fieldKey}
                        type="number"
                        value={isFocused ? draftValue : displayValue}
                        onFocus={beginEditing}
                        onBlur={() => setIsFocused(false)}
                        onChange={handleNumberChange}
                        placeholder={placeholder}
                        className={`w-full rounded-md border text-xs py-1.5 ${prefix ? "pl-5 pr-2" : "px-2"} font-medium transition-all focus:outline-hidden ${inputBorderClass}`}
                        aria-invalid={hasError}
                    />
                ) : (
                    <input
                        id={inputId} aria-label={_fieldKey}
                        type="text"
                        value={isFocused ? draftValue : displayValue}
                        onFocus={beginEditing}
                        onBlur={() => setIsFocused(false)}
                        onChange={(e) => { setDraftValue(e.target.value); onChange(e.target.value); }}
                        placeholder={placeholder}
                        className={`w-full rounded-md border text-xs py-1.5 ${prefix ? "pl-5 pr-2" : "px-2"} font-medium transition-all focus:outline-hidden ${inputBorderClass}`}
                        aria-invalid={hasError}
                    />
                )}

                {/* Reset button — hover only */}
                {isEdited && !isManuallyAdded && onReset && isHovered && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReset();
                        }}
                        title={`Reset to original: "${String(originalValue ?? "")}"`}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200 border border-slate-300 shadow-2xs z-10"
                        aria-label="Reset value"
                    >
                        ↺
                    </button>
                )}
            </div>

            {/* Compact range / traceability badge row */}
            {(compactBadge || hasTraceInfo) && (
                <div className="mt-0.5 flex items-center gap-1 flex-nowrap overflow-hidden" ref={traceRef}>
                    {/* Compact badge */}
                    {compactBadge && (
                        <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0 max-w-[130px] truncate ${
                                isOpenEnded
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : isRange
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                        >
                            <span
                                className={`shrink-0 font-black text-[8px] ${
                                    isOpenEnded ? "text-purple-400" : isRange ? "text-amber-500" : "text-indigo-400"
                                }`}
                            >
                                ●
                            </span>
                            <span className="truncate">{compactBadge}</span>
                        </span>
                    )}

                    {/* ⓘ trace icon */}
                    {hasTraceInfo && cellMeta && (
                        <div className="relative inline-flex items-center shrink-0">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowTraceTooltip((prev) => !prev);
                                }}
                                className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 text-[9px] font-bold border border-slate-200 hover:border-blue-300 transition-colors cursor-help"
                                title="View value traceability"
                                aria-label="Value trace info"
                            >
                                ⓘ
                            </button>

                            {showTraceTooltip && (
                                <>
                                    {/* Click-outside overlay */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowTraceTooltip(false)}
                                    />
                                    <TracePopover
                                        cellMeta={cellMeta}
                                        currentDisplayValue={displayValue}
                                        fieldKey={_fieldKey}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Error/warning message — only for actual errors, kept concise */}
            {issue && (
                <div
                    className={`mt-0.5 text-[10px] leading-tight font-medium ${
                        hasError ? "text-rose-600" : "text-amber-600"
                    }`}
                    title={issue.message}
                >
                    {/* Only show the first ~60 chars inline; full message is in title */}
                    {issue.message.length > 60
                        ? issue.message.slice(0, 58) + "…"
                        : issue.message}
                </div>
            )}
        </div>
    );
}

