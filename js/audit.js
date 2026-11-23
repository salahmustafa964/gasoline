import {collection,getDocs,query,orderBy,limit,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {esc} from "./util.js?v=20";
const L={date:"التاريخ",liters:"اللترات",repName:"المندوب",amount:"المبلغ",name:"الاسم",supplierName:"المورد",pricePerLiter:"السعر",reason:"السبب",type:"النوع",entity:"الجهة",method:"الطريقة",note:"ملحوظة",accountName:"الحساب",phone:"الهاتف",kind:"النوع",category:"البند",description:"الوصف",transport:"الترحيل",stateFee:"رسوم الولاية",otherCost:"أخرى"};
const sum=a=>{if(!a)return"";const p=Object.entries(a).filter(([k,v])=>L[k]&&v!==""&&typeof v!=="object").map(([k,v])=>`${L[k]}: ${v}`);
 if(Array.isArray(a.lines))p.push(`عدد الحمولات: ${a.lines.length}`);return p.join(" | ")};
export async function render(view,{db,period}){
 view.innerHTML=`<div class="panel"><h2>سجل العمليات</h2><p class="soon">${period?`الفترة: <b>${esc(period.name)}</b>. `:""}السجل للقراءة فقط ولا يمكن تعديله أو حذفه. الأعمال المسجّلة قبل هذا الإصدار تظهر في خيار "كل الفترات".</p>
 <div class="form-grid"><div><label>بحث (مستخدم، عملية، تفاصيل)</label><input id="qs"></div></div>
 ${period?'<label class="chk"><input type="checkbox" id="rall"> عرض سجل كل الفترات</label>':""}
 <div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 let rows=[];
 async function load(){
  const all=!period||$("rall").checked;
  const s=await getDocs(all?query(collection(db,"auditLog"),orderBy("createdAt","desc"),limit(300)):query(collection(db,"auditLog"),where("periodId","==",period.id),limit(500)));
  rows=s.docs.map(d=>{const x=d.data(),t=x.createdAt&&x.createdAt.toDate?x.createdAt.toDate():null;
   return {ts:t?t.getTime():0,t:t?t.toLocaleString("en-GB",{hour12:false}):"",u:x.userName||"",a:x.action||"",c:x.collection||"",d:(x.before?"قبل: "+sum(x.before)+"  ←  بعد: ":"")+sum(x.after)}}).sort((p,q)=>q.ts-p.ts);
  draw();
 }
 const draw=()=>{const q=$("qs").value.trim(),r=rows.filter(x=>!q||(x.u+x.a+x.d).includes(q));
  $("list").innerHTML=r.length?`<table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>`+
  r.map(x=>`<tr><td class="num">${esc(x.t)}</td><td>${esc(x.u)}</td><td>${esc(x.a)}</td><td>${esc(x.d)}</td></tr>`).join("")+"</tbody></table>":'<p class="soon">لا توجد عمليات مسجّلة في هذه الفترة.</p>'};
 $("qs").oninput=draw;if(period)$("rall").onchange=load;
 load().catch(e=>{$("list").textContent="تعذّر التحميل: "+e.message});
}
