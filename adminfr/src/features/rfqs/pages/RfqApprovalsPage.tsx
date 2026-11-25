import { useState } from "react";
import { PendingRfqApprovalsPage } from "./PendingRfqApprovalsPage";
import { RfqMatchApprovals } from "../components/RfqMatchApprovals";
import { PageHeading } from "../../../components/tables/AdminTable";

export function RfqApprovalsPage({ onSelectRfq }: { onSelectRfq?: (id: string) => void }) {
  // Open requests first: an RFQ can need review before any supplier match exists.
  // Do not restore the old matches-only preference when entering this page.
  const [queue, setQueue] = useState(() => new URLSearchParams(window.location.search).get("queue") === "matches" ? "matches" : "rfqs");
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
    <PageHeading title="RFQ Approval Queue" description={queue === "matches" ? "Incoming RFQ matches awaiting admin forwarding to suppliers." : "Incoming buyer RFQs awaiting admin review and supplier routing."} />
    <div role="tablist" aria-label="RFQ approval workflows" className="flex flex-wrap gap-2">
      {[["rfqs", "Buyer RFQ review"], ["matches", "Supplier match approvals"]].map(([value, label]) =>
        <button key={value} id={`queue-tab-${value}`} role="tab" tabIndex={queue === value ? 0 : -1} aria-selected={queue === value} aria-controls={`queue-panel-${value}`} className={queue === value ? "btn-primary" : "btn-ghost"} onClick={() => setQueue(value)} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "rfqs" : event.key === "End" ? "matches" : queue === "matches" ? "rfqs" : "matches";
          setQueue(next); document.getElementById(`queue-tab-${next}`)?.focus();
        }}>{label}</button>)}
    </div>
    </div>
    <div id={`queue-panel-${queue}`} role="tabpanel" aria-labelledby={`queue-tab-${queue}`}>
      {queue === "matches" ? <RfqMatchApprovals onSelectRfq={onSelectRfq} onReviewRfqs={() => setQueue("rfqs")} /> : <PendingRfqApprovalsPage onSelectRfq={onSelectRfq} />}
    </div>
  </div>;
}
