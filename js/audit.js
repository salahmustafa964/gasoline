import {collection,getDocs,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {esc} from "./util.js?v=18";
const L={date:"التاريخ",liters:"اللترات",repName:"المندوب",amount:"المبلغ",name:"الاسم",supplierName:"المورد",pricePerLiter:"السعر",reason:"السبب",type:"النوع",entity:"الجهة",method:"الطريقة",note:"ملحوظة",accountName:"الحساب",phone:"الهاتف",kind:"النوع",category:"البند",description:"الوصف",transport:"الترحيل",stateFee:"رسوم الولاية",otherCost:"أخرى"};
const sum=a=>{if(!a)return"";const p=Object.entries(a).filter(([k,v])=>L[k]&&v!==""&&typeof v!=="object").map(([k,v])=>`${L[k]}: ${v}`);
 if(Array.isArray(a.lines))p.push(`عدد الحمولات: ${a.lines.length}`);return p.join(" | ")};
export async function render(view,{db}){
 view.innerHTML=`<div class="panel"><h2>سجل العمليات</h2><p class="soon">آخر 300 عملية. السجل للقراءة فقط ولا يمكن تعديله أو حذفه.</p>
 <div class="form-grid"><div><label>بحث (مستخدم، عملية، تفاصيل)</label><input id="qs"></div></div><div class="tbl-wrap" id="list">جارٍ التحميل...</div></div>`;
 const $=id=>view.querySelector("#"+id);
 const s=await getDocs(query(collection(db,"auditLog"),orderBy("createdAt","desc"),limit(300)));
 const rows=s.docs.map(d=>{const x=d.data(),t=x.createdAt?.toDate?x.createdAt.toDate().toLocaleString("en-GB",{hour12:false}):"";
  return {t,u:x.userName||"",a:x.action||"",c:x.collection||"",d:(x.before?"قبل: "+sum(x.before)+"  ←  بعد: ":"")+sum(x.after)}});
 const draw=()=>{const q=$("qs").value.trim(),r=rows.filter(x=>!q||(x.u+x.a+x.d).includes(q));
  $("list").innerHTML=r.length?`<table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>`+
  r.map(x=>`<tr><td class="num">${esc(x.t)}</td><td>${esc(x.u)}</td><td>${esc(x.a)}</td><td>${esc(x.d)}</td></tr>`).join("")+"</tbody></table>":'<p class="soon">لا توجد نتائج.</p>'};
 $("qs").oninput=draw;draw();
}
