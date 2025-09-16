(function(){
  "use strict";

  const IDS = { painel:"sec-painel", chamados:"sec-chamados", menu:"sec-menu" };

  function ensureNav(){
    if (document.getElementById("admin-tabs")) return;
    const nav = document.createElement("nav");
    nav.id = "admin-tabs";
    nav.className = "tabs";
    nav.innerHTML = `
      <a href="#painel"   data-tab="painel">Painel</a>
      <a href="#chamados" data-tab="chamados">Chamados</a>
      <a href="#menu"     data-tab="menu">Editar Cardápio</a>
    `;
    document.body.prepend(nav);
    nav.addEventListener("click", (e)=>{
      const a = e.target.closest("a[data-tab]");
      if (!a) return;
      e.preventDefault();
      const tab = a.getAttribute("data-tab");
      location.hash = tab;
      renderTab(tab);
    });
  }

  function ensureSections(){
    // 1) Painel: embala TODO conteúdo existente (exceto nosso nav e seções) em #sec-painel
    if (!document.getElementById(IDS.painel)){
      const wrap = document.createElement("div");
      wrap.id = IDS.painel;
      const nav = document.getElementById("admin-tabs");
      const sections = new Set([nav]);
      Array.from(document.querySelectorAll("#"+IDS.chamados+", #"+IDS.menu)).forEach(s=>sections.add(s));

      // move tudo que não é nav/sections para o painel
      const toMove = Array.from(document.body.children).filter(el => !sections.has(el));
      document.body.appendChild(wrap);
      toMove.forEach(el => wrap.appendChild(el));
    }

    // 2) Chamados (placeholder)
    if (!document.getElementById(IDS.chamados)){
      const sec = document.createElement("section");
      sec.id = IDS.chamados;
      sec.style.display = "none";
      sec.innerHTML = `
        <h2>Chamados</h2>
        <div id="alertsBox">Carregando chamados…</div>
      `;
      document.body.appendChild(sec);
    }

    // 3) Editar Cardápio (placeholder)
    if (!document.getElementById(IDS.menu)){
      const sec = document.createElement("section");
      sec.id = IDS.menu;
      sec.style.display = "none";
      sec.innerHTML = `
        <h2>Editar Cardápio</h2>
        <p>MVP: aqui vai o editor de categorias e itens.</p>
      `;
      document.body.appendChild(sec);
    }
  }

  function setActive(tab){
    const nav = document.getElementById("admin-tabs");
    if (!nav) return;
    nav.querySelectorAll("a[data-tab]").forEach(a=>{
      a.classList.toggle("active", a.getAttribute("data-tab") === tab);
    });
  }

  function show(id){ const el = document.getElementById(id); if (el) el.style.display=""; }
  function hide(id){ const el = document.getElementById(id); if (el) el.style.display="none"; }

  function renderTab(tab){
    const t = (tab||"painel").toLowerCase();
    hide(IDS.painel); hide(IDS.chamados); hide(IDS.menu);
    if (t==="chamados")      show(IDS.chamados);
    else if (t==="menu")     show(IDS.menu);
    else                     show(IDS.painel);
    setActive(t);

    // hook: quando entrar em "chamados", se existir função de carregar, chama
    if (t==="chamados" && typeof window.loadAlertsOnce === "function"){
      window.loadAlertsOnce();
    }
  }

  function currentTabFromHash(){
    const h = (location.hash||"").replace("#","").trim();
    if (h==="chamados" || h==="menu" || h==="painel") return h;
    return "painel";
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    ensureNav();
    ensureSections();
    renderTab(currentTabFromHash());
  });

  window.addEventListener("hashchange", ()=>renderTab(currentTabFromHash()));
})();
