"use client";

import ImageUploader from "../ImageUploader";
import type { ColorOption, ListingOption } from "./capability-types";

type Props = {
    apiBasePath: string;
    colorOptions: ColorOption[];
    setColorOptions: (_value: ColorOption[]) => void;
    imageUrls: string[];
    setImageUrls: (_value: string[]) => void;
    listingOptions: ListingOption[];
    loadingListings: boolean;
    listingLoadError: string | null;
    linkedSupplierCatalogIds: string[];
    setLinkedSupplierCatalogIds: (_value: string[]) => void;
    linkedWovenProductIds: string[];
    setLinkedWovenProductIds: (_value: string[]) => void;
    initialValues: {
        millName: string;
        city: string;
        locationState: string;
        notes: string;
    };
};

function toggle(items: string[], id: string) {
    return items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
}

export default function CapabilityAdditionalDetails(props: Props) {
    const {
        apiBasePath, colorOptions, setColorOptions, imageUrls, setImageUrls,
        listingOptions, loadingListings, listingLoadError, linkedSupplierCatalogIds, setLinkedSupplierCatalogIds,
        linkedWovenProductIds, setLinkedWovenProductIds, initialValues,
    } = props;

    return (
        <details className="capability-additional">
            <summary>
                <span>Additional details</span>
                <small>Colours, location, notes, images and linked fabrics</small>
            </summary>
            <div className="capability-additional-content">
                <div className="capability-field-grid is-three">
                    <label className="capability-field">
                        <span>Mill name</span>
                        <input name="millName" defaultValue={initialValues.millName} placeholder="Mill or unit name" />
                    </label>
                    <label className="capability-field">
                        <span>City</span>
                        <input name="city" defaultValue={initialValues.city} placeholder="Surat" />
                    </label>
                    <label className="capability-field">
                        <span>State</span>
                        <input name="locationState" defaultValue={initialValues.locationState} placeholder="Gujarat" />
                    </label>
                </div>

                <div className="capability-colour-editor">
                    <div>
                        <strong>Colour options</strong>
                        <button type="button" onClick={() => setColorOptions([...colorOptions, { color: "" }])}>+ Add colour</button>
                    </div>
                    {colorOptions.length === 0 ? (
                        <p>Add colours only when this product line has defined shade availability.</p>
                    ) : colorOptions.map((option, index) => (
                        <div className="capability-colour-row" key={index}>
                            <input
                                aria-label={`Colour ${index + 1}`}
                                placeholder="Colour name"
                                value={option.color}
                                onChange={(event) => setColorOptions(colorOptions.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item))}
                            />
                            <input
                                aria-label={`Colour ${index + 1} quantity`}
                                type="number"
                                min="0"
                                placeholder="Quantity"
                                value={option.quantity ?? ""}
                                onChange={(event) => setColorOptions(colorOptions.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value ? Number(event.target.value) : undefined } : item))}
                            />
                            <button type="button" onClick={() => setColorOptions(colorOptions.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                        </div>
                    ))}
                </div>

                <label className="capability-field">
                    <span>Internal notes</span>
                    <textarea name="notes" rows={3} defaultValue={initialValues.notes} placeholder="Anything your team should know about this range" />
                </label>

                <ImageUploader
                    label="Capability images"
                    value={imageUrls}
                    onChange={setImageUrls}
                    uploadEndpoint={`${apiBasePath}/images`}
                />

                <fieldset className="capability-linked-listings">
                    <legend>Attach catalog fabrics</legend>
                    <p>Selected fabrics stay linked to this product line.</p>
                    {listingLoadError ? <span role="status">{listingLoadError}</span> : loadingListings ? <span>Loading catalog fabrics…</span> : listingOptions.length === 0 ? <span>No catalog fabrics are available yet.</span> : (
                        <div>
                            {listingOptions.map((option) => {
                                const selected = option.sourceType === "supplier_catalog"
                                    ? linkedSupplierCatalogIds.includes(option.id)
                                    : linkedWovenProductIds.includes(option.id);
                                return (
                                    <label key={`${option.sourceType}-${option.id}`}>
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => option.sourceType === "supplier_catalog"
                                                ? setLinkedSupplierCatalogIds(toggle(linkedSupplierCatalogIds, option.id))
                                                : setLinkedWovenProductIds(toggle(linkedWovenProductIds, option.id))}
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </fieldset>
            </div>
        </details>
    );
}
