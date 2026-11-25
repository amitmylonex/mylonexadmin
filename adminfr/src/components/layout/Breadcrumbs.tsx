export function Breadcrumbs({items}:{items:Array<{label:string;onClick?:()=>void}>}) {
  return <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-xs text-muted">{items.map((item,index)=><span key={index}>{index>0&&<span aria-hidden="true" className="mr-2">→</span>}{item.onClick?<button className="text-primary hover:underline" onClick={item.onClick}>{item.label}</button>:<span aria-current={index===items.length-1?"page":undefined}>{item.label}</span>}</span>)}</nav>;
}
