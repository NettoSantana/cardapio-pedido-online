(function(){
  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function getSlug(){
    var m = location.search.match(/[?&]slug=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "bar-do-netto";
  }
  async function fetchOrderByIdLite(id){
    try{
      var r = await fetch("/api/orders?slug="+encodeURIComponent(getSlug()), {headers:{Accept:"application/json"}});
      if(!r.ok) throw new Error("HTTP "+r.status);
      var arr = await r.json();
      id = Number(id);
      for(var i=0;i<arr.length;i++){ if(Number(arr[i].id)===id) return arr[i]; }
    }catch(e){ console.warn("fetchOrderByIdLite", e); }
    return null;
  }
  function printOrderLite(order){
    if(!order){ alert("Pedido não encontrado."); return; }
    var rows = (order.items||[]).map(function(it){
      var lt = Number(it.line_total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
      var nm = (it.name||""); var q = it.qty||1;
      return "<tr><td>"+q+"x</td><td>"+nm+"</td><td style=\\"text-align:right\\">"+lt+"</td></tr>";
    }).join("");
    var total = Number(order.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    var when = new Date(order.created_at||Date.now()).toLocaleString("pt-BR");
    var w = window.open("","_blank","width=420,height=600");
    var html = ""
      + "<html><head><meta charset=\\"utf-8\\"><title>Pedido #"+order.id+"</title>"
      + "<style>body{font-family:Arial,sans-serif;padding:12px}h2{margin:0 0 8px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #eee}.right{text-align:right}.tot{font-weight:700}.muted{color:#666}</style></head><body>"
      + "<h2>Pedido #"+order.id+" — Mesa "+(order.table_code||"-")+"</h2>"
      + "<div class=\\"muted\\">"+when+" • Status: "+(order.status||"-")+"</div>"
      + "<table><thead><tr><th>Qtde</th><th>Item</th><th class=\\"right\\">Total</th></tr></thead><tbody>"+rows+"</tbody>"
      + "<tfoot><tr><td colspan=\\"2\\" class=\\"tot right\\">TOTAL</td><td class=\\"tot right\\">"+total+"</td></tr></tfoot></table>"
      + "<script>window.print();<\/script></body></html>";
    w.document.write(html); w.document.close();
  }
  function enhanceRow(tr){
    if(!tr || tr.getAttribute("data-print-bound")) return;
    var tds = tr.querySelectorAll("td"); if(!tds || tds.length < 6) return;
    var idText = (tds[0].textContent||"").trim();
    var m = idText.match(/\d+/); if(!m) return; var id = Number(m[0]);
    var actionsTd = tds[5]; if(!actionsTd) return;
    var btn = document.createElement("button");
    btn.className = "btn btn-outline btn-sm";
    btn.type = "button";
    btn.textContent = "Imprimir";
    btn.style.marginLeft = "6px";
    btn.addEventListener("click", async function(){
      var ord = await fetchOrderByIdLite(id);
      printOrderLite(ord);
    });
    actionsTd.appendChild(btn);
    tr.setAttribute("data-print-bound","1");
  }
  function enhanceAll(){
    var tbody = q("#ordersTbody"); if(!tbody) return;
    qa("tr", tbody).forEach(enhanceRow);
  }
  function installObserver(){
    var tbody = q("#ordersTbody"); if(!tbody) return;
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){ qa("tr", m.target).forEach(enhanceRow); });
    });
    mo.observe(tbody, {childList:true, subtree:true});
  }
  window.addEventListener("load", function(){
    try{ enhanceAll(); installObserver(); }catch(e){ console.warn(e); }
  });
})();
