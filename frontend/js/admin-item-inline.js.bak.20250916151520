(function PerItemInlineButtonsV2(){
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

  async function deliver(orderId, itemId, qty){
    const url = withAuth(`/api/orders/${orderId}/items/${itemId}/deliver`);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ qty })
    });
    if (!res.ok) throw new Error("HTTP "+res.status);
    return res.json().catch(()=>null);
  }

  function renderItemsCell(cell, order){
    // monta nossa UL padronizada (independe do HTML original)
    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.padding = "0";
    ul.style.margin = "0";

    (order.items || []).forEach(it => {
      const li = document.createElement("li");
      li.className = "item-row";
      // texto do item
      const left = document.createElement("span");
      left.textContent = `${it.qty}× ${it.name}`;
      // ação à direita
      const right = document.createElement("span");
      right.style.marginLeft = "8px";

      const qty = Number(it.qty || 0);
      const dq  = Number(it.delivered_qty || 0);
      const rem = Math.max(0, qty - dq);

      if (rem > 0) {
        const btn = document.createElement("button");
        btn.className = "btn-mini";
        btn.textContent = "Entregar";
        btn.onclick = async ()=>{
          btn.disabled = true;
          try { await deliver(order.id, it.id, rem); }
          catch(e){ alert("Falha ao entregar item."); }
          finally {
            btn.disabled = false;
            hydrate();   // recarrega lista
          }
        };
        right.appendChild(btn);
      } else {
        const ok = document.createElement("span");
        ok.textContent = "✔ Entregue";
        ok.style.color = "#0a0";
        right.appendChild(ok);
      }

      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });

    // substitui conteúdo da célula pelos nossos itens
    cell.innerHTML = "";
    cell.appendChild(ul);
  }

  function wireRow(row, order){
    const itemsCell = row.querySelector("td:nth-child(3)");
    if (itemsCell) renderItemsCell(itemsCell, order);
  }

  async function hydrate(){
    try{
      const orders = await fetchOrders();
      const rows = document.querySelectorAll("table tbody tr");
      (orders || []).forEach((o, i) => {
        const row = rows[i];
        if (row) wireRow(row, o);
      });
    }catch(e){ console.error("[per-item-inline:v2] erro:", e); }
  }

  // primeira carga + refresh a cada 5s
  hydrate();
  setInterval(hydrate, 5000);
})();
