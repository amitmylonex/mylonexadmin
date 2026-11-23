import Image from "../Image";
import { SUPPLIER_FINISH_OPTIONS } from "../../constants";
import ImageUploader from "../ImageUploader";
import { isFieldDisabled } from "../field-visibility";
import ShadeCardEditor from "./ShadeCardEditor";
import type { CatalogDraft, DraftUpdater, FabricState } from "./types";

const STATES: Array<{ value: FabricState; label: string; detail: string }> = [
    { value: "greige", label: "Greige", detail: "Loom-state, undyed" },
    { value: "rfd", label: "RFD", detail: "Ready for dyeing" },
    { value: "dyed", label: "Dyed", detail: "Yarn or piece dyed" },
    { value: "printed", label: "Printed", detail: "RFD or colour print" },
];

type Props = {
    draft: CatalogDraft;
    update: DraftUpdater;
    uploadEndpoint: string;
    legacyColorOptions?: string[];
    legacyImageUrls?: string[];
};

export default function FabricStateSection({ draft, update, uploadEndpoint, legacyColorOptions = [], legacyImageUrls = [] }: Props) {
    const hasVariants = draft.fabricState === "dyed" || draft.fabricState === "printed";
    function toggleFinish(finish: string) {
        update("finishOptions", draft.finishOptions.includes(finish)
            ? draft.finishOptions.filter((item) => item !== finish)
            : [...draft.finishOptions, finish]);
    }

    return (
        <section className="catalog-form-section" aria-labelledby="fabric-state-heading">
            <div className="catalog-section-heading">
                <span>02</span><h2 id="fabric-state-heading">Fabric state</h2><p>select one</p>
            </div>
            {!draft.fabricState && (
                <div className="legacy-variant-notice" role="status">
                    <div>
                        <strong>Legacy listing — fabric state not set</strong>
                        <p>Select a state before saving. Existing colours and images stay unchanged unless you edit the shade card.</p>
                    </div>
                    {legacyColorOptions.length > 0 && (
                        <div className="legacy-colors" aria-label="Existing colours">
                            {legacyColorOptions.slice(0, 6).map((color) => <span key={color}>{color}</span>)}
                            {legacyColorOptions.length > 6 && <span>+{legacyColorOptions.length - 6}</span>}
                        </div>
                    )}
                    {legacyImageUrls.length > 0 && (
                        <div className="legacy-images" aria-label="Existing fabric images">
                            {legacyImageUrls.slice(0, 3).map((url, index) => <Image key={url} src={url} alt={`Existing fabric image ${index + 1}`} width={96} height={72} unoptimized />)}
                            {legacyImageUrls.length > 3 && <span>+{legacyImageUrls.length - 3} images</span>}
                        </div>
                    )}
                </div>
            )}
            <div className="fabric-state-grid" role="radiogroup" aria-label="Fabric state">
                {STATES.map((state) => (
                    <button
                        key={state.value}
                        type="button"
                        role="radio"
                        aria-checked={draft.fabricState === state.value}
                        className={draft.fabricState === state.value ? "is-selected" : ""}
                        onClick={() => update("fabricState", state.value)}
                    >
                        <i aria-hidden="true" /><span><strong>{state.label}</strong><small>{state.detail}</small></span>
                    </button>
                ))}
            </div>

            {!isFieldDisabled("dyeMethod") && draft.fabricState === "dyed" && (
                <div className="dye-method-row">
                    <strong>Dye method</strong>
                    <div role="radiogroup" aria-label="Dye method">
                        <button type="button" role="radio" aria-checked={draft.dyeMethod === "yarn_dyed"} className={draft.dyeMethod === "yarn_dyed" ? "is-selected" : ""} onClick={() => update("dyeMethod", "yarn_dyed")}>Yarn dyed</button>
                        <button type="button" role="radio" aria-checked={draft.dyeMethod === "piece_dyed"} className={draft.dyeMethod === "piece_dyed" ? "is-selected" : ""} onClick={() => update("dyeMethod", "piece_dyed")}>Piece dyed</button>
                    </div>
                    <span>{draft.dyeMethod === "piece_dyed" ? "solid shades dyed after weaving" : "coloured yarns woven into the fabric"}</span>
                </div>
            )}

            {hasVariants && <ShadeCardEditor shades={draft.shadeVariants} onChange={(value) => update("shadeVariants", value)} uploadEndpoint={uploadEndpoint} />}

            {(draft.fabricState === "greige" || draft.fabricState === "rfd") && (
                <div className="catalog-fabric-images">
                    <ImageUploader
                        label="Fabric images"
                        value={draft.imageUrls}
                        onChange={(value) => update("imageUrls", value)}
                        uploadEndpoint={uploadEndpoint}
                    />
                    <p>Optional for publishing, but the first image becomes the buyer-facing catalog preview.</p>
                </div>
            )}

            <div className="finish-row">
                <div><strong>Finishing</strong><span>optional · applies to the whole fabric</span></div>
                <div className="finish-options">
                    {SUPPLIER_FINISH_OPTIONS.map((finish) => (
                        <button key={finish} type="button" aria-pressed={draft.finishOptions.includes(finish)} className={draft.finishOptions.includes(finish) ? "is-selected" : ""} onClick={() => toggleFinish(finish)}>{finish}</button>
                    ))}
                </div>
            </div>
        </section>
    );
}
