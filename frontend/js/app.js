@'
"use strict";

(async function main() {
  // pequeno status na página
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
    statusEl.textContent = "Cardápio carregado (veja o console).";
  } catch (err) {
    console.error("Falha ao carregar /api/menu:", err);
    statusEl.textContent = "Erro ao carregar cardápio. Tente atualizar a página.";
  }
})();
'@ | Set-Content -Encoding UTF8 frontend\js\app.js

git add frontend\js\app.js

@'
fix(frontend): limpa app.js (remove artefatos de colagem) e mantém fetch /api/menu

- substitui conteúdo com IIFE assíncrona estável
- evita '@''/''@' e caracteres estranhos
'@ | Set-Content commitmsg.txt -Encoding UTF8

git commit -F commitmsg.txt
git push origin main
