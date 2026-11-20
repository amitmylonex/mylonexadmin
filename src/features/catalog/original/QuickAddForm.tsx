import {useCatalogRequest} from "./integration";
"use client";

import { useEffect, useRef, useState } from "react";
import { useCatalogRouter as useRouter } from "./integration";
import BuyerPreview, { BuyerPreviewCard, BeforePublishChecklist } from "./catalog-form/BuyerPreview";
import CollectionSection from "./catalog-form/CollectionSection";
import CommercialsSection from "./catalog-form/CommercialsSection";
import FabricStateSection from "./catalog-form/FabricStateSection";
import SpecificationSection from "./catalog-form/SpecificationSection";
import type { CatalogDraft, DraftUpdater, FabricCollectionOption, QuickAddInitialData } from "./catalog-form/types";
import type { CreatedFabricCollection } from "./CreateCollectionForm";


type Props = {
    mode?: "create" | "edit";
    listingId?: string;
    initialData?: QuickAddInitialData;
    createdCollection?: CreatedFabricCollection | null;
    apiBasePath?: string;
    topRowCollectionSlot?: React.ReactNode;
};

function text(value?: string | number | null, fallback = "") {
    return value === null || value === undefined ? fallback : String(value);
}

function buildDraft(initial?: QuickAddInitialData): CatalogDraft {
    return {
        fabricName: text(initial?.fabricName),
        fabricType: text(initial?.fabricType, "cotton"),
        composition: text(initial?.compositionText),
        gsm: text(initial?.gsm, "100"),
        widthInches: text(initial?.widthInches, "58"),
        construction: text(initial?.construction),
        weaveType: text(initial?.weaveType, "plain"),
        fabricState: initial ? (initial.fabricState ?? "") : "greige",
        dyeMethod: initial?.dyeMethod ?? undefined,
        productionCycle: text(initial?.productionCycle, "made_to_order").replace(/_/g, "-"),
        stockQuantity: text(initial?.stockQuantity, "0"),
        pricePerMeter: text(initial?.pricePerMeter),
        minimumOrderQuantity: text(initial?.minimumOrderQuantity, "1000"),
        leadTimeDays: text(initial?.leadTimeDays, "21"),
        city: text(initial?.city),
        locationState: text(initial?.locationState),
        description: text(initial?.description),
        materialPurity: initial?.materialPurity === "blended" ? "blended" : "pure",
        blendDescription: text(initial?.blendDescription),
        finishOptions: initial?.finishOptions ?? [],
        shadeVariants: Array.isArray(initial?.shadeVariants) ? initial.shadeVariants : [],
        imageUrls: initial?.imageUrls ?? [],
        fabricCollectionName: initial?.fabricCollection?.name ?? "",
        fabricCollectionId: initial?.fabricCollection?.id ?? initial?.fabricCollectionId ?? null,
    };
}

