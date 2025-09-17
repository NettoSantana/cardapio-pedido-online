(function(){
  if (window.__nettabs_v2) return; window.__nettabs_v2 = 1;

  var tabs, aPainel, aCardapio;

  function ensureOverlay(){
    var ov = document.getElementById("cardapio-overlay");
    if (ov) return ov;
    ov = document.createElement("div"); ov.id="cardapio-overlay";
    Object.assign(ov.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,.4)",display:"none",zIndex:"9998"});

    var panel=document.createElement("div"); panel.id="cardapio-panel";
    Object.assign(panel.style,{position:"fixed",top:"64px",left:"50%",transform:"translateX(-50%)",
      width:"min(980px,95vw)",height:"min(70vh,calc(100vh - 96px))",background:"#fff",borderRadius:"10px",
      boxShadow:"0 10px 30px rgba(0,0,0,.2)",zIndex:"9999",display:"flex",flexDirection:"column",overflow:"hidden"});

    var head=document.createElement("div");
    Object.assign(head.style,{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"12px 16px",borderBottom:"1px solid #eee"});

    var strong=document.createElement("strong"); strong.textContent="Editar Cardápio";
    var btn=document.createElement("button"); btn.textContent="Fechar";
    Object.assign(btn.style,{border:"0",background:"#eee",borderRadius:"8px",padding:"6px 10px",cursor:"pointer"});
    btn.addEventListener("click", function(){ hideOverlay(); setActive("painel"); });

    var body=document.createElement("div");
    Object.assign(body.style,{flex:"1",overflow:"auto",padding:"16px"});
    body.appendChild(document.createTextNode("Placeholder do editor de cardápio."));

    head.appendChild(strong); head.appendChild(btn);
    panel.appendChild(head); panel.appendChild(body); ov.appendChild(panel);
    ov.addEventListener("click", function(e){ if(e.target===ov){ hideOverlay(); setActive("painel"); }});
    document.body.appendChild(ov);
    return ov;
  }

  function showOverlay(){ ensureOverlay().style.display="block"; }
  function hideOverlay(){ var ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none"; }

  function setActive(which){
    if (!aPainel || !aCardapio) return;
    aPainel.classList.toggle("active", which==="painel");
    aCardapio.classList.toggle("active", which==="cardapio");
  }

  function buildTabs(){
    tabs = document.createElement("span"); tabs.className="admin-tabs";
    aPainel = document.createElement("a"); aPainel.className="admin-tab active"; aPainel.href="#"; aPainel.textContent="Painel";
    aCardapio = document.createElement("a"); aCardapio.className="admin-tab"; aCardapio.href="#"; aCardapio.textContent="Cardápio";
    tabs.appendChild(aPainel); tabs.appendChild(aCardapio);

    aPainel.addEventListener("click", function(e){ e.preventDefault(); setActive("painel"); hideOverlay(); });
    aCardapio.addEventListener("click", function(e){ e.preventDefault(); setActive("cardapio"); showOverlay(); });
    return tabs;
  }

  function findHost(){
    // preferir o container do badge (fica perto do título)
    var badge = document.getElementById("alertsBadge");
    if (badge && badge.parentElement) return badge.parentElement;
    var h1 = document.querySelector(".topbar h1, header h1, .header h1, .appbar h1, h1");
    return h1 ? h1.parentElement : null;
  }

  function mount(){
    var host = findHost();
    if (!host) return false;

    // já tem? então só garante handlers/refs
    var existing = host.querySelector(".admin-tabs");
    if (existing){ tabs = existing; aPainel = tabs.querySelectorAll(".admin-tab")[0]; aCardapio = tabs.querySelectorAll(".admin-tab")[1]; return true; }

    // injeta antes do badge, se existir
    var badge = document.getElementById("alertsBadge");
    var el = buildTabs();
    if (badge) host.insertBefore(el, badge); else {
      var t = host.querySelector("h1,.title"); t ? t.insertAdjacentElement("afterend", el) : host.appendChild(el);
    }
    return true;
  }

  // Autocura: reinjeta se removerem o nó
  function startSelfHeal(){
    var tries = 0, ok = false;
    var iv = setInterval(function(){
      tries++;
      if (!document.querySelector(".admin-tabs")) ok = mount() || ok;
      if (tries > 60) clearInterval(iv); // ~18s
    }, 300);

    // Observa mutações profundas e recoloca se sumir
    var mo = new MutationObserver(function(){
      if (!document.querySelector(".admin-tabs")) mount();
    });
    mo.observe(document.body, {childList:true, subtree:true});
  }

  document.addEventListener("DOMContentLoaded", function(){
    try { mount(); startSelfHeal(); } catch(e){ console.error(e); }
  });
})();
