(function KeepOnlyWantedTabs(){
  // tenta achar uma barra de status comum
  const bar = document.querySelector(".status-tabs, nav, .tabs, .filters");
  if (!bar) return;

  const wanted = ["todos","recebidos","concluído","concluido","cancelado"];

  // pega botões/links filhos sem remover o contêiner
  const items = bar.querySelectorAll("button, a, [role=tab], .tab, .chip");
  if (!items.length) return;

  items.forEach(el=>{
    const txt = (el.textContent||"").trim().toLowerCase();
    // normaliza acento para comparar "concluído"/"concluido"
    const norm = txt.normalize("NFD").replace(/\p{Diacritic}/gu,"");
    const keep = wanted.some(w=>{
      const wnorm = w.normalize("NFD").replace(/\p{Diacritic}/gu,"");
      return norm.includes(wnorm);
    });
    if (!keep) el.style.display = "none";
  });
})();
