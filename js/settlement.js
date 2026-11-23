import {collection,doc,writeBatch,runTransaction,serverTimestamp,getDocs,query,orderBy,limit,where,deleteField} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js?v=20";
const T={quantity:"فرق كمية",rep:"رصيد مندوب",cost:"فرق تكلفة شحنة"},ST={draft:"مسودة",approved:"معتمدة",rejected:"مرفوضة"};
const r3=x=>Math.round(x*1000)/1000,r2=x=>Math.round(x*100)/100;
export async function render(view,{db,user,period}){
 const isAdmin=user.role==="admin",P=period.id;
 view.innerHTML=`<div class="panel"><h2>تسوية جديدة</h2><p class="soon">كل تسوية تُحفظ كمسودة ولا تؤثر على المخزون أو الحسابات أو الأرباح إلا بعد اعتماد المدير.</p>
 <form id="sf"><div class="form-grid"><div><label>نوع التسوية</label><select id="ty"><option value="quantity">فرق كمية (جرد)</option><option value="rep">رصيد مندوب</option><option value="cost">فرق تكلفة شحنة</option></select></div>
 <div><label>التاريخ</label><input id="dt" type="date" required value="${localToday()}"></div></div>
 <div id="fl"></div><div class="form-grid"><div><label>السبب (إلزامي)</label><input id="rs" required></div></div>
 <button class="btn" style="margin-top:1rem">حفظ كمسودة</button><div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div></form></div>
 <div class="panel"><h2>التسويات</h2><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 if(period.closed){$("sf").hidden=true;$("sf").insertAdjacentHTML("beforebegin",'<p class="soon">هذه الفترة مقفلة ولا تقبل تسويات جديدة.</p>')}
 const [ps,rs,st0]=await Promise.all([getDocs(query(collection(db,"purchases"),where("periodId","==",P))),getDocs(collection(db,"reps")),getDocs(query(collection(db,"settlements"),where("periodId","==",P),limit(300)))]);
 const batches=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const reps=rs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
 const book=batches.reduce((a,b)=>a+n(b.remainingLiters),0);
 const bOpt=batches.map(b=>`<option value="${b.id}">${esc(b.date)} - ${esc(b.supplierName)} (المتبقي ${f(b.remainingLiters,2)})</option>`).join("");
 const rOpt=reps.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("");
 const bl=id=>{const b=batches.find(x=>x.id===id);return b?`${b.date} - ${b.supplierName}`:""};
 const qdiff=()=>{const m=$("qm").value;if(m==="count"){const v=$("cl").value;return v===""?0:r3(n(v)-book)}const x=n($("dl").value);return m==="short"?-x:x};
 function fields(){const t=$("ty").value;
  if(t==="quantity"){$("fl").innerHTML=`<div class="form-grid">
   <div><label>طريقة الإدخال</label><select id="qm"><option value="count">بالجرد (أدخل الكمية الفعلية)</option><option value="short">نقصان (أدخل كمية النقص)</option><option value="over">زيادة (أدخل كمية الزيادة)</option></select></div>
   <div id="qcw"><label>الكمية الفعلية بالجرد (لتر)</label><input id="cl" type="number" step="any" min="0"></div>
   <div id="qdw" hidden><label>كمية الفرق (لتر)</label><input id="dl" type="number" step="any" min="0"></div>
   <div id="qch" hidden><label>النقص يُحمَّل على</label><select id="ch"><option value="">الشركة (يُخصم من الربح)</option>${rOpt}</select></div>
   <div id="qsb" hidden><label>الزيادة تُضاف إلى شحنة</label><select id="sb">${bOpt}</select></div></div><div class="preview" id="qp"></div>`;
   const upd=()=>{const m=$("qm").value;$("qcw").hidden=m!=="count";$("qdw").hidden=m==="count";$("cl").required=m==="count";$("dl").required=m!=="count";
    const d=qdiff();$("qch").hidden=!(d<0);$("qsb").hidden=!(d>0);
    $("qp").textContent=`الرصيد الدفتري: ${f(book,2)} لتر`+(d?` | ${d>0?"زيادة":"نقصان"} ${f(Math.abs(d),2)} لتر`+(d<0&&-d>book?" (أكبر من الرصيد الدفتري)":""):"")};
   $("fl").querySelectorAll("input,select").forEach(e=>{e.oninput=upd;e.onchange=upd});upd()}
  else if(t==="rep")$("fl").innerHTML=`<div class="form-grid"><div><label>المندوب</label><select id="rp" required>${rOpt}</select></div>
   <div><label>نوع التعديل</label><select id="dr"><option value="1">زيادة على المندوب</option><option value="-1">تخفيض عن المندوب</option></select></div>
   <div><label>المبلغ</label><input id="am" type="number" step="any" min="0" required></div></div>`;
  else $("fl").innerHTML=`<div class="form-grid"><div><label>الشحنة</label><select id="cb" required>${bOpt}</select></div>
   <div><label>فرق الترحيل (± مبلغ)</label><input id="d1" type="number" step="any" value="0"></div>
   <div><label>فرق رسوم الولاية (±)</label><input id="d2" type="number" step="any" value="0"></div>
   <div><label>فرق أخرى (±)</label><input id="d3" type="number" step="any" value="0"></div></div>`}
 $("ty").onchange=fields;fields();
 const fail=e=>{const m=e.message||"";$("er").textContent=m.startsWith("STOCK:")?`المتاح للخصم بتاريخ التسوية ${m.slice(6)} لتر فقط.`:m==="STATUS"?"هذه التسوية لم تعد مسودة.":/permission/i.test(m)?"تعذّر التنفيذ: الفترة مقفلة أو ليست لديك صلاحية.":"تعذّر التنفيذ: "+m};
 const audit=(b,action,id,after)=>b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,periodId:s.periodId,periodId:P,action,collection:"settlements",docId:id,after,createdAt:serverTimestamp()});
 $("sf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  const type=$("ty").value,date=$("dt").value,rec={type,date,periodId:P,status:"draft",reason:$("rs").value.trim(),createdBy:user.uid};
  if(type==="quantity"){const d=qdiff(),c=$("qm").value==="count"?n($("cl").value):r3(book+d);if(Math.abs(d)<0.0005){$("er").textContent="لا يوجد فرق. أدخل كمية أو غيّر طريقة الإدخال.";return}
   Object.assign(rec,{bookLiters:book,countedLiters:c,diff:d,chargeRepId:d<0?$("ch").value:"",chargeRepName:d<0&&$("ch").value?$("ch").selectedOptions[0].text:"",surplusBatchId:d>0?$("sb").value:""});
   if(d>0&&!rec.surplusBatchId){$("er").textContent="اختر الشحنة التي تُضاف إليها الزيادة. إن لم توجد شحنات أضف شحنة أولًا.";return}}
  else if(type==="rep"){const a=n($("am").value);if(!(a>0)||!$("rp").value){$("er").textContent="اختر المندوب وأدخل مبلغًا أكبر من صفر.";return}
   Object.assign(rec,{repId:$("rp").value,repName:$("rp").selectedOptions[0].text,amount:a*Number($("dr").value)})}
  else{const d1=n($("d1").value),d2=n($("d2").value),d3=n($("d3").value);if(!d1&&!d2&&!d3){$("er").textContent="أدخل فرقًا واحدًا على الأقل.";return}
   Object.assign(rec,{batchId:$("cb").value,batchLabel:bl($("cb").value),dTransport:d1,dStateFee:d2,dOther:d3})}
  try{const id=doc(collection(db,"settlements")).id,b=writeBatch(db);b.set(doc(db,"settlements",id),{...rec,createdAt:serverTimestamp()});audit(b,"إنشاء تسوية (مسودة)",id,rec);await b.commit();
   $("ok").textContent="تم حفظ التسوية كمسودة، بانتظار اعتماد المدير.";$("sf").reset();fields();load()}catch(e){fail(e)}};
 async function approve(s){$("er").textContent="";$("ok").textContent="";
  const sref=doc(db,"settlements",s.id),base={date:s.date,periodId:s.periodId,createdBy:user.uid,createdAt:serverTimestamp()};
  try{
   let cand=[];
   if(s.type==="quantity"&&s.diff<0){const q=await getDocs(query(collection(db,"purchases"),where("periodId","==",s.periodId)));
    cand=q.docs.filter(d=>d.data().date<=s.date&&n(d.data().remainingLiters)>0).sort((a,b)=>a.data().date.localeCompare(b.data().date)||(a.data().createdAt?.seconds||0)-(b.data().createdAt?.seconds||0))}
   await runTransaction(db,async tx=>{
    const cur=await tx.get(sref);if(cur.data().status!=="draft")throw new Error("STATUS");
    const upd={status:"approved",approvedBy:user.uid,approvedAt:serverTimestamp()};
    if(s.type==="quantity"&&s.diff<0){
     const pool=[];for(const c of cand){const sn=await tx.get(doc(db,"purchases",c.id)),x=sn.data(),rem=n(x.remainingLiters);if(rem>0)pool.push({id:sn.id,rem,uc:n(x.unitCost??x.pricePerLiter)})}
     let need=-s.diff;const al=[];let value=0;const avail=pool.reduce((a,p)=>a+p.rem,0);
     if(need>avail+0.0005)throw new Error("STOCK:"+f(avail,2));
     for(const p of pool){if(need<=0)break;const t=Math.min(p.rem,need);need-=t;value+=t*p.uc;al.push({batchId:p.id,liters:t,unitCost:p.uc});
      const left=r3(p.rem-t);tx.update(doc(db,"purchases",p.id),left===0?{remainingLiters:0,finishedDate:s.date}:{remainingLiters:left})}
     value=r2(value);Object.assign(upd,{value,allocations:al});
     tx.set(doc(collection(db,"stockMovements")),{...base,type:"adjustment",liters:s.diff,ref:s.id});
     if(s.chargeRepId)tx.set(doc(collection(db,"ledger")),{...base,accountType:"rep",repId:s.chargeRepId,repName:s.chargeRepName,type:"settlement",amount:value,ref:s.id,note:s.reason})}
    else if(s.type==="quantity"){
     const br=doc(db,"purchases",s.surplusBatchId),bs=await tx.get(br),x=bs.data(),uc=n(x.unitCost??x.pricePerLiter);
     tx.update(br,{remainingLiters:r3(n(x.remainingLiters)+s.diff),finishedDate:deleteField()});
     upd.value=r2(s.diff*uc);tx.set(doc(collection(db,"stockMovements")),{...base,type:"adjustment",liters:s.diff,ref:s.id})}
    else if(s.type==="rep")tx.set(doc(collection(db,"ledger")),{...base,accountType:"rep",repId:s.repId,repName:s.repName,type:"settlement",amount:s.amount,ref:s.id,note:s.reason});
    tx.update(sref,upd);
    tx.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"اعتماد تسوية",collection:"settlements",docId:s.id,after:{type:s.type,date:s.date,reason:s.reason},createdAt:serverTimestamp()});
   });
   $("ok").textContent="تم اعتماد التسوية وتطبيق أثرها.";setTimeout(()=>location.reload(),900);
  }catch(e){fail(e)}}
 async function reject(s){try{const b=writeBatch(db);b.update(doc(db,"settlements",s.id),{status:"rejected",approvedBy:user.uid,approvedAt:serverTimestamp()});audit(b,"رفض تسوية",s.id,{type:s.type,date:s.date});await b.commit();load()}catch(e){fail(e)}}
 const det=s=>s.type==="quantity"?`الدفتري ${f(s.bookLiters,2)} / الفعلي ${f(s.countedLiters,2)} / الفرق ${s.diff>0?"+":""}${f(s.diff,2)} لتر`+(s.diff<0?` - على ${esc(s.chargeRepName||"الشركة")}`:"")+(s.value!=null?` - القيمة ${f(s.value,2)}`:""):
  s.type==="rep"?`${s.amount>0?"زيادة":"تخفيض"} ${f(Math.abs(s.amount),2)} - ${esc(s.repName)}`:
  `شحنة ${esc(s.batchLabel)}: ترحيل ${f(s.dTransport,2)}، رسوم ${f(s.dStateFee,2)}، أخرى ${f(s.dOther,2)}`;
 async function load(pre){
  const q=pre||await getDocs(query(collection(db,"settlements"),where("periodId","==",P),limit(300)));
  if(q.empty){$("list").innerHTML='<p class="soon">لا توجد تسويات بعد.</p>';return}
  const arr=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $("list").innerHTML=`<table class="tbl"><thead><tr><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>السبب</th><th>الحالة</th><th></th></tr></thead><tbody>`+
  arr.map(s=>`<tr><td>${esc(s.date)}</td><td>${T[s.type]}</td><td>${det(s)}</td><td>${esc(s.reason)}</td><td><span class="tag${s.status==="draft"?"":" done"}">${ST[s.status]}</span></td>
  <td>${s.status==="draft"?(isAdmin?`<button class="btn sm" data-a="${s.id}">اعتماد</button><button class="btn sm danger" data-r="${s.id}">رفض</button>`:'<span class="soon">بانتظار المدير</span>'):""}</td></tr>`).join("")+"</tbody></table>";
  $("list").querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>approve(arr.find(x=>x.id===b.dataset.a)));
  $("list").querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>reject(arr.find(x=>x.id===b.dataset.r)));
 }
 load(st0).catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
