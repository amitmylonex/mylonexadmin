import { FolderKanban } from "lucide-react";
import { CatalogWorkspace } from "../../catalog/CatalogWorkspace";
import { CatalogEditor, EditTarget } from "../../catalog/CatalogEditor";
import React, { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { SupplierStatusBadge } from "../../../components/Badge";
import { StatusUpdateModal } from "../../../components/StatusUpdateModal";
import { SupplierWhatsAppConsentCard } from "../../../components/SupplierWhatsAppConsentCard";
import { maskSupplierPhone } from "../supplier-phone";
import {
  ArrowLeft,
  Building2,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Ban,
  Layers,
  Loader2,
  Archive,
  RotateCcw,
} from "lucide-react";

interface SupplierDetailData {
  id: string;
  companyName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  supplierType: string | null;
  gstNumber: string | null;
  dispatchLocation: string | null;
  warehouseLocation: string | null;
  fulfillmentRegions: string[];
  status: string;
  whatsappConsent: boolean;
  whatsappConsentAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    createdAt: string;
  };
  _count: {
    supplierCatalogEntries: number;
    fabricCollections: number;
    communicationRequestMatches: number;
    wovenProducts: number;
    capabilities: number;
  };
}

interface CatalogData {
  fabricCollections: Array<{
    id: string;
    name: string;
    isArchived: boolean;
    _count: { catalogEntries: number };
  }>;
  catalogEntries: Array<{
    id: string;
    mylonexCode: string | null;
    fabricName: string;
    weaveType: string;
    gsm: number;
    isActive: boolean;
    pricePerMeter: number | string;
    minimumOrderQuantity: number;
  }>;
  wovenProducts: Array<{
    id: string;
    compositionText: string | null;
    weaveType: string;
    gsmFinished: number;
    isActive: boolean;
  }>;
  capabilities: Array<{
    id: string;
    capabilityName: string;
    listingType: string;
    materialPurity: string | null;
    isActive: boolean;
  }>;
}

