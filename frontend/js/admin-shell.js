(function(){
  "use strict";

  // util: mostra uma view e esconde as outras
  function showView(id){
    document.querySelectorAll(".admin-view").forEach(v => v.style.display = "none");
    const el = document.getElementById(id);
    if (el) el.style.display = "";
    // ativa aba
    document.querySelectorAll(".admin-tabs .tab").forEach(b=>b.classList.remove("active"));
    const btn = document.querySelector(`.admin-tabs .tab[data-target="${id}"]`);
    if (btn) btn.classList.add("active");
  }

  function ensureContainers(){
    // cria contêineres de views se não existirem
    const root = document.body;

    // Painel (vamos tentar achar a tabela existente e mover pra cá)
    let vp = document.getElementById("view-painel");
    if (!vp){ vp = document.createElement("div"); vp.id = "view-painel"; vp.className="admin-view"; root.appendChild(vp); }

    // Chamados (reaproveita alertsBox se existir; senão cria)
    let vc = document.getElementById("view-chamados");
    if (!vc){ vc = document.createElement("div"); vc.id = "view-chamados"; vc.className="admin-view"; vc.style.display="none"; root.appendChild(vc); }
    let alerts = document.getElementById("alertsBox");
    if (!alerts){
      alerts = document.createElement("div");
      alerts.id = "alertsBox";
      vc.appendChild(alerts);
      // se existir inicializador antigo, chama
      if (typeof window.loadAlertsOnce === "function") {
        setTimeout(()=> window.loadAlertsOnce(), 100);
      }
    } else {
      // move o alertsBox existente para dentro da view-chamados
      vc.appendChild(alerts);
    }

    // Editar Cardápio (placeholder — depois a gente liga CRUD)
    let ve = document.getElementById("view-edit");
    if (!ve){ 
      ve = document.createElement("div"); 
      ve.id = "view-edit"; 
      ve.className="admin-view"; 
      ve.style.display="none";
      ve.innerHTML = `
        <div class="card">
          <h3>Editar Cardápio</h3>
          <p>Em breve: formulário para gerenciar categorias e itens (nome, descrição, preço, disponibilidade).</p>
          <p>Por enquanto, use o repositório <code>db/&lt;slug&gt;/menu.json</code>.</p>
        </div>`;
      root.appendChild(ve); 
    }

    // mover a primeira <table> encontrada para o Painel, se ainda não estiver lá
    const firstTable = document.querySelector("table");
    if (firstTable && firstTable.parentElement !== vp){
      vp.appendChild(firstTable);
    }
  }

  function injectTabs(){
    if (document.querySelector(".admin-tabs")) return; // já tem

    const bar = document.createElement("div");
    bar.className = "admin-tabs";
    bar.innerHTML = `
      <button class="tab active" data-target="view-painel">Painel</button>
      <button class="tab" data-target="view-chamados">Chamados</button>
      <button class="tab" data-target="view-edit">Editar Cardápio</button>
    `;
    document.body.insertBefore(bar, document.body.firstChild);

    bar.addEventListener("click", (ev)=>{
      const btn = ev.target.closest(".tab");
      if (!btn) return;
      showView(btn.getAttribute("data-target"));
    });
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    ensureContainers();
    injectTabs();
    showView("view-painel"); // inicia no painel
  });
})();
