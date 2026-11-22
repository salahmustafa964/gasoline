import {n,f,esc,localToday} from "./util.js?v=16";
import {loadAll,periodProfit} from "./profit.js?v=16";
export async function render(view,{db,period}){
 view.innerHTML='<p class="soon">جارٍ تحميل الأرقام...</p>';
 const D=await loadAll(db,period.id),today=localToday();
 const stock=D.purchases.reduce((a,b)=>a+n(b.remainingLiters),0);
 const td=D.sales.filter(s=>s.date===today),tdv=td.reduce((a,s)=>a+n(s.amount),0),tdl=td.reduce((a,s)=>a+n(s.liters),0);
 const debt=D.ledger.filter(x=>x.accountType==="rep").reduce((a,x)=>a+n(x.amount),0);
 const p=periodProfit(D,"",""),drafts=D.settlements.filter(s=>s.status==="draft").length;
 view.innerHTML=`<p class="soon">الفترة الحالية: <b>${esc(period.name)}</b>${period.startDate?" | بدأت "+esc(period.startDate):""}</p><div class="grid">
  <div class="stat fuel"><b>${f(stock,2)} لتر</b><span>المخزون الحالي في هذه الفترة</span></div>
  <div class="stat"><b>${f(tdv,2)}</b><span>مبيعات اليوم (${f(tdl,2)} لتر)</span></div>
  <div class="stat bad"><b>${f(debt,2)}</b><span>المتبقي على المناديب من هذه الفترة</span></div>
  <div class="stat good"><b>${f(p.net,2)}</b><span>صافي ربح الفترة</span></div></div>
  ${drafts?`<div class="panel"><b>تنبيه:</b> يوجد ${drafts} تسوية بانتظار الاعتماد.</div>`:""}
  <div class="panel soon">صافي الربح = الربح الإجمالي − ترحيل ورسوم الشحنات المنتهية − العجز على الشركة + زيادة الجرد − المصروفات الإضافية. تكاليف شحنات لم تنتهِ بعد (${f(p.pending,2)}) لم تُخصم.</div>`;
}
