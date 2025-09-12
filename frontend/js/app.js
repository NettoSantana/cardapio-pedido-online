"use strict";

function formataPreco(n) {
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${Number(n).toFixed(2)}`;
  }
}

(async function main() {
  // status na página
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
    menuEl.innerHTML = ""; // limpa

    (data.categories || []).sort((a,b) => (a.order||0) - (b.order||0)).forEach(cat => {
      // Título da categoria
      const h2 = document.createElement("h2");
      h2.textContent = cat.name || "Categoria";
      h2.className = "cat-title";
      menuEl.appendChild(h2);

      // Lista de itens
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
        right.textContent = formataPreco(it.price || 0);

        if (it.available === false) {
          li.classList.add("item-off");
          right.textContent = "Indisponível";
        }

        li.appendChild(left);
        li.appendChild(right);
        ul.appendChild(li);
      });

      menuEl.appendChild(ul);
    });

    statusEl.textContent = "Cardápio carregado (veja o console).";
  } catch (err) {
    console.error("Falha ao carregar /api/menu:", err);
    statusEl.textContent = "Erro ao carregar cardápio. Tente atualizar a página.";
  }
})();
