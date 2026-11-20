import {collection,doc,writeBatch,serverTimestamp,getDocs,query,where,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc,localToday} from "./util.js";
import {loadAll,batchStats,periodProfit} from "./profit.js";
const rng=()=>{const t=localToday();return [t.slice(0,7)+"-01",t]};
const dates=(a,b)=>`<div class="panel"><div class="form-grid"><div><label>من تاريخ</label><input id="fr" type="date" value="${a}"></div><div><label>إلى تاريخ</label><input id="to" type="date" value="${b}"></div></div></div>`;
const tbl=(h,rows,foot="")=>rows.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}${foot}</tbody></table></div>`:'<p class="soon">لا توجد بيانات في هذه الفترة.</p>';
async function repView(view,{db,user}){
 const [a,b]=rng();view.innerHTML=dates(a,b)+'<div id="out"></div>';
 const $=id=>view.querySelector("#"+id);
 if(!user.repId){$("out").innerHTML='<div class="panel soon">حسابك غير مربوط بمندوب. تواصل مع المدير.</div>';return}
 const s=await getDocs(query(collection(db,"sales"),where("repId","==",user.repId),limit(1000)));
 const draw=()=>{const r=s.docs.map(d=>d.data()).filter(x=>x.date>=$("fr").value&&x.date<=$("to").value).sort((x,y)=>y.date.localeCompare(x.date));
  const L=r.reduce((t,x)=>t+n(x.liters),0),V=r.reduce((t,x)=>t+n(x.amount),0),P=r.reduce((t,x)=>t+n(x.paid),0);
  $("out").innerHTML=`<div class="panel"><h2>مسحوباتي</h2>`+tbl(["التاريخ","الجهة","اللترات","السعر","القيمة","المسدّد عند السحب"],
   r.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.entity)}</td><td class="num">${f(x.liters,2)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(x.amount,2)}</td><td class="num">${f(x.paid,2)}</td></tr>`),
   `<tr class="tr-total"><td colspan="2">الإجمالي</td><td class="num">${f(L,2)}</td><td></td><td class="num">${f(V,2)}</td><td class="num">${f(P,2)}</td></tr>`)+`</div>`};
 view.querySelectorAll("input").forEach(i=>i.onchange=draw);draw();
}
export async function render(view,ctx){
 if(ctx.user.role==="rep")return repView(view,ctx);
 const {db,user}=ctx,[a,b]=rng();
 view.innerHTML=dates(a,b)+'<div id="out">جارٍ التحميل...</div>';
 const $=id=>view.querySelector("#"+id);
 let D=await loadAll(db);
 const draw=()=>{
  const fr=$("fr").value,to=$("to").value,inR=d=>d>=fr&&d<=to,p=periodProfit(D,fr,to),row=(l,v,c="")=>`<tr class="${c}"><td>${l}</td><td class="num">${f(v,2)}</td></tr>`;
  const stat=`<div class="panel"><h2>قائمة الأرباح</h2>`+tbl(["البند","المبلغ"],[row("قيمة المبيعات",p.revenue),row("تكلفة المبيعات (سعر الشراء)",-p.cost),row("الربح الإجمالي",p.gross,"tr-total"),
   row("ترحيل ورسوم وتكاليف الشحنات المنتهية في الفترة",-p.extras),row("عجز جرد على الشركة",-p.shortage),row("زيادة جرد",p.surplus),row("صافي الربح",p.net,"tr-total")])+
   `<p class="soon">تكاليف شحنات لم تنتهِ بعد وتُخصم عند انتهائها: ${f(p.pending,2)}. عجز الجرد المحمّل على مندوب لا يُعد خسارة لأنه مسجّل على حسابه.</p></div>`;
  const st=batchStats(D).filter(x=>x.b.date<=to).sort((x,y)=>String(y.b.date).localeCompare(String(x.b.date)));
  const ship=`<div class="panel"><h2>أرباح الشحنات</h2>`+tbl(["التاريخ","المورد","اللترات","المباع","المتبقي","إيراد المبيعات","تكلفة الشراء","الربح الإجمالي","ترحيل ورسوم","الصافي","الحالة"],
   st.map(x=>{const g=x.revenue-x.cost;return `<tr><td>${esc(x.b.date)}</td><td>${esc(x.b.supplierName)}</td><td class="num">${f(x.b.liters,2)}</td><td class="num">${f(x.sold,2)}</td><td class="num">${f(x.b.remainingLiters,2)}</td><td class="num">${f(x.revenue,2)}</td><td class="num">${f(x.cost,2)}</td><td class="num">${f(g,2)}</td><td class="num">${f(x.extras,2)}</td><td class="num"><b>${x.finished?f(g-x.extras,2):"—"}</b></td><td>${x.finished?'<span class="tag done">منتهية</span>':'<span class="tag">جارية</span>'}</td></tr>`}))+`</div>`;
  const g={};D.sales.filter(s=>inR(s.date)).forEach(s=>{const r=g[s.repId]||(g[s.repId]={name:s.repName,L:0,V:0,P:0,C:0});r.L+=n(s.liters);r.V+=n(s.amount);r.P+=n(s.amount)-n(s.costTotal)});
  const col={},bal={};D.ledger.filter(x=>x.repId).forEach(x=>{bal[x.repId]=(bal[x.repId]||0)+n(x.amount);if(x.type==="payment"&&inR(x.date))col[x.repId]=(col[x.repId]||0)-n(x.amount)});
  Object.keys(col).forEach(id=>{if(!g[id]){const l=D.ledger.find(x=>x.repId===id&&x.repName);g[id]={name:l?l.repName:id,L:0,V:0,P:0}}});
  const reps=`<div class="panel"><h2>تقرير المناديب</h2>`+tbl(["المندوب","اللترات المباعة","قيمة المبيعات","الربح الإجمالي","المحصّل في الفترة","المتبقي عليه حاليًا"],
   Object.entries(g).map(([id,r])=>`<tr><td>${esc(r.name)}</td><td class="num">${f(r.L,2)}</td><td class="num">${f(r.V,2)}</td><td class="num">${f(r.P,2)}</td><td class="num">${f(col[id],2)}</td><td class="num"><b>${f(bal[id],2)}</b></td></tr>`))+`</div>`;
  const pu=D.purchases.filter(x=>inR(x.date)).sort((x,y)=>y.date.localeCompare(x.date)),pt=pu.reduce((t,x)=>t+n(x.liters)*n(x.pricePerLiter),0);
  const pur=`<div class="panel"><h2>تقرير المشتريات</h2>`+tbl(["التاريخ","المورد","اللترات","سعر الشراء","قيمة الشراء","ترحيل","رسوم","أخرى"],
   pu.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.supplierName)}</td><td class="num">${f(x.liters,2)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(n(x.liters)*n(x.pricePerLiter),2)}</td><td class="num">${f(x.transport,2)}</td><td class="num">${f(x.stateFee,2)}</td><td class="num">${f(x.otherCost,2)}</td></tr>`),
   `<tr class="tr-total"><td colspan="4">إجمالي قيمة الشراء</td><td class="num">${f(pt,2)}</td><td colspan="3"></td></tr>`)+`</div>`;
  $("out").innerHTML=stat+ship+reps+pur+(user.role==="admin"?'<div id="per"></div>':"");
  if(user.role==="admin")periods();
 };
 async function periods(){
  const ps=await getDocs(collection(db,"periods")),cl=ps.docs.filter(d=>d.data().closed===true).map(d=>d.id).sort().reverse();
  $("per").innerHTML=`<div class="panel"><h2>قفل الفترات</h2><p class="soon">الفترة المقفلة لا تقبل أي حركة بتاريخ داخلها. الرصيد المرحّل يُحسب تلقائيًا من الحركات.</p>
  <div class="form-grid"><div><label>الشهر</label><input id="pm" type="month" value="${localToday().slice(0,7)}"></div></div>
  <button class="btn" id="cl" style="margin-top:1rem">قفل الفترة</button> <button class="btn ghost" id="op" style="color:var(--ink);border-color:var(--line)">إعادة فتح</button>
  <div class="err" id="pe" role="alert"></div><div class="ok" id="pk"></div>
  <p><b>الفترات المقفلة:</b> ${cl.length?cl.join("، "):"لا يوجد"}</p></div>`;
  const set=async closed=>{$("pe").textContent="";$("pk").textContent="";const mo=$("pm").value;if(!mo)return;
   if(closed&&D.settlements.some(s=>s.status==="draft"&&s.periodId===mo)){$("pe").textContent="لا يمكن قفل الفترة: توجد تسويات بانتظار الاعتماد.";return}
   try{const bt=writeBatch(db);bt.set(doc(db,"periods",mo),{closed,by:user.uid,at:serverTimestamp()});
    bt.set(doc(collection(db,"auditLog")),{userId:user.uid,userName:user.name,action:closed?"قفل فترة":"إعادة فتح فترة",collection:"periods",docId:mo,after:{date:mo},createdAt:serverTimestamp()});
    await bt.commit();$("pk").textContent=closed?"تم قفل الفترة.":"تم فتح الفترة.";periods()}catch(e){$("pe").textContent="تعذّر التنفيذ: "+e.message}};
  $("cl").onclick=()=>set(true);$("op").onclick=()=>set(false);
 }
 view.querySelectorAll("#fr,#to").forEach(i=>i.onchange=draw);draw();
}
