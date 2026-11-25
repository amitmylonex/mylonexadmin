export const adminNavigation = [
  {id:"dashboard",slug:"dashboard",label:"Dashboard"},
  {id:"suppliers",slug:"suppliers",label:"Suppliers"},
  {id:"buyers",slug:"buyers",label:"Buyers"},
  {id:"rfq-approvals",slug:"rfq-approvals",label:"RFQ Approval Queue"},
  {id:"quote-approvals",slug:"quote-approvals",label:"Quote Approval Queue"},
  {id:"rfqs",slug:"rfqs",label:"All RFQs"},
  {id:"rfq-tracking",slug:"rfq-tracking",label:"RFQ Tracking"},
  {id:"catalog",slug:"suppliers/catalog",label:"Supplier Catalog Control"},
  {id:"samples",slug:"samples",label:"Sampling Requests"},
  {id:"accepted-orders",slug:"accepted-orders",label:"Accepted Orders"},
] as const;
export const navigationForRole = (role: string) => role === "ADMIN" ? adminNavigation : [];
