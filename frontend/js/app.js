"use strict";

function formataPreco(n) {
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${Number(n).toFixed(2)}`;
  }
}

// ===== Carrinho (memória no navegador) =====
const cart = []; // [{id, name, price, qty}]
function addToCart(item) {
  const idx = cart.findIndex(x => x.id === item.id);
  if (idx >= 0) {
    cart[idx].qty += 1;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  }
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

// ===== App =====
(async function main() {
  // status
  let statusEl = document.getElementById("status");
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "status";
    statusEl.style.margin = "10px 0";
    document.body.prepend(statusEl);
  }
  statusEl.textContent = "Carregando cardápio...";

  try {
    const res = await fetch("/api/menu", { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log("[API] /api/menu →", data);

    // render
    const menuEl = document.getElementById("menu");
    menuEl.innerHTML = "";

    (data.categories || [])
      .sort((a,b) => (a.order||0) - (b.order||0))
      .forEach(cat => {
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
          btn.addEventListener("click", () => {
            addToCart({ id: it.id, name: it.name, price: Number(it.price || 0) });
          });

          right.appendChild(price);
          right.appendChild(btn);

          if (it.available === false) {
            li.classList.add("item-off");
          }

          li.appendChild(left);
          li.appendChild(right);
          ul.appendChild(li);
        });

        menuEl.appendChild(ul);
      });

    updateCartSummary();
    statusEl.textContent = "Cardápio carregado.";
  } catch (err) {
    console.error("Falha ao carregar /api/menu:", err);
    statusEl.textContent = "Erro ao carregar cardápio. Tente atualizar a página.";
  }
})();
