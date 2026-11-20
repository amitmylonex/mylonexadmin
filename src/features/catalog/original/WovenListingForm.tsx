import {useCatalogRequest} from "./integration";
"use client";

import { useRef, useState } from "react";
import { useCatalogRouter as useRouter } from "./integration";
import { WOVEN_FINISH_CATEGORIES, WOVEN_WEAVE_TYPES } from "../constants";
import { WOVEN_SPEC_TEMPLATE } from "./templates";
import ImageUploader from "./ImageUploader";


type SpecFormState = Record<string, { valueNum?: string; valueText?: string }>;

type WovenInitialData = {
    compositionText?: string;
    weaveType?: string;
    finishCategory?: string;
    gsmFinished?: number;
    widthFinishedIn?: number | string;
    listingType?: string;
    priceInrPerM?: number | string;
    moqMeters?: number;
    leadTimeDays?: number;
    millName?: string | null;
    city?: string | null;
    locationState?: string | null;
    notes?: string | null;
    images?: string[];
    specs?: Array<{ specKey: string; valueNum?: number | string | null; valueText?: string | null }>;
};

type Props = {
    mode?: "create" | "edit";
    listingId?: string;
    initialData?: WovenInitialData;
    apiBasePath?: string;
};

function textValue(value?: string | number | null) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}

function toSpecState(specs?: WovenInitialData["specs"]) {
    const state: SpecFormState = {};
    for (const spec of specs ?? []) {
        state[spec.specKey] = {
            valueNum: spec.valueNum === null || spec.valueNum === undefined ? undefined : String(spec.valueNum),
            valueText: spec.valueText ?? undefined,
        };
    }

    return state;
}

