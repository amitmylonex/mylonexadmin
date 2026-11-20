import { SUPPLIER_CATALOG_FABRIC_TYPES, SUPPLIER_WEAVE_TYPES } from "../../constants";
import type { CatalogDraft, DraftUpdater } from "./types";

type Props = { draft: CatalogDraft; update: DraftUpdater };

export default function SpecificationSection({ draft, update }: Props) {
    return (
        <section className="catalog-form-section" aria-labelledby="fabric-specification-heading">
            <div className="catalog-section-heading">
                <span>01</span>
                <h2 id="fabric-specification-heading">Fabric specification</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="catalog-field md:col-span-2">
                    <span>Fabric name <b>*</b></span>
                    <input value={draft.fabricName} onChange={(event) => update("fabricName", event.target.value)} placeholder="Cambric 40×40" required />
                </label>
                <label className="catalog-field">
                    <span>Material</span>
                    <select value={draft.fabricType} onChange={(event) => update("fabricType", event.target.value)}>
                        {SUPPLIER_CATALOG_FABRIC_TYPES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
                    </select>
                </label>
                <label className="catalog-field">
                    <span>Blend / composition</span>
                    <input value={draft.composition} onChange={(event) => update("composition", event.target.value)} placeholder="100% Cotton" />
                </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <label className="catalog-field">
                    <span>Construction</span>
                    <input value={draft.construction} onChange={(event) => update("construction", event.target.value)} placeholder="142 × 72" />
                </label>
                <label className="catalog-field">
                    <span>Weave</span>
                    <input list="catalog-weave-options" value={draft.weaveType} onChange={(event) => update("weaveType", event.target.value)} required />
                    <datalist id="catalog-weave-options">{SUPPLIER_WEAVE_TYPES.map(item=><option key={item} value={item}/>)}</datalist>
                </label>
                <label className="catalog-field">
                    <span>GSM <b>*</b></span>
                    <div className="catalog-unit-input"><input type="number" min="1" value={draft.gsm} onChange={(event) => update("gsm", event.target.value)} placeholder="100" required /><em>g/m²</em></div>
                </label>
                <label className="catalog-field">
                    <span>Width</span>
                    <div className="catalog-unit-input"><input type="number" min="1" step="0.01" value={draft.widthInches} onChange={(event) => update("widthInches", event.target.value)} placeholder="58" /><em>in</em></div>
                </label>
                <label className="catalog-field">
                    <span>Material type</span>
                    <select value={draft.materialPurity} onChange={(event) => update("materialPurity", event.target.value as CatalogDraft["materialPurity"])}>
                        <option value="pure">Pure</option>
                        <option value="blended">Blended</option>
                    </select>
                </label>
                {draft.materialPurity === "blended" && (
                    <label className="catalog-field">
                        <span>Blend description <b>*</b></span>
                        <input value={draft.blendDescription} onChange={(event) => update("blendDescription", event.target.value)} placeholder="65% Polyester, 35% Cotton" required />
                    </label>
                )}
            </div>
            <label className="catalog-field">
                <span>Buyer notes</span>
                <textarea rows={3} value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Add anything a buyer should know about this quality." />
            </label>
        </section>
    );
}
