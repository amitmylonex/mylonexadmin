"use client";

import { useId, useState } from "react";
import type { CapabilityOption } from "./capability-options";

type Props = {
    label: string;
    options: readonly CapabilityOption[];
    value: string[];
    onChange: (_value: string[]) => void;
    addLabel?: string;
};

function normalise(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9%]+/g, "");
}

function includesEquivalent(items: string[], candidate: string) {
    return items.some((item) => normalise(item) === normalise(candidate));
}

export default function ChipSelector({ label, options, value, onChange, addLabel = "Add your own" }: Props) {
    const inputId = useId();
    const [adding, setAdding] = useState(false);
    const [customValue, setCustomValue] = useState("");
    const customOptions = value
        .filter((item) => !options.some((option) => normalise(option.value) === normalise(item) || normalise(option.label) === normalise(item)))
        .filter((item, index, items) => items.findIndex((candidate) => normalise(candidate) === normalise(item)) === index);

    function toggle(option: CapabilityOption) {
        const selected = includesEquivalent(value, option.value) || includesEquivalent(value, option.label);
        onChange(selected
            ? value.filter((item) => normalise(item) !== normalise(option.value) && normalise(item) !== normalise(option.label))
            : [...value, option.value]);
    }

    function addCustom() {
        const next = customValue.trim();
        if (!next) return;
        const preset = options.find((option) => normalise(option.value) === normalise(next) || normalise(option.label) === normalise(next));
        const canonicalValue = preset?.value ?? next;
        if (!includesEquivalent(value, canonicalValue)) onChange([...value, canonicalValue]);
        setCustomValue("");
        setAdding(false);
    }

    return (
        <div className="capability-choice-row" role="group" aria-labelledby={`${inputId}-label`}>
            <span id={`${inputId}-label`} className="capability-choice-label">{label}</span>
            <div className="capability-chip-list">
                {options.map((option) => {
                    const selected = includesEquivalent(value, option.value) || includesEquivalent(value, option.label);
                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            className={selected ? "capability-chip is-selected" : "capability-chip"}
                            onClick={() => toggle(option)}
                        >
                            {option.label}
                        </button>
                    );
                })}
                {customOptions.map((option) => (
                    <button key={option} type="button" aria-pressed="true" className="capability-chip is-selected" onClick={() => onChange(value.filter((item) => normalise(item) !== normalise(option)))}>
                        {option}
                    </button>
                ))}
                {adding ? (
                    <span className="capability-custom-value">
                        <label className="sr-only" htmlFor={inputId}>{`Custom ${label}`}</label>
                        <input
                            id={inputId}
                            autoFocus
                            value={customValue}
                            onChange={(event) => setCustomValue(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    addCustom();
                                }
                                if (event.key === "Escape") setAdding(false);
                            }}
                        />
                        <button type="button" onClick={addCustom}>Add</button>
                    </span>
                ) : (
                    <button type="button" className="capability-chip is-add" onClick={() => setAdding(true)}>
                        + {addLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
