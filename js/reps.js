import {collection,doc,writeBatch,serverTimestamp,getDocs,query,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js";
export async function render(view,{db,user}){
 view.innerHTML=`
 <div class="panel"><h2>مندوب جديد</h2><form id="rf"><div class="form-grid">
  <div><label>اسم المندوب</label><input id="rn" required></div>
  <div><label>الهاتف</label><input id="rp" type="tel"></div></div>
  <button class="btn" style="margin-top:1rem">حفظ المندوب</button></form></div>
 <div class="panel"><h2>تسجيل سداد من مندوب</h2><form id="pf"><div class="form-grid">
  <div><label>التاريخ</label><input id="pd" type="date" required value="${localToday()}"></div>
  <div><label>المندوب</label><select id="ps" required></select></div>
  <div><label>تم الدفع في حساب</label><select id="pc" required></select></div>
  <div><label>المبلغ المسدّد</label><input id="pa" type="number" step="any" min="0" required></div></div>
  <button class="btn" style="margin-top:1rem">حفظ السداد</button></form></div>
 <div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div>
 <div class="panel"><h2>حسابات المناديب</h2><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 const audit=(b,action,col,id,after)=>b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action,collection:col,docId:id,after,createdAt:serverTimestamp()});
 async function load(){
  const [rs,ls,as]=await Promise.all([getDocs(collection(db,"reps")),getDocs(query(collection(db,"ledger"),limit(5000))),getDocs(collection(db,"accounts"))]);
  $("pc").innerHTML=as.docs.filter(d=>d.data().active!==false).map(d=>`<option value="${d.id}">${esc(d.data().name)}</option>`).join("");
  const t={},sold={},paid={};
  ls.forEach(d=>{const x=d.data();if(!x.repId)return;t[x.repId]=(t[x.repId]||0)+n(x.amount);
   if(x.type==="sale")sold[x.repId]=(sold[x.repId]||0)+n(x.amount);else paid[x.repId]=(paid[x.repId]||0)-n(x.amount)});
  const reps=rs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name,"ar"));
  $("ps").innerHTML=reps.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("");
  if(!reps.length){$("list").innerHTML='<p class="soon">لا يوجد مناديب بعد.</p>';return}
  let all=0;
  $("list").innerHTML=`<table class="tbl"><thead><tr><th>المندوب</th><th>الهاتف</th><th>إجمالي المسحوب</th><th>المسدّد</th><th>المتبقي عليه</th></tr></thead><tbody>`+
  reps.map(r=>{all+=n(t[r.id]);return `<tr><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td class="num">${f(sold[r.id])}</td><td class="num">${f(paid[r.id])}</td><td class="num"><b>${f(t[r.id])}</b></td></tr>`}).join("")+
  `</tbody></table><p><b>إجمالي المديونيات: ${f(all)}</b></p>`;
 }
 const fail=e=>{$("er").textContent=/permission/i.test(e.message)?"تعذّر الحفظ: الفترة مقفلة أو ليست لديك صلاحية.":"تعذّر الحفظ: "+e.message};
 $("rf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  try{const id=doc(collection(db,"reps")).id,rec={name:$("rn").value.trim(),phone:$("rp").value.trim(),active:true};
   const b=writeBatch(db);b.set(doc(db,"reps",id),{...rec,createdAt:serverTimestamp()});audit(b,"إضافة مندوب","reps",id,rec);await b.commit();
   $("ok").textContent="تم حفظ المندوب.";$("rf").reset();load()}catch(e){fail(e)}};
 $("pf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  const a=n($("pa").value),date=$("pd").value,repId=$("ps").value;if(!(a>0)||!repId||!$("pc").value){$("er").textContent="اختر المندوب والحساب الذي دُفع فيه المبلغ، وأدخل مبلغًا أكبر من صفر.";return}
  try{const rec={accountType:"rep",repId,type:"payment",amount:-a,accountId:$("pc").value,accountName:$("pc").selectedOptions[0].text,date,periodId:date.slice(0,7),createdBy:user.uid};
   const b=writeBatch(db),lr=doc(collection(db,"ledger"));b.set(lr,{...rec,createdAt:serverTimestamp()});audit(b,"سداد مندوب","ledger",lr.id,rec);await b.commit();
   $("ok").textContent="تم تسجيل السداد.";$("pa").value="";load()}catch(e){fail(e)}};
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
