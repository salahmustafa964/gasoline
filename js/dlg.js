import {esc} from "./util.js?v=19";
export const fe=e=>{const m=(e&&e.message)||String(e);return /permission/i.test(m)?"تعذّر التنفيذ: الفترة مقفلة أو ليست لديك صلاحية.":m};
export function openForm({title,note="",fields,values={},submit="حفظ التعديل",onSubmit}){
 const d=document.createElement("dialog");
 const fld=x=>{const val=values[x.k]??"";
  return `<label>${esc(x.label)}</label>`+(x.type==="select"
   ?`<select name="${x.k}">${x.options.map(o=>`<option value="${esc(o.v)}"${String(o.v)===String(val)?" selected":""}>${esc(o.t)}</option>`).join("")}</select>`
   :`<input name="${x.k}" type="${x.type||"text"}"${x.type==="number"?' step="any"':""}${x.req?" required":""} value="${esc(val)}">`)};
 d.innerHTML=`<form><h3>${esc(title)}</h3>${note?`<p class="soon">${esc(note)}</p>`:""}${fields.map(fld).join("")}<div class="err" role="alert"></div><div class="dlg-actions"><button class="btn" type="submit">${esc(submit)}</button><button class="btn ghost" type="button" data-c>إلغاء</button></div></form>`;
 document.body.appendChild(d);
 const form=d.querySelector("form"),err=d.querySelector(".err");
 d.querySelector("[data-c]").onclick=()=>d.close();
 d.addEventListener("close",()=>d.remove());
 form.onsubmit=async ev=>{ev.preventDefault();err.textContent="";const v={};fields.forEach(x=>{v[x.k]=form.elements[x.k].value});
  try{await onSubmit(v);d.close()}catch(e){err.textContent=fe(e)}};
 d.showModal();
}
