import React, { useState } from "react";
import { useAdminList } from "../../../hooks/useAdminList";
import { apiRequest } from "../../../lib/api";
import {
  AdminTable,
  PageHeading,
  QueryToolbar,
  ListFeedback,
  Pagination,
  Status,
  date,
  money,
} from "../../../components/tables/AdminTable";
import { Dialog } from "../../../components/ui/Dialog";
export function AcceptedOrdersPage() {
  const [kind, setKind] = useState("legacy"),
    [target, setTarget] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const list = useAdminList(
    kind === "legacy"
      ? "/api/v1/admin/orders"
      : `/api/v1/admin/accepted-orders/${kind}`,
    "orders",
  );
  async function deliver() {
    setBusy(true);
    try {
      await apiRequest(
        `/api/v1/admin/accepted-orders/${kind}/${target.id}/delivered`,
        { method: "POST", body: "{}" },
      );
      setMessage("Delivery recorded successfully.");
      setTarget(null);
      list.reload();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeading
        title="Order Master View"
        description="Production quotes and sampling requests accepted by requesters, with commercial and delivery details."
      />
      <nav aria-label="Order type" className="flex gap-2 flex-wrap">
        {[
          ["legacy", "Platform order records"],
          ["production", "Accepted production quotes"],
          ["sampling", "Accepted samples"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={kind === value ? "btn-primary" : "btn-outline"}
            onClick={() => {
              setKind(value);
              list.setPage(1);
              list.setStatus("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {
        <QueryToolbar
          list={list}
          statuses={[
            { value: "pending", label: "Awaiting delivery" },
            { value: "delivered", label: "Delivered" },
          ]}
        />
      }
      <ListFeedback list={list} />
      {message && (
        <p role="status" className="card p-4 text-sm">
          {message}
        </p>
      )}
      <AdminTable
        items={list.items}
        columns={[
          {
            label: "Reference / fabric",
            render: (o) => (
              <>
                {o.sampleNumber ||
                  o.orderNumber ||
                  o.requestMatch?.communicationRequest.rfqNumber}
                <p className="text-xs text-muted">
                  {o.fabricName ||
                    o.requestMatch?.communicationRequest.fabricName ||
                    o.response?.requestMatch?.communicationRequest.fabricName ||
                    o.sample?.fabricName}
                </p>
              </>
            ),
          },
          {
            label: "Requester / supplier",
            render: (o) => (
              <>
                {o.buyer?.email ||
                  o.requestMatch?.communicationRequest.buyer.email}
                <p className="text-xs text-muted">
                  {o.supplier?.companyName ||
                    o.requestMatch?.communicationRequest.deliveryPincode ||
                    o.deliveryAddress}
                </p>
              </>
            ),
          },
          {
            label: "Commercials",
            render: (o) =>
              kind === "production" ? (
                <>
                  {money(o.price)}/m
                  <p className="text-xs">
                    {o.requestMatch.communicationRequest.quantity} m · Material{" "}
                    {money(
                      Number(o.price) *
                        Number(o.requestMatch.communicationRequest.quantity),
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    MOQ {o.moq || "—"} · {o.leadTimeDays} days
                  </p>
                </>
              ) : kind === "sampling" ? (
                <>
                  Material {money(o.quoteSampleCostInr)}
                  <p className="text-xs">
                    Courier {money(o.quoteCourierCostInr)} · {o.quantityMeters}{" "}
                    m
                  </p>
                  <p className="text-xs text-muted">
                    {o.quoteDeliveryTimeline}
                  </p>
                </>
              ) : o.response ? (
                <>
                  {money(o.response.price)}/m
                  <p className="text-xs">
                    {o.response.requestMatch.communicationRequest.quantity} m
                  </p>
                </>
              ) : (
                <>
                  Material {money(o.sample?.quoteSampleCostInr)} · courier{" "}
                  {money(o.sample?.quoteCourierCostInr)}
                </>
              ),
          },
          {
            label: "Accepted / delivery",
            render: (o) => (
              <>
                {date(o.buyerDecisionAt || o.createdAt)}
                <p className="mt-2">
                  {o.deliveredAt ? (
                    <Status value={`Delivered ${date(o.deliveredAt)}`} />
                  ) : (
                    <Status
                      value={kind === "legacy" ? o.status : "Awaiting delivery"}
                    />
                  )}
                </p>
              </>
            ),
          },
          {
            label: "Action",
            render: (o) =>
              kind === "legacy" ? (
                <button
                  className="btn-outline text-xs"
                  onClick={() => setTarget(o)}
                >
                  View order
                </button>
              ) : kind === "sampling" && !o.deliveredAt ? (<a className="text-primary text-xs" href={`/admin/samples?search=${encodeURIComponent(o.sampleNumber)}`}>Manage sample delivery</a>) : !o.deliveredAt ? (
                <button
                  className="btn-outline text-xs"
                  onClick={() => setTarget(o)}
                >
                  Mark delivered
                </button>
              ) : (
                "—"
              ),
          },
        ]}
      />
      <Pagination list={list} />
      <Dialog
        open={!!target}
        title={kind === "legacy" ? "Order details" : "Confirm delivery"}
        busy={busy}
        onClose={() => setTarget(null)}
      >
        {kind === "legacy" && target ? (
          <div className="space-y-4 text-sm">
            <h3 className="font-semibold">{target.orderNumber}</h3>
            <p>Buyer: {target.buyer.email}</p>
            <p>Supplier: {target.supplier.companyName}</p>
            <Status value={target.status} />
            <p>Tracking number: {target.trackingNumber || "Not recorded"}</p>
            <div className="flex gap-4">
              {[
                ["Invoice", target.invoiceUrl],
                ["Purchase order", target.purchaseOrderUrl],
              ].map(([label, url]) =>
                typeof url === "string" && /^https?:\/\//.test(url) ? (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {label}
                  </a>
                ) : null,
              )}
            </div>
            <h4 className="font-semibold">Recorded milestones</h4>
            {target.milestones?.length ? (
              target.milestones.map((m: any) => (
                <div key={m.id} className="border-l border-border pl-4">
                  <Status value={m.status} />
                  <p className="font-medium">{m.title}</p>
                  <p>{m.description}</p>
                  <time className="text-xs text-muted">
                    {date(m.createdAt)}
                  </time>
                </div>
              ))
            ) : (
              <p className="text-muted">No milestones recorded.</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm mb-5">
              Confirm that this accepted {kind} order has been delivered. The
              administrator and timestamp will be recorded.
            </p>
            <button className="btn-primary" disabled={busy} onClick={deliver}>
              Confirm delivered
            </button>
          </>
        )}
      </Dialog>
    </div>
  );
}
