import type {ImgHTMLAttributes} from "react";
export default function Image({fill,unoptimized:_unoptimized,...props}:ImgHTMLAttributes<HTMLImageElement>&{fill?:boolean;unoptimized?:boolean}){
  return <img loading="lazy" decoding="async" {...props} style={fill?{position:"absolute",inset:0,width:"100%",height:"100%",...props.style}:props.style}/>;
}
