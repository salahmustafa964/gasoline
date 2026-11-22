import {esc} from "./util.js";
const CSS=`body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#12303b;font-size:12px;line-height:1.6;margin:0}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:16px 0 6px;border-bottom:2px solid #d98e04;padding-bottom:3px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #c9d3d9;padding:4px 6px;text-align:right;font-size:11px}th{background:#eef1f4}
.num{text-align:left;font-variant-numeric:tabular-nums}.sum{display:flex;gap:8px;margin:10px 0}.sum div{flex:1;border:1px solid #c9d3d9;padding:6px 8px}.sum b{display:block;font-size:15px}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #12303b;padding-bottom:8px}
.tot td{font-weight:700;background:#f6e7c4}tr{page-break-inside:avoid}thead{display:table-header-group}@page{size:A4;margin:12mm}`;
export function printDoc(title,body){
 const fr=document.createElement("iframe");
 fr.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0";
 document.body.appendChild(fr);
 const d=fr.contentDocument;d.open();
 d.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`);
 d.close();
 const old=document.title,go=()=>{document.title=title;try{fr.contentWindow.focus();fr.contentWindow.print()}finally{setTimeout(()=>{document.title=old;fr.remove()},60000)}};
 const ready=d.fonts&&d.fonts.ready?d.fonts.ready:Promise.resolve();
 setTimeout(()=>ready.then(go,go),700);
}
