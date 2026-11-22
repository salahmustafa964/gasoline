import {openForm,fe} from "./dlg.js";
import {collection,doc,writeBatch,serverTimestamp,getDocs,query,orderBy,limit,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js";
const CATS=["إيجار","رواتب وأجور","وقود وتنقلات","صيانة","اتصالات وإنترنت","رسوم حكومية","أخرى"];
export async function render(view,{db,user,period}){
 const isAdmin=user.role==="admin",t=localToday(),P=period.id;
 view.innerHTML=`
 <div class="page-head"><h2>المصروفات الإضافية</h2><button class="btn alt" id="addb">+ إضافة مصروف</button></div>
 <div class="panel"><div class="form-grid"><div><label>من تاريخ</label><input id="fr" type="date" value="${period.startDate||""}"></div>
  <div><label>إلى تاريخ</label><input id="to" type="date" value=""></div></div></div>
 <div id="ok" class="ok"></div><div id="er" class="err" role="alert"></div>
 <div id="out">جارٍ التحميل...</div>
 <dialog id="dlg"><form id="ef"><h3>إضافة مصروف</h3><p class="soon">يُخصم من صافي الربح في تاريخ المصروف.</p>
  <label for="xd">التاريخ</label><input id="xd" type="date" required value="${t}">
  <label for="xc">البند</label><select id="xc">${CATS.map(c=>`<option>${c}</option>`).join("")}</select>
  <label for="xn">الوصف</label><input id="xn" placeholder="مثال: إيجار المكتب لشهر نوفمبر">
  <label for="xa">المبلغ</label><input id="xa" type="number" step="any" min="0" required>
  <div class="err" id="xe" role="alert"></div>
  <div class="dlg-actions"><button class="btn" type="submit">حفظ المصروف</button><button class="btn ghost" type="button" id="xc2">إلغاء</button></div></form></dialog>`;
 const $=id=>view.querySelector("#"+id);
 if(period.closed)$("addb").hidden=true;
 let list=[];
 const fetchAll=async()=>{const s=await getDocs(query(collection(db,"expenses"),where("periodId","==",P),limit(1000)));list=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date).localeCompare(String(a.date)))};
 function draw(){
  const fr=$("fr").value,to=$("to").value,r=list.filter(x=>(!fr||x.date>=fr)&&(!to||x.date<=to)),live=r.filter(x=>!x.voided);
  const total=live.reduce((a,x)=>a+n(x.amount),0),by={};live.forEach(x=>by[x.category]=(by[x.category]||0)+n(x.amount));
  const cats=Object.entries(by).sort((a,b)=>b[1]-a[1]),max=cats.length?cats[0][1]:1;
  $("out").innerHTML=`<div class="panel"><div class="grid"><div class="stat bad"><b>${f(total,2)}</b><span>إجمالي المصروفات في الفترة</span></div>
   <div class="stat"><b>${live.length}</b><span>عدد المصروفات</span></div></div>
   <div class="bars">${cats.length?cats.map(([c,v])=>`<div class="bar"><span>${esc(c)}</span><div class="track"><div class="fill" style="width:${Math.max(3,v/max*100)}%"></div></div><span class="v">${f(v,2)}</span></div>`).join(""):'<p class="soon">لا توجد مصروفات في هذه الفترة. اضغط "إضافة مصروف" لتسجيل أول مصروف.</p>'}</div></div>
   <div class="panel"><h2>السجل</h2>${r.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>التاريخ</th><th>البند</th><th>الوصف</th><th>المبلغ</th><th>سجّله</th>${isAdmin?"<th></th>":""}</tr></thead><tbody>`+
   r.map(x=>`<tr class="${x.voided?"void":""}"><td>${esc(x.date)}</td><td>${esc(x.category)}${x.voided?' <span class="tag done">ملغى</span>':""}</td><td>${esc(x.description)}</td><td class="num"><b>${f(x.amount,2)}</b></td><td>${esc(x.createdByName)}</td>${isAdmin?`<td>${x.voided?"":`<button class="btn sm" data-x="${x.id}">تعديل</button><button class="btn sm danger" data-v="${x.id}">إلغاء</button>`}</td>`:""}</tr>`).join("")+
   `</tbody></table></div>`:'<p class="soon">لا توجد مصروفات.</p>'}</div>`;
  $("out").querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>voidIt(b.dataset.v));
  $("out").querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>editX(b.dataset.x));
 }
 const audit=(b,action,id,after)=>b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action,collection:"expenses",docId:id,after,createdAt:serverTimestamp()});
 async function voidIt(id){const x=list.find(e=>e.id===id);$("er").textContent="";$("ok").textContent="";
  if(!confirm(`إلغاء مصروف «${x.category}» بمبلغ ${f(x.amount,2)}؟ يبقى ظاهرًا في السجل مشطوبًا ولا يُحسب في الأرباح.`))return;
  try{const b=writeBatch(db);b.update(doc(db,"expenses",id),{voided:true,voidedBy:user.uid,voidedAt:serverTimestamp()});
   audit(b,"إلغاء مصروف",id,{date:x.date,type:x.category,amount:x.amount});await b.commit();await fetchAll();draw();$("ok").textContent="تم إلغاء المصروف."}
  catch(e){$("er").textContent=/permission/i.test(e.message)?"تعذّر الإلغاء: الفترة مقفلة أو ليست لديك صلاحية.":"تعذّر الإلغاء: "+e.message}}
 function editX(id){const x=list.find(e=>e.id===id);
  openForm({title:"تعديل مصروف",fields:[{k:"date",label:"التاريخ",type:"date",req:1},{k:"category",label:"البند",type:"select",options:CATS.map(c=>({v:c,t:c}))},{k:"description",label:"الوصف"},{k:"amount",label:"المبلغ",type:"number",req:1}],
   values:{date:x.date,category:x.category,description:x.description,amount:x.amount},
   onSubmit:async v=>{const a=n(v.amount);if(!(a>0))throw new Error("أدخل مبلغًا أكبر من صفر.");if(v.category==="أخرى"&&!v.description.trim())throw new Error("اكتب وصفًا عند اختيار «أخرى».");
    try{const b=writeBatch(db),nw={date:v.date,category:v.category,description:v.description.trim(),amount:a};
     b.update(doc(db,"expenses",id),{...nw,updatedBy:user.uid,updatedAt:serverTimestamp()});
     b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:"تعديل مصروف",collection:"expenses",docId:id,before:{date:x.date,type:x.category,note:x.description,amount:x.amount},after:{date:nw.date,type:nw.category,note:nw.description,amount:a},createdAt:serverTimestamp()});
     await b.commit()}catch(e){throw new Error(fe(e))}
    await fetchAll();draw()}})}
 $("addb").onclick=()=>{$("xe").textContent="";$("dlg").showModal();$("xa").focus()};
 $("xc2").onclick=()=>$("dlg").close();
 $("ef").onsubmit=async ev=>{ev.preventDefault();$("xe").textContent="";
  const date=$("xd").value,cat=$("xc").value,desc=$("xn").value.trim(),a=n($("xa").value);
  if(!(a>0)){$("xe").textContent="أدخل مبلغًا أكبر من صفر.";return}
  if(cat==="أخرى"&&!desc){$("xe").textContent="اكتب وصفًا للمصروف عند اختيار «أخرى».";return}
  try{const id=doc(collection(db,"expenses")).id,rec={date,periodId:P,category:cat,description:desc,amount:a,voided:false,createdBy:user.uid,createdByName:user.name},b=writeBatch(db);
   b.set(doc(db,"expenses",id),{...rec,createdAt:serverTimestamp()});audit(b,"إضافة مصروف",id,{date,type:cat,amount:a,note:desc});await b.commit();
   $("dlg").close();$("ef").reset();$("xd").value=localToday();await fetchAll();draw();$("ok").textContent="تم حفظ المصروف.";
  }catch(e){$("xe").textContent=/permission/i.test(e.message)?"تعذّر الحفظ: الفترة مقفلة أو ليست لديك صلاحية.":"تعذّر الحفظ: "+e.message}};
 $("fr").onchange=draw;$("to").onchange=draw;
 try{await fetchAll();draw()}catch(e){$("out").textContent="تعذّر التحميل: "+e.message}
}
