import {useAdminList} from "../../../hooks/useAdminList";
import {PageHeading,ListFeedback,Pagination} from "../../../components/tables/AdminTable";
import {Breadcrumbs} from "../../../components/layout/Breadcrumbs";
import {RfqRequestDetails} from "../components/RfqRequestDetails";
import {RfqSourcingActions} from "../components/RfqSourcingActions";
import {RfqMatchGroups} from "../components/RfqMatchGroups";
import type {RfqDetail} from "../types";
export function RfqDetailPage({id,onBack,onSelectSupplier,onTrackRfq}:{id:string;onBack:()=>void;onSelectSupplier?:(id:string)=>void;onTrackRfq?:(id:string)=>void}) {
  const list=useAdminList(`/api/v1/admin/rfqs/${id}`,"unused");
  const rfq=list.data?.rfq as RfqDetail|undefined;
  return <div className="space-y-6">
    <Breadcrumbs items={[{label:'Admin Console'},{label:'All RFQs',onClick:onBack},{label:rfq?.rfqNumber||'RFQ detail'}]}/>
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeading title={rfq?.rfqNumber||'RFQ detail'} description={rfq?.fabricName}/>{rfq?.requesterRole==='BUYER'&&onTrackRfq&&<button className="btn-outline" onClick={()=>onTrackRfq(id)}>View RFQ tracking</button>}</div>
    <ListFeedback list={list}/>
    {rfq&&<><RfqRequestDetails rfq={rfq}/><RfqSourcingActions rfq={rfq} onSaved={list.reload} onSelectSupplier={onSelectSupplier}/><RfqMatchGroups rfq={rfq} onSaved={list.reload}/><Pagination list={list}/></>}
  </div>;
}
