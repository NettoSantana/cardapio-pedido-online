// admin-spa.js (v2 com topbar e alertas)
(function(){
  "use strict";

  const state = {
    slug: new URLSearchParams(location.search).get("slug") || "bar-do-netto",
    filter: "all",               // all | received | done | cancelled
    pollingMs: 4000,
    timer: null,
    alertsTimer: null,
    alertsCount: 0,
  };

  const qs = s => document.querySelector(s);
  const el = (tag, cls) => { const x = document.createElement(tag); if (cls) x.className = cls; return x; };
  const $root = document.createDocumentFragment();

  function money(n){ try{ return Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }catch{ return "R$ "+Number(n||0).toFixed(2); } }

  /* ----------- TOPBAR ----------- */
  function topbar(){
    const tb = el("div","topbar");
    const w = el("div","wrap");
    const logo = el("div","logo");
    // se você tiver /img/logo.png, descomente:
    // logo.innerHTML = '<img src="img/logo.png" alt="logo" style="width:100%;height:100%;object-fit:cover;">';
    logo.textContent = "N";

    const title = el("div","title"); title.textContent = "Bar do Netto • Painel";
    const spacer = el("div","spacer");
    const badge = el("button","badge"); badge.id = "alertsBadge"; badge.textContent = "Chamados (0)";
    badge.onclick = ()=> {
      const url = `/admin-alerts?slug=${encodeURIComponent(state.slug)}`;
      window.open(url, "_blank");
    };
    w.append(logo,title,spacer,badge);
    tb.appendChild(w);
    return tb;
  }

  /* ----------- HEAD/FILTRAGEM ----------- */
  function head(){
    const bar = el("div","admin-head");
    const filters = el("div","admin-filters");
    [
      ["all","Todos"],["received","Recebidos"],["done","Concluídos"],["cancelled","Cancelados"]
    ].forEach(([val,label])=>{
      const b = el("button"); b.textContent = label;
      if (state.filter===val) b.classList.add("active");
      b.onclick = ()=>{ state.filter = val; render(); fetchOrders(true); };
      filters.appendChild(b);
    });
    const right = el("div","right");
    const btnRefresh = el("button","btn outline"); btnRefresh.textContent = "Atualizar";
    btnRefresh.onclick = ()=> fetchOrders(true);
    right.appendChild(btnRefresh);

    bar.append(filters,right);
    return bar;
  }

  /* ----------- TABELA ----------- */
  function rowOrder(o){
    const tr = el("tr");

    const tdId = el("td","col-id"); tdId.textContent = `#${o.id}`;
    const tdMesa = el("td","col-mesa"); tdMesa.textContent = o.table_code || "-";

    const tdItems = el("td");
    const wrap = el("div","items");
    (o.items||[]).forEach(it=>{
      const r = el("div","item-row");
      const left = el("span","item-text"); left.textContent = `${it.qty}× ${it.name}`;
      const deliveredQty = Number(it.delivered_qty || 0);
      const totalQty = Number(it.qty || 0);
      const needDeliver = deliveredQty < totalQty && (o.status!=="cancelled");
      const right = el("span");
      if (needDeliver){
        const btn = el("button","btn small outline");
        btn.textContent = "Entregar";
        btn.onclick = ()=> deliverItem(o.id, it.id);
        right.appendChild(btn);
      }else{
        right.innerHTML = '<span class="badge-pill">Entregue</span>';
      }
      r.append(left,right);
      wrap.appendChild(r);
    });
    tdItems.appendChild(wrap);

    const tdTot = el("td","col-total"); tdTot.textContent = money(o.total||0);
    const tdSta = el("td","col-status"); tdSta.textContent = (o.status||"").toUpperCase();

    const tdAct = el("td","col-acoes");
    if ((o.status||"")!=="cancelled"){
      const btnCancel = el("button","btn outline"); btnCancel.textContent = "Cancelar";
      btnCancel.onclick = ()=> updateStatus(o.id, "cancelled");
      tdAct.appendChild(btnCancel);
    } else tdAct.textContent = "-";

    tr.append(tdId,tdMesa,tdItems,tdTot,tdSta,tdAct);
    return tr;
  }

  function table(orders){
    const t = el("table","table");
    const thead = el("thead");
    thead.innerHTML = `
      <tr>
        <th class="col-id">ID</th>
        <th class="col-mesa">Mesa</th>
        <th>Itens</th>
        <th class="col-total">Total</th>
        <th class="col-status">Status</th>
        <th class="col-acoes">Ações</th>
      </tr>`;
    const tbody = el("tbody");
    if (!orders.length){
      const tr = el("tr");
      const td = el("td"); td.colSpan = 6; td.className = "empty"; td.textContent = "Nenhum pedido.";
      tr.appendChild(td); tbody.appendChild(tr);
    } else {
      orders.forEach(o=> tbody.appendChild(rowOrder(o)));
    }
    t.append(thead,tbody);
    return t;
  }

  /* ----------- RENDER ----------- */
  function render(orders){
    const app = el("div");
    app.append(topbar(), head());
    if (orders){
      const filtered = orders.filter(o=>{
        if (state.filter==="all") return true;
        return (o.status||"").toLowerCase() === state.filter;
      });
      app.appendChild(table(filtered));
    }
    const host = qs("#app-admin") || document.body;
    host.replaceChildren(app);
  }

  /* ----------- FETCH ----------- */
  async function fetchOrders(forceNow){
    try{
      const url = `/api/orders?slug=${encodeURIComponent(state.slug)}`;
      const res = await fetch(url, { headers: { "Accept":"application/json" } });
      if (!res.ok) throw new Error("HTTP "+res.status);
      const data = await res.json();
      render(data);
    }catch(e){
      console.error("load orders:", e);
    }finally{
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(fetchOrders, state.pollingMs);
    }
  }

  async function fetchAlerts(){
    try{
      const url = `/api/alerts`;
      const res = await fetch(url, { headers: { "Accept":"application/json" } });
      if (!res.ok) throw new Error("HTTP "+res.status);
      const data = await res.json();
      const openAssist = (data.assist_calls||[]).length;
      const openClose  = (data.close_requests||[]).length;
      state.alertsCount = openAssist + openClose;
      const badge = document.getElementById("alertsBadge");
      if (badge) badge.textContent = `Chamados (${state.alertsCount})`;
    }catch(e){
      // silencioso
    }finally{
      if (state.alertsTimer) clearTimeout(state.alertsTimer);
      state.alertsTimer = setTimeout(fetchAlerts, state.pollingMs);
    }
  }

  /* ----------- AÇÕES ----------- */
  async function updateStatus(orderId, status){
    try{
      const url = `/api/orders/${orderId}?slug=${encodeURIComponent(state.slug)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("HTTP "+res.status);
      await fetchOrders(true);
    }catch(e){ console.error("updateStatus:", e); }
  }

  async function deliverItem(orderId, itemId){
    try{
      const url = `/api/orders/${orderId}/items/${itemId}/deliver?slug=${encodeURIComponent(state.slug)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ qty: 0 }) // 0 = entregar restante
      });
      if (!res.ok) throw new Error("HTTP "+res.status);
      await fetchOrders(true);
    }catch(e){ console.error("deliverItem:", e); }
  }

  // boot: casca + dados + alertas
  render();          // esqueleto
  fetchOrders();     // pedidos
  fetchAlerts();     // chamados
})();
