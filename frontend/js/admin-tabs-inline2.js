(function(){
  if(window.__tabs2)return; window.__tabs2=1;

  function makeTabs(){
    var span=document.createElement("span"); span.className="admin-tabs";
    var aPainel=document.createElement("a"); aPainel.className="admin-tab active"; aPainel.href="#"; aPainel.textContent="Painel";
    var aCard=document.createElement("a"); aCard.className="admin-tab"; aCard.href="#"; aCard.textContent="Cardápio";
    span.appendChild(aPainel); span.appendChild(aCard);

    aPainel.addEventListener("click", function(e){
      e.preventDefault(); aPainel.classList.add("active"); aCard.classList.remove("active");
      var ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none";
    });
    aCard.addEventListener("click", function(e){
      e.preventDefault(); aCard.classList.add("active"); aPainel.classList.remove("active");
      ensureOverlay(); document.getElementById("cardapio-overlay").style.display="block";
    });
    return span;
  }

  function ensureOverlay(){
    if(document.getElementById("cardapio-overlay")) return;
    var ov=document.createElement("div"); ov.id="cardapio-overlay";
    Object.assign(ov.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,.4)",display:"none",zIndex:"9998"});
    var panel=document.createElement("div"); panel.id="cardapio-panel";
    Object.assign(panel.style,{position:"fixed",top:"64px",left:"50%",transform:"translateX(-50%)",
      width:"min(980px,95vw)",height:"min(70vh,calc(100vh - 96px))",background:"#fff",borderRadius:"10px",
      boxShadow:"0 10px 30px rgba(0,0,0,.2)",zIndex:"9999",display:"flex",flexDirection:"column",overflow:"hidden"});
    var head=document.createElement("div"); head.id="cardapio-head";
    Object.assign(head.style,{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #eee"});
    var title=document.createElement("strong"); title.textContent="Editar Cardápio";
    var btn=document.createElement("button"); btn.id="cardapio-close"; btn.textContent="Fechar";
    Object.assign(btn.style,{border:"0",background:"#eee",borderRadius:"8px",padding:"6px 10px",cursor:"pointer"});
    btn.addEventListener("click", function(){ ov.style.display="none"; });
    head.appendChild(title); head.appendChild(btn);

    var body=document.createElement("div"); body.id="cardapio-body"; Object.assign(body.style,{flex:"1",overflow:"auto",padding:"16px"});
    body.appendChild(document.createTextNode("Placeholder do editor de cardápio."));

    panel.appendChild(head); panel.appendChild(body); ov.appendChild(panel); document.body.appendChild(ov);
    ov.addEventListener("click", function(e){ if(e.target===ov) ov.style.display="none"; });
  }

  function tryInject(){
    var badge=document.getElementById("alertsBadge");
    var host= badge ? badge.parentElement : null;
    if(!host){
      var h1=document.querySelector(".topbar h1, header h1, .header h1, .appbar h1, h1");
      host = h1 ? h1.parentElement : null;
    }
    if(!host) return false;
    if(host.querySelector(".admin-tabs")) return true;

    var tabs=makeTabs();
    if(badge) host.insertBefore(tabs, badge);
    else {
      var t=host.querySelector("h1,.title"); if(t) t.insertAdjacentElement("afterend", tabs); else host.appendChild(tabs);
    }
    return true;
  }

  function tick(){ if(tryInject()) clearInterval(iv); }
  var iv=setInterval(tick,400);
  document.addEventListener("DOMContentLoaded", tick);
  document.addEventListener("readystatechange", tick);
})();
