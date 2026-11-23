"use client";
import { CATALOG_EDITOR_FIELDS } from "../excel/fields";
import { CatalogField, RowActions, type RowProps } from "./ExcelImportRowFields";
export default function ExcelImportEditableRow(props: RowProps) {
    return <tr className="catalog-review-row align-top">
        {CATALOG_EDITOR_FIELDS.map(field => <td key={field.key} className="catalog-review-cell border-r border-slate-200"><CatalogField {...props} field={field} /></td>)}
        <td className="catalog-review-cell"><RowActions {...props} /></td>
    </tr>;
}

