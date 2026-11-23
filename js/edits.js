import {collection,doc,getDoc,getDocs,query,where,runTransaction,writeBatch,serverTimestamp,deleteField} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n} from "./util.js?v=19";
const r3=x=>Math.round(x*1000)/1000,r2=x=>Math.round(x*100)/100;
const aud=(user,action,col,id,before,after)=>({userId:user.uid,userName:user.name,action,collection:col,docId:id,before,after,createdAt:serverTimestamp()});
const byAge=(a,b)=>a.date.localeCompare(b.date)||(a.ts-b.ts);
const q1=(db,c,k,v)=>getDocs(query(collection(db,c),where(k,"==",v)));

// تعديل حمولة بيع: التاريخ، الجهة، اللترات، السعر. يُعاد توزيع الدفعات والتكلفة والمخزون والحساب.
export async function editSale(db,user,saleId,v){
 const date=v.date,L=n(v.liters),P=n(v.price),entity=(v.entity||"").trim();
 if(!date)throw new Error("أدخل التاريخ.");
 if(!(L>0)||!(P>0))throw new Error("أدخل كمية وسعرًا أكبر من صفر.");
 const s0=await getDoc(doc(db,"sales",saleId));if(!s0.exists())throw new Error("الحمولة غير موجودة.");
 const periodId=s0.data().periodId;
 const [al,mv,le,pu]=await Promise.all([q1(db,"saleAllocations","saleId",saleId),q1(db,"stockMovements","ref",saleId),q1(db,"ledger","ref",saleId),getDocs(query(collection(db,"purchases"),where("periodId","==",periodId)))]);
 const oldB=new Set(al.docs.map(d=>d.data().batchId));
 const ids=pu.docs.filter(d=>String(d.data().date)<=date||oldB.has(d.id)).map(d=>d.id);
 const amount=L*P;
 await runTransaction(db,async tx=>{
  const sref=doc(db,"sales",saleId),ss=await tx.get(sref);
  if(!ss.exists())throw new Error("الحمولة غير موجودة.");
  const old=ss.data();
  const snaps=await Promise.all(ids.map(id=>tx.get(doc(db,"purchases",id))));
  const pool=snaps.filter(s=>s.exists()).map(s=>{const x=s.data(),r=n(x.remainingLiters);return {id:s.id,date:String(x.date),ts:(x.createdAt&&x.createdAt.seconds)||0,uc:n(x.unitCost??x.pricePerLiter),init:r,rem:r}});
  al.docs.forEach(a=>{const p=pool.find(x=>x.id===a.data().batchId);if(p)p.rem+=n(a.data().liters)});
  const paid=le.docs.filter(d=>d.data().type==="payment").reduce((t,d)=>t-n(d.data().amount),0);
  if(paid>amount+0.005)throw new Error(`المسدّد على هذه الحمولة (${r2(paid)}) أكبر من قيمتها الجديدة. عدّل السداد أولًا.`);
  const elig=pool.filter(p=>p.date<=date).sort(byAge);
  const avail=elig.reduce((t,p)=>t+Math.max(p.rem,0),0);
  if(L>avail+0.0005)throw new Error(`المتاح في المخزون بتاريخ ${date} هو ${r3(avail)} لتر فقط.`);
  let need=L,cost=0;const na=[];
  for(const p of elig){if(need<=0)break;if(p.rem<=0)continue;const t=Math.min(p.rem,need);p.rem=r3(p.rem-t);need-=t;cost+=t*p.uc;na.push({id:p.id,t,uc:p.uc})}
  for(const p of pool){const fin=r3(p.rem);if(Math.abs(fin-r3(p.init))>0.0005)tx.update(doc(db,"purchases",p.id),fin<=0?{remainingLiters:0,finishedDate:date}:{remainingLiters:fin,finishedDate:deleteField()})}
  al.docs.forEach(a=>tx.delete(a.ref));
  na.forEach(a=>tx.set(doc(collection(db,"saleAllocations")),{date,periodId,createdBy:user.uid,createdAt:serverTimestamp(),saleId,batchId:a.id,liters:a.t,unitCost:a.uc}));
  tx.update(sref,{date,periodId,entity,liters:L,pricePerLiter:P,amount,costTotal:cost,updatedBy:user.uid,updatedAt:serverTimestamp()});
  const m=mv.docs.find(d=>d.data().type==="sale");
  if(m)tx.update(m.ref,{date,periodId,liters:-L});else tx.set(doc(collection(db,"stockMovements")),{date,periodId,type:"sale",liters:-L,ref:saleId,createdBy:user.uid,createdAt:serverTimestamp()});
  le.docs.forEach(d=>{const x=d.data();if(x.type==="sale")tx.update(d.ref,{date,periodId,amount,entity});else if((x.entity||"")!==entity)tx.update(d.ref,{entity})});
  tx.set(doc(collection(db,"auditLog")),aud(user,"تعديل بيع","sales",saleId,{date:old.date,entity:old.entity,liters:old.liters,pricePerLiter:old.pricePerLiter,amount:old.amount,repName:old.repName},{date,entity,liters:L,pricePerLiter:P,amount,repName:old.repName}));
 });
}

