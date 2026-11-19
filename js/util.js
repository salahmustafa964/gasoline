export const n=v=>Number(v)||0;
export const f=(v,d=0)=>n(v).toLocaleString("en-US",{maximumFractionDigits:d});
export const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const localToday=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
export const FS="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
