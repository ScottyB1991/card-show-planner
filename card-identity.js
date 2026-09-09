/* THE CARD MAP v27 — Card Map Identity Polish */
(() => {
  "use strict";
  const tidy = s => String(s || "").replace(/\s+/g," ").trim();
  function findEvent(card){
    if(!Array.isArray(window.currentEvents)) return null;
    const html=card.outerHTML||"", text=tidy(card.textContent).toLowerCase();
    for(const e of window.currentEvents){try{const k=String(eventKey(e));if(k&&html.includes(k))return e}catch(_){}}
    return window.currentEvents.find(e=>{const n=tidy(e&&e.name).toLowerCase();return n&&text.includes(n)})||null;
  }
  function fmtDate(v){
    if(!v)return "";
    const d=new Date(`${v}T12:00:00`);
    return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(d);
  }
  function decorate(){
    document.querySelectorAll(".event").forEach(card=>{
      if(card.dataset.tcmIdentity==="1")return;
      const e=findEvent(card); if(!e)return;
      const date=fmtDate(e.date), place=tidy(e.city||e.location||e.postcode||e.venue);
      if(!date&&!place)return;
      const stamp=document.createElement("div"); stamp.className="tcm-card-stamp";
      stamp.innerHTML=`<span aria-hidden="true">📍</span>${date?`<span class="tcm-date">${date}</span>`:""}${date&&place?'<span class="tcm-sep">•</span>':""}${place?`<span>${place}</span>`:""}`;
      card.insertBefore(stamp,card.firstChild);
      if(/top scout pick|scout pick/i.test(card.textContent))card.classList.add("tcm-scout-card");
      card.dataset.tcmIdentity="1";
    });
  }
  let q=false; const queue=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;decorate()})};
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
  addEventListener("load",queue); document.addEventListener("DOMContentLoaded",queue);
})();