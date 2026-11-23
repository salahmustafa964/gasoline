import {printDoc} from "./pdf.js?v=19";
import {APP_NAME} from "../firebase-config.js?v=19";
import {collection,doc,writeBatch,serverTimestamp,getDocs,query,limit,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js?v=19";
import {openForm,fe} from "./dlg.js?v=19";
import {editSale,editPayment} from "./edits.js?v=19";
export async function render(view,{db,user,period}){
 const isAdmin=user.role==="admin";
 view.innerHTML=`
 <div class="panel"><h2>مندوب جديد</h2><form id="rf2"><div class="form-grid">
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
 <div class="panel"><h2>حسابات المناديب</h2>
  <div class="form-grid"><div><label for="rq">بحث باسم المندوب</label><input id="rq" type="search" placeholder="اكتب اسم المندوب لعرض كل تفاصيله"></div>
  <div><label for="rfr">من تاريخ</label><input id="rfr" type="date"></div><div><label for="rto">إلى تاريخ</label><input id="rto" type="date"></div></div>
  <label class="chk"><input type="checkbox" id="rz"> إخفاء المناديب الذين لا حركة لهم</label>
  <label class="chk"><input type="checkbox" id="rall"> عرض حركة كل الفترات (الافتراضي: الفترة الحالية فقط)</label><button class="btn sm" id="rc" type="button">مسح الفترة</button>
  <div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>
 <div id="detail"></div>`;
 const $=id=>view.querySelector("#"+id);
 const audit=(b,action,col,id,after,before)=>b.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action,collection:col,docId:id,after,...(before?{before}:{}),createdAt:serverTimestamp()});
 const fail=e=>{$("er").textContent=fe(e)};
 const r2=x=>Math.round(x*100)/100;
 let open=[],cache={s:[],l:[]},state={reps:[],t:{},accs:[],pn:{}},sel="";
 function loadOpen(){
  const rid=$("ps").value;open=[];
  if(rid){const paid={};cache.l.forEach(x=>{if(x.repId===rid&&x.type==="payment"&&x.ref)paid[x.ref]=(paid[x.ref]||0)-n(x.amount)});
   open=cache.s.filter(x=>x.repId===rid&&($("rall").checked||!period||x.periodId===period.id)).map(x=>({...x,rem:r2(n(x.amount)-n(paid[x.id]))})).filter(x=>x.rem>0.005)
    .sort((x,y)=>String(x.date).localeCompare(String(y.date))||(x.lineNo||0)-(y.lineNo||0));}
  $("pl").innerHTML='<option value="">سداد عام (يُوزَّع على الأقدم أولًا)</option>'+open.map(x=>`<option value="${x.id}">${esc(x.date)} - ${esc(x.entity||"بدون جهة")} - ${f(x.liters)} لتر - المتبقي ${f(x.rem,2)}</option>`).join("");
 }
 async function load(){
  const [rs,ls,as,ss,ps]=await Promise.all([getDocs(collection(db,"reps")),getDocs(query(collection(db,"ledger"),limit(5000))),getDocs(collection(db,"accounts")),getDocs(query(collection(db,"sales"),limit(5000))),getDocs(collection(db,"periods"))]);
  const accs=as.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.active!==false);
  $("pc").innerHTML='<option value="">— غير محدد —</option>'+accs.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  cache={s:ss.docs.map(d=>({id:d.id,...d.data()})),l:ls.docs.map(d=>({id:d.id,...d.data()}))};
  const t={};cache.l.forEach(x=>{if(x.repId)t[x.repId]=(t[x.repId]||0)+n(x.amount)});
  const reps=rs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
  const cur=$("ps").value;
  $("ps").innerHTML=reps.map(r=>`<option value="${r.id}">${esc(r.name)}${r.active===false?" (موقوف)":""}</option>`).join("");
  if(cur)$("ps").value=cur;
  const pn={};ps.forEach(d=>pn[d.id]=d.data().name||d.id);state={reps,t,accs,pn};loadOpen();drawList();
 }
 const rangeOk=(d,fr,to)=>(!fr||d>=fr)&&(!to||d<=to);
 function stats(id,fr,to){
  const pid=$("rall").checked?"":(period?period.id:"");
  const S=cache.s.filter(x=>x.repId===id&&(!pid||x.periodId===pid)&&rangeOk(String(x.date),fr,to));
  const P=cache.l.filter(x=>x.repId===id&&x.type==="payment"&&(!pid||x.periodId===pid)&&rangeOk(String(x.date),fr,to));
  const cp=cache.l.filter(x=>x.repId===id&&(!pid||x.periodId===pid)).reduce((a,x)=>a+n(x.amount),0);
  return {S,P,cp,orders:new Set(S.map(x=>x.invoiceId||x.id)).size,loads:S.length,liters:S.reduce((a,x)=>a+n(x.liters),0),value:S.reduce((a,x)=>a+n(x.amount),0),paid:-P.reduce((a,x)=>a+n(x.amount),0)};
 }
 function drawList(){
  const {reps,t}=state,q=($("rq").value||"").trim().toLowerCase(),fr=$("rfr").value,to=$("rto").value;
  if(!reps.length){$("list").innerHTML='<p class="soon">لا يوجد مناديب بعد.</p>';$("detail").innerHTML="";return}
  let rows=reps.filter(r=>!q||String(r.name||"").toLowerCase().includes(q)).map(r=>({r,s:stats(r.id,fr,to)}));
  if($("rz").checked)rows=rows.filter(x=>x.s.loads||x.s.P.length);
  const tot=rows.reduce((a,x)=>({o:a.o+x.s.orders,c:a.c+x.s.loads,l:a.l+x.s.liters,v:a.v+x.s.value,p:a.p+x.s.paid,b:a.b+n(t[x.r.id]),cp:a.cp+x.s.cp}),{o:0,c:0,l:0,v:0,p:0,b:0,cp:0});
  $("list").innerHTML=rows.length?`<table class="tbl"><thead><tr><th>المندوب</th><th>الهاتف</th><th>عدد الأوردرات</th><th>الحمولات</th><th>اللترات</th><th>قيمة المسحوب</th><th>المسدّد</th><th>المتبقي عليه</th><th></th></tr></thead><tbody>`+
  rows.map(({r,s})=>`<tr><td><button class="lnk" data-s="${r.id}">${esc(r.name||"(بدون اسم)")}</button>${r.active===false?' <span class="tag done">موقوف</span>':""}</td><td>${esc(r.phone)}</td><td class="num"><b>${s.orders}</b></td><td class="num">${s.loads}</td><td class="num">${f(s.liters,2)}</td><td class="num">${f(s.value,2)}</td><td class="num">${f(s.paid,2)}</td><td class="num"><b>${f(s.cp,2)}</b></td>
  <td>${isAdmin?`<button class="btn sm" data-e="${r.id}">تعديل</button>`:""}<button class="btn sm" data-pdf="${r.id}">PDF</button><button class="btn sm" data-t="${r.id}">${r.active===false?"تفعيل":"إيقاف"}</button><button class="btn sm danger" data-d="${r.id}" data-n="${esc(r.name)}">حذف</button></td></tr>`).join("")+
  `<tr class="tr-total"><td colspan="2">الإجمالي${fr||to?" (للفترة المحددة)":""}</td><td class="num">${tot.o}</td><td class="num">${tot.c}</td><td class="num">${f(tot.l,2)}</td><td class="num">${f(tot.v,2)}</td><td class="num">${f(tot.p,2)}</td><td class="num">${f(tot.cp,2)}</td><td></td></tr></tbody></table>
  <p class="soon">الأوردر = فاتورة واحدة (قد تضم عدة حمولات). كل الأعمدة تخص الفترة الحالية فقط (أو كل الفترات إن فعّلت الخيار)، وحساب كل مندوب يبدأ من الصفر مع كل فترة جديدة.</p>`:'<p class="soon">لا يوجد مندوب مطابق.</p>';
  $("list").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>toggle(b.dataset.t));
  $("list").querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>del(b.dataset.d,b.dataset.n));
  $("list").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>editRep(b.dataset.e));
  $("list").querySelectorAll("[data-pdf]").forEach(b=>b.onclick=()=>exportPdf(b.dataset.pdf));
  $("list").querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{sel=b.dataset.s;showDetail(sel);$("detail").scrollIntoView({behavior:"smooth"})});
  if(q&&rows.length===1)sel=rows[0].r.id;else if(!rows.some(x=>x.r.id===sel))sel="";
  if(sel)showDetail(sel);else $("detail").innerHTML="";
 }
 function showDetail(id){
  const r=state.reps.find(x=>x.id===id);if(!r)return;
  const fr=$("rfr").value,to=$("rto").value,st=stats(id,fr,to),S=st.S.slice().sort((x,y)=>String(x.date).localeCompare(String(y.date))||(x.lineNo||0)-(y.lineNo||0));
  const pd={},tg={};cache.l.forEach(x=>{if(x.repId===id&&x.type==="payment"&&x.ref){pd[x.ref]=(pd[x.ref]||0)-n(x.amount);const k=[x.accountName,x.method].filter(Boolean).join(" - ");if(k)(tg[x.ref]||(tg[x.ref]=new Set())).add(k)}});
  const TY={payment:"سداد",settlement:"تسوية"},mv=cache.l.filter(x=>x.repId===id&&x.type!=="sale"&&rangeOk(String(x.date),fr,to)).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  const tbl=(h,rows)=>rows.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`:'<p class="soon">لا توجد حركات في هذه الفترة.</p>';
  $("detail").innerHTML=`<div class="panel"><div class="page-head"><h2>تفاصيل المندوب: ${esc(r.name)}</h2><button class="btn alt" id="dpdf" type="button">تصدير PDF</button></div><p class="soon">${esc(r.phone)}${fr||to?` | الفترة: ${fr?"من "+esc(fr):""} ${to?"إلى "+esc(to):""}`:" | "+($("rall").checked?"كل الفترات":"الفترة: "+esc(period?period.name:""))}</p>
  <div class="grid"><div class="stat"><b>${st.orders}</b><span>عدد الأوردرات (${st.loads} حمولة)</span></div><div class="stat"><b>${f(st.value,2)}</b><span>المسحوب (${f(st.liters,2)} لتر)</span></div>
  <div class="stat good"><b>${f(st.paid,2)}</b><span>المسدّد في الفترة</span></div><div class="stat bad"><b>${f(st.cp,2)}</b><span>المتبقي عليه</span></div></div>
  <h3>الحمولات</h3>`+tbl(["التاريخ","الفترة","الجهة","اللترات","السعر","القيمة","المسدّد","الحساب / الطريقة","المتبقي",...(isAdmin?[""]:[])],
   S.map(x=>{const p=n(pd[x.id]);return `<tr><td>${esc(x.date)}</td><td>${esc(state.pn[x.periodId]||x.periodId)}</td><td>${esc(x.entity)}</td><td class="num">${f(x.liters,2)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(x.amount,2)}</td><td class="num">${f(p,2)}</td><td>${tg[x.id]?[...tg[x.id]].map(esc).join("، "):""}</td><td class="num"><b>${f(n(x.amount)-p,2)}</b></td>${isAdmin?`<td><button class="btn sm" data-es="${x.id}">تعديل</button></td>`:""}</tr>`}))+
  `<h3>السدادات والتسويات</h3>`+tbl(["التاريخ","النوع","المبلغ","الجهة","الحساب","الطريقة","ملحوظة",...(isAdmin?[""]:[])],
   mv.map(x=>`<tr><td>${esc(x.date)}</td><td>${TY[x.type]||esc(x.type)}</td><td class="num">${x.type==="payment"?f(-n(x.amount),2):(n(x.amount)>0?"+":"")+f(x.amount,2)}</td><td>${esc(x.entity)}</td><td>${esc(x.accountName)}</td><td>${esc(x.method)}</td><td>${esc(x.note)}</td>${isAdmin?`<td>${x.type==="payment"?`<button class="btn sm" data-ep="${x.id}">تعديل</button>`:""}</td>`:""}</tr>`))+`</div>`;
  $("detail").querySelectorAll("[data-es]").forEach(b=>b.onclick=()=>editLoad(b.dataset.es));
  $("detail").querySelectorAll("[data-ep]").forEach(b=>b.onclick=()=>editPay(b.dataset.ep));
  $("dpdf").onclick=()=>exportPdf(id);
 }

 function exportPdf(id){
  const r=state.reps.find(x=>x.id===id);if(!r)return;
  const fr=$("rfr").value,to=$("rto").value,st=stats(id,fr,to);
  const S=st.S.slice().sort((x,y)=>String(x.date).localeCompare(String(y.date))||(x.lineNo||0)-(y.lineNo||0));
  const pd={},tg={};cache.l.forEach(x=>{if(x.repId===id&&x.type==="payment"&&x.ref){pd[x.ref]=(pd[x.ref]||0)-n(x.amount);const k=[x.accountName,x.method].filter(Boolean).join(" - ");if(k)(tg[x.ref]||(tg[x.ref]=new Set())).add(k)}});
  const mv=cache.l.filter(x=>x.repId===id&&x.type!=="sale"&&rangeOk(String(x.date),fr,to)).sort((x,y)=>String(x.date).localeCompare(String(y.date)));
  const TY={payment:"سداد",settlement:"تسوية"};
  const sumRem=S.reduce((a,x)=>a+n(x.amount)-n(pd[x.id]),0);
  const loads=S.map(x=>{const p=n(pd[x.id]);return `<tr><td>${esc(x.date)}</td><td>${esc(state.pn[x.periodId]||x.periodId||"")}</td><td>${esc(x.entity)}</td><td class="num">${f(x.liters,2)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(x.amount,2)}</td><td class="num">${f(p,2)}</td><td class="num">${f(n(x.amount)-p,2)}</td></tr>`}).join("");
  const pays=mv.map(x=>`<tr><td>${esc(x.date)}</td><td>${TY[x.type]||esc(x.type)}</td><td class="num">${x.type==="payment"?f(-n(x.amount),2):(n(x.amount)>0?"+":"")+f(x.amount,2)}</td><td>${esc(x.entity)}</td><td>${esc(x.accountName)}</td><td>${esc(x.method)}</td><td>${esc(x.note)}</td></tr>`).join("");
  const range=($("rall").checked?"كل الفترات":"الفترة: "+esc(period?period.name:""))+(fr||to?` | ${fr?"من "+esc(fr):""} ${to?"إلى "+esc(to):""}`:"");
  const body=`<div class="hd"><div><h1>${esc(APP_NAME)}</h1><div>كشف حساب مندوب</div></div><div>تاريخ الطباعة: ${localToday()}</div></div>
  <h2>${esc(r.name)}</h2><div>الهاتف: ${esc(r.phone||"—")} &nbsp;|&nbsp; الفترة الزمنية: ${range}</div>
  <div class="sum"><div>عدد الأوردرات<b>${st.orders}</b></div><div>اللترات المسحوبة<b>${f(st.liters,2)}</b></div><div>قيمة المسحوب<b>${f(st.value,2)}</b></div><div>المسدّد في الفترة<b>${f(st.paid,2)}</b></div><div>المتبقي عليه<b>${f(st.cp,2)}</b></div></div>
  <h2>الحمولات</h2>${loads?`<table><thead><tr><th>التاريخ</th><th>الفترة</th><th>الجهة</th><th>اللترات</th><th>السعر</th><th>القيمة</th><th>المسدّد</th><th>المتبقي</th></tr></thead><tbody>${loads}<tr class="tot"><td colspan="3">الإجمالي</td><td class="num">${f(st.liters,2)}</td><td></td><td class="num">${f(st.value,2)}</td><td class="num">${f(S.reduce((a,x)=>a+n(pd[x.id]),0),2)}</td><td class="num">${f(sumRem,2)}</td></tr></tbody></table>`:"<p>لا توجد حمولات.</p>"}
  <h2>السدادات والتسويات</h2>${pays?`<table><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الجهة</th><th>الحساب</th><th>الطريقة</th><th>ملحوظة</th></tr></thead><tbody>${pays}</tbody></table>`:"<p>لا توجد حركات.</p>"}`;
  printDoc("كشف حساب - "+r.name,body);
 }
 function editLoad(id){const x=cache.s.find(e=>e.id===id);
  openForm({title:"تعديل حمولة",note:"يُعاد حساب المخزون والتكلفة وحساب المندوب تلقائيًا، ويُسجَّل التعديل في سجل العمليات.",
   fields:[{k:"date",label:"التاريخ",type:"date",req:1},{k:"entity",label:"الجهة"},{k:"liters",label:"الكمية (لتر)",type:"number",req:1},{k:"price",label:"سعر البيع للتر",type:"number",req:1}],
   values:{date:x.date,entity:x.entity,liters:x.liters,price:x.pricePerLiter},
   onSubmit:async v=>{await editSale(db,user,id,v);await load()}})}
 function editPay(id){const x=cache.l.find(e=>e.id===id);
  openForm({title:"تعديل سداد",fields:[{k:"date",label:"التاريخ",type:"date",req:1},{k:"amount",label:"المبلغ",type:"number",req:1},
   {k:"accountId",label:"تم الدفع في حساب",type:"select",options:[{v:"",t:"— غير محدد —"},...state.accs.map(a=>({v:a.id,t:a.name}))]},
   {k:"method",label:"طريقة السداد",type:"select",options:[{v:"",t:"—"},{v:"كاش",t:"كاش"},{v:"بنكك",t:"بنكك"},{v:"تحويل آخر",t:"تحويل آخر"}]},{k:"note",label:"ملحوظة"}],
   values:{date:x.date,amount:-n(x.amount),accountId:x.accountId||"",method:x.method||"",note:x.note||""},
   onSubmit:async v=>{const a=state.accs.find(z=>z.id===v.accountId);await editPayment(db,user,id,v,a?a.name:"");await load()}})}
 function editRep(id){const r=state.reps.find(x=>x.id===id);
  openForm({title:"تعديل بيانات المندوب",fields:[{k:"name",label:"اسم المندوب",req:1},{k:"phone",label:"رقم الهاتف",type:"tel"}],values:{name:r.name,phone:r.phone},
   onSubmit:async v=>{const name=v.name.trim();if(!name)throw new Error("الاسم مطلوب.");
    const b=writeBatch(db);b.update(doc(db,"reps",id),{name,phone:v.phone.trim()});
    audit(b,"تعديل مندوب","reps",id,{name,phone:v.phone.trim()},{name:r.name,phone:r.phone||""});await b.commit();await load()}})}
 async function toggle(id){const r=state.reps.find(x=>x.id===id),act=r.active===false;
  try{const b=writeBatch(db);b.update(doc(db,"reps",id),{active:act});audit(b,act?"تفعيل مندوب":"إيقاف مندوب","reps",id,{name:r.name});await b.commit();load()}catch(e){fail(e)}}
 async function del(id,name){$("er").textContent="";$("ok").textContent="";
  try{const [a,b2]=await Promise.all([getDocs(query(collection(db,"ledger"),where("repId","==",id),limit(1))),getDocs(query(collection(db,"sales"),where("repId","==",id),limit(1)))]);
   if(!a.empty||!b2.empty){$("er").textContent=`لا يمكن حذف «${name}» لأن له حركات مسجلة. استخدم "إيقاف" فيختفي من قوائم البيع ويبقى في التقارير.`;return}
   if(!confirm(`حذف المندوب «${name}» نهائيًا؟`))return;
   const b=writeBatch(db);b.delete(doc(db,"reps",id));audit(b,"حذف مندوب","reps",id,{name});await b.commit();$("ok").textContent="تم حذف المندوب.";load()}catch(e){fail(e)}}
 $("ps").onchange=loadOpen;$("rq").oninput=drawList;$("rfr").onchange=drawList;$("rto").onchange=drawList;$("rz").onchange=drawList;$("rall").onchange=()=>{loadOpen();drawList()};
 $("rc").onclick=()=>{$("rfr").value="";$("rto").value="";drawList()};
 $("rf2").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  try{const id=doc(collection(db,"reps")).id,rec={name:$("rn").value.trim(),phone:$("rp").value.trim(),active:true};
   const b=writeBatch(db);b.set(doc(db,"reps",id),{...rec,createdAt:serverTimestamp()});audit(b,"إضافة مندوب","reps",id,rec);await b.commit();
   $("ok").textContent="تم حفظ المندوب.";$("rf2").reset();load()}catch(e){fail(e)}};
 $("pf").onsubmit=async ev=>{ev.preventDefault();$("er").textContent="";$("ok").textContent="";
  const a=r2(n($("pa").value)),date=$("pd").value,repId=$("ps").value,selL=$("pl").value;
  if(!(a>0)||!repId){$("er").textContent="اختر المندوب وأدخل مبلغًا أكبر من صفر.";return}
  let targets=[];
  if(selL){const s=open.find(x=>x.id===selL);if(a>s.rem+0.005){$("er").textContent=`المبلغ أكبر من المتبقي على هذه الحمولة (${f(s.rem,2)}).`;return}targets=[{s,amt:a}]}
  else{let left=a;for(const s of open){if(left<=0.005)break;const t=Math.min(left,s.rem);targets.push({s,amt:r2(t)});left=r2(left-t)}
   if(left>0.005){$("er").textContent=`المبلغ أكبر من إجمالي المتبقي على المندوب (${f(open.reduce((x,s)=>x+s.rem,0),2)}).`;return}}
  try{const b=writeBatch(db),rn=$("ps").selectedOptions[0].text,acc=$("pc");
   const info={repName:rn,accountId:acc.value,accountName:acc.value?acc.selectedOptions[0].text:"",method:$("pm").value,note:$("pn").value.trim()};
   for(const {s,amt} of targets){const rec={accountType:"rep",repId,type:"payment",amount:-amt,ref:s.id,entity:s.entity||"",...info,date,periodId:s.periodId||date.slice(0,7),createdBy:user.uid};
    const lr=doc(collection(db,"ledger"));b.set(lr,{...rec,createdAt:serverTimestamp()});audit(b,"سداد مندوب","ledger",lr.id,rec)}
   await b.commit();$("ok").textContent="تم تسجيل السداد.";$("pa").value="";$("pn").value="";load()}catch(e){fail(e)}};
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
