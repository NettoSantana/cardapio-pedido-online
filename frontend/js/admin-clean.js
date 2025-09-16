(function hideAdvanceButtonForever(){
  function tick(){
    document.querySelectorAll("td.actions button").forEach(btn=>{
      if ((btn.textContent || "").trim().toLowerCase().startsWith("avanç")) {
        btn.style.display = "none";
      }
    });
  }
  tick();
  setInterval(tick, 1000);
})();
