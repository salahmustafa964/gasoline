import {openForm,fe} from "./dlg.js";
import {collection,doc,writeBatch,serverTimestamp,getDocs,query,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc} from "./util.js";
export async function render(view,{db,user}){
 const isAdmin=user.role==="admin";
 view.innerHTML=`<div class="panel"><h2>حساب استلام جديد</h2><p class="soon">الحسابات التي تُسدَّد فيها المبالغ: خزينة، حساب بنكي، حساب شخص...</p>
 <form id="af"><div class="form-grid"><div><label>اسم الحساب (صاحب الحساب)</label><input id="an" required></div>
 <div><label>النوع</label><select id="ak"><option>نقدي</option><option>حساب بنكي</option><option>حساب شخص</option></select></div></div>
 <button class="btn" style="margin-top:1rem">حفظ الحساب</button><div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div></form></div>
 <div class="panel"><h2>كشف المسدّد لكل حساب</h2><div id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 async function load(){
  const [as,ls,rs]=await Promise.all([getDocs(collection(db,"accounts")),getDocs(query(collection(db,"ledger"),limit(5000))),getDocs(collection(db,"reps"))]);
  const reps={};rs.forEach(d=>reps[d.id]=d.data().name);
  const g={};ls.forEach(d=>{const x=d.data();if(x.type==="payment")(g[x.accountId||""]||(g[x.accountId||""]=[])).push(x)});
  const list=as.docs.map(d=>({id:d.id,name:d.data().name,kind:d.data().kind||""}));list.push({id:"",name:"بدون حساب محدد",kind:""});
  let html="",grand=0;
  for(const a of list){const rows=(g[a.id]||[]).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
   if(!rows.length&&a.id==="")continue;
   const tot=rows.reduce((s,x)=>s-n(x.amount),0);grand+=tot;
   html+=`<div class="acc"><h3>${esc(a.name)} ${a.kind?`<span class="tag">${esc(a.kind)}</span>`:""} ${isAdmin&&a.id?`<button class="btn sm" data-ea="${a.id}">تعديل</button>`:""}</h3>`+
   (rows.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>التاريخ</th><th>المندوب</th><th>الجهة</th><th>المبلغ</th><th>الطريقة</th><th>ملحوظة</th></tr></thead><tbody>`+
   rows.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(reps[x.repId]||x.repName)}</td><td>${esc(x.entity)}</td><td class="num">${f(-n(x.amount),2)}</td><td>${esc(x.method)}</td><td>${esc(x.note)}</td></tr>`).join("")+
   `<tr class="tr-total"><td colspan="3">إجمالي المسدّد لهذا الحساب</td><td class="num">${f(tot,2)}</td><td colspan="2"></td></tr></tbody></table></div>`:'<p class="soon">لا توجد مبالغ مسدّدة لهذا الحساب بعد.</p>')+`</div>`}
  $("list").innerHTML=(html||'<p class="soon">لا توجد حسابات بعد.</p>')+(html?`<p class="acc"><b>إجمالي كل المسدّد: ${f(grand,2)}</b></p>`:"");
  $("list").querySelectorAll("[data-ea]").forEach(b=>b.onclick=()=>{const id=b.dataset.ea,a=list.find(z=>z.id===id);
   openForm({title:"تعديل حساب الاستلام",fields:[{k:"name",label:"اسم الحساب",req:1},{k:"kind",label:"النوع",type:"select",options:["نقدي","حساب بنكي","حساب شخص"].map(k=>({v:k,t:k}))}],values:{name:a.name,kind:a.kind},
    onSubmit:async v=>{const name=v.name.trim();if(!name)throw new Error("الاسم مطلوب.");
     try{const bt=writeBatch(db);bt.update(doc(db,"accounts",id),{name,kind:v.kind});
      bt.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"تعديل حساب استلام",collection:"accounts",docId:id,before:{name:a.name,kind:a.kind},after:{name,kind:v.kind},createdAt:serverTimestamp()});
      await bt.commit()}catch(e){throw new Error(fe(e))}
     await load()}})})}
 $("af").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  try{const id=doc(collection(db,"accounts")).id,rec={name:$("an").value.trim(),kind:$("ak").value,active:true},b=writeBatch(db);
   b.set(doc(db,"accounts",id),{...rec,createdAt:serverTimestamp()});
   b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"إضافة حساب استلام",collection:"accounts",docId:id,after:rec,createdAt:serverTimestamp()});
   await b.commit();$("ok").textContent="تم حفظ الحساب.";$("af").reset();load()}catch(e){$("er").textContent="تعذّر الحفظ: "+e.message}};
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
