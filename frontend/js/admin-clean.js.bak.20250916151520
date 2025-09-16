/* admin-clean.js: patch mínimo e idempotente */
(function(){
  if (window.__ADMIN_CLEAN__) return; window.__ADMIN_CLEAN__=true;

  function tick(){
    const table = document.querySelector("table");
    if (!table) return;

    // marca colunas para CSS
    table.classList.add("table-admin");
    document.querySelectorAll("tbody tr").forEach(tr=>{
      const tds = tr.querySelectorAll("td");
      if (tds.length < 6) return;
      tds[0].classList.add("admin-col-id");
      tds[1].classList.add("admin-col-mesa");
      tds[2].classList.add("admin-col-itens");
      tds[3].classList.add("admin-col-total");
      tds[4].classList.add("admin-col-status");
      tds[5].classList.add("admin-col-acoes");

      // 1) esconde "Avançar"
      tds[5].querySelectorAll("button,a").forEach(b=>{
        const t=(b.textContent||"").trim().toLowerCase();
        if (t==="avançar"||t==="avancar") b.style.display="none";
      });

      // 2) remove preços dentro da célula de Itens (mantém só nomes/quantidades)
      //   - Padrão BR: R$ 1.234,56  ou  R$ 12,00
      const rePreco = /R\$\s?\d{1,3}(\.\d{3})*,\d{2}/g;
      const before = tds[2].innerHTML;
      const cleaned = before.replace(rePreco, "").replace(/\s{2,}/g," ");
      if (cleaned!==before) tds[2].innerHTML = cleaned;
    });
  }

  document.addEventListener("DOMContentLoaded", tick);
  setInterval(tick, 800); // acompanha atualizações da página
})();
