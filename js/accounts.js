import {collection,doc,writeBatch,serverTimestamp,getDocs,query,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc} from "./util.js";
export async function render(view,{db,user}){
 view.innerHTML=`<div class="panel"><h2>حساب استلام جديد</h2><p class="soon">الحسابات التي تُسدَّد فيها المبالغ: خزينة، حساب بنكي، حساب شخص...</p>
 <form id="af"><div class="form-grid"><div><label>اسم الحساب (صاحب الحساب)</label><input id="an" required></div>
 <div><label>النوع</label><select id="ak"><option>نقدي</option><option>حساب بنكي</option><option>حساب شخص</option></select></div></div>
 <button class="btn" style="margin-top:1rem">حفظ الحساب</button><div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div></form></div>
 <div class="panel"><h2>إجمالي المستلم في كل حساب</h2><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 async function load(){
  const [as,ls]=await Promise.all([getDocs(collection(db,"accounts")),getDocs(query(collection(db,"ledger"),limit(5000)))]);
  const t={};ls.forEach(d=>{const x=d.data();if(x.type==="payment"&&x.accountId)t[x.accountId]=(t[x.accountId]||0)-n(x.amount)});
  if(as.empty){$("list").innerHTML='<p class="soon">لا توجد حسابات بعد.</p>';return}
  let all=0;
  $("list").innerHTML=`<table class="tbl"><thead><tr><th>الحساب</th><th>النوع</th><th>إجمالي المستلم</th></tr></thead><tbody>`+
  as.docs.map(d=>{const x=d.data();all+=n(t[d.id]);return `<tr><td>${esc(x.name)}</td><td>${esc(x.kind)}</td><td class="num"><b>${f(t[d.id],2)}</b></td></tr>`}).join("")+`</tbody></table><p><b>الإجمالي: ${f(all,2)}</b></p>`}
 $("af").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  try{const id=doc(collection(db,"accounts")).id,rec={name:$("an").value.trim(),kind:$("ak").value,active:true},b=writeBatch(db);
   b.set(doc(db,"accounts",id),{...rec,createdAt:serverTimestamp()});
   b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"إضافة حساب استلام",collection:"accounts",docId:id,after:rec,createdAt:serverTimestamp()});
   await b.commit();$("ok").textContent="تم حفظ الحساب.";$("af").reset();load()}catch(e){$("er").textContent="تعذّر الحفظ: "+e.message}};
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
