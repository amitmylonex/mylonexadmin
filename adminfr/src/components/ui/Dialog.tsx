import React, { useEffect, useId, useRef } from "react";
export function Dialog({
  open,
  title,
  onClose,
  children,
  busy = false,
  variant = "dialog",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
  variant?: "dialog" | "drawer";
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      style={variant === "drawer" ? {margin:0} : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className={variant === "drawer" ? "fixed inset-y-0 right-0 left-auto m-0 w-[min(640px,100vw)] max-w-none h-[100dvh] max-h-none overflow-auto border-l border-border bg-white p-6 backdrop:bg-slate-900/40" : "m-auto w-[min(740px,94vw)] max-h-[90vh] overflow-auto rounded-2xl border border-border bg-white p-6 backdrop:bg-slate-900/40"}
    >
      <header className="flex justify-between items-center border-b border-border pb-4 mb-5">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <button className="btn-ghost text-xs" disabled={busy} onClick={onClose}>
          Close
        </button>
      </header>
      {children}
    </dialog>
  );
}
