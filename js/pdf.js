import {esc} from "./util.js?v=18";
const CSS=`#printroot{display:none}
@media print{
body>*:not(#printroot){display:none!important}
#printroot{display:block!important;color:#12303b;font-size:12px;line-height:1.6;background:#fff}
#printroot h1{font-size:20px;margin:0}
#printroot h2{font-size:15px;margin:16px 0 6px;border-bottom:2px solid #d98e04;padding-bottom:3px}
#printroot table{width:100%;border-collapse:collapse}
#printroot th,#printroot td{border:1px solid #c9d3d9;padding:4px 6px;text-align:right;font-size:11px}
#printroot th{background:#eef1f4}
#printroot .num{text-align:left}
#printroot .sum{display:flex;gap:8px;margin:10px 0}
#printroot .sum div{flex:1;border:1px solid #c9d3d9;padding:6px 8px}
#printroot .sum b{display:block;font-size:15px}
#printroot .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #12303b;padding-bottom:8px}
#printroot .tot td{font-weight:700;background:#f6e7c4}
#printroot tr{page-break-inside:avoid}
#printroot thead{display:table-header-group}
@page{size:A4;margin:12mm}}`;
export function printDoc(title,body){
 let st=document.getElementById("printcss");
 if(!st){st=document.createElement("style");st.id="printcss";st.textContent=CSS;document.head.appendChild(st)}
 const old0=document.getElementById("printroot");if(old0)old0.remove();
 const root=document.createElement("div");root.id="printroot";root.innerHTML=body;document.body.appendChild(root);
 const oldTitle=document.title;document.title=title;
 const done=()=>{document.title=oldTitle;root.remove();removeEventListener("afterprint",done)};
 addEventListener("afterprint",done);
 setTimeout(()=>window.print(),200);
}
