(function AdminAlertsWidget(){
  // procura (ou cria) o container do widget
  let host = document.getElementById("alertsWidget");
  if (!host) {
    host = document.createElement("section");
    host.id = "alertsWidget";
    host.className = "card";
    const main = document.querySelector("main") || document.body;
    main.insertBefore(host, main.firstChild); // topo da página
  }
  host.innerHTML = `
    <div class="card header" style="display:flex;justify-content:space-between;align-items:center;">
      <strong>Chamados em aberto</strong>
      <small id="alertsStamp" style="color:#555"></small>
    </div>
    <div id="alertsBody" style="margin-top:8px;"></div>
  `;

  const stamp = host.querySelector("#alertsStamp");
  const body  = host.querySelector("#alertsBody");

  function withAuth(urlPath){
    const q = new URLSearchParams(location.search);
    const url = new URL(urlPath, location.origin);
    for (const k of ["slug","u","p","dev"]) {
      const v = (q.get(k) || "").trim();
      if (v) url.searchParams.set(k, v);
    }
    return url.toString();
  }

  async function fetchAlerts(){
    try{
      const res = await fetch(withAuth("/api/alerts"), { headers: { "Accept":"application/json" }});
      if (!res.ok) throw new Error("HTTP "+res.status);
      const data = await res.json();
      render(data);
      stamp.textContent = "Atualizado " + new Date().toLocaleTimeString();
    }catch(e){
      console.error("[admin-alerts-widget] falha:", e);
      stamp.textContent = "Falha ao atualizar";
    }
  }

  function line(type, it){
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.display = "flex";
    wrap.style.justifyContent = "space-between";
    wrap.style.alignItems = "center";
    wrap.style.marginTop = "6px";

    const left = document.createElement("div");
    left.innerHTML = `<strong>Mesa:</strong> ${it.table_code||"-"} <span style="color:#555">(${type} • ${new Date(it.requested_at).toLocaleTimeString()})</span>`;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Confirmar";
    btn.onclick = async () => {
      btn.disabled = true;
      try{
        await fetch(withAuth("/api/alerts/ack"), {
          method: "POST",
          headers: { "Content-Type":"application/json", "Accept":"application/json" },
          body: JSON.stringify({ type, id: it.id })
        });
      }finally{
        btn.disabled = false;
        fetchAlerts();
      }
    };

    const right = document.createElement("div");
    right.appendChild(btn);

    wrap.appendChild(left);
    wrap.appendChild(right);
    return wrap;
  }

  function render(data){
    body.innerHTML = "";

    const sec1 = document.createElement("div");
    sec1.innerHTML = `<h3 style="margin:8px 0 4px">Chamadas de garçom</h3>`;
    (data.assist_calls||[]).forEach(it => sec1.appendChild(line("assist", it)));
    if(!(data.assist_calls||[]).length){ const p=document.createElement("div"); p.style.color="#555"; p.textContent="Nenhuma"; sec1.appendChild(p); }
    body.appendChild(sec1);

    const sec2 = document.createElement("div");
    sec2.innerHTML = `<h3 style="margin:12px 0 4px">Solicitações de fechar conta</h3>`;
    (data.close_requests||[]).forEach(it => sec2.appendChild(line("close", it)));
    if(!(data.close_requests||[]).length){ const p=document.createElement("div"); p.style.color="#555"; p.textContent="Nenhuma"; sec2.appendChild(p); }
    body.appendChild(sec2);
  }

  fetchAlerts();
  setInterval(fetchAlerts, 5000);
})();
