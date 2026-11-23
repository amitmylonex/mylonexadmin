import React, { useState, useEffect } from "react";
import { LogOut, AlertTriangle } from "lucide-react";
import { FabricLoader } from "../FabricLoader";

interface ConfirmSignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmSignOutModal({
  isOpen,
  onClose,
  onConfirm,
}: ConfirmSignOutModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    try {
      setBusy(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Could not sign out. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl text-ink">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">
              Sign out of MyloNex?
            </h2>
            <p className="text-xs text-muted">Admin Console</p>
          </div>
        </div>

        <p className="text-xs text-ink/70 leading-relaxed mb-4">
          Are you sure you want to end your active administrator session? You
          will need to sign back in with your credentials to access operations.
        </p>

        {busy && (
          <div className="my-3 py-2 flex justify-center">
            <FabricLoader label="Signing out..." />
          </div>
        )}

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border/70">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="btn-outline text-xs px-4 py-2 w-full sm:w-auto"
          >
            Stay signed in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSignOut}
            className="btn text-xs px-4 py-2 bg-destructive text-white hover:bg-destructive/90 shadow-sm font-semibold w-full sm:w-auto"
          >
            {busy ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
