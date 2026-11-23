import {collection,getDocs,query,where,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n} from "./util.js?v=20";
export async function loadAll(db,P){
 const names=["sales","purchases","settlements","saleAllocations","ledger","expenses"];
 const r=await Promise.all(names.map(c=>getDocs(query(collection(db,c),where("periodId","==",P),limit(5000)))));
 const m=r.map(s=>s.docs.map(d=>({id:d.id,...d.data()})));
 return {sales:m[0],purchases:m[1],settlements:m[2],allocs:m[3],ledger:m[4],expenses:m[5]};
}
export function batchStats(D){
 const sm={};D.sales.forEach(s=>sm[s.id]=s);
 const st={};
 D.purchases.forEach(b=>{
  const adj=D.settlements.filter(s=>s.status==="approved"&&s.type==="cost"&&s.batchId===b.id).reduce((a,s)=>a+n(s.dTransport)+n(s.dStateFee)+n(s.dOther),0);
  const fin=n(b.remainingLiters)<=0;
  st[b.id]={b,sold:0,revenue:0,cost:0,finished:fin,finDate:fin?(b.finishedDate||b.date):"",extras:n(b.transport)+n(b.stateFee)+n(b.otherCost)+adj}});
 D.allocs.forEach(a=>{const x=st[a.batchId],s=sm[a.saleId];if(!x||!s)return;x.sold+=n(a.liters);x.revenue+=n(a.liters)*n(s.pricePerLiter);x.cost+=n(a.liters)*n(a.unitCost)});
 return Object.values(st);
}
export function periodProfit(D,from,to){
 const inR=d=>(!from||d>=from)&&(!to||d<=to);
 const sales=D.sales.filter(s=>inR(s.date));
 const revenue=sales.reduce((a,s)=>a+n(s.amount),0),cost=sales.reduce((a,s)=>a+n(s.costTotal),0),liters=sales.reduce((a,s)=>a+n(s.liters),0);
 const stats=batchStats(D);
 const extras=stats.filter(x=>x.finished&&inR(x.finDate)).reduce((a,x)=>a+x.extras,0);
 const pending=stats.filter(x=>!x.finished).reduce((a,x)=>a+x.extras,0);
 const q=D.settlements.filter(s=>s.status==="approved"&&s.type==="quantity"&&inR(s.date));
 const shortage=q.filter(s=>s.diff<0&&!s.chargeRepId).reduce((a,s)=>a+n(s.value),0);
 const surplus=q.filter(s=>s.diff>0).reduce((a,s)=>a+n(s.value),0);
 const expenses=(D.expenses||[]).filter(e=>!e.voided&&inR(e.date)).reduce((a,e)=>a+n(e.amount),0);
 const gross=revenue-cost;
 return {revenue,cost,gross,liters,extras,pending,shortage,surplus,expenses,net:gross-extras-shortage+surplus-expenses};
}
