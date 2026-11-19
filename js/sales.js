import {collection,doc,runTransaction,serverTimestamp,query,orderBy,limit,getDocs,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js";
export async function render(view,{db,user}){
 const canWrite=user.role!=="rep";
 view.innerHTML=(canWrite?`
 <div class="panel"><h2>فاتورة بيع لمندوب</h2><form id="sf"><div class="form-grid">
  <div><label>التاريخ</label><input id="date" type="date" required value="${localToday()}"></div>
  <div><label>المندوب</label><select id="rep" required></select></div></div>
  <div id="lines"></div>
  <button type="button" class="btn alt" id="add">+ إضافة حمولة لجهة أخرى</button>
  <div class="preview" id="pv">—</div>
  <button class="btn" style="margin-top:1rem">حفظ الفاتورة</button>
  <div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div></form></div>`:"")+
 `<div class="panel"><h2>آخر المبيعات</h2><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 let bal=0,accs=[];
 const q=(el,c)=>el.querySelector("."+c);
 const read=()=>[...view.querySelectorAll(".line")].map(el=>{const L=n(q(el,"li").value),P=n(q(el,"pr").value),paid=n(q(el,"pd").value),a=q(el,"ac");
  return {el,entity:q(el,"en").value.trim(),L,P,paid,amount:L*P,accId:a.value,accName:a.value?a.selectedOptions[0].text:"",method:q(el,"pm").value,note:q(el,"nt").value.trim()}});
 const upd=()=>{if(!canWrite)return;let tot=0,pd=0;
  read().forEach(l=>{tot+=l.amount;pd+=l.paid;q(l.el,"lv").textContent=`القيمة ${f(l.amount,2)} | المتبقي ${f(l.amount-l.paid,2)}`});
  $("pv").innerHTML=`إجمالي الفاتورة: ${f(tot,2)} | المسدّد: ${f(pd,2)} | المتبقي: ${f(tot-pd,2)}<br>رصيد المندوب بعد الفاتورة: ${f(bal+tot-pd,2)}`};
 const addLine=()=>{const d=document.createElement("div");d.className="line form-grid";
  d.innerHTML=`<div><label>الجهة</label><input class="en"></div>
  <div><label>اللترات</label><input class="li" type="number" step="any" min="0"></div>
  <div><label>سعر البيع للتر</label><input class="pr" type="number" step="any" min="0"></div>
  <div><label>السداد الفعلي</label><input class="pd" type="number" step="any" min="0" value="0"></div>
  <div><label>تم الدفع في حساب (اختياري)</label><select class="ac"><option value="">— غير محدد —</option>${accs.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></div>
  <div><label>طريقة السداد (اختياري)</label><select class="pm"><option value="">—</option><option>كاش</option><option>بنكك</option><option>تحويل آخر</option></select></div>
  <div><label>ملحوظة السداد (اختياري)</label><input class="nt"></div>
  <div class="lv"></div><button type="button" class="btn ghost rm">حذف الحمولة</button>`;
  d.addEventListener("input",upd);q(d,"rm").onclick=()=>{if(view.querySelectorAll(".line").length>1){d.remove();upd()}};
  $("lines").appendChild(d);upd()};
 async function repBal(){if(!$("rep").value){bal=0;upd();return}
  const s=await getDocs(query(collection(db,"ledger"),where("repId","==",$("rep").value)));
  bal=0;s.forEach(d=>bal+=n(d.data().amount));upd()}
 async function load(){
  const [s,ls]=await Promise.all([getDocs(query(collection(db,"sales"),orderBy("date","desc"),limit(60))),canWrite?getDocs(query(collection(db,"ledger"),limit(5000))):Promise.resolve(null)]);
  if(s.empty){$("list").innerHTML='<p class="soon">لا توجد مبيعات بعد.</p>';return}
  const pay={};if(ls)ls.forEach(d=>{const x=d.data();if(x.type==="payment"&&x.ref){const p=pay[x.ref]||(pay[x.ref]={sum:0,tags:new Set()});p.sum-=n(x.amount);const t=[x.accountName,x.method].filter(Boolean).join(" - ");if(t)p.tags.add(t)}});
  $("list").innerHTML=`<table class="tbl"><thead><tr><th>التاريخ</th><th>المندوب</th><th>الجهة</th><th>اللترات</th><th>السعر</th><th>القيمة</th><th>المسدّد</th><th>الحساب / الطريقة</th><th>المتبقي</th>${canWrite?"<th>الربح (قبل الترحيل والرسوم)</th>":""}</tr></thead><tbody>`+
  s.docs.map(d=>{const x=d.data(),p=pay[d.id],paid=p?p.sum:n(x.paid),tags=p?[...p.tags].map(esc).join("، "):esc(x.paidAccountName);
   return `<tr><td>${esc(x.date)}</td><td>${esc(x.repName)}</td><td>${esc(x.entity)}</td><td class="num">${f(x.liters)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(x.amount,2)}</td><td class="num">${f(paid,2)}</td><td>${tags}</td><td class="num">${f(n(x.amount)-paid,2)}</td>${canWrite?`<td class="num">${f(n(x.amount)-n(x.costTotal),2)}</td>`:""}</tr>`}).join("")+"</tbody></table>"}
 if(canWrite){
  const [rs,as]=await Promise.all([getDocs(collection(db,"reps")),getDocs(collection(db,"accounts"))]);
  const reps=rs.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.active!==false);
  accs=as.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.active!==false);
  if(!reps.length){$("sf").innerHTML='<p class="soon">أضف مندوبًا أولًا من صفحة المناديب. وأضف حساب استلام من صفحة حسابات الاستلام.</p>'}
  else{
   $("rep").innerHTML=reps.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("");
   $("rep").onchange=repBal;$("add").onclick=addLine;addLine();repBal();
   $("sf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
    const date=$("date").value,periodId=date.slice(0,7),repId=$("rep").value,repName=reps.find(r=>r.id===repId).name,lines=read();
    for(const l of lines){
     if(!(l.L>0)||!(l.P>0)){$("er").textContent="في كل حمولة: أدخل كمية وسعرًا أكبر من صفر.";return}
     if(l.paid>l.amount){$("er").textContent="سداد إحدى الحمولات أكبر من قيمتها. سجّل الزيادة كسداد من صفحة المناديب.";return}
     }
    try{
     const ps=await getDocs(query(collection(db,"purchases"),where("remainingLiters",">",0)));
     const cand=ps.docs.filter(d=>d.data().date<=date).sort((a,b)=>a.data().date.localeCompare(b.data().date)||(a.data().createdAt?.seconds||0)-(b.data().createdAt?.seconds||0));
     const invoiceId=doc(collection(db,"sales")).id,res=[];
     await runTransaction(db,async tx=>{
      const pool=[];for(const c of cand){const s=await tx.get(doc(db,"purchases",c.id)),x=s.data(),rem=n(x.remainingLiters);if(rem>0)pool.push({id:s.id,rem,used:0,uc:n(x.unitCost??x.pricePerLiter)})}
      const avail=pool.reduce((a,p)=>a+p.rem,0),req=lines.reduce((a,l)=>a+l.L,0);
      if(req>avail+0.0005)throw new Error("STOCK:"+f(avail,2));
      const per=lines.map(l=>{let need=l.L,cost=0;const al=[];
       for(const p of pool){if(need<=0)break;const a=p.rem-p.used;if(a<=0)continue;const t=Math.min(a,need);p.used+=t;need-=t;cost+=t*p.uc;al.push({id:p.id,t,uc:p.uc})}
       return {l,cost,al}});
      const base={date,periodId,createdBy:user.uid,createdAt:serverTimestamp()};
      for(const p of pool)if(p.used>0){const left=Math.round((p.rem-p.used)*1000)/1000;tx.update(doc(db,"purchases",p.id),left===0?{remainingLiters:0,finishedDate:date}:{remainingLiters:left})}
      per.forEach(({l,cost,al},i)=>{const sr=doc(collection(db,"sales")),rec={date,periodId,invoiceId,lineNo:i+1,repId,repName,entity:l.entity,liters:l.L,pricePerLiter:l.P,amount:l.amount,costTotal:cost,paid:l.paid,paidAccountId:l.accId,paidAccountName:l.paid>0?l.accName:"",createdBy:user.uid};
       tx.set(sr,{...rec,createdAt:serverTimestamp()});res.push(rec);
       for(const a of al)tx.set(doc(collection(db,"saleAllocations")),{...base,saleId:sr.id,batchId:a.id,liters:a.t,unitCost:a.uc});
       tx.set(doc(collection(db,"stockMovements")),{...base,type:"sale",liters:-l.L,ref:sr.id});
       tx.set(doc(collection(db,"ledger")),{...base,accountType:"rep",repId,type:"sale",amount:l.amount,ref:sr.id,entity:l.entity});
       if(l.paid>0)tx.set(doc(collection(db,"ledger")),{...base,accountType:"rep",repId,type:"payment",amount:-l.paid,repName,entity:l.entity,accountId:l.accId,accountName:l.accName,method:l.method,note:l.note,ref:sr.id})});
      tx.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"إضافة فاتورة بيع",collection:"sales",docId:invoiceId,after:{repId,repName,date,lines:res},createdAt:serverTimestamp()});
     });
     const tot=res.reduce((a,r)=>a+r.amount,0),cost=res.reduce((a,r)=>a+r.costTotal,0);
     $("ok").textContent=`تم حفظ الفاتورة (${res.length} حمولة). الربح قبل الترحيل والرسوم ${f(tot-cost,2)}.`;
     $("lines").innerHTML="";addLine();repBal();load();
    }catch(e){
     $("er").textContent=e.message.startsWith("STOCK:")?`المتاح في المخزون بتاريخ ${date} هو ${e.message.slice(6)} لتر فقط، والمطلوب أكثر من ذلك.`:/permission/i.test(e.message)?"تعذّر الحفظ: الفترة مقفلة أو ليست لديك صلاحية.":"تعذّر الحفظ: "+e.message}};
  }}
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
