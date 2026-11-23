import React from "react";

export function Badge({
  variant = "default",
  children,
}: {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
  children: React.ReactNode;
}) {
  const styles = {
    default: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    destructive: "bg-rose-50 text-rose-700 border-rose-200",
    outline: "bg-white text-slate-700 border-slate-300",
  }[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${styles}`}
    >
      {children}
    </span>
  );
}

export function SupplierStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="success">Approved</Badge>;
    case "PENDING":
      return <Badge variant="warning">Pending Approval</Badge>;
    case "SUSPENDED":
      return <Badge variant="destructive">Suspended</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