// تعديل سداد: التاريخ، المبلغ، الحساب، الطريقة، الملحوظة
export async function editPayment(db,user,id,v,accName){
 const a=n(v.amount),date=v.date;
 if(!date)throw new Error("أدخل التاريخ.");
 if(!(a>0))throw new Error("أدخل مبلغًا أكبر من صفر.");
 const ref=doc(db,"ledger",id),s=await getDoc(ref);
 if(!s.exists())throw new Error("السداد غير موجود.");
 const old=s.data();
 if(old.ref){
  const [ss,ls]=await Promise.all([getDoc(doc(db,"sales",old.ref)),q1(db,"ledger","ref",old.ref)]);
  if(ss.exists()){const others=ls.docs.filter(d=>d.id!==id&&d.data().type==="payment").reduce((t,d)=>t-n(d.data().amount),0);
   if(others+a>n(ss.data().amount)+0.005)throw new Error(`المبلغ أكبر من المتبقي على الحمولة (${r2(n(ss.data().amount)-others)}).`)}}
 const nw={date,amount:-a,accountId:v.accountId||"",accountName:v.accountId?accName:"",method:v.method||"",note:(v.note||"").trim()};
 const b=writeBatch(db);
 b.update(ref,{...nw,updatedBy:user.uid,updatedAt:serverTimestamp()});
 b.set(doc(collection(db,"auditLog")),aud(user,"تعديل سداد","ledger",id,{date:old.date,amount:-n(old.amount),accountName:old.accountName||"",method:old.method||"",note:old.note||"",repName:old.repName||""},{date,amount:a,accountName:nw.accountName,method:nw.method,note:nw.note,repName:old.repName||""}));
 await b.commit();
}

// تعديل شحنة شراء: التاريخ، المورد، الكمية، السعر، الترحيل، الرسوم، أخرى
export async function editPurchase(db,user,id,v){
 const date=v.date,L=n(v.liters),P=n(v.price),tr=n(v.transport),sf=n(v.stateFee),ot=n(v.other),sup=(v.supplier||"").trim();
 if(!date)throw new Error("أدخل التاريخ.");
 if(!(L>0))throw new Error("أدخل كمية أكبر من صفر.");
 const [al,mv]=await Promise.all([q1(db,"saleAllocations","batchId",id),q1(db,"stockMovements","ref",id)]);
 const first=al.docs.map(d=>String(d.data().date)).sort()[0];
 if(first&&first<date)throw new Error(`لا يمكن جعل تاريخ الشحنة بعد مبيعات سُحبت منها (أقدم بيع بتاريخ ${first}).`);
 await runTransaction(db,async tx=>{
  const pref=doc(db,"purchases",id),ps=await tx.get(pref);
  if(!ps.exists())throw new Error("الشحنة غير موجودة.");
  const p=ps.data(),sold=r3(n(p.liters)-n(p.remainingLiters)),rem=r3(L-sold);
  if(rem<-0.0005)throw new Error(`الكمية الجديدة أقل مما سُحب من الشحنة (${sold} لتر).`);
  const oldUc=n(p.unitCost??p.pricePerLiter),costs={};
  if(Math.abs(P-oldUc)>1e-9&&al.docs.length){
   const sids=[...new Set(al.docs.map(d=>d.data().saleId))];
   (await Promise.all(sids.map(i=>tx.get(doc(db,"sales",i))))).forEach(s=>{if(s.exists())costs[s.id]=n(s.data().costTotal)});
   al.docs.forEach(d=>{const x=d.data();if(costs[x.saleId]!=null)costs[x.saleId]+=n(x.liters)*(P-n(x.unitCost));tx.update(d.ref,{unitCost:P})});
   Object.entries(costs).forEach(([sid,c])=>tx.update(doc(db,"sales",sid),{costTotal:c}));
  }
  tx.update(pref,{date,supplierName:sup,liters:L,pricePerLiter:P,unitCost:P,transport:tr,stateFee:sf,otherCost:ot,purchaseTotal:L*P,extrasTotal:tr+sf+ot,remainingLiters:rem,finishedDate:rem<=0?(p.finishedDate||date):deleteField(),updatedBy:user.uid,updatedAt:serverTimestamp()});
  const m=mv.docs.find(d=>d.data().type==="purchase");
  if(m)tx.update(m.ref,{date,liters:L});else tx.set(doc(collection(db,"stockMovements")),{date,periodId:p.periodId,type:"purchase",liters:L,ref:id,createdBy:user.uid,createdAt:serverTimestamp()});
  tx.set(doc(collection(db,"auditLog")),aud(user,"تعديل شحنة","purchases",id,
   {date:p.date,supplierName:p.supplierName,liters:p.liters,pricePerLiter:p.pricePerLiter,transport:p.transport,stateFee:p.stateFee,otherCost:p.otherCost},
   {date,supplierName:sup,liters:L,pricePerLiter:P,transport:tr,stateFee:sf,otherCost:ot}));
 });
}
