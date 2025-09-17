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
    btn.addEventListener("click",function(){ ov.style.display="none"; var p=document.querySelector(".admin-tab"); if(p) p.classList.add("active"); });
    head.appendChild(strong); head.appendChild(btn);
    var body=document.createElement("div"); body.id="cardapio-body"; Object.assign(body.style,{flex:"1",overflow:"auto",padding:"16px"});
    body.textContent = "Carregando cardápio…";
    panel.appendChild(head); panel.appendChild(body); ov.appendChild(panel);
    ov.addEventListener("click",function(e){ if(e.target===ov) ov.style.display="none"; });
    document.body.appendChild(ov);
  }

  async function loadMenuInto(body){
    try{
      const u = new URL(location.href);
      const slug = u.searchParams.get("slug") || "bar-do-netto";
      const r = await fetch("/api/menu?slug="+encodeURIComponent(slug), {credentials:"include"});
      if(!r.ok) throw new Error("HTTP "+r.status);
      const data = await r.json();

      // render bem simples (categorias e itens)
      body.innerHTML = "";
      (data.categories||[]).forEach(function(cat){
        var h = document.createElement("h3"); h.textContent = cat.name || ("Categoria "+cat.id);
        h.style.margin = "8px 0";
        body.appendChild(h);
        var ul = document.createElement("ul"); ul.style.marginTop = "0";
        (cat.items||[]).forEach(function(it){
          var li = document.createElement("li");
          li.textContent = (it.name||"Item")+" — R$ "+(Number(it.price||0).toFixed(2)).replace(".",",");
          ul.appendChild(li);
        });
        body.appendChild(ul);
      });

      if(!(data.categories||[]).length){
        body.innerHTML = "<em>Sem categorias no menu.json.</em>";
      }
    }catch(e){
      body.innerHTML = "<strong>Erro ao carregar cardápio.</strong> "+e.message;
    }
  }

  function mount(){
    var host=null, badge=document.getElementById("alertsBadge");
    if (badge) host = badge.parentElement;
    if (!host){
      var h1=document.querySelector(".topbar h1, header h1, .header h1, .appbar h1, h1");
      host = h1 ? h1.parentElement : null;
    }
    if (!host || host.querySelector(".admin-tabs")) return false;

    // cria abas estilo "pílula" (CSS já feito antes)
    var tabs=document.createElement("span"); tabs.className="admin-tabs";
    var a1=document.createElement("a"); a1.className="admin-tab active"; a1.href="#"; a1.textContent="Painel";
    var a2=document.createElement("a"); a2.className="admin-tab"; a2.href="#"; a2.textContent="Cardápio";
    tabs.appendChild(a1); tabs.appendChild(a2);

    if (badge) host.insertBefore(tabs, badge);
    else {
      var t = host.querySelector("h1,.title");
      t ? t.insertAdjacentElement("afterend", tabs) : host.appendChild(tabs);
    }

    a1.addEventListener("click",function(e){
      e.preventDefault(); a1.classList.add("active"); a2.classList.remove("active");
      var ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none";
    });

    a2.addEventListener("click",async function(e){
      e.preventDefault(); a2.classList.add("active"); a1.classList.remove("active");
      ensureOverlay();
      var ov=document.getElementById("cardapio-overlay");
      var body=document.getElementById("cardapio-body");
      if(body) body.textContent = "Carregando cardápio…";
      ov.style.display="block";
      if(body) await loadMenuInto(body);
    });

    return true;
  }

  var ok=false, tries=0, iv=setInterval(function(){
    tries++; ok = mount() || ok;
    if (ok || tries>30) clearInterval(iv);
  }, 300);
  document.addEventListener("DOMContentLoaded", mount);
})();
