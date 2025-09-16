(function hideAdvanceButtonForever(){
  function norm(s){ return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase(); }
  function tick(){
    // pega a última coluna (Ações) e some com "Avançar"
    document.querySelectorAll("table tbody tr td:last-child button").forEach(btn=>{
      const t = norm(btn.textContent || btn.value);
      if (t.startsWith("avancar") || t.includes("avanc")) btn.style.display = "none";
    });
  }
  tick();
  setInterval(tick, 1200);
})();
