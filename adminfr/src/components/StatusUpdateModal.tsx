import React, { useState } from "react";
import { Button } from "./Button";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { apiRequest } from "../lib/api";

interface StatusUpdateModalProps {
  supplierId: string;
  companyName: string;
  currentStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StatusUpdateModal({
  supplierId,
  companyName,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>(
    currentStatus === "PENDING"
      ? "APPROVED"
      : currentStatus === "APPROVED"
      ? "SUSPENDED"
      : "APPROVED"
  );
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 5) {
      setError("Please provide a reason of at least 5 characters for the audit log.");
      return;
    }

    try {
      setIsLoading(true);
      await apiRequest(`/api/v1/admin/suppliers/${supplierId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedCurrentStatus: currentStatus,
          nextStatus: selectedStatus,
          reason: reason.trim(),
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.conflict) {
        setError(
          `Conflict: This supplier's status was modified to '${err.currentStatus}'. Please close and refresh.`
        );
      } else {
        setError(err.message ||"Failed to update supplier status");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="supplier-status-title" className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="supplier-status-title" className="text-base font-semibold text-slate-900">
                Update Supplier Status
              </h2>
              <p className="text-xs text-slate-500 font-medium">{companyName}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Current Status
              </label>
              <div className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                {currentStatus}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                New Target Status
              </label>
              <select
                aria-label="New target status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currentStatus !== "APPROVED" && (
                  <option value="APPROVED">APPROVED (Activate supplier for quotes)</option>
                )}
                {currentStatus !== "SUSPENDED" && (
                  <option value="SUSPENDED">SUSPENDED (Temporarily block participation)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Audit Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                aria-label="Audit reason"
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Verified business registration and production capacity via phone."
                rows={3}
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                This note is recorded in the backend audit log alongside your operator ID.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={selectedStatus === "APPROVED" ? "primary" : "destructive"}
                size="sm"
                isLoading={isLoading}
              >
                {selectedStatus === "APPROVED" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Approve Supplier
                  </>
                ) : (
                  "Confirm Transition"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
