import type { CatalogDraft, DraftUpdater } from "./types";

const CYCLES = [
    { value: "ready-stock", label: "Ready stock" },
    { value: "running-production", label: "Running production" },
    { value: "made-to-order", label: "Made to order" },
];

type Props = { draft: CatalogDraft; update: DraftUpdater };

export default function CommercialsSection({ draft, update }: Props) {
    return (
        <section className="catalog-form-section" aria-labelledby="commercials-heading">
            <div className="catalog-section-heading">
                <span>03</span><h2 id="commercials-heading">Commercials</h2><p>one line for every variant</p>
            </div>
            <div className="commercial-cycle" role="radiogroup" aria-label="Production availability">
                {CYCLES.map((cycle) => (
                    <button
                        key={cycle.value}
                        type="button"
                        role="radio"
                        aria-checked={draft.productionCycle === cycle.value}
                        className={draft.productionCycle === cycle.value ? "is-selected" : ""}
                        onClick={() => update("productionCycle", cycle.value)}
                    ><i aria-hidden="true" />{cycle.label}</button>
                ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <label className="catalog-field">
                    <span>MOQ <b>*</b></span>
                    <div className="catalog-unit-input"><input type="number" min="1" value={draft.minimumOrderQuantity} onChange={(event) => update("minimumOrderQuantity", event.target.value)} placeholder="1000" required /><em>m</em></div>
                </label>
                <label className="catalog-field">
                    <span>Lead time <b>*</b></span>
                    <div className="catalog-unit-input"><input type="number" min="1" value={draft.leadTimeDays} onChange={(event) => update("leadTimeDays", event.target.value)} placeholder="21" required /><em>days</em></div>
                </label>
                <label className="catalog-field">
                    <span>Base price / m <b>*</b></span>
                    <div className="catalog-unit-input"><em>₹</em><input type="number" min="0.01" step="0.01" value={draft.pricePerMeter} onChange={(event) => update("pricePerMeter", event.target.value)} placeholder="150" required /></div>
                </label>
                {draft.productionCycle === "ready-stock" && (
                    <label className="catalog-field">
                        <span>Stock quantity</span>
                        <div className="catalog-unit-input"><input type="number" min="0" value={draft.stockQuantity} onChange={(event) => update("stockQuantity", event.target.value)} placeholder="5000" /><em>m</em></div>
                    </label>
                )}
                <label className="catalog-field">
                    <span>City</span>
                    <input value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="Ahmedabad" />
                </label>
                <label className="catalog-field">
                    <span>State</span>
                    <input value={draft.locationState} onChange={(event) => update("locationState", event.target.value)} placeholder="Gujarat" />
                </label>
            </div>
        </section>
    );
}
