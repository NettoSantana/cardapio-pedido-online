// admin-spa.js
(function(){
  "use strict";

  const state = {
    slug: new URLSearchParams(location.search).get("slug") || "bar-do-netto",
    filter: "all",     // all | received | done | cancelled
    pollingMs: 4000,
    timer: null,
  };

  const qs = s => document.querySelector(s);
  const el = (tag, cls) => { const x = document.createElement(tag); if (cls) x.className = cls; return x; };
  const $app = el("div", "admin-wrap");

  function money(n){ try{ return Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }catch{ return "R$ "+Number(n||0).toFixed(2); } }

  function head(){
    const bar = el("div","admin-head");
    const title = el("div"); title.innerHTML = `<strong>Painel</strong> (slug: ${state.slug})`;
    const filters = el("div","admin-filters");
    [
      ["all","Todos"],["received","Recebidos"],["done","Concluídos"],["cancelled","Cancelados"]
    ].forEach(([val,label])=>{
      const b = el("button"); b.textContent = label;
      if (state.filter===val) b.classList.add("active");
      b.onclick = ()=>{ state.filter = val; render(); fetchAndRender(); };
      filters.appendChild(b);
    });
    const right = el("div","right");
    const btnRefresh = el("button","btn outline"); btnRefresh.textContent = "Atualizar";
    btnRefresh.onclick = ()=> fetchAndRender(true);
    right.appendChild(btnRefresh);

    bar.appendChild(title);
    bar.appendChild(filters);
    bar.appendChild(right);
    return bar;
  }

  function rowOrder(o){
    const tr = el("tr");

    const tdId = el("td","col-id"); tdId.textContent = `#${o.id}`;
    const tdMesa = el("td","col-mesa"); tdMesa.textContent = o.table_code || "-";

    // Itens
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
        right.innerHTML = '<span class="badge">Entregue</span>';
      }
      r.appendChild(left); r.appendChild(right);
      wrap.appendChild(r);
    });
    tdItems.appendChild(wrap);

    const tdTot = el("td","col-total"); tdTot.textContent = money(o.total||0);
    const tdSta = el("td","col-status"); tdSta.textContent = (o.status||"").toUpperCase();

    // Ações (apenas Cancelar se não cancelado)
    const tdAct = el("td","col-acoes");
    if ((o.status||"")!=="cancelled"){
      const btnCancel = el("button","btn outline"); btnCancel.textContent = "Cancelar";
      btnCancel.onclick = ()=> updateStatus(o.id, "cancelled");
      tdAct.appendChild(btnCancel);
    } else {
      tdAct.textContent = "-";
    }

    tr.appendChild(tdId);
    tr.appendChild(tdMesa);
    tr.appendChild(tdItems);
    tr.appendChild(tdTot);
    tr.appendChild(tdSta);
    tr.appendChild(tdAct);
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
    t.appendChild(thead); t.appendChild(tbody);
    return t;
  }

  function render(orders){
    $app.innerHTML = "";
    $app.appendChild(head());
    if (!orders){ qs("#app-admin").replaceChildren($app); return; }
    // filtro
    const filtered = orders.filter(o=>{
      if (state.filter==="all") return true;
      return (o.status||"").toLowerCase() === state.filter;
    });
    $app.appendChild(table(filtered));
    qs("#app-admin").replaceChildren($app);
  }

  async function fetchAndRender(forceNow){
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
      state.timer = setTimeout(fetchAndRender, state.pollingMs);
    }
  }

  async function updateStatus(orderId, status){
    try{
      const url = `/api/orders/${orderId}?slug=${encodeURIComponent(state.slug)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("HTTP "+res.status);
      await fetchAndRender(true);
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
      await fetchAndRender(true);
    }catch(e){ console.error("deliverItem:", e); }
  }

  // boot
  render();          // casca
  fetchAndRender();  // dados
})();
