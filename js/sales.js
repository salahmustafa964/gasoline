import {collection,doc,runTransaction,serverTimestamp,query,orderBy,limit,getDocs,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js";
export async function render(view,{db,user}){
 const canWrite=user.role!=="rep";
 view.innerHTML=(canWrite?`
 <div class="panel"><h2>عملية بيع لمندوب</h2><form id="sf"><div class="form-grid">
  <div><label>التاريخ</label><input id="date" type="date" required value="${localToday()}"></div>
  <div><label>المندوب</label><select id="rep" required></select></div>
  <div><label>الجهة (اختياري)</label><input id="entity"></div>
  <div><label>الكمية (لتر)</label><input id="liters" type="number" step="any" min="0" required></div>
  <div><label>سعر البيع للتر</label><input id="price" type="number" step="any" min="0" required></div>
  <div><label>السداد الفعلي الآن</label><input id="paid" type="number" step="any" min="0" value="0"></div></div>
  <div class="preview" id="pv">—</div>
  <button class="btn" style="margin-top:1rem">حفظ البيع</button>
  <div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div></form></div>`:"")+
 `<div class="panel"><h2>آخر المبيعات</h2><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 let bal=0;
 const upd=()=>{if(!canWrite)return;const v=n($("liters").value)*n($("price").value),pd=n($("paid").value);
  $("pv").innerHTML=`قيمة العملية: ${f(v,2)}<br>المتبقي من هذه الفاتورة: ${f(v-pd,2)}<br>رصيد المندوب بعد العملية: ${f(bal+v-pd,2)}`};
 async function repBal(){if(!$("rep").value){bal=0;upd();return}
  const s=await getDocs(query(collection(db,"ledger"),where("repId","==",$("rep").value)));
  bal=0;s.forEach(d=>bal+=n(d.data().amount));upd()}
 async function load(){
  const s=await getDocs(query(collection(db,"sales"),orderBy("date","desc"),limit(50)));
  if(s.empty){$("list").innerHTML='<p class="soon">لا توجد مبيعات بعد.</p>';return}
  $("list").innerHTML=`<table class="tbl"><thead><tr><th>التاريخ</th><th>المندوب</th><th>الجهة</th><th>اللترات</th><th>السعر</th><th>القيمة</th><th>المسدّد</th><th>المتبقي</th>${canWrite?"<th>الربح (قبل الترحيل والرسوم)</th>":""}</tr></thead><tbody>`+
  s.docs.map(d=>{const x=d.data();return `<tr><td>${esc(x.date)}</td><td>${esc(x.repName)}</td><td>${esc(x.entity)}</td><td class="num">${f(x.liters)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(x.amount,2)}</td><td class="num">${f(x.paid,2)}</td><td class="num">${f(n(x.amount)-n(x.paid),2)}</td>${canWrite?`<td class="num">${f(n(x.amount)-n(x.costTotal),2)}</td>`:""}</tr>`}).join("")+"</tbody></table>"}
 if(canWrite){
  const rs=await getDocs(collection(db,"reps"));
  const reps=rs.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.active!==false);
  if(!reps.length){$("sf").innerHTML='<p class="soon">أضف مندوبًا أولًا من صفحة المناديب.</p>'}
  else{
   $("rep").innerHTML=reps.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("");
   $("rep").onchange=repBal;view.querySelectorAll("#sf input").forEach(i=>i.addEventListener("input",upd));repBal();
   $("sf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
    const date=$("date").value,L=n($("liters").value),P=n($("price").value),paid=n($("paid").value),amount=L*P,periodId=date.slice(0,7);
    const repId=$("rep").value,repName=reps.find(r=>r.id===repId).name;
    if(!(L>0)||!(P>0)){$("er").textContent="أدخل كمية وسعرًا أكبر من صفر.";return}
    if(paid>amount){$("er").textContent="السداد أكبر من قيمة العملية. سجّل الزيادة من صفحة المناديب كسداد.";return}
    try{
     const ps=await getDocs(query(collection(db,"purchases"),where("remainingLiters",">",0)));
     const cand=ps.docs.filter(d=>d.data().date<=date).sort((a,b)=>a.data().date.localeCompare(b.data().date)||(a.data().createdAt?.seconds||0)-(b.data().createdAt?.seconds||0));
     const saleRef=doc(collection(db,"sales"));let cost=0;
     await runTransaction(db,async tx=>{
      const snaps=[];for(const c of cand)snaps.push(await tx.get(doc(db,"purchases",c.id)));
      let need=L;const al=[];
      for(const s of snaps){if(need<=0)break;const x=s.data(),rem=n(x.remainingLiters);if(rem<=0)continue;
       const take=Math.min(rem,need);al.push({id:s.id,take,uc:n(x.unitCost??x.pricePerLiter),left:Math.round((rem-take)*1000)/1000});need-=take}
      if(need>0.0005)throw new Error("STOCK:"+f(L-need,2));
      cost=al.reduce((a,x)=>a+x.take*x.uc,0);
      const base={date,periodId,createdBy:user.uid,createdAt:serverTimestamp()};
      for(const a of al){tx.update(doc(db,"purchases",a.id),a.left===0?{remainingLiters:0,finishedDate:date}:{remainingLiters:a.left});
       tx.set(doc(collection(db,"saleAllocations")),{...base,saleId:saleRef.id,batchId:a.id,liters:a.take,unitCost:a.uc})}
      const rec={date,periodId,repId,repName,entity:$("entity").value.trim(),liters:L,pricePerLiter:P,amount,costTotal:cost,paid,createdBy:user.uid};
      tx.set(saleRef,{...rec,createdAt:serverTimestamp()});
      tx.set(doc(collection(db,"stockMovements")),{...base,type:"sale",liters:-L,ref:saleRef.id});
      tx.set(doc(collection(db,"ledger")),{...base,accountType:"rep",repId,type:"sale",amount,ref:saleRef.id});
      if(paid>0)tx.set(doc(collection(db,"ledger")),{...base,accountType:"rep",repId,type:"payment",amount:-paid,ref:saleRef.id});
      tx.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"إضافة بيع",collection:"sales",docId:saleRef.id,after:rec,createdAt:serverTimestamp()});
     });
     $("ok").textContent=`تم حفظ البيع. التكلفة ${f(cost,2)} والربح قبل الترحيل والرسوم ${f(amount-cost,2)}.`;
     $("liters").value="";$("paid").value="0";repBal();load();
    }catch(e){
     $("er").textContent=e.message.startsWith("STOCK:")?`المتاح في المخزون بتاريخ ${date} هو ${e.message.slice(6)} لتر فقط.`:/permission/i.test(e.message)?"تعذّر الحفظ: الفترة مقفلة أو ليست لديك صلاحية.":"تعذّر الحفظ: "+e.message}};
  }}
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
