export type RfqMatch = {
  id:string;supplierId:string;sourceType:string;score:number;explanation?:string;status:string;createdAt?:string;
  supplier:{companyName:string;status?:string;user?:{email?:string}};
  adminReviewNote?:string;supplierRejectionReason?:string;supplierRejectedAt?:string;whatsappStatus?:string;
  response?:{price:number|string;supplierOriginalPrice?:number|string;status:string;buyerDecision?:string;buyerDecisionReason?:string;adminReviewNote?:string;moq?:number;leadTimeDays?:number;quoteType?:string;totalValueEstimate?:Record<string,unknown>}|null;
};
export type RfqDetail = {
  id:string;rfqNumber:string;fabricName:string;quantity:number;status:string;requesterRole:string;
  buyer:{fullName?:string;email?:string};buyerMessage?:string;contactPhone?:string;productionCycle?:string;
  deliveryPincode?:string;requiredDeliveryDate?:string;targetPriceMin?:number;targetPriceMax?:number;createdAt?:string;
  buyerImageUrls?:string[];specPayload?:Record<string,unknown>;matches:RfqMatch[];_count?:{matches:number};matchCounts?:Record<string,number>;
};
