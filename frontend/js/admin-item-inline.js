(function PerItemInlineButtons(){
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

  function wireRow(row, order){
    // coluna "Itens" (3ª)
    const cell = row.querySelector("td:nth-child(3)");
    if (!cell) return;

    // lista existente
    const ul = cell.querySelector("ul");
    if (!ul) return;

    // marca cada li pra layout lado-a-lado
    const lis = [...ul.querySelectorAll("li")];
    lis.forEach(li => li.classList.add("item-row"));

    // remove botões antigos (se houver)
    ul.querySelectorAll(".btn-mini, .per-item-right, .delivered-flag").forEach(x=>x.remove());

    // pareia por índice: li[i] <-> order.items[i]
    (order.items || []).forEach((it, i) => {
      const li = lis[i];
      if (!li) return;

      const qty = Number(it.qty || 0);
      const dq  = Number(it.delivered_qty || 0);
      const rem = Math.max(0, qty - dq);

      // área à direita
      const right = document.createElement("span");
      right.className = "per-item-right";

      if (rem > 0) {
        const btn = document.createElement("button");
        btn.className = "btn-mini";
        btn.textContent = "Entregar";
        btn.onclick = async ()=>{
          btn.disabled = true;
          try { await deliver(order.id, it.id, rem); }
          catch(e){ alert("Falha ao entregar item."); }
          finally { btn.disabled = false; refresh(); }
        };
        right.appendChild(btn);
      } else {
        const flag = document.createElement("span");
        flag.className = "delivered-flag";
        flag.textContent = "✔";
        flag.style.color = "#0a0";
        right.appendChild(flag);
      }

      // injeta na LI (fica ao lado por causa do display:flex do CSS)
      li.appendChild(right);
    });
  }

  async function hydrate(){
    try{
      const orders = await fetchOrders();
      const rows = document.querySelectorAll("table tbody tr");
      (orders || []).forEach((o, i) => {
        const row = rows[i];
        if (row) wireRow(row, o);
      });
    }catch(e){
      console.error("[per-item-inline] erro:", e);
    }
  }

  function refresh(){ hydrate(); }

  // primeira carga + refresh a cada 5s
  hydrate();
  setInterval(refresh, 5000);
})();
