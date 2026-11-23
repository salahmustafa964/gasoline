import {collection,getDocs,query,where,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {n,f,esc} from "./util.js?v=19";
import {loadAll,batchStats,periodProfit} from "./profit.js?v=19";
const dates=(a="",b="")=>`<div class="panel"><div class="form-grid"><div><label>من تاريخ (اختياري)</label><input id="fr" type="date" value="${a}"></div><div><label>إلى تاريخ (اختياري)</label><input id="to" type="date" value="${b}"></div></div></div>`;
const tbl=(h,rows,foot="")=>rows.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}${foot}</tbody></table></div>`:'<p class="soon">لا توجد بيانات في هذه الفترة.</p>';
async function repView(view,{db,user}){
 view.innerHTML=dates()+'<div id="out"></div>';
 const $=id=>view.querySelector("#"+id);
 if(!user.repId){$("out").innerHTML='<div class="panel soon">حسابك غير مربوط بمندوب. تواصل مع المدير.</div>';return}
 const s=await getDocs(query(collection(db,"sales"),where("repId","==",user.repId),limit(1000)));
 const draw=()=>{const fr=$("fr").value,to=$("to").value,r=s.docs.map(d=>d.data()).filter(x=>(!fr||x.date>=fr)&&(!to||x.date<=to)).sort((x,y)=>y.date.localeCompare(x.date));
  const L=r.reduce((t,x)=>t+n(x.liters),0),V=r.reduce((t,x)=>t+n(x.amount),0),P=r.reduce((t,x)=>t+n(x.paid),0);
  $("out").innerHTML=`<div class="panel"><h2>مسحوباتي</h2>`+tbl(["التاريخ","الجهة","اللترات","السعر","القيمة","المسدّد عند السحب"],
   r.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.entity)}</td><td class="num">${f(x.liters,2)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(x.amount,2)}</td><td class="num">${f(x.paid,2)}</td></tr>`),
   `<tr class="tr-total"><td colspan="2">الإجمالي</td><td class="num">${f(L,2)}</td><td></td><td class="num">${f(V,2)}</td><td class="num">${f(P,2)}</td></tr>`)+`</div>`};
 view.querySelectorAll("input").forEach(i=>i.onchange=draw);draw();
}
export async function render(view,ctx){
 if(ctx.user.role==="rep")return repView(view,ctx);
 const {db,period}=ctx;
 view.innerHTML=`<p class="soon">تقارير الفترة: <b>${esc(period.name)}</b></p>`+dates()+'<div id="out">جارٍ التحميل...</div>';
 const $=id=>view.querySelector("#"+id);
 const [D,rr]=await Promise.all([loadAll(db,period.id),getDocs(collection(db,"reps"))]);
 const RM={};rr.forEach(d=>RM[d.id]=d.data().name);
 const draw=()=>{
  const fr=$("fr").value,to=$("to").value,inR=d=>(!fr||d>=fr)&&(!to||d<=to),p=periodProfit(D,fr,to),row=(l,v,c="")=>`<tr class="${c}"><td>${l}</td><td class="num">${f(v,2)}</td></tr>`;
  const stat=`<div class="panel"><h2>قائمة الأرباح</h2>`+tbl(["البند","المبلغ"],[row("قيمة المبيعات",p.revenue),row("تكلفة المبيعات (سعر الشراء)",-p.cost),row("الربح الإجمالي",p.gross,"tr-total"),
   row("ترحيل ورسوم وتكاليف الشحنات المنتهية",-p.extras),row("عجز جرد على الشركة",-p.shortage),row("زيادة جرد",p.surplus),row("مصروفات إضافية (عامة)",-p.expenses),row("صافي الربح",p.net,"tr-total")])+
   `<p class="soon">تكاليف شحنات لم تنتهِ بعد وتُخصم عند انتهائها: ${f(p.pending,2)}. عجز الجرد المحمّل على مندوب لا يُعد خسارة لأنه مسجّل على حسابه.</p></div>`;
  const st=batchStats(D).sort((x,y)=>String(y.b.date).localeCompare(String(x.b.date)));
  const ship=`<div class="panel"><h2>أرباح الشحنات</h2>`+tbl(["التاريخ","المورد","اللترات","المباع","المتبقي","إيراد المبيعات","تكلفة الشراء","الربح الإجمالي","ترحيل ورسوم","الصافي","الحالة"],
   st.map(x=>{const g=x.revenue-x.cost;return `<tr><td>${esc(x.b.date)}</td><td>${esc(x.b.supplierName)}</td><td class="num">${f(x.b.liters,2)}</td><td class="num">${f(x.sold,2)}</td><td class="num">${f(x.b.remainingLiters,2)}</td><td class="num">${f(x.revenue,2)}</td><td class="num">${f(x.cost,2)}</td><td class="num">${f(g,2)}</td><td class="num">${f(x.extras,2)}</td><td class="num"><b>${x.finished?f(g-x.extras,2):"—"}</b></td><td>${x.finished?'<span class="tag done">منتهية</span>':'<span class="tag">جارية</span>'}</td></tr>`}))+`</div>`;
  const g={};D.sales.filter(s=>inR(s.date)).forEach(s=>{const r=g[s.repId]||(g[s.repId]={name:RM[s.repId]||s.repName,L:0,V:0,P:0});r.L+=n(s.liters);r.V+=n(s.amount);r.P+=n(s.amount)-n(s.costTotal)});
  const col={},bal={};D.ledger.filter(x=>x.repId).forEach(x=>{bal[x.repId]=(bal[x.repId]||0)+n(x.amount);if(x.type==="payment"&&inR(x.date))col[x.repId]=(col[x.repId]||0)-n(x.amount)});
  Object.keys(col).forEach(id=>{if(!g[id])g[id]={name:RM[id]||id,L:0,V:0,P:0}});
  const reps=`<div class="panel"><h2>تقرير المناديب</h2>`+tbl(["المندوب","اللترات المباعة","قيمة المبيعات","الربح الإجمالي","المحصّل","المتبقي عليه من هذه الفترة"],
   Object.entries(g).map(([id,r])=>`<tr><td>${esc(r.name)}</td><td class="num">${f(r.L,2)}</td><td class="num">${f(r.V,2)}</td><td class="num">${f(r.P,2)}</td><td class="num">${f(col[id],2)}</td><td class="num"><b>${f(bal[id],2)}</b></td></tr>`))+`</div>`;
  const pu=D.purchases.filter(x=>inR(x.date)).sort((x,y)=>y.date.localeCompare(x.date)),pt=pu.reduce((t,x)=>t+n(x.liters)*n(x.pricePerLiter),0);
  const pur=`<div class="panel"><h2>تقرير المشتريات</h2>`+tbl(["التاريخ","المورد","اللترات","سعر الشراء","قيمة الشراء","ترحيل","رسوم","أخرى"],
   pu.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.supplierName)}</td><td class="num">${f(x.liters,2)}</td><td class="num">${f(x.pricePerLiter,2)}</td><td class="num">${f(n(x.liters)*n(x.pricePerLiter),2)}</td><td class="num">${f(x.transport,2)}</td><td class="num">${f(x.stateFee,2)}</td><td class="num">${f(x.otherCost,2)}</td></tr>`),
   `<tr class="tr-total"><td colspan="4">إجمالي قيمة الشراء</td><td class="num">${f(pt,2)}</td><td colspan="3"></td></tr>`)+`</div>`;
  $("out").innerHTML=stat+ship+reps+pur;
 };
 view.querySelectorAll("#fr,#to").forEach(i=>i.onchange=draw);draw();
}