export default function QuickAddForm({
    mode = "create",
    listingId,
    initialData,
    createdCollection,
    apiBasePath = "/api/supplier/catalog",
    topRowCollectionSlot,
}: Props) {
    const router = useRouter();
    const catalogRequest = useCatalogRequest();
    const [notice,setNotice]=useState("");
    const toast={success:setNotice};
    const [draft, setDraft] = useState<CatalogDraft>(() => buildDraft(initialData));
    const [collections, setCollections] = useState<FabricCollectionOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<string[]>([]);
    const [published, setPublished] = useState(false);
    const [shadeVariantsTouched, setShadeVariantsTouched] = useState(false);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const update: DraftUpdater = (key, value) => {
        if (key === "shadeVariants" || key === "imageUrls") setShadeVariantsTouched(true);
        if (key === "fabricState" && (value === "greige" || value === "rfd") && draft.shadeVariants.length > 0) {
            setShadeVariantsTouched(true);
        }
        setDraft((current) => ({ ...current, [key]: value }));
    };

    useEffect(() => {
        let active = true;
        async function loadCollections() {
            try {
                const response = await catalogRequest(apiBasePath);
                const json = await response.json();
                if (!response.ok || !active) return;
                setCollections((json.data?.fabricCollections ?? []).map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    imageUrl: item.imageUrl ?? null,
                    count: item._count?.catalogEntries,
                })));
            } catch {
                if (active) setError("Collections could not be loaded. You can still publish this fabric without one.");
            }
        }
        loadCollections();
        return () => { active = false; };
    }, [apiBasePath]);

    useEffect(() => {
        if (createdCollection) handleCollectionCreated(createdCollection);
    // The callback is stable for this simple synchronization case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createdCollection]);

    useEffect(() => () => {
        if (redirectTimer.current) clearTimeout(redirectTimer.current);
    }, []);

    function handleCollectionCreated(collection: CreatedFabricCollection) {
        setCollections((current) => current.some((item) => item.id === collection.id) ? current : [{ ...collection, count: 0 }, ...current]);
        update("fabricCollectionName", collection.name);
        update("fabricCollectionId",collection.id);
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setFieldErrors([]);
        try {
            const endpoint = mode === "edit" ? `${apiBasePath}/quick-add/${listingId}` : `${apiBasePath}/quick-add`;
            const response = await catalogRequest(endpoint, {
                method: mode === "edit" ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...draft,
                    isActive: initialData ? (initialData as QuickAddInitialData & {isActive?:boolean}).isActive : true,
                    shadeVariantAction: mode === "edit" && !shadeVariantsTouched ? "preserve" : "replace",
                }),
            });
            const json = await response.json();
            if (!response.ok) {
                if (Array.isArray(json.error?.details)) {
                    setFieldErrors(json.error.details.map((item: { path: string; message: string }) => item.message));
                }
                throw new Error(json.error?.message || "This fabric could not be saved");
            }
            if (mode === "create") {
                toast.success("Fabric published to your catalog.");
                setDraft(buildDraft());
                setShadeVariantsTouched(false);
                router.refresh();
            } else {
                toast.success("Fabric updated successfully.");
                router.refresh();
            }
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "This fabric could not be saved. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    if (topRowCollectionSlot) {
        return (
            <div className="space-y-8">
                {/* SECTION 1: TOP ROW (Create Collection + Buyer Preview) */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] gap-6 items-start">
                    <div className="card p-6 space-y-4 h-fit">
                        <div className="border-b border-border pb-3">
                            <h2 className="text-lg font-bold text-slate-900">Create Collection</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Organize fabrics into seasonal or thematic lines.</p>
                        </div>
                        {topRowCollectionSlot}
                    </div>

                    <div className="card p-6 space-y-4 h-fit">
                        <div className="border-b border-border pb-3">
                            <h2 className="text-lg font-bold text-slate-900">Buyer Preview</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Real-time simulation of how buyers see this fabric in the marketplace.</p>
                        </div>
                        <BuyerPreviewCard draft={draft} />
                    </div>
                </div>

                {/* SECTION 2: FULL-WIDTH QUICK-ADD FABRIC */}
                <div className="card p-6 sm:p-8 space-y-6">
                    <div className="border-b border-border pb-4">
                        <h2 className="text-xl font-bold text-slate-900">{mode === "edit" ? "Edit Fabric Listing" : "Create Quick-Add Fabric"}</h2>
                        <p className="mt-1 text-sm text-slate-600">Spec once. Variants, colors and designs sit under the fabric — one listing per quality.</p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-6">
                        {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
                {error && <div role="alert" className="catalog-form-alert is-error"><strong>Fabric not saved.</strong><span>{error}</span></div>}
                        {fieldErrors.length > 0 && <ul className="catalog-form-alert is-error">{fieldErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>}

                        <SpecificationSection draft={draft} update={update} />
                        <FabricStateSection
                            draft={draft}
                            update={update}
                            uploadEndpoint={`${apiBasePath}/images`}
                            legacyColorOptions={initialData?.colorOptions ?? []}
                            legacyImageUrls={initialData?.imageUrls ?? []}
                        />
                        <CommercialsSection draft={draft} update={update} />
                        <CollectionSection
                            collections={collections}
                            selectedName={draft.fabricCollectionName}
                            onSelect={(value) => {update("fabricCollectionName",value);update("fabricCollectionId",collections.find(c=>c.name===value)?.id??null);}}
                            onCreated={handleCollectionCreated}
                            apiBasePath={apiBasePath}
                        />

                        {/* Before publish validation checklist naturally placed within Quick-Add Fabric workflow */}
                        <BeforePublishChecklist draft={draft} />

                        <footer className="catalog-publish-footer rounded-xl border border-border bg-slate-50/70">
                            <button type="submit" className={published ? "is-done" : undefined} disabled={saving || published}>
                                {published ? "✓ Done — opening catalog…" : saving ? "Publishing fabric…" : mode === "edit" ? "Update fabric" : "Publish fabric"}
                            </button>
                            <span>{published ? "Your fabric is now in the supplier catalog." : draft.fabricCollectionName ? `Will appear in ${draft.fabricCollectionName}.` : "No collection selected — lists as an individual fabric."}</span>
                        </footer>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="catalog-authoring-grid">
            <div className="catalog-form-shell">
                <header className="catalog-form-title"><h2>{mode === "edit" ? "Edit fabric" : "Add fabric"}</h2></header>
                {error && <div role="alert" className="catalog-form-alert is-error"><strong>Fabric not saved.</strong><span>{error}</span></div>}
                {fieldErrors.length > 0 && <ul className="catalog-form-alert is-error">{fieldErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>}

                <SpecificationSection draft={draft} update={update} />
                <FabricStateSection
                    draft={draft}
                    update={update}
                    uploadEndpoint={`${apiBasePath}/images`}
                    legacyColorOptions={initialData?.colorOptions ?? []}
                    legacyImageUrls={initialData?.imageUrls ?? []}
                />
                <CommercialsSection draft={draft} update={update} />
                <CollectionSection
                    collections={collections}
                    selectedName={draft.fabricCollectionName}
                    onSelect={(value) => {update("fabricCollectionName",value);update("fabricCollectionId",collections.find(c=>c.name===value)?.id??null);}}
                    onCreated={handleCollectionCreated}
                    apiBasePath={apiBasePath}
                />
                <footer className="catalog-publish-footer">
                    <button type="submit" className={published ? "is-done" : undefined} disabled={saving || published}>
                        {published ? "✓ Done — opening catalog…" : saving ? "Publishing fabric…" : mode === "edit" ? "Update fabric" : "Publish fabric"}
                    </button>
                    <span>{published ? "Your fabric is now in the supplier catalog." : draft.fabricCollectionName ? `Will appear in ${draft.fabricCollectionName}.` : "No collection selected — lists as an individual fabric."}</span>
                </footer>
            </div>
            <BuyerPreview draft={draft} />
        </form>
    );
}
