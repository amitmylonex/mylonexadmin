import React,{createContext,useCallback,useContext,useMemo,useState} from "react";
import {apiRequest} from "../../../lib/api";
import {queryClient} from "../../../services/query-client";
type Integration={refresh:()=>void;close:()=>void;uploading:(busy:boolean)=>void};
const Context=createContext<Integration|null>(null);
export function CatalogIntegration({onSaved,onClose,children}:{onSaved:()=>void;onClose?:()=>void;children:React.ReactNode}){
  const [uploads,setUploads]=useState(0);
  const uploading=useCallback((busy:boolean)=>setUploads(count=>Math.max(0,count+(busy?1:-1))),[]);
  const value=useMemo(()=>({refresh:onSaved,close:onClose||(()=>{}),uploading}),[onSaved,onClose,uploading]);
  return <Context.Provider value={value}><fieldset disabled={uploads>0} className="min-w-0 w-full">{children}</fieldset></Context.Provider>;
}
function useIntegration(){const value=useContext(Context);if(!value)throw new Error("Catalog integration provider is missing");return value;}
export function useCatalogRouter(){const value=useIntegration();return {refresh:value.refresh,push:(_path?:string)=>value.close(),replace:(_path?:string)=>value.close()};}
export function useCatalogRequest(){
  const {uploading}=useIntegration();
  return async(path:string,init:RequestInit={}):Promise<{ok:boolean;json:()=>Promise<{data?:any;error?:{message:string;details?:any}}>}>=>{
    let imageUpload=false;
    try{
      if(init.body instanceof FormData){
        imageUpload=true;uploading(true);
        const files=init.body.getAll("files").filter((file):file is File=>file instanceof File);
        if(!files.length||files.length>20)throw new Error("Select between one and twenty images");
        for(const file of files)if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)throw new Error("Use JPG, PNG or WEBP images up to 10MB each");
        const urls:string[]=[];
        for(const file of files){
          const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});
          const result=await apiRequest<{imageUrl:string}>(path,{method:"POST",body:JSON.stringify({contentType:file.type,data})});urls.push(result.imageUrl);
        }
        return {ok:true,json:async()=>({data:{urls}})};
      }
      const original=path;
      path=path.replace(/\/(fabric-collections|woven-listings|capabilities)(?=\/|$)/,(_match,kind:string)=>"/manage/"+({"fabric-collections":"collections","woven-listings":"woven",capabilities:"capabilities"} as Record<string,string>)[kind]);
      if(/\/quick-add\//.test(path))path=path.replace("/quick-add/","/manage/fabrics/");
      const method=init.method==="PATCH"&&path!==original?"PUT":init.method;
      // Catalog forms share the same first-page read as the supplier overview.
      // Deduplicate concurrent mounts and reuse it when revisiting the tab.
      const readPath = /\/catalog$/.test(path) ? `${path}?page=1&pageSize=20` : path;
      const result = (!method || method.toUpperCase() === "GET")
        ? await queryClient.fetchQuery({queryKey:["admin",readPath],queryFn:()=>apiRequest<any>(readPath,{...init,method})})
        : await apiRequest<any>(path,{...init,method});
      return {ok:true,json:async()=>({data:result.item??result})};
    }catch(error:any){return {ok:false,json:async()=>({error:{message:error.message||"Unable to save catalog",details:error.details}})};}
    finally{if(imageUpload)uploading(false);}
  };
}
