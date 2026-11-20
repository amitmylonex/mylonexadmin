import React,{useState,lazy,Suspense} from "react";
import QuickAddForm from "./original/QuickAddForm";
import CreateCollectionForm,{type CreatedFabricCollection} from "./original/CreateCollectionForm";
import WovenListingForm from "./original/WovenListingForm";
import CapabilityForm from "./original/capabilities/CapabilityForm";
import {CatalogIntegration} from "./original/integration";
import "./original/catalog-original.css";
import "./catalog-parity.css";
const ExcelCatalogImport=lazy(()=>import("../../components/ExcelCatalogImport").then(m=>({default:m.ExcelCatalogImport})));
export function CatalogWorkspace({supplierId,supplierName,onSaved}: {supplierId:string;supplierName:string;collections:Array<{id:string;name:string;isArchived:boolean}>;onSaved:()=>void}){
  const [createdCollection,setCreatedCollection]=useState<CreatedFabricCollection|null>(null);
  const apiBasePath=`/api/v1/admin/suppliers/${supplierId}/catalog`;
  return <CatalogIntegration onSaved={onSaved}><div className="supplier-catalog-workspace original-admin-catalog space-y-8 w-full max-w-full min-w-0">
    <section aria-label="Add catalog from Excel" className="min-w-0"><Suspense fallback={<p className="text-sm text-muted">Loading Excel importer…</p>}><ExcelCatalogImport supplierId={supplierId} supplierName={supplierName} onImportComplete={onSaved}/></Suspense></section>
    <section aria-label="Create Quick-add fabric"><QuickAddForm apiBasePath={apiBasePath} createdCollection={createdCollection} topRowCollectionSlot={<CreateCollectionForm apiBasePath={apiBasePath} onCreated={collection=>{setCreatedCollection(collection);onSaved();}}/>}/></section>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full max-w-full min-w-0">
      <section className="card p-6 space-y-4 min-w-0" aria-label="Create Woven listing"><div><h2 className="text-lg font-bold text-slate-900">Create Woven Listing</h2><p className="text-xs text-slate-500 mt-0.5">Add full technical woven fabric specification.</p></div><WovenListingForm apiBasePath={apiBasePath}/></section>
      <section className="card p-6 space-y-4 min-w-0" aria-label="Create Capability"><div><h2 className="text-lg font-bold text-slate-900">Create Capability</h2><p className="text-xs text-slate-500 mt-0.5">Publish supplier manufacturing capability product line.</p></div><CapabilityForm apiBasePath={apiBasePath}/></section>
    </div>
  </div></CatalogIntegration>;
}
