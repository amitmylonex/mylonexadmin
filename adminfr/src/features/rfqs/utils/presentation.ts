export function humanize(value:unknown):string {
  if(value==null)return "";
  const text=String(value).trim();
  if(!text||/^(undefined|null|nan)$/i.test(text))return "";
  if(text.toLowerCase()==="rfd")return "RFD";
  if(["gsm","epi","ppi","moq"].includes(text.toLowerCase()))return text.toUpperCase();
  const words=text.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ");
  return words[0].toUpperCase()+words.slice(1);
}
export const quantity=(value:unknown)=>value!=null&&String(value).trim()!==""&&Number.isFinite(Number(value))?`${Number(value).toLocaleString("en-IN")} m`:"";
export const rfqDate=(value:unknown)=>value&&Number.isFinite(new Date(String(value)).getTime())?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(String(value)))+" IST":"Not recorded";
export const safeImage=(url:string)=>{try{return ["https:","http:"].includes(new URL(url).protocol);}catch{return false;}};
