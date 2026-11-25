import { apiRequest } from "../../../lib/api";
export const rfqApi = {
  rematch: (id:string,note="") => apiRequest<{createdCount:number;totalMatchCount:number;message:string}>(`/api/v1/admin/rfqs/${id}/matches/re-run`,{method:"POST",body:JSON.stringify({note})}),
  manual: (id:string,supplierId:string,note:string) => apiRequest<{notification?:{message:string}}>(`/api/v1/admin/rfqs/${id}/manual-match`,{method:"POST",body:JSON.stringify({supplierId,note})}),
  decide: (id:string,decision:"forward"|"reject",note:string) => apiRequest<{changedCount:number;notification?:{message:string};failures?:Array<{message:string}>}>(`/api/v1/admin/rfq-match-approvals/${id}/${decision}`,{method:"POST",body:JSON.stringify({note})}),
};
