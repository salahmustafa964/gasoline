import {openForm,fe} from "./dlg.js?v=18";
import {editPurchase} from "./edits.js?v=18";
import {collection,doc,writeBatch,serverTimestamp,query,orderBy,limit,getDocs,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const n=v=>Number(v)||0;
const f=(v,d=0)=>n(v).toLocaleString("en-US",{maximumFractionDigits:d});
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const localToday=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);

export async function render(view,{db,user,period}){
 const isAdmin=user.role==="admin",P=period.id;
 view.innerHTML=`
 <div class="panel"><h2>شحنة جديدة</h2>
 <form id="pf"><div class="form-grid">
  <div><label>تاريخ الوصول</label><input id="date" type="date" required value="${localToday()}"></div>
  <div><label>المورد</label><input id="supplier" type="text" required></div>
  <div><label>الكمية (لتر)</label><input id="liters" type="number" step="any" min="0" required></div>
  <div><label>سعر الشراء للتر</label><input id="price" type="number" step="any" min="0" required></div>
  <div><label>الترحيل (إجمالي الشحنة)</label><input id="transport" type="number" step="any" min="0" value="0"></div>
  <div><label>رسوم الولاية (إجمالي)</label><input id="stateFee" type="number" step="any" min="0" value="0"></div>
  <div><label>أخرى (إجمالي)</label><input id="other" type="number" step="any" min="0" value="0"></div>
 </div>
 <div class="preview" id="pv">قيمة الشراء: —</div>
 <button class="btn" type="submit" style="margin-top:1rem">حفظ الشحنة</button>
 <div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div></form></div>
 <div class="panel"><h2>الشحنات</h2><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 if(period.closed){$("pf").hidden=true;$("pf").insertAdjacentHTML("beforebegin",'<p class="soon">هذه الفترة مقفلة ولا تقبل شحنات جديدة.</p>')}
 const calc=()=>{const L=n($("liters").value),P=n($("price").value);
  const extra=n($("transport").value)+n($("stateFee").value)+n($("other").value);
  const total=L*P+extra;return {L,P,extra,total,unit:L>0?total/L:0}};
 const upd=()=>{const c=calc();$("pv").textContent=c.L>0?`قيمة الشراء (تكلفة اللتر ${f(c.P,2)}): ${f(c.L*c.P,2)}  |  تكاليف إضافية تُخصم من ربح الشحنة عند انتهائها: ${f(c.extra,2)}`:"قيمة الشراء: —"};
 view.querySelectorAll("#pf input").forEach(i=>i.addEventListener("input",upd));

 async function load(){
  const s=await getDocs(query(collection(db,"purchases"),where("periodId","==",P),limit(500)));
  if(s.empty){$("list").innerHTML='<p class="soon">لا توجد شحنات بعد. أضف أول شحنة من النموذج أعلاه.</p>';return}
  let rem=0;
  const rows=[...s.docs].sort((a,b)=>String(b.data().date).localeCompare(String(a.data().date))).map(d=>{const x=d.data();rem+=n(x.remainingLiters);
   return `<tr><td>${esc(x.date)}</td><td>${esc(x.supplierName)}</td><td class="num">${f(x.liters)}</td>
   <td class="num"><b>${f(x.pricePerLiter,2)}</b></td><td class="num">${f(n(x.liters)*n(x.pricePerLiter),2)}</td>
   <td class="num">${f(n(x.transport)+n(x.stateFee)+n(x.otherCost),2)}</td><td class="num">${f(x.remainingLiters)}</td>
   <td>${n(x.remainingLiters)>0?'<span class="tag">متاحة</span>':'<span class="tag done">منتهية</span>'}</td>${isAdmin?`<td><button class="btn sm" data-e="${d.id}">تعديل</button></td>`:""}</tr>`}).join("");
  $("list").innerHTML=`<table class="tbl"><thead><tr><th>التاريخ</th><th>المورد</th><th>اللترات</th><th>تكلفة اللتر</th><th>قيمة الشراء</th><th>ترحيل ورسوم (تُخصم لاحقًا)</th><th>المتبقي</th><th>الحالة</th>${isAdmin?"<th></th>":""}</tr></thead><tbody>${rows}</tbody></table>
  <p><b>إجمالي المتبقي في الدفعات: ${f(rem)} لتر</b></p>`;
  if(isAdmin)$("list").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{const id=b.dataset.e,x=s.docs.find(d=>d.id===id).data();
   openForm({title:"تعديل شحنة",note:"يُعاد حساب المتبقي وتكلفة المبيعات المرتبطة تلقائيًا، ويُسجَّل التعديل في سجل العمليات.",
    fields:[{k:"date",label:"تاريخ الوصول",type:"date",req:1},{k:"supplier",label:"المورد",req:1},{k:"liters",label:"الكمية (لتر)",type:"number",req:1},{k:"price",label:"سعر الشراء للتر",type:"number",req:1},{k:"transport",label:"الترحيل (إجمالي)",type:"number"},{k:"stateFee",label:"رسوم الولاية (إجمالي)",type:"number"},{k:"other",label:"أخرى (إجمالي)",type:"number"}],
    values:{date:x.date,supplier:x.supplierName,liters:x.liters,price:x.pricePerLiter,transport:x.transport,stateFee:x.stateFee,other:x.otherCost},
    onSubmit:async v=>{try{await editPurchase(db,user,id,v)}catch(e){throw new Error(fe(e))}await load()}})});
 }

 $("pf").addEventListener("submit",async ev=>{
  ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  const c=calc(),date=$("date").value;
  if(!(c.L>0)){$("er").textContent="أدخل كمية أكبر من صفر.";return}
  const id=doc(collection(db,"purchases")).id;
  const rec={date,periodId:P,supplierName:$("supplier").value.trim(),liters:c.L,pricePerLiter:c.P,
   transport:n($("transport").value),stateFee:n($("stateFee").value),otherCost:n($("other").value),
   unitCost:c.P,purchaseTotal:c.L*c.P,extrasTotal:c.extra,remainingLiters:c.L,createdBy:user.uid};
  try{
   const b=writeBatch(db);
   b.set(doc(db,"purchases",id),{...rec,createdAt:serverTimestamp()});
   b.set(doc(collection(db,"stockMovements")),{type:"purchase",liters:c.L,date,periodId:rec.periodId,ref:id,createdBy:user.uid,createdAt:serverTimestamp()});
   b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"إضافة شحنة",collection:"purchases",docId:id,after:rec,createdAt:serverTimestamp()});
   await b.commit();
   $("ok").textContent=`تم حفظ الشحنة. تكلفة اللتر ${f(c.P,2)}.`;
   $("pf").reset();$("date").value=localToday();upd();load();
  }catch(e){
   $("er").textContent=/permission/i.test(e.message)?"تعذّر الحفظ: الفترة مقفلة أو ليست لديك صلاحية.":"تعذّر الحفظ: "+e.message;
  }
 });
 load().catch(e=>{$("list").textContent="تعذّر تحميل الشحنات: "+e.message});
}
