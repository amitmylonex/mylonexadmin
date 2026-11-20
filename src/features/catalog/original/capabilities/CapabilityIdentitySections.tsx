"use client";

import CapabilityFormSection from "./CapabilityFormSection";
import ChipSelector from "./ChipSelector";
import {
    FABRIC_STATE_OPTIONS,
    FIBER_OPTIONS,
    MATERIAL_OPTIONS,
    STRUCTURE_OPTIONS,
    WEAVE_OPTIONS,
} from "./capability-options";

type IdentityProps = {
    initialName: string;
    structures: string[];
    setStructures: (_value: string[]) => void;
    materialTypes: string[];
    setMaterialTypes: (_value: string[]) => void;
    fabricStates: string[];
    setFabricStates: (_value: string[]) => void;
};

export function CapabilityIdentitySection(props: IdentityProps) {
    return (
        <CapabilityFormSection number="01" title="Range identity" hint="how your team describes this product line" id="capability-identity-heading">
            <label className="capability-field capability-name-field">
                <span>Product line name <b>*</b></span>
                <input name="capabilityName" required defaultValue={props.initialName} placeholder="Shirting — cotton & cellulose" />
            </label>
            <ChipSelector label="Structure" options={STRUCTURE_OPTIONS} value={props.structures} onChange={props.setStructures} />
            <ChipSelector label="Materials" options={MATERIAL_OPTIONS} value={props.materialTypes} onChange={props.setMaterialTypes} />
            <ChipSelector label="Fabric state" options={FABRIC_STATE_OPTIONS} value={props.fabricStates} onChange={props.setFabricStates} />
        </CapabilityFormSection>
    );
}

type MaterialsProps = {
    fibers: string[];
    setFibers: (_value: string[]) => void;
    weaveTypes: string[];
    setWeaveTypes: (_value: string[]) => void;
    materialPurity: "pure" | "blended";
    setMaterialPurity: (_value: "pure" | "blended") => void;
    values: Record<string, string>;
};

function RangePair({ label, minName, maxName, minValue, maxValue, suffix, step = "1" }: {
    label: string; minName: string; maxName: string; minValue: string; maxValue: string; suffix?: string; step?: string;
}) {
    return (
        <div className="capability-range-field">
            <span>{label}</span>
            <div>
                <input aria-label={`${label} minimum`} name={minName} type="number" min={step === "1" ? "1" : "0.01"} step={step} defaultValue={minValue} placeholder="Min" />
                <i>–</i>
                <input aria-label={`${label} maximum`} name={maxName} type="number" min={step === "1" ? "1" : "0.01"} step={step} defaultValue={maxValue} placeholder="Max" />
                {suffix && <em>{suffix}</em>}
            </div>
        </div>
    );
}

export function CapabilityMaterialsSection(props: MaterialsProps) {
    return (
        <CapabilityFormSection number="02" title="Materials & construction" hint="range limits across this line" id="capability-materials-heading">
            <ChipSelector label="Fiber family" options={FIBER_OPTIONS} value={props.fibers} onChange={props.setFibers} />
            <ChipSelector label="Weaves" options={WEAVE_OPTIONS} value={props.weaveTypes} onChange={props.setWeaveTypes} addLabel="Custom weave" />
            <div className="capability-field-grid is-four">
                <RangePair label="GSM range" minName="gsmMin" maxName="gsmMax" minValue={props.values.gsmMin} maxValue={props.values.gsmMax} />
                <RangePair label="Count range" minName="countRangeMin" maxName="countRangeMax" minValue={props.values.countRangeMin} maxValue={props.values.countRangeMax} step="0.01" />
                <RangePair label="Width range" minName="widthMinInches" maxName="widthMaxInches" minValue={props.values.widthMinInches} maxValue={props.values.widthMaxInches} suffix="in" step="0.01" />
                <div className="capability-range-field">
                    <span>Construction range</span>
                    <div className="is-text-range">
                        <input aria-label="Construction range minimum" name="constructionRangeMin" defaultValue={props.values.constructionRangeMin} placeholder="40×40 / 132×72" />
                        <i>–</i>
                        <input aria-label="Construction range maximum" name="constructionRangeMax" defaultValue={props.values.constructionRangeMax} placeholder="60×60 / 90×88" />
                    </div>
                </div>
            </div>
            <div className="capability-purity-row">
                <span>Material purity</span>
                <fieldset aria-label="Material purity">
                    {(["pure", "blended"] as const).map((option) => (
                        <label key={option} className={props.materialPurity === option ? "is-selected" : ""}>
                            <input className="sr-only" type="radio" name="materialPurityChoice" value={option} checked={props.materialPurity === option} onChange={() => props.setMaterialPurity(option)} />
                            <span>{option === "pure" ? "Pure" : "Blended"}</span>
                        </label>
                    ))}
                </fieldset>
                {props.materialPurity === "blended" && <input aria-label="Blend description" name="blendDescription" required defaultValue={props.values.blendDescription} placeholder="65% polyester, 35% cotton" />}
            </div>
        </CapabilityFormSection>
    );
}
