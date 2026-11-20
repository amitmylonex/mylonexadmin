import React, { useState } from "react";
import { apiRequest } from "../lib/api";
import { supplierAccountSchema } from "../features/suppliers/supplier-validation";
import { UserPlus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface CreateSupplierFormProps {
  onSupplierCreated: () => void;
}

export function CreateSupplierForm({ onSupplierCreated }: CreateSupplierFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    gstNumber: "",
    supplierType: "manufacturer",
    city: "",
    locationState: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const validated = supplierAccountSchema.safeParse(form);
    if (!validated.success) {
      setFeedback({ ok: false, message: validated.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
      return;
    }
    setLoading(true);
    setFeedback(null);

    try {
      const res = await apiRequest<{ ok: boolean; message: string }>("/api/v1/admin/suppliers", {
        method: "POST",
        body: JSON.stringify(validated.data),
      });

      setFeedback({
        ok: true,
        message: res.message || "Supplier account created successfully! Approval is pending.",
      });

      setForm({
        fullName: "",
        companyName: "",
        email: "",
        phone: "",
        gstNumber: "",
        supplierType: "manufacturer",
    city: "",
    locationState: "",
      });

      onSupplierCreated();
    } catch (err: any) {
      setFeedback({
        ok: false,
        message: err.message || "Could not create supplier account. Check the inputs and retry.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 sm:p-6 border border-border">
      <button type="button" aria-expanded={isOpen} aria-controls="supplier-create-form" disabled={loading}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left cursor-pointer select-none flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Create Supplier Account</h2>
            <p className="text-xs text-muted">Directly onboard a verified textile mill or supplier</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold text-primary hover:text-brand-deep transition"
        >
          {isOpen ? "Close form ↑" : "+ Onboard supplier"}
        </span>
      </button>

      {isOpen && (
        <form id="supplier-create-form" noValidate onSubmit={handleSubmit} className="mt-5 pt-5 border-t border-border space-y-4">
          <fieldset disabled={loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="supplier-fullName" className="label block mb-1 text-xs">Full Name *</label>
              <input
                type="text"
                required
                id="supplier-fullName" value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Ramesh Patel"
                className="input text-xs w-full"
              />
            </div>

            <div>
              <label htmlFor="supplier-companyName" className="label block mb-1 text-xs">Company Name *</label>
              <input
                type="text"
                required
                id="supplier-companyName" value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="e.g. Surat Weaving Mills Ltd"
                className="input text-xs w-full"
              />
            </div>

            <div>
              <label htmlFor="supplier-email" className="label block mb-1 text-xs">Company Email Address *</label>
              <input
                type="email"
                required
                id="supplier-email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="supplier@suratweaving.com"
                className="input text-xs w-full"
              />
            </div>

            <div>
              <label htmlFor="supplier-phone" className="label block mb-1 text-xs">Phone Number *</label>
              <input
                type="tel"
                pattern="[+0-9 ()-]{7,20}"
                maxLength={20}
                required
                id="supplier-phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 9876543210"
                className="input text-xs w-full"
              />
            </div>

            <div>
              <label htmlFor="supplier-gstNumber" className="label block mb-1 text-xs">GST / Tax ID (Optional)</label>
              <input
                type="text"
                maxLength={15} pattern="([0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z])?" id="supplier-gstNumber" value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                placeholder="24AAACA1234A1Z5"
                className="input text-xs w-full"
              />
            </div>

            <div>
              <label htmlFor="supplier-supplierType" className="label block mb-1 text-xs">Supplier Type *</label>
              <select
                id="supplier-supplierType" value={form.supplierType}
                onChange={(e) => setForm({ ...form, supplierType: e.target.value })}
                className="input text-xs w-full"
              >
                <option value="manufacturer">Manufacturer</option>
                <option value="trader">Trader</option>
                <option value="buying_house">Buying House</option>
              </select>
            </div>
            {([['city', 'City'], ['locationState', 'State']] as const).map(([key, label]) => <label key={key} className="text-xs font-semibold">{label} (optional)<input className="input mt-1 w-full" maxLength={200} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
          </fieldset>

          {feedback && (
            <div
              role="status"
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedback.ok
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {feedback.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => setIsOpen(false)}
              className="btn-outline text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs px-5 py-2 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                "Create supplier account"
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
