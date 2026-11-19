import {collection,doc,writeBatch,serverTimestamp,getDocs,query,limit,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
  <div><label>تسديد لـ</label><select id="pl"></select></div>
  <div><label>المبلغ المسدّد</label><input id="pa" type="number" step="any" min="0" required></div>
  <div><label>تم الدفع في حساب (اختياري)</label><select id="pc"></select></div>
  <div><label>طريقة السداد (اختياري)</label><select id="pm"><option value="">—</option><option>كاش</option><option>بنكك</option><option>تحويل آخر</option></select></div>
  <div><label>ملحوظة (اختياري)</label><input id="pn"></div></div>
  <button class="btn" style="margin-top:1rem">حفظ السداد</button></form></div>
 <div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div>
 <div class="panel"><h2>حسابات المناديب</h2><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 const audit=(b,action,col,id,after)=>b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action,collection:col,docId:id,after,createdAt:serverTimestamp()});
 const fail=e=>{$("er").textContent=/permission/i.test(e.message)?"تعذّر الحفظ: ليست لديك صلاحية.":"تعذّر الحفظ: "+e.message};
 const r2=x=>Math.round(x*100)/100;
 let open=[];
 async function loadOpen(){
  const rid=$("ps").value;open=[];
  if(rid){
   const [ss,ls]=await Promise.all([getDocs(query(collection(db,"sales"),where("repId","==",rid))),getDocs(query(collection(db,"ledger"),where("repId","==",rid)))]);
   const paid={};ls.forEach(d=>{const x=d.data();if(x.type==="payment"&&x.ref)paid[x.ref]=(paid[x.ref]||0)-n(x.amount)});
   open=ss.docs.map(d=>({id:d.id,...d.data()})).map(s=>({...s,rem:r2(n(s.amount)-n(paid[s.id]))})).filter(s=>s.rem>0.005)
    .sort((a,b)=>a.date.localeCompare(b.date)||(a.lineNo||0)-(b.lineNo||0));}
  $("pl").innerHTML='<option value="">سداد عام (يُوزَّع على الأقدم أولًا)</option>'+open.map(s=>`<option value="${s.id}">${esc(s.date)} - ${esc(s.entity||"بدون جهة")} - ${f(s.liters)} لتر - المتبقي ${f(s.rem,2)}</option>`).join("");
 }
 async function load(){
  const [rs,ls,as]=await Promise.all([getDocs(collection(db,"reps")),getDocs(query(collection(db,"ledger"),limit(5000))),getDocs(collection(db,"accounts"))]);
  $("pc").innerHTML='<option value="">— غير محدد —</option>'+as.docs.filter(d=>d.data().active!==false).map(d=>`<option value="${d.id}">${esc(d.data().name)}</option>`).join("");
  const t={},sold={},paid={};
  ls.forEach(d=>{const x=d.data();if(!x.repId)return;t[x.repId]=(t[x.repId]||0)+n(x.amount);
   if(x.type==="sale")sold[x.repId]=(sold[x.repId]||0)+n(x.amount);else paid[x.repId]=(paid[x.repId]||0)-n(x.amount)});
  const reps=rs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name,"ar"));
  const cur=$("ps").value;
  $("ps").innerHTML=reps.map(r=>`<option value="${r.id}">${esc(r.name)}${r.active===false?" (موقوف)":""}</option>`).join("");
  if(cur)$("ps").value=cur;
  await loadOpen();
  if(!reps.length){$("list").innerHTML='<p class="soon">لا يوجد مناديب بعد.</p>';return}
  let all=0;
  $("list").innerHTML=`<table class="tbl"><thead><tr><th>المندوب</th><th>الهاتف</th><th>إجمالي المسحوب</th><th>المسدّد</th><th>المتبقي عليه</th><th></th></tr></thead><tbody>`+
  reps.map(r=>{all+=n(t[r.id]);return `<tr><td>${esc(r.name)}${r.active===false?' <span class="tag done">موقوف</span>':""}</td><td>${esc(r.phone)}</td><td class="num">${f(sold[r.id],2)}</td><td class="num">${f(paid[r.id],2)}</td><td class="num"><b>${f(t[r.id],2)}</b></td>
  <td><button class="btn sm" data-t="${r.id}">${r.active===false?"تفعيل":"إيقاف"}</button><button class="btn sm danger" data-d="${r.id}" data-n="${esc(r.name)}">حذف</button></td></tr>`}).join("")+
  `</tbody></table><p><b>إجمالي المديونيات: ${f(all,2)}</b></p>`;
  $("list").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>toggle(b.dataset.t,reps));
  $("list").querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>del(b.dataset.d,b.dataset.n));
 }
 async function toggle(id,reps){const r=reps.find(x=>x.id===id),act=r.active===false;
  try{const b=writeBatch(db);b.update(doc(db,"reps",id),{active:act});audit(b,act?"تفعيل مندوب":"إيقاف مندوب","reps",id,{name:r.name});await b.commit();load()}catch(e){fail(e)}}
 async function del(id,name){$("er").textContent="";$("ok").textContent="";
  try{const [a,b2]=await Promise.all([getDocs(query(collection(db,"ledger"),where("repId","==",id),limit(1))),getDocs(query(collection(db,"sales"),where("repId","==",id),limit(1)))]);
   if(!a.empty||!b2.empty){$("er").textContent=`لا يمكن حذف «${name}» لأن له حركات مسجلة. استخدم "إيقاف" فيختفي من قوائم البيع ويبقى في التقارير.`;return}
   if(!confirm(`حذف المندوب «${name}» نهائيًا؟`))return;
   const b=writeBatch(db);b.delete(doc(db,"reps",id));audit(b,"حذف مندوب","reps",id,{name});await b.commit();$("ok").textContent="تم حذف المندوب.";load()}catch(e){fail(e)}}
 $("ps").onchange=loadOpen;
 $("rf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  try{const id=doc(collection(db,"reps")).id,rec={name:$("rn").value.trim(),phone:$("rp").value.trim(),active:true};
   const b=writeBatch(db);b.set(doc(db,"reps",id),{...rec,createdAt:serverTimestamp()});audit(b,"إضافة مندوب","reps",id,rec);await b.commit();
   $("ok").textContent="تم حفظ المندوب.";$("rf").reset();load()}catch(e){fail(e)}};
 $("pf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  const a=r2(n($("pa").value)),date=$("pd").value,repId=$("ps").value,sel=$("pl").value;
  if(!(a>0)||!repId){$("er").textContent="اختر المندوب وأدخل مبلغًا أكبر من صفر.";return}
  let targets=[];
  if(sel){const s=open.find(x=>x.id===sel);if(a>s.rem+0.005){$("er").textContent=`المبلغ أكبر من المتبقي على هذه الحمولة (${f(s.rem,2)}).`;return}targets=[{s,amt:a}]}
  else{let left=a;for(const s of open){if(left<=0.005)break;const t=Math.min(left,s.rem);targets.push({s,amt:r2(t)});left=r2(left-t)}
   if(left>0.005){$("er").textContent=`المبلغ أكبر من إجمالي المتبقي على المندوب (${f(open.reduce((x,s)=>x+s.rem,0),2)}).`;return}}
  try{const b=writeBatch(db),rn=$("ps").selectedOptions[0].text,acc=$("pc");
   const info={repName:rn,accountId:acc.value,accountName:acc.value?acc.selectedOptions[0].text:"",method:$("pm").value,note:$("pn").value.trim()};
   for(const {s,amt} of targets){const rec={accountType:"rep",repId,type:"payment",amount:-amt,ref:s.id,entity:s.entity||"",...info,date,periodId:date.slice(0,7),createdBy:user.uid};
    const lr=doc(collection(db,"ledger"));b.set(lr,{...rec,createdAt:serverTimestamp()});audit(b,"سداد مندوب","ledger",lr.id,rec)}
   await b.commit();$("ok").textContent="تم تسجيل السداد.";$("pa").value="";$("pn").value="";load()}catch(e){fail(e)}};
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
