(function(){
  "use strict";

  const SLUG = (new URLSearchParams(location.search)).get("slug") || "bar-do-netto";

  function fmtWhen(iso){
    try { return (iso||"").replace("T"," ").replace("Z",""); } catch { return iso||""; }
  }

  function card(html){ const div=document.createElement("div"); div.className="alert-card"; div.innerHTML=html; return div; }

  async function ack(type, id){
    try{
      const res = await fetch(`/api/alerts/ack?slug=${encodeURIComponent(SLUG)}`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ type, id })
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAndRender(); // atualiza lista
    }catch(e){ console.error("ack error", e); alert("Falha ao confirmar: " + e.message); }
  }

  async function fetchAndRender(){
    const box = document.getElementById("alertsBox");
    if (!box) return;
    box.textContent = "Carregando chamados…";
    try{
      const res = await fetch(`/api/alerts?slug=${encodeURIComponent(SLUG)}`, { cache:"no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const a = data.assist_calls||[], c = data.close_requests||[];
      box.innerHTML = "";

      const title = document.createElement("div");
      title.className = "alerts-title";
      title.textContent = `Chamados abertos — Garçom (${a.length}) • Fechar conta (${c.length})`;
      box.appendChild(title);

      const wrap = document.createElement("div");
      wrap.className = "alerts-list";
      box.appendChild(wrap);

      if (!a.length && !c.length){
        wrap.appendChild(card(`<em>Sem chamados no momento.</em>`));
      }

      a.forEach(x=>{
        const el = card(`
          <div class="row">
            <strong>Garçom</strong> • Mesa <b>${x.table_code||"-"}</b> • ${fmtWhen(x.requested_at)}
          </div>
          <div class="row actions">
            <button class="btn btn-outline btn-ack" data-type="assist" data-id="${x.id}">Marcar como visto</button>
          </div>
        `);
        wrap.appendChild(el);
      });

      c.forEach(x=>{
        const el = card(`
          <div class="row">
            <strong>Fechar conta</strong> • Mesa <b>${x.table_code||"-"}</b> • ${fmtWhen(x.requested_at)}
          </div>
          <div class="row actions">
            <button class="btn btn-outline btn-ack" data-type="close" data-id="${x.id}">Marcar como visto</button>
          </div>
        `);
        wrap.appendChild(el);
      });

      wrap.querySelectorAll(".btn-ack").forEach(b=>{
        b.addEventListener("click", ()=> ack(b.getAttribute("data-type"), Number(b.getAttribute("data-id")) ));
      });

    }catch(e){
      console.error(e);
      box.textContent = "Erro ao carregar chamados.";
    }
  }

  // expõe um inicializador para a aba
  let started = false;
  window.loadAlertsOnce = function(){
    if (started) return;
    started = true;
    fetchAndRender();
    // polling leve
    setInterval(fetchAndRender, 5000);
  };
})();
