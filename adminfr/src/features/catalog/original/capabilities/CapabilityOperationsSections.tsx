"use client";

import CapabilityFormSection from "./CapabilityFormSection";
import ChipSelector from "./ChipSelector";
import { COATING_OPTIONS, DYE_OPTIONS, FINISH_OPTIONS, LISTING_CYCLES, PRINT_OPTIONS } from "./capability-options";

type ProcessingProps = {
    dyeMethods: string[];
    setDyeMethods: (_value: string[]) => void;
    printMethods: string[];
    setPrintMethods: (_value: string[]) => void;
    coatingTypes: string[];
    setCoatingTypes: (_value: string[]) => void;
    finishTags: string[];
    setFinishTags: (_value: string[]) => void;
};

export function CapabilityProcessingSection(props: ProcessingProps) {
    return (
        <CapabilityFormSection number="03" title="Processing" id="capability-processing-heading">
            <ChipSelector label="Dyeing" options={DYE_OPTIONS} value={props.dyeMethods} onChange={props.setDyeMethods} />
            <ChipSelector label="Printing" options={PRINT_OPTIONS} value={props.printMethods} onChange={props.setPrintMethods} />
            <ChipSelector label="Coatings" options={COATING_OPTIONS} value={props.coatingTypes} onChange={props.setCoatingTypes} />
            <ChipSelector label="Finishes" options={FINISH_OPTIONS} value={props.finishTags} onChange={props.setFinishTags} />
        </CapabilityFormSection>
    );
}

type CommercialProps = {
    listingType: string;
    setListingType: (_value: string) => void;
    values: Record<string, string>;
};

export function CapabilityCommercialSection({ listingType, setListingType, values }: CommercialProps) {
    return (
        <CapabilityFormSection number="04" title="Commercial terms" id="capability-commercial-heading">
            <fieldset className="capability-commercial-cycle" aria-label="Production cycle">
                {LISTING_CYCLES.map((cycle) => (
                    <label key={cycle.value} className={listingType === cycle.value ? "is-selected" : ""}>
                        <input className="sr-only" type="radio" name="listingTypeChoice" value={cycle.value} checked={listingType === cycle.value} onChange={() => setListingType(cycle.value)} />
                        <strong>{cycle.label}</strong>
                        <span>{cycle.detail}</span>
                    </label>
                ))}
            </fieldset>
            <p className="capability-cycle-note">Choose the production cycle this line normally runs on.</p>
            <div className="capability-field-grid is-commercial">
                <label className="capability-field">
                    <span>MOQ (meters)</span>
                    <input name="moqMeters" type="number" min="1" defaultValue={values.moqMeters} placeholder="500" />
                </label>
                <label className="capability-field">
                    <span>Lead time (days)</span>
                    <input name="leadTimeDays" type="number" min="1" defaultValue={values.leadTimeDays} placeholder="21" />
                </label>
                <div className="capability-range-field">
                    <span>Price band (INR/m)</span>
                    <div>
                        <input aria-label="Minimum price" name="priceMinInr" type="number" min="0.01" step="0.01" defaultValue={values.priceMinInr} placeholder="90" />
                        <i>–</i>
                        <input aria-label="Maximum price" name="priceMaxInr" type="number" min="0.01" step="0.01" defaultValue={values.priceMaxInr} placeholder="240" />
                    </div>
                </div>
            </div>
        </CapabilityFormSection>
    );
}
