import CreateCollectionForm, { type CreatedFabricCollection } from "../CreateCollectionForm";
import type { FabricCollectionOption } from "./types";

type Props = {
    collections: FabricCollectionOption[];
    selectedName: string;
    onSelect: (_name: string) => void;
    onCreated: (_collection: CreatedFabricCollection) => void;
    apiBasePath: string;
};

export default function CollectionSection({ collections, selectedName, onSelect, onCreated, apiBasePath }: Props) {
    return (
        <section className="catalog-form-section" aria-labelledby="collection-heading">
            <div className="catalog-section-heading">
                <span>04</span><h2 id="collection-heading">Collection</h2><p>optional · without one, this lists as an individual fabric</p>
            </div>
            <div className="collection-options">
                <button type="button" className={!selectedName ? "is-selected" : ""} onClick={() => onSelect("")}>No collection</button>
                {collections.map((collection) => (
                    <button key={collection.id} type="button" className={selectedName === collection.name ? "is-selected" : ""} onClick={() => onSelect(collection.name)}>
                        {collection.name}{typeof collection.count === "number" && <span>{collection.count}</span>}
                    </button>
                ))}
                <details className="new-collection-details">
                    <summary>New collection…</summary>
                    <div><CreateCollectionForm onCreated={onCreated} apiBasePath={apiBasePath} embedded /></div>
                </details>
            </div>
        </section>
    );
}
