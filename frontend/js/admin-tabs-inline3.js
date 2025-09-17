(function(){
  if (window.__nettabs_v3) return; window.__nettabs_v3 = 1;

  var tabs, aPainel, aCardapio, bodyEl;

  function ensureOverlay(){
    var ov = document.getElementById("cardapio-overlay");
    if (ov){
      bodyEl = ov.querySelector("#cardapio-body");
      return ov;
    }
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

    bodyEl=document.createElement("div"); bodyEl.id="cardapio-body";
    Object.assign(bodyEl.style,{flex:"1",overflow:"auto",padding:"16px"});

    head.appendChild(strong); head.appendChild(btn);
    panel.appendChild(head); panel.appendChild(bodyEl); ov.appendChild(panel);
    ov.addEventListener("click", function(e){ if(e.target===ov){ hideOverlay(); setActive("painel"); }});
    document.body.appendChild(ov);
    return ov;
  }

  function showOverlay(){ ensureOverlay().style.display="block"; loadMenuIntoBody(); }
  function hideOverlay(){ var ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none"; }

  function setActive(which){
    if (!aPainel || !aCardapio) return;
    aPainel.classList.toggle("active", which==="painel");
    aCardapio.classList.toggle("active", which==="cardapio");
  }

  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

  function renderMenu(data){
    bodyEl.innerHTML = ""; // limpa placeholder
    if(!data || !Array.isArray(data.categories) || data.categories.length===0){
      bodyEl.appendChild(el("p", null, "Nenhuma categoria cadastrada ainda."));
      return;
    }
    data.categories.sort(function(a,b){ return (a.order||0)-(b.order||0); });
    data.categories.forEach(function(cat){
      var cWrap = el("div", null, null);
      cWrap.style.marginBottom = "18px";
      var h = el("h3", null, cat.name || ("Categoria "+cat.id));
      h.style.margin = "0 0 8px 0";
      cWrap.appendChild(h);

      var ul = el("ul", null, null);
      ul.style.margin = "0 0 0 18px";
      (cat.items||[]).forEach(function(it){
        var li = el("li", null, null);
        var line = (it.name||"Item")+" — R$ "+Number(it.price||0).toFixed(2);
        if (it.desc) line += " • "+it.desc;
        li.textContent = line;
        ul.appendChild(li);
      });
      if (!ul.children.length){
        var li = el("li", null, "Sem itens");
        ul.appendChild(li);
      }
      cWrap.appendChild(ul);
      bodyEl.appendChild(cWrap);
    });
  }

  async function loadMenuIntoBody(){
    try{
      bodyEl.textContent = "Carregando cardápio…";
      var slug = (new URLSearchParams(location.search).get("slug")) || "bar-do-netto";
      var res = await fetch("/api/menu?slug="+encodeURIComponent(slug), {credentials:"include"});
      if(!res.ok) throw new Error("HTTP "+res.status);
      var json = await res.json();
      renderMenu(json);
    }catch(e){
      bodyEl.textContent = "Falha ao carregar cardápio.";
      console.error(e);
    }
  }

  function buildTabs(){
    var wrap = document.createElement("span"); wrap.className="admin-tabs";
    aPainel = document.createElement("a"); aPainel.className="admin-tab active"; aPainel.href="#"; aPainel.textContent="Painel";
    aCardapio = document.createElement("a"); aCardapio.className="admin-tab"; aCardapio.href="#"; aCardapio.textContent="Cardápio";
    wrap.appendChild(aPainel); wrap.appendChild(aCardapio);

    aPainel.addEventListener("click", function(e){ e.preventDefault(); setActive("painel"); hideOverlay(); });
    aCardapio.addEventListener("click", function(e){ e.preventDefault(); setActive("cardapio"); showOverlay(); });
    return wrap;
  }

  function findHost(){
    var badge = document.getElementById("alertsBadge");
    if (badge && badge.parentElement) return badge.parentElement;
    var h1 = document.querySelector(".topbar h1, header h1, .header h1, .appbar h1, h1");
    return h1 ? h1.parentElement : null;
  }

  function mount(){
    var host = findHost();
    if (!host) return false;
    if (host.querySelector(".admin-tabs")) return true;
    tabs = buildTabs();
    var badge = document.getElementById("alertsBadge");
    if (badge) host.insertBefore(tabs, badge); else {
      var t = host.querySelector("h1,.title"); t ? t.insertAdjacentElement("afterend", tabs) : host.appendChild(tabs);
    }
    return true;
  }

  function startSelfHeal(){
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if (!document.querySelector(".admin-tabs")) mount();
      if (tries > 60) clearInterval(iv);
    }, 300);
    var mo = new MutationObserver(function(){ if (!document.querySelector(".admin-tabs")) mount(); });
    mo.observe(document.body, {childList:true, subtree:true});
  }

  document.addEventListener("DOMContentLoaded", function(){
    try { mount(); startSelfHeal(); } catch(e){ console.error(e); }
  });
})();
