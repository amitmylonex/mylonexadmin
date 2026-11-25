import type { ReactNode } from "react";
export function EmptyState({ children = "No records found." }: { children?: ReactNode }) {
  return <p className="p-10 text-center text-sm text-muted">{children}</p>;
}
