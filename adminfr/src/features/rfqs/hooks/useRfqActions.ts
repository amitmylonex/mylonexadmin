import {useState} from "react";
export function useRfqActions(onSaved:()=>void) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function run(action:()=>Promise<string>){if(busy)return;setBusy(true);setMessage("");setError("");try{setMessage(await action());onSaved();}catch(failure){setError(failure instanceof Error?failure.message:"Action could not be completed.");}finally{setBusy(false);}}
  return {busy,message,error,run};
}
