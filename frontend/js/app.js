"use strict";

(async function main() {
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
    if (!res.ok) throw new Error(HTTP );
    const data = await res.json();

    console.log("[API] /api/menu →", data);
    statusEl.textContent = "Cardápio carregado (veja o console).";
  } catch (err) {
    console.error("Falha ao carregar /api/menu:", err);
    statusEl.textContent = "Erro ao carregar cardápio. Tente atualizar a página.";
  }
})();