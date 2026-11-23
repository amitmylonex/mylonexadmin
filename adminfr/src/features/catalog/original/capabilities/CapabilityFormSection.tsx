import type { ReactNode } from "react";

type Props = {
    number: string;
    title: string;
    hint?: string;
    id: string;
    children: ReactNode;
};

export default function CapabilityFormSection({ number, title, hint, id, children }: Props) {
    return (
        <section className="capability-form-section" aria-labelledby={id}>
            <div className="capability-section-heading">
                <span>{number}</span>
                <h2 id={id}>{title}</h2>
                {hint && <p>{hint}</p>}
            </div>
            {children}
        </section>
    );
}
