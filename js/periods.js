import {collection,doc,writeBatch,serverTimestamp,getDocs,query,where,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc} from "./util.js?v=16";
import {openForm,fe} from "./dlg.js?v=16";
export async function render(view,{db,user,period}){
 const isAdmin=user.role==="admin";
 view.innerHTML=`<div class="page-head"><h2>الفترات</h2></div>
 <p class="soon">كل فترة مساحة عمل مستقلة بشحناتها ومبيعاتها ومخزونها وتسوياتها ومصروفاتها وتقاريرها. المناديب وحسابات الاستلام مشتركة بين كل الفترات. أنشئ فترة جديدة من الزر أعلى الصفحة، وبدّل بين الفترات من القائمة بجانبه.</p>
 <div class="err" id="er" role="alert"></div><div class="ok" id="ok"></div>
 <div class="panel"><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 const aud=(b,action,id,after,before)=>b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action,collection:"periods",docId:id,after,...(before?{before}:{}),createdAt:serverTimestamp()});
 async function load(){
  const [ps,ss,pu]=await Promise.all([getDocs(collection(db,"periods")),getDocs(query(collection(db,"sales"),limit(5000))),getDocs(collection(db,"purchases"))]);
  const sa={},pl={},pr={};
  ss.forEach(d=>{const x=d.data();sa[x.periodId]=(sa[x.periodId]||0)+n(x.amount)});
  pu.forEach(d=>{const x=d.data();pl[x.periodId]=(pl[x.periodId]||0)+n(x.liters);pr[x.periodId]=(pr[x.periodId]||0)+n(x.remainingLiters)});
  const list=ps.docs.map(d=>({id:d.id,...d.data(),name:d.data().name||d.id})).sort((a,b)=>((b.createdAt&&b.createdAt.seconds)||0)-((a.createdAt&&a.createdAt.seconds)||0)||String(b.id).localeCompare(String(a.id)));
  $("list").innerHTML=list.length?`<table class="tbl"><thead><tr><th>الفترة</th><th>تاريخ البداية</th><th>اللترات المشتراة</th><th>المتبقي في المخزون</th><th>قيمة المبيعات</th><th>الحالة</th><th></th></tr></thead><tbody>`+
   list.map(p=>`<tr><td><b>${esc(p.name)}</b>${period&&p.id===period.id?' <span class="tag">الحالية</span>':""}</td><td>${esc(p.startDate)}</td><td class="num">${f(pl[p.id],2)}</td><td class="num">${f(pr[p.id],2)}</td><td class="num">${f(sa[p.id],2)}</td><td>${p.closed?'<span class="tag done">مقفلة</span>':'<span class="tag">مفتوحة</span>'}</td>
   <td><button class="btn sm" data-o="${p.id}">فتح هذه الفترة</button>${isAdmin?`<button class="btn sm" data-e="${p.id}">تعديل</button><button class="btn sm ${p.closed?"":"danger"}" data-l="${p.id}">${p.closed?"إعادة فتح":"قفل"}</button>`:""}</td></tr>`).join("")+`</tbody></table>`:'<p class="soon">لا توجد فترات بعد. اضغط "+ فترة جديدة" أعلى الصفحة.</p>';
  $("list").querySelectorAll("[data-o]").forEach(b=>b.onclick=()=>dispatchEvent(new CustomEvent("setperiod",{detail:b.dataset.o})));
  $("list").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{const p=list.find(x=>x.id===b.dataset.e);
   openForm({title:"تعديل الفترة",fields:[{k:"name",label:"اسم الفترة",req:1},{k:"start",label:"تاريخ البداية",type:"date"}],values:{name:p.name,start:p.startDate||""},
    onSubmit:async v=>{try{const bt=writeBatch(db);bt.set(doc(db,"periods",p.id),{name:v.name.trim(),startDate:v.start||""},{merge:true});aud(bt,"تعديل فترة",p.id,{name:v.name.trim(),date:v.start},{name:p.name,date:p.startDate||""});await bt.commit()}catch(e){throw new Error(fe(e))}
     dispatchEvent(new Event("periodschanged"))}})});
  $("list").querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>lock(list.find(x=>x.id===b.dataset.l)));
 }
 async function lock(p){$("er").textContent="";$("ok").textContent="";const closing=!p.closed;
  try{
   if(closing){const st=await getDocs(query(collection(db,"settlements"),where("periodId","==",p.id)));
    if(st.docs.some(d=>d.data().status==="draft")){$("er").textContent="لا يمكن قفل الفترة: توجد تسويات بانتظار الاعتماد.";return}
    if(!confirm(`قفل «${p.name}»؟ لن تقبل أي حركة جديدة أو تعديل حتى تعيد فتحها.`))return}
   const bt=writeBatch(db);bt.set(doc(db,"periods",p.id),{closed:closing,by:user.uid,at:serverTimestamp()},{merge:true});aud(bt,closing?"قفل فترة":"إعادة فتح فترة",p.id,{name:p.name});await bt.commit();
   $("ok").textContent=closing?"تم قفل الفترة.":"تم فتح الفترة.";dispatchEvent(new Event("periodschanged"));
  }catch(e){$("er").textContent=fe(e)}}
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
