(function SimplifyStatusTabs(){
  const wanted = [
    {label:"Todos", key:"all"},
    {label:"Recebidos", key:"received"},   // inclui delivering junto
    {label:"Concluído", key:"done"},
    {label:"Cancelado", key:"cancelled"}
  ];

  // esconde quaisquer tabs antigas
  const old = document.querySelectorAll(".status-tabs button, .status-tabs a, nav .tab");
  old.forEach(el => el.style.display = "none");

  // cria barra simples
  let bar = document.getElementById("simpleTabs");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "simpleTabs";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.margin = "8px 0";
    const where = document.querySelector(".container") || document.body;
    where.prepend(bar);
  }
  bar.innerHTML = "";
  wanted.forEach(t=>{
    const b = document.createElement("button");
    b.className = "btn btn-outline";
    b.textContent = t.label;
    b.onclick = ()=> applyFilter(t.key);
    bar.appendChild(b);
  });

  function applyFilter(key){
    // cada linha/pedido deve ter um atributo data-status (se não tiver, mostramos todos)
    const rows = document.querySelectorAll("[data-order-id]");
    rows.forEach(r=>{
      const s = (r.getAttribute("data-status")||"").toLowerCase();
      let show = true;
      if (key === "received") {
        show = (s==="received" || s==="delivering");
      } else if (key === "done") {
        show = (s==="done");
      } else if (key === "cancelled") {
        show = (s==="cancelled");
      } else {
        show = true; // all
      }
      r.style.display = show ? "" : "none";
    });
  }

  // aplica "Recebidos" por padrão
  setTimeout(()=>applyFilter("received"), 300);
})();
