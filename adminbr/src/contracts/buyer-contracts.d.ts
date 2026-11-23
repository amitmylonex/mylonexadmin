export interface BuyerDirectoryItem {
  id: string; fullName: string | null; email: string; company: string | null; phone: string | null;
  city: string | null; gstNumber: string | null; createdAt: string; totalRfqs: number; totalInquiries: number;
  rfqCount: number; inquiryCount: number; sampleCount: number; orderCount: number; acceptedOrderCount: number;
  engagementStatus: string;
}
export interface BuyerOrderSummary {
  totalCount: number; productionCount: number; sampleCount: number; valuedOrderCount: number; unknownValueCount: number;
  totalValueEstimateInr: string | null; currency: "INR"; basis: string;
}
export interface AdminBuyerProfile {
  id: string; email: string; fullName: string | null; createdAt: string;
  buyerProfile: { id: string; company: string | null; phone: string | null; city: string | null; gstNumber: string | null; billingAddress: string | null } | null;
  billingAddress: string | null;
  verification: { emailVerified: boolean | null; emailVerifiedAt: string | null; gstVerified: null };
  _count: { inquiries: number; communicationRequests: number; samples: number; orders: number };
}
export interface BuyerActivity {
  id: string; rfqNumber?: string; sampleNumber?: string; sampleType?: string; fabricName?: string | null;
  quantity?: number; status: string; createdAt: string; orderNumber?: string; orderType?: string; totalValueEstimate?: string | null;
}
