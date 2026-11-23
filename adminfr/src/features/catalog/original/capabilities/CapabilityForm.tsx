import {useCatalogRequest} from "../integration";
"use client";

import { useEffect, useRef, useState } from "react";
import { useCatalogRouter as useRouter } from "../integration";
import CapabilityAdditionalDetails from "./CapabilityAdditionalDetails";
import { CapabilityIdentitySection, CapabilityMaterialsSection } from "./CapabilityIdentitySections";
import { CapabilityCommercialSection, CapabilityProcessingSection } from "./CapabilityOperationsSections";
import type { CapabilityFormInitialData, ListingOption } from "./capability-types";
import { buildListingOptions, initialSelections, numeric, text, validateRanges } from "./capability-form-utils";

type Props = {
    mode?: "create" | "edit";
    capabilityId?: string;
    initialData?: CapabilityFormInitialData;
    apiBasePath?: string;
};

export default function CapabilityForm({ mode = "create", capabilityId, initialData, apiBasePath = "/api/supplier/catalog" }: Props) {
    const router = useRouter();
    const catalogRequest = useCatalogRequest();
    const formRef = useRef<HTMLFormElement>(null);
    const [selections, setSelections] = useState(() => initialSelections(initialData));
    const [materialPurity, setMaterialPurity] = useState<"pure" | "blended">(initialData?.materialPurity === "blended" ? "blended" : "pure");
    const [listingType, setListingType] = useState(initialData?.listingType ?? "ready_stock");
    const [colorOptions, setColorOptions] = useState(initialData?.colorOptionsWithQuantity ?? []);
    const [imageUrls, setImageUrls] = useState(initialData?.imageUrls ?? []);
    const [linkedSupplierCatalogIds, setLinkedSupplierCatalogIds] = useState(initialData?.linkedSupplierCatalogIds ?? []);
    const [linkedWovenProductIds, setLinkedWovenProductIds] = useState(initialData?.linkedWovenProductIds ?? []);
    const [listingOptions, setListingOptions] = useState<ListingOption[]>([]);
    const [loadingListings, setLoadingListings] = useState(true);
    const [listingLoadError, setListingLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<string[]>([]);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        async function loadListings() {
            try {
                const response = await catalogRequest(apiBasePath);
                const json = await response.json();
                if (!active) return;
                if (!response.ok) {
                    setListingLoadError("Catalog fabrics could not be loaded. Existing links will still be preserved when you save.");
                    return;
                }
                setListingOptions(buildListingOptions(json));
            } catch {
                if (active) setListingLoadError("Catalog fabrics could not be loaded. Existing links will still be preserved when you save.");
            } finally {
                if (active) setLoadingListings(false);
            }
        }
        loadListings();
        return () => { active = false; };
    }, [apiBasePath]);

    function updateSelection(key: keyof ReturnType<typeof initialSelections>, value: string[]) {
        setSelections((current) => ({ ...current, [key]: value }));
    }

    function resetCreateForm() {
        formRef.current?.reset();
        setSelections(initialSelections());
        setMaterialPurity("pure");
        setListingType("ready_stock");
        setColorOptions([]);
        setImageUrls([]);
        setLinkedSupplierCatalogIds([]);
        setLinkedWovenProductIds([]);
        setError(null);
        setFieldErrors([]);
        setSuccess(null);
    }

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!formRef.current) return;
        setSaving(true);
        setError(null);
        setFieldErrors([]);
        setSuccess(null);
        const form = new FormData(formRef.current);
        const rangeErrors = validateRanges(form);
        if (rangeErrors.length > 0) {
            setFieldErrors(rangeErrors);
            setSaving(false);
            return;
        }
        const payload = {
            capabilityName: form.get("capabilityName"),
            isActive:(initialData as CapabilityFormInitialData & {isActive?:boolean})?.isActive??false,
            ...selections,
            gsmMin: numeric(form, "gsmMin"),
            gsmMax: numeric(form, "gsmMax"),
            widthMinInches: numeric(form, "widthMinInches"),
            widthMaxInches: numeric(form, "widthMaxInches"),
            countRangeMin: numeric(form, "countRangeMin"),
            countRangeMax: numeric(form, "countRangeMax"),
            constructionRangeMin: form.get("constructionRangeMin") || undefined,
            constructionRangeMax: form.get("constructionRangeMax") || undefined,
            colorOptionsWithQuantity: colorOptions.filter((option) => option.color.trim()),
            materialPurity,
            blendDescription: materialPurity === "blended" ? form.get("blendDescription") || undefined : undefined,
            priceMinInr: numeric(form, "priceMinInr"),
            priceMaxInr: numeric(form, "priceMaxInr"),
            moqMeters: numeric(form, "moqMeters"),
            leadTimeDays: numeric(form, "leadTimeDays"),
            listingType,
            millName: form.get("millName") || undefined,
            city: form.get("city") || undefined,
            locationState: form.get("locationState") || undefined,
            notes: form.get("notes") || undefined,
            imageUrls,
            linkedSupplierCatalogIds,
            linkedWovenProductIds,
        };

        try {
            const endpoint = mode === "edit" ? `${apiBasePath}/capabilities/${capabilityId}` : `${apiBasePath}/capabilities`;
            const response = await catalogRequest(endpoint, {
                method: mode === "edit" ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await response.json();
            if (!response.ok) {
                if (Array.isArray(json.error?.details)) {
                    setFieldErrors(json.error.details.map((item: { path: string; message: string }) => `${item.path}: ${item.message}`));
                }
                throw new Error(json.error?.message || "This product line could not be saved.");
            }
            if (mode === "create") resetCreateForm();
            setSuccess(mode === "edit" ? "Product line updated." : "Product line saved.");
            router.refresh();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "This product line could not be saved.");
        } finally {
            setSaving(false);
        }
    }

    const values = Object.fromEntries([
        "gsmMin", "gsmMax", "widthMinInches", "widthMaxInches", "countRangeMin", "countRangeMax",
        "constructionRangeMin", "constructionRangeMax", "blendDescription", "moqMeters", "leadTimeDays", "priceMinInr", "priceMaxInr",
    ].map((key) => [key, text(initialData?.[key as keyof CapabilityFormInitialData] as string | number | null)]));

    return (
        <form ref={formRef} onSubmit={submit} className="capabilities-workspace capability-form-shell">
            <header className="capability-form-title">
                <h2>{mode === "edit" ? "Edit product line" : "New product line"}</h2>
                <p>Only what you select is used for this capability profile.</p>
            </header>
            {error && <div role="alert" className="capability-form-alert is-error"><strong>Not saved.</strong><span>{error}</span></div>}
            {fieldErrors.length > 0 && <ul className="capability-form-alert is-error">{fieldErrors.map((message) => <li key={message}>{message}</li>)}</ul>}
            {success && <div role="status" className="capability-form-alert is-success"><strong>Done.</strong><span>{success}</span></div>}

            <CapabilityIdentitySection
                initialName={text(initialData?.capabilityName)}
                structures={selections.structures} setStructures={(value) => updateSelection("structures", value)}
                materialTypes={selections.materialTypes} setMaterialTypes={(value) => updateSelection("materialTypes", value)}
                fabricStates={selections.fabricStates} setFabricStates={(value) => updateSelection("fabricStates", value)}
            />
            <CapabilityMaterialsSection
                fibers={selections.fibers} setFibers={(value) => updateSelection("fibers", value)}
                weaveTypes={selections.weaveTypes} setWeaveTypes={(value) => updateSelection("weaveTypes", value)}
                materialPurity={materialPurity} setMaterialPurity={setMaterialPurity} values={values}
            />
            <CapabilityProcessingSection
                dyeMethods={selections.dyeMethods} setDyeMethods={(value) => updateSelection("dyeMethods", value)}
                printMethods={selections.printMethods} setPrintMethods={(value) => updateSelection("printMethods", value)}
                coatingTypes={selections.coatingTypes} setCoatingTypes={(value) => updateSelection("coatingTypes", value)}
                finishTags={selections.finishTags} setFinishTags={(value) => updateSelection("finishTags", value)}
            />
            <CapabilityCommercialSection listingType={listingType} setListingType={setListingType} values={values} />
            <CapabilityAdditionalDetails
                apiBasePath={apiBasePath} colorOptions={colorOptions} setColorOptions={setColorOptions}
                imageUrls={imageUrls} setImageUrls={setImageUrls} listingOptions={listingOptions} loadingListings={loadingListings} listingLoadError={listingLoadError}
                linkedSupplierCatalogIds={linkedSupplierCatalogIds} setLinkedSupplierCatalogIds={setLinkedSupplierCatalogIds}
                linkedWovenProductIds={linkedWovenProductIds} setLinkedWovenProductIds={setLinkedWovenProductIds}
                initialValues={{ millName: text(initialData?.millName), city: text(initialData?.city), locationState: text(initialData?.locationState), notes: text(initialData?.notes) }}
            />
            <footer className="capability-save-footer">
                <p><strong>{linkedSupplierCatalogIds.length + linkedWovenProductIds.length} catalog fabrics</strong> linked to this line.</p>
                <div>
                    <button type="button" className="capability-cancel-button" onClick={() => mode === "edit" ? router.push("/supplier/catalog/capabilities") : resetCreateForm()}>Cancel</button>
                    <button type="submit" className="capability-save-button" disabled={saving}>{saving ? "Saving…" : mode === "edit" ? "Update product line" : "Save product line"}</button>
                </div>
            </footer>
        </form>
    );
}
