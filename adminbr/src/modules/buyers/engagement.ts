export type BuyerEngagementStatus =
  | "converted"
  | "active"
  | "registered"
  | "inactive";

export type BuyerEngagementInput = {
  rfqCount: number;
  sampleCount: number;
  openRfqCount: number;
  openSampleCount: number;
  acceptedOrderCount: number;
};

export function deriveBuyerEngagementStatus(
  input: BuyerEngagementInput,
): BuyerEngagementStatus {
  if (input.acceptedOrderCount > 0) {
    return "converted";
  }
  if (input.openRfqCount > 0 || input.openSampleCount > 0) {
    return "active";
  }
  if (input.rfqCount === 0 && input.sampleCount === 0) {
    return "registered";
  }
  return "inactive";
}

export function engagementStatusLabel(status: BuyerEngagementStatus): string {
  switch (status) {
    case "converted":
      return "Converted";
    case "active":
      return "Active";
    case "registered":
      return "Registered";
    case "inactive":
      return "Inactive";
  }
}

export function engagementStatusBadgeClass(
  status: BuyerEngagementStatus,
): string {
  switch (status) {
    case "converted":
      return "bg-emerald-100 text-emerald-800";
    case "active":
      return "bg-blue-100 text-blue-800";
    case "registered":
      return "bg-slate-100 text-slate-700";
    case "inactive":
      return "bg-amber-100 text-amber-800";
  }
}
