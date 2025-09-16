(function InlinePerItemDelivery(){
  function withAuth(path){
    const q = new URLSearchParams(location.search);
    const url = new URL(path, location.origin);
    for (const k of ["slug","u","p","dev"]) {
      const v = (q.get(k) || "").trim();
      if (v) url.searchParams.set(k, v);
    }
    return url.toString();
  }

  async function fetchOrders(){
    const res = await fetch(withAuth("/api/orders"), { headers:{ "Accept":"application/json" }});
    if (!res.ok) throw new Error("HTTP "+res.status);
    return res.json();
  }

  function hostFor(orderId){
    // tenta localizar o contêiner do pedido pelo atributo data-order-id
    const el = document.querySelector(`[data-order-id="${orderId}"]`);
    return el || null;
  }

  function ensureInlineBox(container){
    // cria/recupera um box logo após a lista de itens existente
    // tenta após uma lista típica; se não houver, coloca no final do contêiner
    let anchor = container.querySelector(".items, .order-items, ul, table, .card-body") || container;
    let box = container.querySelector(".per-item-controls");
    if (!box) {
      box = document.createElement("div");
      box.className = "per-item-controls";
      box.style.marginTop = "8px";
      box.style.borderTop = "1px solid #eee";
      box.style.paddingTop = "6px";
      anchor.appendChild(box);
    }
    return box;
  }

  function fmtCurrency(n){ try{ return Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}catch{return "R$ "+(n||0);} }

  async function deliver(orderId, itemId, qty){
    const url = withAuth(`/api/orders/${orderId}/items/${itemId}/deliver`);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ qty: qty })
    });
    if (!res.ok) throw new Error("HTTP "+res.status);
  }

  function renderInline(container, order){
    const box = ensureInlineBox(container);
    // limpa e renderiza
    box.innerHTML = "";

    const s = (order.status||"").toLowerCase();
    // exibimos inline apenas para pedidos recebidos/delivering (para não poluir concluídos)
    if (!(s==="received" || s==="delivering")) return;

    // título discreto
    const title = document.createElement("div");
    title.style.color = "#555";
    title.style.marginBottom = "6px";
    title.textContent = "Entrega por item:";
    box.appendChild(title);

    (order.items||[]).forEach(it=>{
      const qty = Number(it.qty||0);
      const dq  = Number(it.delivered_qty||0);
      const rem = Math.max(0, qty - dq);

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.padding = "4px 0";

      const left = document.createElement("div");
      left.innerHTML = `<strong>${it.name}</strong> — ${dq}/${qty} entregue(s) <span style="color:#777">(${fmtCurrency(it.line_total||0)})</span>`;

      const right = document.createElement("div");
      if (rem > 0){
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = "Entregar";
        btn.onclick = async ()=>{
          btn.disabled = true;
          try { await deliver(order.id, it.id, rem); }
          catch(e){ alert("Falha ao entregar item."); }
          finally { btn.disabled = false; refresh(); }
        };
        right.appendChild(btn);
      } else {
        const ok = document.createElement("span");
        ok.textContent = "Entregue";
        ok.style.color = "#090";
        right.appendChild(ok);
      }

      row.appendChild(left);
      row.appendChild(right);
      box.appendChild(row);
    });
  }

  async function hydrate(){
    try{
      const orders = await fetchOrders();
      // percorre cada pedido e injeta no seu contêiner
      (orders||[]).forEach(o=>{
        const c = hostFor(o.id);
        if (c) renderInline(c, o);
      });
    }catch(e){
      console.error("[inline-per-item] erro:", e);
    }
  }

  function refresh(){ hydrate(); }

  // roda agora e a cada 5s para acompanhar o painel
  hydrate();
  setInterval(refresh, 5000);
})();
