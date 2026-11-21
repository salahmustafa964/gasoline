import {collection,getDocs,query,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js";
const TYPE={purchase:"وارد (شراء)",sale:"مبيع",adjustment:"تسوية"};
export async function render(view,{db}){
 view.innerHTML=`<div class="panel"><h2>رصيد المخزون</h2>
 <div class="form-grid"><div><label>الشهر</label><input id="mo" type="month" value="${localToday().slice(0,7)}"></div></div>
 <div id="sum"></div></div>
 <div class="panel"><h2>الدفعات (الشحنات المشتراة)</h2><div class="tbl-wrap" id="bt">جارٍ التحميل...</div></div>
 <div class="panel"><h2>حركات الشهر</h2><div class="tbl-wrap" id="mv"></div></div>`;
 const $=id=>view.querySelector("#"+id);
 const [ps,ms]=await Promise.all([getDocs(collection(db,"purchases")),getDocs(query(collection(db,"stockMovements"),limit(5000)))]);
 const batches=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const mvs=ms.docs.map(d=>d.data());
 const inBatches=batches.reduce((a,b)=>a+n(b.remainingLiters),0),inMoves=mvs.reduce((a,m)=>a+n(m.liters),0);
 $("bt").innerHTML=batches.length?`<table class="tbl"><thead><tr><th>التاريخ</th><th>المورد</th><th>اللترات</th><th>تكلفة اللتر</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>`+
  batches.map(b=>`<tr><td>${esc(b.date)}</td><td>${esc(b.supplierName)}</td><td class="num">${f(b.liters)}</td><td class="num">${f(b.unitCost??b.pricePerLiter,2)}</td><td class="num"><b>${f(b.remainingLiters,2)}</b></td><td>${n(b.remainingLiters)>0?'<span class="tag">متاحة</span>':'<span class="tag done">منتهية</span>'}</td></tr>`).join("")+
  `</tbody></table>`:'<p class="soon">لا توجد شحنات.</p>';
 function draw(){
  const mo=$("mo").value,start=mo+"-01",inM=mvs.filter(m=>String(m.date).slice(0,7)===mo);
  const sum=t=>inM.filter(m=>m.type===t).reduce((a,m)=>a+n(m.liters),0);
  const opening=mvs.filter(m=>String(m.date)<start).reduce((a,m)=>a+n(m.liters),0);
  const inc=sum("purchase"),sold=-sum("sale"),adj=sum("adjustment"),close=opening+inc-sold+adj;
  $("sum").innerHTML=`<div class="grid" style="margin-top:1rem">
   <div class="stat"><b>${f(opening,2)}</b><span>الرصيد المرحّل</span></div>
   <div class="stat good"><b>${f(inc,2)}</b><span>الوارد (مشتريات)</span></div>
   <div class="stat bad"><b>${f(sold,2)}</b><span>المباع للمناديب</span></div>
   <div class="stat"><b>${f(adj,2)}</b><span>التسويات (±)</span></div>
   <div class="stat fuel"><b>${f(close,2)}</b><span>الرصيد في نهاية الشهر</span></div></div>
   <p class="soon">الرصيد = المرحّل + الوارد − المباع ± التسويات. الوارد يأتي من المشتريات فقط.</p>
   <p><b>الرصيد الحالي حسب الدفعات: ${f(inBatches,2)} لتر</b></p>`+
   (Math.abs(inBatches-inMoves)>0.01?`<div class="err">تنبيه: مجموع الحركات (${f(inMoves,2)}) لا يطابق مجموع الدفعات. غالبًا بسبب بيانات تجريبية قديمة، راجعها قبل البدء الفعلي.</div>`:"");
  const rows=inM.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $("mv").innerHTML=rows.length?`<table class="tbl"><thead><tr><th>التاريخ</th><th>النوع</th><th>اللترات</th></tr></thead><tbody>`+
   rows.map(m=>`<tr><td>${esc(m.date)}</td><td>${TYPE[m.type]||esc(m.type)}</td><td class="num">${n(m.liters)>0?"+":""}${f(m.liters,2)}</td></tr>`).join("")+`</tbody></table>`:'<p class="soon">لا حركات في هذا الشهر.</p>';
 }
 $("mo").onchange=draw;draw();
}
