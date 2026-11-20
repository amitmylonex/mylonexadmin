import {useCatalogRequest} from "./integration";
"use client";

import { useState } from "react";
import ImageUploader from "./ImageUploader";


export type CreatedFabricCollection = {
    id: string;
    name: string;
    imageUrl: string | null;
};

type Props = {
    onCreated: (_collection: CreatedFabricCollection) => void;
    apiBasePath?: string;
    embedded?: boolean;
};

export default function CreateCollectionForm({
    onCreated,
    apiBasePath = "/api/supplier/catalog",
    embedded = false,
}: Props) {
    const catalogRequest = useCatalogRequest();
    const [notice,setNotice]=useState("");
    const toast={success:setNotice};
    const [name, setName] = useState("");
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function createCollection() {
        if (loading) return;

        setError(null);

        const trimmedName = name.trim();
        if (!trimmedName) {
            setError("Collection name is required.");
            return;
        }

        const imageUrl = imageUrls[0];
        if (!imageUrl) {
            setError("Collection image is required.");
            return;
        }

        setLoading(true);

        try {
            const response = await catalogRequest(`${apiBasePath}/fabric-collections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: trimmedName,
                    imageUrl,
                }),
            });

            const json = await response.json();
            if (!response.ok) {
                throw new Error(json.error?.message || "Failed to create collection");
            }

            const created: CreatedFabricCollection = {
                id: json.data.id,
                name: json.data.name,
                imageUrl: json.data.imageUrl ?? null,
            };

            onCreated(created);
            toast.success(`Collection "${created.name}" created. You can now link fabrics to it.`);
            setName("");
            setImageUrls([]);
        } catch (submitError: any) {
            setError(submitError.message || "Failed to create collection");
        } finally {
            setLoading(false);
        }
    }

    const fields = (
        <>
            {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}

            <div>
                <label className="block text-sm font-semibold text-slate-700">
                    Collection Name {!embedded && <span className="text-red-500 font-bold ml-0.5">*</span>}
                </label>
                {/* Embedded controls belong to the outer fabric form, so they
                    must not block publishing while this panel is closed. */}
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input mt-1.5"
                    placeholder="e.g. Autumn / Winter Essentials"
                    required={!embedded}
                />
            </div>

            <ImageUploader
                label="Collection Image"
                value={imageUrls}
                onChange={(urls) => setImageUrls(urls.slice(-1))}
                uploadEndpoint={`${apiBasePath}/images`}
            />
            <p className="-mt-1 text-xs text-slate-500">Only one cover image is stored for a collection.</p>

            <button
                type={embedded ? "button" : "submit"}
                onClick={embedded ? createCollection : undefined}
                className="btn-primary w-full sm:w-auto"
                disabled={loading}
            >
                {loading ? "Creating Collection..." : "Create Collection"}
            </button>
        </>
    );

    if (embedded) {
        return (
            <div
                className="space-y-4"
                onKeyDown={(event) => {
                    if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type !== "file") {
                        event.preventDefault();
                        createCollection();
                    }
                }}
            >
                {fields}
            </div>
        );
    }

    return <form onSubmit={(event) => { event.preventDefault(); createCollection(); }} className="space-y-4">{fields}</form>;
}
