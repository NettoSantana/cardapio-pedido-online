(async function main() {
  const statusEl = document.createElement("div");
  statusEl.id = "status";
  statusEl.style.margin = "10px 0";
  statusEl.textContent = "Carregando cardápio...";
  document.body.prepend(statusEl);

  try {
    const res = await fetch("/api/menu", { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    console.log("[API] /api/menu →", data);

    statusEl.textContent = "Cardápio carregado (veja o console).";
  } catch (err) {
    console.error("Falha ao carregar /api/menu:", err);
    statusEl.textContent = "Erro ao carregar cardápio. Tente atualizar a página.";
  }
})();