export function SupplierDetailPage({
  supplierId,
  initialTab = "overview",
  onBack,
}: {
  supplierId: string;
  initialTab?: "overview" | "catalog";
  onBack: () => void;
}) {
  const [editor, setEditor] = useState<EditTarget | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loadError, setLoadError] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPages, setCatalogPages] = useState(1);
  const [supplier, setSupplier] = useState<SupplierDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "catalog">(initialTab);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab, supplierId]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Catalog tab data
  const [catalogData, setCatalogData] = useState<CatalogData | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchSupplier();
  }, [supplierId]);

  useEffect(() => {
    if (activeTab === "catalog") {
      fetchCatalog();
    }
  }, [activeTab, supplierId, catalogPage]);

  const fetchSupplier = async (background = false) => {
    try {
      if (!background) setLoading(true);
      setLoadError("");
      const res = await apiRequest<{ supplier: SupplierDetailData }>(
        `/api/v1/admin/suppliers/${supplierId}`
      );
      setSupplier(res.supplier);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Supplier could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      setCatalogLoading(true);
      const res = await apiRequest<CatalogData>(
        `/api/v1/admin/suppliers/${supplierId}/catalog?page=${catalogPage}&pageSize=20`
      );
      setCatalogData(res);
      setCatalogPages((res as any).totalPages || 1);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Catalog could not be loaded");
    } finally {
      setCatalogLoading(false);
    }
  };

  const toggleCatalogItemActive = async (
    type: "catalog" | "woven" | "capability",
    itemId: string,
    isActive: boolean
  ) => {
    try {
      setActionBusyId(itemId);
      await apiRequest(
        `/api/v1/admin/suppliers/${supplierId}/catalog/products/${itemId}`,
        { method: "PATCH", body: JSON.stringify({ isActive, sourceType: ({ catalog: "fabrics", woven: "woven", capability: "capabilities" } as const)[type] }) }
      );
      await fetchCatalog();
    } catch (err: any) {
      alert(err.message || "Failed to update item status");
    } finally {
      setActionBusyId(null);
    }
  };

  const toggleCollectionArchive = async (collectionId: string) => {
    try {
      setActionBusyId(collectionId);
      await apiRequest(
        `/api/v1/admin/suppliers/${supplierId}/catalog/collections/${collectionId}/toggle-archive`,
        { method: "POST" }
      );
      await fetchCatalog();
    } catch (err: any) {
      alert(err.message || "Failed to toggle collection archive status");
    } finally {
      setActionBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <span className="text-sm font-medium">Loading supplier profile...</span>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold text-ink">{loadError || "Supplier not found"}</p><button className="btn-outline text-xs" onClick={() => fetchSupplier()}>Retry</button>
        <button onClick={onBack} className="mt-3 btn-primary text-xs">
          Back to list
        </button>
      </div>
    );
  }

  const totalCatalogFabrics =
    (supplier._count.supplierCatalogEntries || 0) + (supplier._count.wovenProducts || 0);

  return (
    <div className="space-y-6">
      {activeTab === "catalog" ? <header className="legacy-catalog-page-heading"><button onClick={onBack}>← Back to Supplier Catalog Control</button><p className="label mt-3">Admin Console</p><h1 className="text-2xl font-semibold text-ink">Catalog Control: {supplier.companyName}</h1><p className="mt-1 text-sm text-ink/60">Supplier status: {supplier.status}</p></header> : <>
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to suppliers
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink tracking-tight">
              {supplier.companyName}
            </h1>
            <SupplierStatusBadge status={supplier.status} />
          </div>
          <p className="text-xs text-muted font-mono mt-1">Supplier ID: {supplier.id}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === "overview" ? "catalog" : "overview")}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
          >
            <FolderKanban className="w-4 h-4" />
            <span>{activeTab === "overview" ? "Manage Catalog →" : "View Overview"}</span>
          </button>

          {supplier.status === "PENDING" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Approve Supplier
            </button>
          )}

          {supplier.status === "APPROVED" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn text-xs bg-rose-600 text-white hover:bg-rose-700 font-semibold"
            >
              <Ban className="w-4 h-4 mr-1.5" />
              Suspend Supplier
            </button>
          )}

          {supplier.status === "SUSPENDED" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Re-activate Supplier
            </button>
          )}

          <button onClick={() => setIsModalOpen(true)} className="btn-outline text-xs">
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Change Status
          </button>
        </div>
      </div>

      </>}

      {/* Tab 1: Profile Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Profile */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Building2 className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted">
                  Business Profile
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted font-medium">Supplier Type</span>
                  <p className="font-semibold text-ink mt-0.5 capitalize">
                    {supplier.supplierType || "Not specified"}
                  </p>
                </div>
                <div>
                  <span className="text-muted font-medium">GST / Tax ID</span>
                  <p className="font-semibold text-ink mt-0.5">
                    {supplier.gstNumber || "Not provided"}
                  </p>
                </div>
                <div>
                  <span className="text-muted font-medium">City / Head Office</span>
                  <p className="font-semibold text-ink mt-0.5">
                    {supplier.city || "Not specified"}
                  </p>
                </div>
                <div>
                  <span className="text-muted font-medium">Dispatch Location</span>
                  <p className="font-semibold text-ink mt-0.5">
                    {supplier.dispatchLocation || "Not specified"}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted font-medium">Registered Address</span>
                  <p className="font-semibold text-ink mt-0.5">{supplier.address || "Not provided"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted font-medium">Warehouse Location</span>
                  <p className="font-semibold text-ink mt-0.5">
                    {supplier.warehouseLocation || "Not specified"}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted font-medium">Fulfillment Regions</span>
                  <p className="font-semibold text-ink mt-0.5">
                    {supplier.fulfillmentRegions?.length > 0
                      ? supplier.fulfillmentRegions.join(", ")
                      : "Not specified"}
                  </p>
                </div>
              </div>
            </div>

            {/* Account Credentials */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Mail className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted">
                  Account Credentials
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-muted font-medium">Contact Person</span>
                  <p className="font-semibold text-ink mt-0.5">
                    {supplier.user.fullName || "Not provided"}
                  </p>
                </div>
                <div>
                  <span className="text-muted font-medium">Email</span>
                  <p className="font-semibold text-ink mt-0.5 font-mono">
                    {supplier.user.email}
                  </p>
                </div>
                <div>
                  <span className="text-muted font-medium">Phone</span>
                  <p className="font-semibold text-ink mt-0.5">
                    {maskSupplierPhone(supplier.phone, supplier.phoneCountryCode)}
                  </p>
                </div>
                <div className="pt-2 border-t border-border flex items-center justify-between text-muted">
                  <span>Account Created</span>
                  <span>{new Date(supplier.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Platform Activity */}
            <div className="card p-6 space-y-4 md:col-span-2">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent" />
                  <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted">
                    Platform Engagement & Fulfillment
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Manage items in catalog →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-canvas p-4 rounded-xl border border-border">
                  <span className="text-muted font-medium">Catalog Listings</span>
                  <p className="text-2xl font-bold text-ink mt-1">
                    {supplier._count.supplierCatalogEntries}
                  </p>
                </div>
                <div className="bg-canvas p-4 rounded-xl border border-border">
                  <span className="text-muted font-medium">Woven Products</span>
                  <p className="text-2xl font-bold text-ink mt-1">
                    {supplier._count.wovenProducts}
                  </p>
                </div>
                <div className="bg-canvas p-4 rounded-xl border border-border">
                  <span className="text-muted font-medium">Collections</span>
                  <p className="text-2xl font-bold text-ink mt-1">
                    {supplier._count.fabricCollections}
                  </p>
                </div>
                <div className="bg-canvas p-4 rounded-xl border border-border">
                  <span className="text-muted font-medium">RFQ Matches</span>
                  <p className="text-2xl font-bold text-ink mt-1">
                    {supplier._count.communicationRequestMatches}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive WhatsApp RFQ Notifications Card */}
          <SupplierWhatsAppConsentCard
            supplierId={supplier.id}
            companyName={supplier.companyName}
            phone={supplier.phone}
            phoneCountryCode={supplier.phoneCountryCode}
            whatsappConsent={supplier.whatsappConsent}
            whatsappConsentAt={supplier.whatsappConsentAt}
            onConsentUpdated={fetchSupplier}
          />
        </div>
      )}

      {/* Tab 2: Supplier Catalog Control */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          {feedback && <p role="status" className="card p-3 text-sm">{feedback}</p>}
          {editor && <CatalogEditor supplierId={supplier.id} collections={catalogData?.fabricCollections || []} target={editor} onClose={() => setEditor(null)} onSaved={() => { setFeedback("Catalog saved successfully."); fetchCatalog(); fetchSupplier(true); }} />}
          <CatalogWorkspace supplierId={supplier.id} supplierName={supplier.companyName} collections={catalogData?.fabricCollections || []} onSaved={() => { fetchCatalog(); fetchSupplier(true); }} />
          {catalogPages > 1 && <div className="catalog-pagination"><button disabled={catalogPage <= 1} onClick={() => setCatalogPage(p => p-1)}>Previous</button><span>Catalog page {catalogPage} of {catalogPages}</span><button disabled={catalogPage >= catalogPages} onClick={() => setCatalogPage(p => p+1)}>Next</button></div>}

          {catalogLoading ? (
            <div className="p-16 flex flex-col items-center justify-center text-muted">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <span className="text-sm font-medium">Loading catalog items and collections...</span>
            </div>
          ) : !catalogData ? (
            <div className="card p-8 text-center text-muted">
              Could not load catalog details.
            </div>
          ) : (
            <>
              {/* Fabric Collections Section */}
              <section className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Collections</h2>
                    
                  </div>
                  <span className="text-xs font-semibold text-muted">
                    {catalogData.fabricCollections.length} collections
                  </span>
                </div>

                {catalogData.fabricCollections.length === 0 ? (
                  <p className="text-xs text-muted p-4 bg-canvas rounded-xl">
                    No collections found.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {catalogData.fabricCollections.map((col) => (
                      <div
                        key={col.id}
                        className="rounded-xl border border-border p-4 bg-white space-y-3 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-ink">{col.name}</h3>
                            <p className="text-xs text-muted mt-0.5">
                              {col._count.catalogEntries} linked fabrics
                            </p>
                          </div>
                          <span
                            className={`badge text-[10px] ${
                              col.isArchived
                                ? "bg-slate-200 text-slate-700"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {col.isArchived ? "Archived" : "Active"}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-border flex justify-end"><button className="btn-ghost text-xs" onClick={() => setEditor({ kind: "collections", id: col.id })}>Edit</button>
                          <button
                            type="button"
                            disabled={actionBusyId === col.id}
                            onClick={() => toggleCollectionArchive(col.id)}
                            className="btn-ghost text-xs px-2.5 py-1 flex items-center gap-1.5 text-muted hover:text-ink"
                          >
                            {actionBusyId === col.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : col.isArchived ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                            <span>{col.isArchived ? "Restore Collection" : "Archive Collection"}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Fabric Listings Section */}
              <section className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Fabric Listings</h2>
                    
                  </div>
                  <span className="text-xs font-semibold text-muted">
                    {catalogData.catalogEntries.length + catalogData.wovenProducts.length} fabrics
                  </span>
                </div>

                {catalogData.catalogEntries.length === 0 && catalogData.wovenProducts.length === 0 ? (
                  <p className="text-xs text-muted p-4 bg-canvas rounded-xl">
                    No fabric listings found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {catalogData.catalogEntries.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border p-3.5 bg-white shadow-xs flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              {item.mylonexCode || "PENDING"}
                            </span>
                            <span className="text-xs font-semibold text-ink">
                              {item.fabricName || item.mylonexCode || "Unnamed fabric"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted">
                            {item.weaveType} weave • {item.gsm} GSM • MOQ: {item.minimumOrderQuantity}m
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`badge text-[10px] ${
                              item.isActive
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </span>

                          <button className="btn-ghost text-xs" onClick={() => setEditor({ kind: "fabrics", id: item.id })}>Edit</button>
                          <button
                            type="button"
                            disabled={actionBusyId === item.id}
                            onClick={() => toggleCatalogItemActive("catalog", item.id, !item.isActive)}
                            className="btn-outline text-xs px-3 py-1 font-semibold"
                          >
                            {actionBusyId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : item.isActive ? (
                              "Deactivate"
                            ) : (
                              "Activate"
                            )}
                          </button>
                        </div>
                      </div>
                    ))}

                    {catalogData.wovenProducts.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border p-3.5 bg-white shadow-xs flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            {item.compositionText || "Woven Product"}
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            woven • {item.weaveType} • {item.gsmFinished} GSM
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`badge text-[10px] ${
                              item.isActive
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </span>

                          <button className="btn-ghost text-xs" onClick={() => setEditor({ kind: "woven", id: item.id })}>Edit</button>
                          <button
                            type="button"
                            disabled={actionBusyId === item.id}
                            onClick={() => toggleCatalogItemActive("woven", item.id, !item.isActive)}
                            className="btn-outline text-xs px-3 py-1 font-semibold"
                          >
                            {actionBusyId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : item.isActive ? (
                              "Deactivate"
                            ) : (
                              "Activate"
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Mill Capabilities Section */}
              <section className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Capabilities</h2>
                    
                  </div>
                  <span className="text-xs font-semibold text-muted">
                    {catalogData.capabilities.length} capabilities
                  </span>
                </div>

                {catalogData.capabilities.length === 0 ? (
                  <p className="text-xs text-muted p-4 bg-canvas rounded-xl">
                    No custom capabilities declared by this supplier.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {catalogData.capabilities.map((cap) => (
                      <div
                        key={cap.id}
                        className="rounded-xl border border-border p-3.5 bg-white shadow-xs flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-semibold text-ink">{cap.capabilityName}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {cap.listingType} • {cap.materialPurity || "pure"}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`badge text-[10px] ${
                              cap.isActive
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {cap.isActive ? "Active" : "Inactive"}
                          </span>

                          <button className="btn-ghost text-xs" onClick={() => setEditor({ kind: "capabilities", id: cap.id })}>Edit</button>
                          <button
                            type="button"
                            disabled={actionBusyId === cap.id}
                            onClick={() => toggleCatalogItemActive("capability", cap.id, !cap.isActive)}
                            className="btn-outline text-xs px-3 py-1 font-semibold"
                          >
                            {actionBusyId === cap.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : cap.isActive ? (
                              "Deactivate"
                            ) : (
                              "Activate"
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* Status Modal */}
      <StatusUpdateModal
        supplierId={supplier.id}
        companyName={supplier.companyName}
        currentStatus={supplier.status}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSupplier}
      />
    </div>
  );
}
