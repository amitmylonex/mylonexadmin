import {useCatalogRequest} from "../integration";
"use client";

import { useRef, useState } from "react";
import Image from "../Image";
import type { ShadeVariant } from "./types";

type Props = {
    shades: ShadeVariant[];
    onChange: (_shades: ShadeVariant[]) => void;
    uploadEndpoint: string;
};

const EMPTY_SHADE = { name: "", colorHex: "", millCode: "", imageUrl: "" };

export default function ShadeCardEditor({ shades, onChange, uploadEndpoint }: Props) {
    const catalogRequest = useCatalogRequest();
    const fileRef = useRef<HTMLInputElement>(null);
    const [shade, setShade] = useState(EMPTY_SHADE);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function uploadImage(file?: File) {
        if (!file) return;
        setUploading(true);
        setError(null);
        const body = new FormData();
        body.append("files", file);
        try {
            const response = await catalogRequest(uploadEndpoint, { method: "POST", body });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message || "Shade image could not be uploaded");
            setShade((current) => ({ ...current, imageUrl: json.data?.urls?.[0] ?? "" }));
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Shade image could not be uploaded");
        } finally {
            setUploading(false);
        }
    }

    function saveShade() {
        const name = shade.name.trim();
        const millCode = shade.millCode.trim();
        if (!name) return setError("Enter a colour or design name before adding this shade.");
        if (!shade.colorHex && !millCode) return setError("Choose a colour or enter a Pantone / mill code.");

        const next: ShadeVariant = {
            id: editingId ?? crypto.randomUUID(),
            name,
            ...(shade.colorHex ? { colorHex: shade.colorHex } : {}),
            ...(millCode ? { millCode } : {}),
            ...(shade.imageUrl ? { imageUrl: shade.imageUrl } : {}),
        };
        onChange(editingId ? shades.map((item) => item.id === editingId ? next : item) : [...shades, next]);
        setShade(EMPTY_SHADE);
        setEditingId(null);
        setError(null);
        if (fileRef.current) fileRef.current.value = "";
    }

    function editShade(item: ShadeVariant) {
        setEditingId(item.id);
        setShade({ name: item.name, colorHex: item.colorHex ?? "", millCode: item.millCode ?? "", imageUrl: item.imageUrl ?? "" });
        setError(null);
    }

    return (
        <div className="shade-editor">
            <div className="shade-editor-header">
                <div><strong>Shade card</strong><span>{shades.length ? `${shades.length} added` : "none yet"}</span></div>
                <span>Images are optional</span>
            </div>
            <div className="shade-input-row">
                <div className="shade-color-control">
                    <input
                        aria-label="Choose shade colour"
                        type="color"
                        value={shade.colorHex || "#8aaac7"}
                        onChange={(event) => setShade((current) => ({ ...current, colorHex: event.target.value }))}
                    />
                    <button type="button" onClick={() => setShade((current) => ({ ...current, colorHex: "" }))}>{shade.colorHex ? shade.colorHex.toUpperCase() : "Pick colour"}</button>
                </div>
                <label><span className="sr-only">Colour or design name</span><input value={shade.name} onChange={(event) => setShade((current) => ({ ...current, name: event.target.value }))} placeholder="Colour or design name" /></label>
                <label><span className="sr-only">Pantone or mill code</span><input value={shade.millCode} onChange={(event) => setShade((current) => ({ ...current, millCode: event.target.value }))} placeholder="Pantone / mill code (optional)" /></label>
                <label className="shade-upload-button">
                    <span>{uploading ? "Uploading…" : shade.imageUrl ? "Replace image" : "Add image"}</span>
                    <input ref={fileRef} type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0])} disabled={uploading} />
                </label>
                <button className="shade-add-button" type="button" onClick={saveShade}>{editingId ? "Update" : "Add"}</button>
            </div>
            {error && <p role="alert" className="shade-error">{error}</p>}

            {shades.length === 0 ? (
                <p className="shade-empty">Add each colour or print once. A photo helps buyers, but the shade can be published without one.</p>
            ) : (
                <div className="shade-card-grid">
                    {shades.map((item) => (
                        <article key={item.id} className="shade-card">
                            {item.imageUrl ? <Image src={item.imageUrl} alt={`${item.name} shade`} width={350} height={208} unoptimized /> : (
                                <div className="shade-no-image" style={{ backgroundColor: item.colorHex || "#eef1f5" }}><span>No image set</span></div>
                            )}
                            <div className="shade-card-copy">
                                <strong>{item.name}</strong>
                                <span>{item.millCode || item.colorHex?.toUpperCase()}</span>
                            </div>
                            <div className="shade-card-actions">
                                <button type="button" onClick={() => editShade(item)}>Edit</button>
                                <button type="button" onClick={() => onChange(shades.filter((shadeItem) => shadeItem.id !== item.id))}>Delete</button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
