import Image from "../Image";
import { isFieldDisabled } from "../field-visibility";
import type { CatalogDraft } from "./types";

type Props = { draft: CatalogDraft };

function CheckItem({
    complete,
    label,
    detail,
    optional = false,
}: {
    complete: boolean;
    label: string;
    detail?: string;
    optional?: boolean;
}) {
    return (
        <li
            className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                complete
                    ? "border-emerald-200 bg-emerald-50/40 text-slate-800"
                    : "border-border bg-white text-slate-600"
            }`}
        >
            <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none ${
                    complete
                        ? "bg-emerald-600 text-white"
                        : "border-2 border-slate-300 text-slate-400 bg-white"
                }`}
                aria-hidden="true"
            >
                {complete ? "✓" : "○"}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${complete ? "text-slate-900" : "text-slate-700"}`}>
                        {label}
                    </span>
                    <span
                        className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                            complete
                                ? "bg-emerald-100 text-emerald-800"
                                : optional
                                ? "bg-slate-100 text-slate-500"
                                : "bg-amber-100 text-amber-800"
                        }`}
                    >
                        {complete ? "Ready" : optional ? "Optional" : "Required"}
                    </span>
                </div>
                {detail && (
                    <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                        {detail}
                    </p>
                )}
            </div>
        </li>
    );
}

export function BuyerPreviewCard({ draft }: Props) {
    const firstShade = draft.shadeVariants[0];
    const previewImage = firstShade?.imageUrl || draft.imageUrls[0];
    const stateLabel = !draft.fabricState ? "Not classified" : (!isFieldDisabled("dyeMethod") && draft.fabricState === "dyed" && draft.dyeMethod)
        ? `${draft.fabricState} · ${draft.dyeMethod.replace("_", " ")}`
        : draft.fabricState;

    return (
        <section className="buyer-preview rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
            <header className="flex min-h-[44px] items-center gap-2 border-b border-border px-4 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50/70">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live Buyer Preview
            </header>
            <div className="flex flex-col sm:flex-row items-stretch">
                <div className="w-full sm:w-56 md:w-64 h-48 sm:h-auto shrink-0 relative bg-slate-100 flex items-center justify-center overflow-hidden border-b sm:border-b-0 sm:border-r border-border">
                    {previewImage ? (
                        <Image src={previewImage} alt={firstShade ? `${firstShade.name} preview` : "Fabric preview"} fill className="object-cover" unoptimized />
                    ) : (
                        <div className="w-full h-full min-h-[160px] flex items-center justify-center p-4 text-center" style={firstShade?.colorHex ? { backgroundColor: firstShade.colorHex } : undefined}>
                            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs border border-slate-200">
                                {firstShade ? "No image set" : "Preview appears here"}
                            </span>
                        </div>
                    )}
                </div>
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 min-w-0">
                    <div className="space-y-2">
                        <span className="inline-block rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                            {stateLabel.replace(/_/g, " ")}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 truncate">
                            {draft.fabricName.trim() || "Untitled fabric"}
                        </h3>
                        <p className="text-sm font-medium text-slate-600 truncate">
                            {draft.composition.trim() || `${draft.gsm || "—"} GSM · ${draft.widthInches || "—"} in`}
                        </p>
                        {draft.construction && (
                            <p className="text-xs text-slate-500 truncate">
                                Construction: {draft.construction} · Weave: {draft.weaveType}
                            </p>
                        )}
                        {draft.pricePerMeter && (
                            <p className="text-base font-bold text-primary">
                                ₹{draft.pricePerMeter} <span className="text-xs font-normal text-slate-500">/ meter</span>
                            </p>
                        )}
                    </div>
                    <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
                        <span><b className="text-slate-800">{draft.shadeVariants.length}</b> {draft.shadeVariants.length === 1 ? "shade" : "variants"}</span>
                        <span className="truncate">{draft.fabricCollectionName ? `Collection: ${draft.fabricCollectionName}` : "Individual fabric"}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function BeforePublishChecklist({ draft }: Props) {
    const commercialComplete = Boolean(draft.minimumOrderQuantity && draft.leadTimeDays && draft.pricePerMeter);
    const needsShades = draft.fabricState === "dyed" || draft.fabricState === "printed";
    const allHaveImages = draft.shadeVariants.length > 0 && draft.shadeVariants.every((shade) => shade.imageUrl);

    return (
        <section className="publish-checklist rounded-xl border border-border bg-slate-50/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Before Publish Checklist</h3>
                <span className="text-xs text-slate-500 font-medium">Validation status</span>
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <CheckItem
                    complete={Boolean(draft.fabricName.trim())}
                    label="Fabric name"
                    detail={draft.fabricName.trim() ? draft.fabricName : "Enter a quality title"}
                />
                <CheckItem
                    complete={Boolean(draft.fabricState) && (draft.fabricState !== "dyed" || isFieldDisabled("dyeMethod") || Boolean(draft.dyeMethod))}
                    label="Fabric state"
                    detail={draft.fabricState ? `Selected: ${draft.fabricState}` : "Choose greige, RFD, dyed, or printed"}
                />
                <CheckItem
                    complete={!needsShades || draft.shadeVariants.length > 0}
                    label={needsShades ? "Shade variants" : "Variant requirement"}
                    detail={needsShades ? `${draft.shadeVariants.length} shades added` : "Sells as-is — no variants needed"}
                />
                <CheckItem
                    complete={draft.shadeVariants.length ? allHaveImages : draft.imageUrls.length > 0}
                    label="Fabric imagery"
                    detail={draft.shadeVariants.length ? "Variant photography" : "Cover photo upload"}
                    optional
                />
                <CheckItem
                    complete={commercialComplete}
                    label="MOQ & commercials"
                    detail={commercialComplete ? `MOQ: ${draft.minimumOrderQuantity}m · ₹${draft.pricePerMeter}/m` : "Specify MOQ, lead time, and price"}
                />
            </ul>
        </section>
    );
}

export default function BuyerPreview({ draft }: Props) {
    return (
        <aside className="catalog-preview-column" aria-label="Buyer preview and publishing checklist">
            <BuyerPreviewCard draft={draft} />
            <BeforePublishChecklist draft={draft} />
        </aside>
    );
}
