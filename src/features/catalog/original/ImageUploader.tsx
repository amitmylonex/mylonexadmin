import {useCatalogRequest} from "./integration";
"use client";

import { useId, useState } from "react";
import Image from "./Image";

type Props = {
    value: string[];
    onChange: (_value: string[]) => void;
    label?: string;
    uploadEndpoint?: string;
};

export default function ImageUploader({
    value,
    onChange,
    label = "Images",
    uploadEndpoint = "/api/supplier/catalog/images",
}: Props) {
    const catalogRequest = useCatalogRequest();
    const inputId = useId();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function uploadFiles(files: FileList | null) {
        if (!files || files.length === 0) {
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        Array.from(files).forEach((file) => formData.append("files", file));

        try {
            const response = await catalogRequest(uploadEndpoint, {
                method: "POST",
                body: formData,
            });
            const json = await response.json();
            if (!response.ok) {
                throw new Error(json.error?.message || "Image upload failed");
            }

            const newUrls: string[] = json.data?.urls ?? [];
            onChange([...value, ...newUrls]);
        } catch (uploadError: any) {
            setError(uploadError.message || "Image upload failed");
        } finally {
            setUploading(false);
        }
    }

    function removeUrl(url: string) {
        onChange(value.filter((item) => item !== url));
    }

    return (
        <div className="space-y-3">
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700">
                        {label}
                    </label>
                    {value.length > 0 && (
                        <span className="text-xs font-medium text-slate-500">
                            {value.length} {value.length === 1 ? "image" : "images"} selected
                        </span>
                    )}
                </div>

                <label
                    htmlFor={inputId}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => { event.preventDefault(); if (!uploading) void uploadFiles(event.dataTransfer.files); }}
                    className={`relative flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border-2 border-dashed p-4 sm:p-5 transition-all duration-150 cursor-pointer ${
                        uploading
                            ? "border-primary/40 bg-blue-50/30 cursor-wait opacity-80"
                            : "border-border hover:border-primary/60 bg-slate-50/60 hover:bg-blue-50/20"
                    }`}
                >
                    <input
                        id={inputId}
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={async (event) => {
                            await uploadFiles(event.target.files);
                            event.target.value = "";
                        }}
                        disabled={uploading}
                    />

                    <div className="flex items-center gap-3 text-center sm:text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                {uploading ? "Uploading images..." : "Click to select or drag images here"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Supports JPG, PNG, WEBP up to 10MB • Multiple images allowed
                            </p>
                        </div>
                    </div>

                    <span className="btn-outline pointer-events-none shrink-0 text-xs px-3.5 py-1.5 font-semibold text-slate-700 bg-white shadow-xs">
                        {uploading ? (
                            <span className="flex items-center gap-1.5">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                Uploading…
                            </span>
                        ) : (
                            "Browse Files"
                        )}
                    </span>
                </label>
            </div>

            {error && (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {value.length > 0 && (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 pt-1">
                    {value.map((url, index) => (
                        <div key={url} className="group relative rounded-xl border border-border bg-white p-2 shadow-xs transition-shadow hover:shadow-sm">
                            <div className="relative h-24 w-full overflow-hidden rounded-lg bg-slate-100">
                                <Image src={url} alt={`Uploaded fabric ${index + 1}`} fill unoptimized className="object-cover" />
                                {index === 0 && (
                                    <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                                        Cover
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-[11px] text-slate-500 font-medium truncate">
                                    Photo #{index + 1}
                                </span>
                                <button
                                    type="button"
                                    className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors"
                                    onClick={() => removeUrl(url)}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
