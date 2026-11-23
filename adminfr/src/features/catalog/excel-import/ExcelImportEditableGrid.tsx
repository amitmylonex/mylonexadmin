"use client";
import "./catalog-review.css";
import { useState, useEffect, type KeyboardEvent } from "react";
import { CATALOG_EDITOR_FIELDS, getProposedDefaults } from "../excel/fields";
import type { DetectedColumn, ExcelCatalogRowMapped, FieldMappingSuggestion } from "../excel/types";
import ExcelImportToolbar from "./ExcelImportToolbar";
import ExcelImportEditableRow from "./ExcelImportEditableRow";
import ExcelImportMobileRow from "./ExcelImportMobileRow";
import type { RowProps } from "./ExcelImportRowFields";
import type { ExcelStagedRow } from "../excel/types";
export const CATALOG_PARAM_COLUMNS = CATALOG_EDITOR_FIELDS;
interface Props extends Omit<RowProps, "row"> {
    rows: ExcelStagedRow[]; mappings: FieldMappingSuggestion[]; detectedColumns?: DetectedColumn[];
    activeFilter: "all" | "ready" | "issues"; onFilterChange: (_filter: "all" | "ready" | "issues") => void;
    onAddRow: () => void;
    onConfirmAllDefaults: () => void;
    onMappingChange?: (_field: keyof ExcelCatalogRowMapped, _index: number | null) => void;
    onBackToMapping: () => void; onContinueToPreview: () => void;
}
export default function ExcelImportEditableGrid(props: Props) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
    useEffect(() => {
        const media = window.matchMedia("(min-width: 768px)");
        const update = () => setDesktop(media.matches);
        media.addEventListener("change", update); return () => media.removeEventListener("change", update);
    }, []);
    const visible = props.rows.filter(row => (props.activeFilter === "all" || (props.activeFilter === "ready" ? row.status === "ready" : row.status !== "ready")) &&
        (!search || JSON.stringify([row.data, row.sourceSheet, row.sourceRowNumber]).toLowerCase().includes(search.toLowerCase())));
    const defaults = props.rows.filter(row => getProposedDefaults(row.data).length > 0);
    const pages = Math.max(1, Math.ceil(visible.length / 25));
    const currentPage = Math.min(page, pages);
    const pageRows = visible.slice((currentPage - 1) * 25, currentPage * 25);
    const revealAddedRow = () => { props.onFilterChange("all"); setSearch(""); setPage(Math.ceil((props.rows.length + 1) / 25)); };
    const rowActions = { ...props, onDuplicateRow: (id: string) => { props.onDuplicateRow(id); revealAddedRow(); } };
    const keyboard = (event: KeyboardEvent<HTMLTableElement>) => {
        if (event.key !== "Enter" && !(event.altKey && event.key.startsWith("Arrow"))) return;
        const target = event.target as HTMLElement;
        if (!target.matches("input,select")) return;
        const cell = target.closest("td"), row = cell?.parentElement;
        if (!cell || !row) return;
        const rows = Array.from(event.currentTarget.tBodies[0].rows);
        const nextRow = rows.indexOf(row as HTMLTableRowElement) + (event.key === "ArrowUp" || event.key === "Enter" && event.shiftKey ? -1 : event.key === "ArrowDown" || event.key === "Enter" ? 1 : 0);
        const nextColumn = Array.from(row.children).indexOf(cell) + (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0);
        const next = rows[nextRow]?.cells[nextColumn]?.querySelector<HTMLElement>("input,select");
        if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    };
    return <div className="catalog-review-workspace space-y-4 min-w-0">
        <ExcelImportToolbar totalRows={props.rows.length} readyCount={props.rows.filter(r => r.status === "ready").length}
            issuesCount={props.rows.filter(r => r.status !== "ready").length} editedCount={props.rows.filter(r => r.isEdited).length}
            activeFilter={props.activeFilter} onFilterChange={filter => { props.onFilterChange(filter); setPage(1); }}
            searchQuery={search} onSearchChange={value => { setSearch(value); setPage(1); }} onAddRowClick={() => { props.onAddRow(); revealAddedRow(); }}
            onBackToMapping={props.onBackToMapping} onContinueToPreview={props.onContinueToPreview} canContinue={props.rows.length > 0} />
        {!!defaults.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{defaults.length} rows have proposed defaults. Review the proposed values before confirming.</p>
            <details className="mt-2"><summary className="cursor-pointer">Review proposed defaults</summary><ul className="my-2 text-xs space-y-1">{defaults.map(row => <li key={row.id}>{row.sourceSheet || "Manual"} · row {row.sourceRowNumber ?? row.rowNumber}: {getProposedDefaults(row.data).map(([key, value]) => `${key}: ${value}`).join(", ")}</li>)}</ul>
                <button type="button" className="btn-outline text-xs" onClick={props.onConfirmAllDefaults}>Confirm listed defaults for all rows</button>
            </details>
        </div>}
        <p className="text-xs text-slate-600">Source coordinates remain fixed when rows are removed. Original cells remain available for remapping. Proposed defaults need confirmation.</p>
        <p className="text-xs text-slate-600">Mapped Warp/Weft supply labelled Count text only when Count is blank. Mapped GLM supplies Weight only when the primary weight is blank; GSM is calculated using the entered full fabric width.</p>
        <p id="catalog-review-keyboard" className="sr-only">Use Enter / Shift+Enter to move between rows, or Alt+Arrow keys between cells.</p>
        {desktop ? <div className="catalog-review-scroll"><table aria-label="Editable fabric catalog" aria-describedby="catalog-review-keyboard" onKeyDown={keyboard} className="catalog-review-table text-left text-xs">
            <thead className="bg-slate-100"><tr>{CATALOG_EDITOR_FIELDS.map(field => {
                const mapping = props.mappings.find(m => m.targetFieldKey === field.key);
                return <th key={field.key} className="catalog-review-column border-r border-slate-200 align-top">
                    <span className="block mb-2">{field.label}</span>
                    <select aria-label={field.label + " source column"} className="catalog-review-mapping rounded border bg-white font-normal"
                        value={mapping?.supplierColumnIndex ?? ""} onChange={e => props.onMappingChange?.(field.key, e.target.value === "" ? null : Number(e.target.value))}>
                        <option value="">Not mapped</option>{props.detectedColumns?.map(c => <option key={c.index} value={c.index}>{c.rawHeader}</option>)}
                    </select>
                    {mapping?.confidence === "review" && <button type="button" className="block mt-1 text-amber-800 underline" onClick={() => props.onMappingChange?.(field.key, mapping.supplierColumnIndex)}>Confirm suggestion</button>}
                </th>;
            })}<th className="catalog-review-column">Row review</th></tr></thead>
            <tbody className="divide-y divide-slate-200">{pageRows.map(row => <ExcelImportEditableRow key={row.id} {...rowActions} row={row} />)}</tbody>
        </table></div> : <div className="space-y-3">{pageRows.map(row => <ExcelImportMobileRow key={row.id} {...rowActions} row={row} />)}</div>}
        {pages > 1 && <div className="flex items-center justify-end gap-3 text-xs"><button className="btn-outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous rows</button><span>Review page {currentPage} of {pages}</span><button className="btn-outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next rows</button></div>}
        {!visible.length && <p className="p-6 text-center text-sm text-slate-500">No matching rows.</p>}
    </div>;
}

