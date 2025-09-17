(function(){
  if (window.__nettabs) return; window.__nettabs = 1;

  function ensureOverlay(){
    if (document.getElementById("cardapio-overlay")) return;
    var ov = document.createElement("div"); ov.id="cardapio-overlay";
    Object.assign(ov.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,.4)",display:"none",zIndex:"9998"});
    var panel=document.createElement("div"); panel.id="cardapio-panel";
    Object.assign(panel.style,{position:"fixed",top:"64px",left:"50%",transform:"translateX(-50%)",width:"min(980px,95vw)",height:"min(70vh,calc(100vh - 96px))",background:"#fff",borderRadius:"10px",boxShadow:"0 10px 30px rgba(0,0,0,.2)",zIndex:"9999",display:"flex",flexDirection:"column",overflow:"hidden"});
    var head=document.createElement("div"); Object.assign(head.style,{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #eee"});
    var strong=document.createElement("strong"); strong.textContent="Editar Cardápio";
    var btn=document.createElement("button"); btn.textContent="Fechar";
    Object.assign(btn.style,{border:"0",background:"#eee",borderRadius:"8px",padding:"6px 10px",cursor:"pointer"});
    btn.addEventListener("click",function(){ ov.style.display="none"; });
    head.appendChild(strong); head.appendChild(btn);
    var body=document.createElement("div"); Object.assign(body.style,{flex:"1",overflow:"auto",padding:"16px"});
    body.appendChild(document.createTextNode("Placeholder do editor de cardápio."));
    panel.appendChild(head); panel.appendChild(body); ov.appendChild(panel);
    ov.addEventListener("click",function(e){ if(e.target===ov) ov.style.display="none"; });
    document.body.appendChild(ov);
  }

  function hostEl(){
    var badge=document.getElementById("alertsBadge");
    if (badge && badge.parentElement) return badge.parentElement;
    var h1=document.querySelector(".topbar h1, header h1, .header h1, .appbar h1, h1");
    return h1 ? h1.parentElement : null;
  }

  function hasTabs(h){ return !!(h && h.querySelector && h.querySelector(".admin-tabs")); }

  function mount(){
    var host = hostEl();
    if (!host || hasTabs(host)) return false;

    var tabs=document.createElement("span"); tabs.className="admin-tabs"; tabs.setAttribute("data-persistent","1");
    var a1=document.createElement("a"); a1.className="admin-tab active"; a1.href="#"; a1.textContent="Painel";
    var a2=document.createElement("a"); a2.className="admin-tab"; a2.href="#"; a2.textContent="Cardápio";
    tabs.appendChild(a1); tabs.appendChild(a2);

    var badge=document.getElementById("alertsBadge");
    if (badge) host.insertBefore(tabs, badge);
    else {
      var t = host.querySelector("h1,.title");
      t ? t.insertAdjacentElement("afterend", tabs) : host.appendChild(tabs);
    }

    a1.addEventListener("click",function(e){
      e.preventDefault(); a1.classList.add("active"); a2.classList.remove("active");
      var ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none";
    });
    a2.addEventListener("click",function(e){
      e.preventDefault(); a2.classList.add("active"); a1.classList.remove("active");
      try{ openMenuEditor(); }catch(e){ console.error(e); }
    });
    return true;
  }

  // 1) Tenta montar quando o DOM fica pronto
  document.addEventListener("DOMContentLoaded", mount);

  // 2) Tenta por polling leve (caso o topo apareça depois)
  var tries=0, iv=setInterval(function(){
    if (mount()) { clearInterval(iv); }
    if (++tries>40) clearInterval(iv);
  }, 250);

  // 3) Observa mudanças no topo e remonta se as abas sumirem
  var mo = new MutationObserver(function(){
    var h = hostEl();
    if (h && !hasTabs(h)) mount();
  });
  mo.observe(document.documentElement || document.body, {childList:true, subtree:true});
})();
