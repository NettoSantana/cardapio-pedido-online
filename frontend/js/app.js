"use strict";

function formataPreco(n) {
  try { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  catch { return `R$ ${Number(n).toFixed(2)}`; }
}

// slug atual ( /c/<slug> → <slug> ; senão, default)
function currentSlug() {
  const p = location.pathname.replace(/^\/+|\/+$/g, "");
  if (p.startsWith("c/")) return p.split("/")[1] || "bar-do-netto";
  return "bar-do-netto";
}

// ===== Carrinho (memória no navegador) =====
const cart = [];
function addToCart(item) {
  const idx = cart.findIndex(x => x.id === item.id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  updateCartSummary();
}
function cartTotals() {
  const items = cart.reduce((acc, it) => acc + it.qty, 0);
  const total = cart.reduce((acc, it) => acc + it.price * it.qty, 0);
  return { items, total };
}
function updateCartSummary() {
  const { items, total } = cartTotals();
  const cartCountEl = document.getElementById("cartCount");
  const cartTotalEl = document.getElementById("cartTotal");
  if (cartCountEl) cartCountEl.textContent = `${items} ${items === 1 ? "item" : "itens"}`;
  if (cartTotalEl) cartTotalEl.textContent = formataPreco(total);
}

async function finalizeOrder() {
  const slug = currentSlug();
  const msgEl = document.getElementById("orderMsg");
  const tableCode = (document.getElementById("tableCode")?.value || "").trim();
  const customerName = (document.getElementById("customerName")?.value || "").trim();

  msgEl.className = "order-msg";
  if (!tableCode) { msgEl.classList.add("err"); msgEl.textContent = "Informe a mesa/quarto (ex: M01)."; return; }
  if (cart.length === 0) { msgEl.classList.add("err"); msgEl.textContent = "Seu carrinho está vazio."; return; }

  const payload = {
    table_code: tableCode,
    customer_name: customerName || undefined,
    items: cart.map(it => ({ id: it.id, qty: it.qty }))
  };

  msgEl.textContent = "Enviando pedido...";
  try {
    const res = await fetch(`/api/orders?slug=${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { const txt = await res.text(); throw new Error(`HTTP ${res.status} - ${txt}`); }
    const data = await res.json();
    msgEl.classList.add("ok");
    msgEl.textContent = `Pedido #${data.order_id} recebido! Total: ${formataPreco(data.total)}.`;

    cart.splice(0, cart.length);
    updateCartSummary();
  } catch (err) {
    console.error("Falha ao enviar pedido:", err);
    msgEl.classList.add("err");
    msgEl.textContent = "Erro ao enviar pedido. Tente novamente.";
  }
}

(async function main() {
  let statusEl = document.getElementById("status");
  if (!statusEl) { statusEl = document.createElement("div"); statusEl.id = "status"; statusEl.style.margin = "10px 0"; document.body.prepend(statusEl); }
  statusEl.textContent = "Carregando cardápio...";

  document.getElementById("btnCheckout")?.addEventListener("click", finalizeOrder);

  const slug = currentSlug();
  try {
    const res = await fetch(`/api/menu?slug=${encodeURIComponent(slug)}`, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log("[API] /api/menu →", data);

    const menuEl = document.getElementById("menu");
    menuEl.innerHTML = "";

    (data.categories || []).sort((a,b) => (a.order||0) - (b.order||0)).forEach(cat => {
      const h2 = document.createElement("h2");
      h2.textContent = cat.name || "Categoria";
      h2.className = "cat-title";
      menuEl.appendChild(h2);

      const ul = document.createElement("ul");
      ul.className = "item-list";

      (cat.items || []).forEach(it => {
        const li = document.createElement("li");
        li.className = "item-row";

        const left = document.createElement("div");
        left.className = "item-left";
        const name = document.createElement("div");
        name.className = "item-name";
        name.textContent = it.name || "Item";
        const desc = document.createElement("div");
        desc.className = "item-desc";
        desc.textContent = it.desc || "";
        left.appendChild(name);
        if (desc.textContent) left.appendChild(desc);

        const right = document.createElement("div");
        right.className = "item-right";

        const price = document.createElement("div");
        price.className = "item-price";
        price.textContent = it.available === false ? "Indisponível" : formataPreco(it.price || 0);

        const btn = document.createElement("button");
        btn.className = "btn btn-add";
        btn.type = "button";
        btn.textContent = "Adicionar";
        btn.disabled = it.available === false;
        btn.addEventListener("click", () => addToCart({ id: it.id, name: it.name, price: Number(it.price || 0) }));

        right.appendChild(price);
        right.appendChild(btn);

        if (it.available === false) li.classList.add("item-off");

        li.appendChild(left);
        li.appendChild(right);
        ul.appendChild(li);
      });

      menuEl.appendChild(ul);
    });

    updateCartSummary();
    statusEl.textContent = `Cardápio carregado (${slug}).`;
  } catch (err) {
    console.error("Falha ao carregar /api/menu:", err);
    statusEl.textContent = "Erro ao carregar cardápio. Tente atualizar a página.";
  }
})();