export default function WovenListingForm({
    mode = "create",
    listingId,
    initialData,
    apiBasePath = "/api/supplier/catalog",
}: Props) {
    const router = useRouter();
    const catalogRequest = useCatalogRequest();
    const [notice,setNotice]=useState("");
    const toast={success:setNotice};
    const formRef = useRef<HTMLFormElement>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<string[]>([]);
    const [specValues, setSpecValues] = useState<SpecFormState>(toSpecState(initialData?.specs));
    const [imageUrls, setImageUrls] = useState<string[]>(initialData?.images ?? []);

    function updateSpec(key: string, patch: { valueNum?: string; valueText?: string }) {
        setSpecValues((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                ...patch,
            },
        }));
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formEl = formRef.current;
        if (!formEl) {
            setError("Form unavailable. Please retry.");
            return;
        }
        setLoading(true);
        setError(null);
        setFieldErrors([]);

        const form = new FormData(formEl);
        const specs = WOVEN_SPEC_TEMPLATE
            .map((spec) => {
                const state = specValues[spec.key] || {};
                if (!state.valueText && !state.valueNum) {
                    return null;
                }

                return {
                    specKey: spec.key,
                    valueText: state.valueText || undefined,
                    valueNum: state.valueNum ? Number(state.valueNum) : undefined,
                    unit: spec.unit,
                    displayGroup: spec.displayGroup,
                    isRequired: spec.isRequiredDefault || false,
                    source: "supplier_input",
                };
            })
            .filter(Boolean);

        const payload = {
            compositionText: form.get("compositionText"),
            materialFamily:(initialData as WovenInitialData & {materialFamily?:string})?.materialFamily||"cellulosic_cotton",
            isActive:(initialData as WovenInitialData & {isActive?:boolean})?.isActive??false,
            weaveType: form.get("weaveType"),
            finishCategory: form.get("finishCategory"),
            gsmFinished: Number(form.get("gsmFinished")),
            widthFinishedIn: Number(form.get("widthFinishedIn")),
            listingType: (form.get("listingType") as string) || "ready_stock",
            priceInrPerM: Number(form.get("priceInrPerM")),
            moqMeters: Number(form.get("moqMeters") || 500),
            leadTimeDays: Number(form.get("leadTimeDays") || 21),
            millName: form.get("millName") || undefined,
            city: form.get("city") || undefined,
            locationState: form.get("locationState") || undefined,
            notes: form.get("notes") || undefined,
            images: imageUrls,
            specs,
        };

        try {
            const endpoint = mode === "edit"
                ? `${apiBasePath}/woven-listings/${listingId}`
                : `${apiBasePath}/woven-listings`;
            const res = await catalogRequest(endpoint, {
                method: mode === "edit" ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) {
                if (json.error?.details) {
                    setFieldErrors(
                        json.error.details.map((d: any) => `${(Array.isArray(d.path)?d.path.join("."):d.path)}: ${d.message}`)
                    );
                }
                throw new Error(json.error?.message || "Failed to save woven listing");
            }
            toast.success(mode === "edit" ? "Woven listing updated." : "Woven listing created.");
            if (mode === "create") {
                formRef.current?.reset();
                setSpecValues({});
                setImageUrls([]);
            }
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Failed to save woven listing");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
            {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
            {fieldErrors.length > 0 && (
                <ul className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
                    {fieldErrors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <label className="block text-sm font-semibold text-slate-700">
                        Composition <span className="text-red-500 font-bold ml-0.5">*</span>
                    </label>
                    <input aria-label="Composition" name="compositionText" className="input mt-1.5" required defaultValue={textValue(initialData?.compositionText)} placeholder="e.g. 100% Cotton" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">
                        Weave Type <span className="text-red-500 font-bold ml-0.5">*</span>
                    </label>
                    <select aria-label="Weave Type" name="weaveType" className="input mt-1.5" required defaultValue={textValue(initialData?.weaveType || "poplin")}>
                        {WOVEN_WEAVE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">
                        Finish Category <span className="text-red-500 font-bold ml-0.5">*</span>
                    </label>
                    <select aria-label="Finish Category" name="finishCategory" className="input mt-1.5" required defaultValue={textValue(initialData?.finishCategory || "greige")}>
                        {WOVEN_FINISH_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700">
                        GSM <span className="text-red-500 font-bold ml-0.5">*</span>
                    </label>
                    <input aria-label="GSM" name="gsmFinished" type="number" min={1} className="input mt-1.5" required defaultValue={textValue(initialData?.gsmFinished)} placeholder="100" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">
                        Width (in) <span className="text-red-500 font-bold ml-0.5">*</span>
                    </label>
                    <input aria-label="Width (in)" name="widthFinishedIn" type="number" min={1} step="0.01" className="input mt-1.5" required defaultValue={textValue(initialData?.widthFinishedIn)} placeholder="58" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">
                        Price INR/m <span className="text-red-500 font-bold ml-0.5">*</span>
                    </label>
                    <input aria-label="Price INR/m" name="priceInrPerM" type="number" min={1} step="0.01" className="input mt-1.5" required defaultValue={textValue(initialData?.priceInrPerM)} placeholder="150" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">Listing Type</label>
                    <select aria-label="Listing Type" name="listingType" className="input mt-1.5" defaultValue={textValue(initialData?.listingType || "ready_stock")}>
                        <option value="ready_stock">ready_stock</option>
                        <option value="running_production">running_production</option>
                        <option value="made_to_order">made_to_order</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700">MOQ (m)</label>
                    <input aria-label="MOQ (m)" name="moqMeters" type="number" min={1} defaultValue={textValue(initialData?.moqMeters ?? 500)} className="input mt-1.5" placeholder="500" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">Lead Time (days)</label>
                    <input aria-label="Lead Time (days)" name="leadTimeDays" type="number" min={1} defaultValue={textValue(initialData?.leadTimeDays ?? 21)} className="input mt-1.5" placeholder="21" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">City</label>
                    <input aria-label="City" name="city" className="input mt-1.5" defaultValue={textValue(initialData?.city)} placeholder="e.g. Surat" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">Location State</label>
                    <input aria-label="Location State" name="locationState" className="input mt-1.5" defaultValue={textValue(initialData?.locationState)} placeholder="e.g. Gujarat" />
                </div>
            </div>

            <div className="rounded-xl border border-border p-4 bg-slate-50/40">
                <h3 className="mb-3 text-sm font-bold text-slate-900">Technical Specs</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    {WOVEN_SPEC_TEMPLATE.map((spec) => (
                        <div key={spec.key} className="rounded-md border border-ink/10 p-3">
                            <div className="text-xs text-ink/50">{spec.displayGroup}</div>
                            <label className="block text-sm font-medium text-ink">{spec.label}</label>
                            {spec.valueType === "number" ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input mt-2"
                                    aria-label={spec.label} value={specValues[spec.key]?.valueNum || ""}
                                    onChange={(e) => updateSpec(spec.key, { valueNum: e.target.value })}
                                />
                            ) : (
                                <input
                                    className="input mt-2"
                                    aria-label={spec.label} value={specValues[spec.key]?.valueText || ""}
                                    onChange={(e) => updateSpec(spec.key, { valueText: e.target.value })}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Disclaimer note */}
                <div className="mt-4 rounded-2xl border border-[#f5deb3] bg-[#fffbf0] p-5">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#92400e]">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                        Please Note
                    </div>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#78350f]">
                        <li><strong>Pricing:</strong> Prices are dynamic in nature and are subject to change depending on market conditions, and until the buyer confirms the quotation given.</li>
                        <li><strong>Shrinkage:</strong> Shrinkage is as per industry norms (+/- 3%), and +/- 5% for lycra-based products.</li>
                        <li><strong>Colour fastness:</strong> Colour fastness will depend on the dyeing method used.</li>
                        <li><strong>Sampling:</strong> Sampling is subject to availability — if the exact sample is unavailable, the buyer will receive a similar sample of equivalent quality. If sample yardages are not available in ready stock, we can develop a handloom or machine sample for you, which will take a minimum of 21–30 days.</li>
                    </ol>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label className="block text-sm font-semibold text-slate-700">Mill Name</label>
                    <input name="millName" className="input mt-1.5" defaultValue={textValue(initialData?.millName)} placeholder="e.g. Arvind Mills" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700">Notes</label>
                    <textarea aria-label="Notes" name="notes" className="textarea mt-1.5" rows={3} defaultValue={textValue(initialData?.notes)} placeholder="Internal or buyer notes on this quality" />
                </div>
            </div>

            <ImageUploader
                label="Woven Listing Images"
                value={imageUrls}
                onChange={setImageUrls}
                uploadEndpoint={`${apiBasePath}/images`}
            />

            <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
                {loading ? "Saving Woven Listing..." : mode === "edit" ? "Update Woven Listing" : "Create Woven Listing"}
            </button>
        </form>
    );
}
