"use client";
import { CATALOG_EDITOR_FIELDS } from "../excel/fields";
import { CatalogField, RowActions, type RowProps } from "./ExcelImportRowFields";
export default function ExcelImportMobileRow(props: RowProps) {
    return <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <RowActions {...props} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{CATALOG_EDITOR_FIELDS.map(field => <div key={field.key} className="block min-w-0">
            <span className="block text-xs font-semibold text-slate-700 mb-1">{field.label}</span><CatalogField {...props} field={field} />
        </div>)}</div>
    </article>;
}

