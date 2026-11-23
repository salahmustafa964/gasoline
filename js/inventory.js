import {collection,getDocs,query,where,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc} from "./util.js?v=20";
const TYPE={purchase:"وارد (شراء)",sale:"مبيع",adjustment:"تسوية"};
export async function render(view,{db,period}){
 view.innerHTML=`<div class="panel"><h2>رصيد المخزون</h2><p class="soon">الفترة: <b>${esc(period.name)}</b>. تبدأ كل فترة برصيد صفر، والرصيد = الوارد − المباع ± التسويات.</p><div id="sum"></div></div>
 <div class="panel"><h2>الدفعات (الشحنات المشتراة)</h2><div class="tbl-wrap" id="bt">جارٍ التحميل...</div></div>
 <div class="panel"><h2>حركات المخزون</h2><div class="form-grid"><div><label>من تاريخ</label><input id="fr" type="date"></div><div><label>إلى تاريخ</label><input id="to" type="date"></div></div><div class="tbl-wrap" id="mv"></div></div>`;
 const $=id=>view.querySelector("#"+id);
 const P=period.id;
 const [ps,ms]=await Promise.all([getDocs(query(collection(db,"purchases"),where("periodId","==",P))),getDocs(query(collection(db,"stockMovements"),where("periodId","==",P),limit(5000)))]);
 const batches=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const mvs=ms.docs.map(d=>d.data());
 const inBatches=batches.reduce((a,b)=>a+n(b.remainingLiters),0),inMoves=mvs.reduce((a,m)=>a+n(m.liters),0);
 const sum=t=>mvs.filter(m=>m.type===t).reduce((a,m)=>a+n(m.liters),0);
 $("sum").innerHTML=`<div class="grid" style="margin-top:1rem">
  <div class="stat good"><b>${f(sum("purchase"),2)}</b><span>الوارد (مشتريات)</span></div>
  <div class="stat bad"><b>${f(-sum("sale"),2)}</b><span>المباع للمناديب</span></div>
  <div class="stat"><b>${f(sum("adjustment"),2)}</b><span>التسويات (±)</span></div>
  <div class="stat fuel"><b>${f(inMoves,2)}</b><span>الرصيد الحالي (لتر)</span></div></div>
  <p><b>الرصيد حسب الدفعات: ${f(inBatches,2)} لتر</b></p>`+
  (Math.abs(inBatches-inMoves)>0.01?`<div class="err">تنبيه: مجموع الحركات لا يطابق مجموع الدفعات. راجع الحركات.</div>`:"");
 $("bt").innerHTML=batches.length?`<table class="tbl"><thead><tr><th>التاريخ</th><th>المورد</th><th>اللترات</th><th>تكلفة اللتر</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>`+
  batches.map(b=>`<tr><td>${esc(b.date)}</td><td>${esc(b.supplierName)}</td><td class="num">${f(b.liters)}</td><td class="num">${f(b.unitCost??b.pricePerLiter,2)}</td><td class="num"><b>${f(b.remainingLiters,2)}</b></td><td>${n(b.remainingLiters)>0?'<span class="tag">متاحة</span>':'<span class="tag done">منتهية</span>'}</td></tr>`).join("")+`</tbody></table>`:'<p class="soon">لا توجد شحنات في هذه الفترة. سجّل الشحنة من صفحة المشتريات والتكاليف.</p>';
 function draw(){
  const fr=$("fr").value,to=$("to").value,rows=mvs.filter(m=>(!fr||String(m.date)>=fr)&&(!to||String(m.date)<=to)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $("mv").innerHTML=rows.length?`<table class="tbl"><thead><tr><th>التاريخ</th><th>النوع</th><th>اللترات</th></tr></thead><tbody>`+
   rows.map(m=>`<tr><td>${esc(m.date)}</td><td>${TYPE[m.type]||esc(m.type)}</td><td class="num">${n(m.liters)>0?"+":""}${f(m.liters,2)}</td></tr>`).join("")+`</tbody></table>`:'<p class="soon">لا حركات.</p>';
 }
 $("fr").onchange=draw;$("to").onchange=draw;draw();
}
