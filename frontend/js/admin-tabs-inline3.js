(function(){
  if (window.__nettabs_v4) return; window.__nettabs_v4 = 1;

  var tabs, aPainel, aCardapio, bodyEl, currentMenu=null, slug=null;

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
    Object.assign(head.style,{display:"flex",gap:"8px",alignItems:"center",
      padding:"12px 16px",borderBottom:"1px solid #eee"});

    var title=document.createElement("strong"); title.textContent="Editar Cardápio";
    var btnAddCat=button("Adicionar categoria", onAddCategory);
    var btnAddItem=button("Adicionar item", onAddItem);
    var btnSave=button("Salvar", onSave); btnSave.style.background="#0a58ca"; btnSave.style.color="#fff";
    var btnClose=button("Fechar", function(){ hideOverlay(); setActive("painel"); });

    bodyEl=document.createElement("div"); bodyEl.id="cardapio-body";
    Object.assign(bodyEl.style,{flex:"1",overflow:"auto",padding:"0"});

    head.appendChild(title);
    head.appendChild(btnAddCat);
    head.appendChild(btnAddItem);
    head.appendChild(btnSave);
    head.appendChild(btnClose);
    panel.appendChild(head); panel.appendChild(bodyEl); ov.appendChild(panel);
    ov.addEventListener("click", function(e){ if(e.target===ov){ hideOverlay(); setActive("painel"); }});
    document.body.appendChild(ov);
    return ov;
  }

  function button(label, handler){
    var b=document.createElement("button");
    b.textContent=label;
    Object.assign(b.style,{border:"0",background:"#eee",borderRadius:"8px",padding:"6px 10px",cursor:"pointer"});
    b.addEventListener("click", handler);
    b.addEventListener("mouseenter", function(){ b.style.background="#e0e0e0"; });
    b.addEventListener("mouseleave", function(){ b.style.background="#eee"; });
    return b;
  }

  function showOverlay(){ ensureOverlay().style.display="block"; loadMenuIntoEditor(); }
  function hideOverlay(){ var ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none"; }

  function setActive(which){
    if (!aPainel || !aCardapio) return;
    aPainel.classList.toggle("active", which==="painel");
    aCardapio.classList.toggle("active", which==="cardapio");
  }

  function editorEl(){
    var ed = document.getElementById("menu-editor");
    if (ed) return ed;
    ed = document.createElement("textarea");
    ed.id = "menu-editor";
    ed.style.width="100%"; ed.style.height="100%"; ed.style.border="0"; ed.style.outline="none";
    ed.style.fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ed.style.fontSize="13px"; ed.style.lineHeight="1.4"; ed.style.padding="16px";
    bodyEl.innerHTML=""; bodyEl.appendChild(ed);
    return ed;
  }

  function pretty(obj){ try{ return JSON.stringify(obj, null, 2); }catch(e){ return ""; } }

  async function loadMenuIntoEditor(){
    try{
      slug = (new URLSearchParams(location.search).get("slug")) || "bar-do-netto";
      var ed = editorEl();
      ed.value = "Carregando cardápio…";
      var res = await fetch("/api/menu?slug="+encodeURIComponent(slug), {credentials:"include"});
      if(!res.ok) throw new Error("HTTP "+res.status);
      currentMenu = await res.json();
      ed.value = pretty(currentMenu);
    }catch(e){
      editorEl().value = "Falha ao carregar cardápio: "+e;
      console.error(e);
    }
  }

  function safeParse(){
    var ed = editorEl();
    try{
      var obj = JSON.parse(ed.value);
      if (!obj || typeof obj!=="object") throw new Error("JSON inválido");
      return obj;
    }catch(e){
      alert("JSON inválido. Erro: "+e.message);
      throw e;
    }
  }

  function onAddCategory(){
    try{
      var obj = safeParse();
      obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
      var maxId = obj.categories.reduce((m,c)=>Math.max(m, parseInt(c.id||0)||0), 0);
      var nextId = maxId+1;
      obj.categories.push({ id: nextId, name: "Nova Categoria", order: nextId, active: true, items: [] });
      editorEl().value = pretty(obj);
    }catch(_){}
  }

  function onAddItem(){
    try{
      var obj = safeParse();
      obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
      if (!obj.categories.length){ alert("Crie uma categoria primeiro."); return; }
      var cat = obj.categories[0]; // simples: primeira categoria
      cat.items = Array.isArray(cat.items) ? cat.items : [];
      var maxItem = 0;
      obj.categories.forEach(function(c){
        (c.items||[]).forEach(function(it){ maxItem = Math.max(maxItem, parseInt(it.id||0)||0); });
      });
      var nextItem = maxItem+1;
      cat.items.push({ id: nextItem, name: "Novo Item", desc: "", price: 0.0, photo_url: null, available: true });
      editorEl().value = pretty(obj);
    }catch(_){}
  }

  async function onSave(){
    try{
      var obj = safeParse();
      // validação mínima
      if (!Array.isArray(obj.categories)) { alert("'categories' precisa ser uma lista."); return; }
      var res = await fetch("/api/menu/save?slug="+encodeURIComponent(slug), {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        credentials:"include",
        body: JSON.stringify(obj)
      });
      var j = await res.json().catch(()=>({}));
      if (res.ok && j.ok){
        currentMenu = obj;
        alert("Cardápio salvo com sucesso!");
      }else{
        alert("Falha ao salvar: "+(j.error||("HTTP "+res.status)));
      }
    }catch(e){
      console.error(e);
    }
  }

  // --- Abas na appbar ---
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
(function(){
  if (window.__rmBtns) return; window.__rmBtns = 1;

  function mountRemoveButtons(){
    var head = document.getElementById("cardapio-head");
    if (!head) return;

    if (!head.querySelector("#btn-remove-cat")){
      var btnRC = document.createElement("button");
      btnRC.id="btn-remove-cat"; btnRC.textContent="Remover categoria";
      btnRC.style.marginRight="8px";
      btnRC.addEventListener("click", onRemoveCategory);
      head.insertBefore(btnRC, head.querySelector("#btn-save") || head.lastChild);
    }
    if (!head.querySelector("#btn-remove-item")){
      var btnRI = document.createElement("button");
      btnRI.id="btn-remove-item"; btnRI.textContent="Remover item";
      btnRI.style.marginRight="8px";
      btnRI.addEventListener("click", onRemoveItem);
      head.insertBefore(btnRI, head.querySelector("#btn-save") || head.lastChild);
    }
  }

  // tenta sempre que o DOM mudar/abas clicadas
  setInterval(mountRemoveButtons, 500);
  document.addEventListener("click", function(e){
    if (e.target && e.target.classList && e.target.classList.contains("admin-tab")){
      setTimeout(mountRemoveButtons, 300);
    }
  });
})();
if (typeof window.editorEl !== "function") { window.editorEl = function(){ return document.getElementById("cardapio-editor"); }; }
if (typeof window.pretty   !== "function") { window.pretty   = function(o){ return JSON.stringify(o,null,2); }; }

if (typeof window.onRemoveCategory !== "function") {
  window.onRemoveCategory = function(){
    try{
      var obj = (typeof safeParse==="function") ? safeParse() : JSON.parse(editorEl().value||"{}");
      obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
      if (!obj.categories.length){ alert("Não há categorias para remover."); return; }

      var list = obj.categories.map(function(c){return c.id+" - "+c.name}).join("\n");
      var pick = prompt("Remover QUAL categoria?\n"+list);
      if (!pick) return;

      var idx = obj.categories.findIndex(function(c){return String(c.id)===String(pick)});
      if (idx<0){ alert("Categoria não encontrada."); return; }

      if (!confirm('Tem certeza que deseja remover a categoria "'+obj.categories[idx].name+'" e TODOS os itens dela?')) return;
      obj.categories.splice(idx,1);
      editorEl().value = (typeof pretty==="function") ? pretty(obj) : JSON.stringify(obj,null,2);
    }catch(e){ console.error(e); }
  };
}

if (typeof window.onRemoveItem !== "function") {
  window.onRemoveItem = function(){
    try{
      var obj = (typeof safeParse==="function") ? safeParse() : JSON.parse(editorEl().value||"{}");
      obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
      if (!obj.categories.length){ alert("Crie uma categoria primeiro."); return; }

      var list = obj.categories.map(function(c){return c.id+" - "+c.name}).join("\n");
      var pick = prompt("De QUAL categoria remover item?\n"+list, obj.categories[0].id);
      if (!pick) return;

      var cat = obj.categories.find(function(c){return String(c.id)===String(pick)});
      if (!cat){ alert("Categoria não encontrada."); return; }

      cat.items = Array.isArray(cat.items) ? cat.items : [];
      if (!cat.items.length){ alert("Essa categoria não tem itens."); return; }

      var listItems = cat.items.map(function(it){return it.id+" - "+it.name}).join("\n");
      var pickItem = prompt('REMOVER qual item de "'+cat.name+'"?\n'+listItems, cat.items[0].id);
      if (!pickItem) return;

      var idx = cat.items.findIndex(function(it){return String(it.id)===String(pickItem)});
      if (idx<0){ alert("Item não encontrado."); return; }

      if (!confirm('Tem certeza que deseja remover o item "'+cat.items[idx].name+'"?')) return;
      cat.items.splice(idx,1);
      editorEl().value = (typeof pretty==="function") ? pretty(obj) : JSON.stringify(obj,null,2);
    }catch(e){ console.error(e); }
  };
}
if (typeof window.editorEl !== "function") { window.editorEl = function(){ return document.getElementById("cardapio-editor"); }; }
if (typeof window.pretty   !== "function") { window.pretty   = function(o){ return JSON.stringify(o,null,2); }; }

if (typeof window.onRemoveCategory !== "function") {
  window.onRemoveCategory = function(){
    try{
      var obj = (typeof safeParse==="function") ? safeParse() : JSON.parse(editorEl().value||"{}");
      obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
      if (!obj.categories.length){ alert("Não há categorias para remover."); return; }

      var list = obj.categories.map(function(c){return c.id+" - "+c.name}).join("\n");
      var pick = prompt("Remover QUAL categoria?\n"+list);
      if (!pick) return;

      var idx = obj.categories.findIndex(function(c){return String(c.id)===String(pick)});
      if (idx<0){ alert("Categoria não encontrada."); return; }

      if (!confirm('Tem certeza que deseja remover a categoria "'+obj.categories[idx].name+'" e TODOS os itens dela?')) return;
      obj.categories.splice(idx,1);
      editorEl().value = (typeof pretty==="function") ? pretty(obj) : JSON.stringify(obj,null,2);
    }catch(e){ console.error(e); }
  };
}

if (typeof window.onRemoveItem !== "function") {
  window.onRemoveItem = function(){
    try{
      var obj = (typeof safeParse==="function") ? safeParse() : JSON.parse(editorEl().value||"{}");
      obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
      if (!obj.categories.length){ alert("Crie uma categoria primeiro."); return; }

      var list = obj.categories.map(function(c){return c.id+" - "+c.name}).join("\n");
      var pick = prompt("De QUAL categoria remover item?\n"+list, obj.categories[0].id);
      if (!pick) return;

      var cat = obj.categories.find(function(c){return String(c.id)===String(pick)});
      if (!cat){ alert("Categoria não encontrada."); return; }

      cat.items = Array.isArray(cat.items) ? cat.items : [];
      if (!cat.items.length){ alert("Essa categoria não tem itens."); return; }

      var listItems = cat.items.map(function(it){return it.id+" - "+it.name}).join("\n");
      var pickItem = prompt('REMOVER qual item de "'+cat.name+'"?\n'+listItems, cat.items[0].id);
      if (!pickItem) return;

      var idx = cat.items.findIndex(function(it){return String(it.id)===String(pickItem)});
      if (idx<0){ alert("Item não encontrado."); return; }

      if (!confirm('Tem certeza que deseja remover o item "'+cat.items[idx].name+'"?')) return;
      cat.items.splice(idx,1);
      editorEl().value = (typeof pretty==="function") ? pretty(obj) : JSON.stringify(obj,null,2);
    }catch(e){ console.error(e); }
  };
}
(function(){
  if (window.__ensureBtns) return; window.__ensureBtns = 1;

  function head(){ return document.getElementById("cardapio-head"); }
  function ed(){ return document.getElementById("cardapio-editor"); }

  function upsertBtn(id, label, handler, beforeId){
    var h = head(); if(!h) return;
    var btn = h.querySelector("#"+id);
    if (!btn){
      btn = document.createElement("button");
      btn.id = id; btn.textContent = label;
      Object.assign(btn.style,{marginRight:"8px"});
      if (beforeId){
        var ref = h.querySelector("#"+beforeId);
        ref ? h.insertBefore(btn, ref) : h.appendChild(btn);
      } else {
        h.appendChild(btn);
      }
    }
    if (handler && !btn.__bound){ btn.addEventListener("click", handler); btn.__bound = 1; }
  }

  // utilitários leves
  function safeParse(){
    try{ return JSON.parse(ed().value || "{}"); }catch(e){ alert("JSON inválido no editor."); throw e; }
  }
  function pretty(o){ return JSON.stringify(o,null,2); }
  function nextIds(menu){
    var cids = (menu.categories||[]).map(c=>+c.id||0);
    var iids = (menu.categories||[]).flatMap(c=>(c.items||[])).map(it=>+it.id||0);
    return {cat: (Math.max(0,...cids)+1)||1, item: (Math.max(0,...iids)+1)||1};
  }

  // handlers ADD/EDIT simples (somente se não existirem)
  if (typeof window.onAddCategory!=="function"){
    window.onAddCategory = function(){
      var m = safeParse(); m.categories = m.categories||[];
      var ids = nextIds(m);
      var name = prompt("Nome da categoria nova:","Nova Categoria"); if(!name) return;
      m.categories.push({id:ids.cat, name:name, order:ids.cat, active:true, items:[]});
      ed().value = pretty(m);
    };
  }

  if (typeof window.onAddItem!=="function"){
    window.onAddItem = function(){
      var m=safeParse(), cats=m.categories||[]; if(!cats.length){alert("Crie uma categoria primeiro.");return;}
      var catPick = prompt("ID da categoria para adicionar item:\n"+cats.map(c=>c.id+" - "+c.name).join("\n"), cats[0].id);
      if(!catPick) return;
      var c = cats.find(x=>String(x.id)===String(catPick)); if(!c){alert("Categoria não encontrada.");return;}
      var ids = nextIds(m);
      var nm = prompt("Nome do item:","Novo Item"); if(!nm) return;
      var pr = parseFloat(prompt("Preço (ex: 12.50):","0")); if(isNaN(pr)) pr=0;
      var ds = prompt("Descrição:",""); 
      c.items = c.items||[];
      c.items.push({id:ids.item, name:nm, desc:ds, price:pr, available:true});
      ed().value = pretty(m);
    };
  }

  if (typeof window.onEditItem!=="function"){
    window.onEditItem = function(){
      var m=safeParse(), cats=m.categories||[]; if(!cats.length){alert("Sem categorias.");return;}
      var catPick = prompt("Editar item de QUAL categoria (ID)?\n"+cats.map(c=>c.id+" - "+c.name).join("\n"), cats[0].id);
      if(!catPick) return;
      var c = cats.find(x=>String(x.id)===String(catPick)); if(!c){alert("Categoria não encontrada.");return;}
      c.items=c.items||[]; if(!c.items.length){alert("Essa categoria não tem itens.");return;}
      var itemPick = prompt("Qual item (ID)?\n"+c.items.map(it=>it.id+" - "+it.name).join("\n"), c.items[0].id);
      if(!itemPick) return;
      var it = c.items.find(x=>String(x.id)===String(itemPick)); if(!it){alert("Item não encontrado.");return;}
      var nm = prompt("Nome:", it.name); if(nm===null) return; it.name = nm||it.name;
      var ds = prompt("Descrição:", it.desc||""); if(ds===null) return; it.desc = ds;
      var pr = prompt("Preço:", String(it.price||0)); if(pr===null) return;
      pr = parseFloat(pr); if(!isNaN(pr)) it.price = pr;
      var av = confirm("Disponível? OK=Sim / Cancel=Não"); it.available = av;
      ed().value = pretty(m);
    };
  }

  if (typeof window.onSaveMenu!=="function"){
    window.onSaveMenu = async function(){
      try{
        var m = safeParse();
        var slug = (m.tenant && m.tenant.slug) || "bar-do-netto";
        var r = await fetch("/api/menu/save?slug="+encodeURIComponent(slug),{
          method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(m)
        });
        if(!r.ok){ var t=await r.text(); alert("Falha ao salvar: "+t); return; }
        alert("Salvo!");
      }catch(e){ console.error(e); alert("Erro ao salvar."); }
    };
  }

  function ensureButtons(){
    if (!head() || !ed()) return;
    // ordem: Add Cat | Add Item | Edit Item | (Remove Item | Remove Cat) | Salvar | Fechar
    upsertBtn("btn-add-cat",   "Adicionar categoria", window.onAddCategory,  "btn-save");
    upsertBtn("btn-add-item",  "Adicionar item",      window.onAddItem,      "btn-save");
    upsertBtn("btn-edit-item", "Editar item",         window.onEditItem,     "btn-save");
    upsertBtn("btn-remove-item","Remover item",       window.onRemoveItem,   "btn-save");
    upsertBtn("btn-remove-cat","Remover categoria",   window.onRemoveCategory,"btn-save");
    // garante o botão salvar se não existir
    upsertBtn("btn-save","Salvar", window.onSaveMenu);
  }

  // roda repetidamente porque o overlay pode ser recriado
  setInterval(ensureButtons, 600);
  document.addEventListener("DOMContentLoaded", ensureButtons);
})();
(function(){
  // Handlers de REMOVER (só cria se não existir)
  function _ed(){ return document.getElementById("cardapio-editor"); }
  function _safe(){ try{ return JSON.parse(_ed().value||"{}"); }catch(e){ alert("JSON inválido."); throw e; } }
  function _pretty(o){ return JSON.stringify(o,null,2); }

  if (typeof window.onRemoveItem!=="function"){
    window.onRemoveItem = function(){
      var m=_safe(), cats=m.categories||[]; if(!cats.length){alert("Sem categorias.");return;}
      var catPick = prompt("Remover ITEM de qual categoria (ID)?\n"+cats.map(c=>c.id+" - "+c.name).join("\n"), cats[0].id);
      if(!catPick) return;
      var c = cats.find(x=>String(x.id)===String(catPick)); if(!c){alert("Categoria não encontrada.");return;}
      c.items=c.items||[]; if(!c.items.length){alert("Essa categoria não tem itens.");return;}
      var itemPick = prompt("Qual item (ID) remover?\n"+c.items.map(it=>it.id+" - "+it.name).join("\n"), c.items[0].id);
      if(!itemPick) return;
      var before = c.items.length;
      c.items = c.items.filter(it=>String(it.id)!==String(itemPick));
      if (c.items.length===before){ alert("Item não encontrado."); return; }
      _ed().value = _pretty(m);
    };
  }

  if (typeof window.onRemoveCategory!=="function"){
    window.onRemoveCategory = function(){
      var m=_safe(), cats=m.categories||[]; if(!cats.length){alert("Sem categorias.");return;}
      var catPick = prompt("Remover QUAL categoria (ID)?\n"+cats.map(c=>c.id+" - "+c.name).join("\n"), cats[0].id);
      if(!catPick) return;
      var before = cats.length;
      m.categories = cats.filter(c=>String(c.id)!==String(catPick));
      if (m.categories.length===before){ alert("Categoria não encontrada."); return; }
      _ed().value = _pretty(m);
    };
  }

  // Garante que os botões existam (inclusive os de remover)
  function head(){ return document.getElementById("cardapio-head"); }
  function upsertBtn(id, label, handler, beforeId){
    var h=head(); if(!h) return;
    var b=h.querySelector("#"+id);
    if(!b){
      b=document.createElement("button"); b.id=id; b.textContent=label;
      Object.assign(b.style,{marginRight:"8px"});
      if(beforeId){ var ref=h.querySelector("#"+beforeId); ref? h.insertBefore(b,ref):h.appendChild(b); }
      else h.appendChild(b);
    }
    if(handler && !b.__bound){ b.addEventListener("click", handler); b.__bound=1; }
  }
  function ensureRemoveButtons(){
    if(!head()) return;
    upsertBtn("btn-remove-item", "Remover item", window.onRemoveItem, "btn-save");
    upsertBtn("btn-remove-cat",  "Remover categoria", window.onRemoveCategory, "btn-save");
  }
  setInterval(ensureRemoveButtons, 600);
  document.addEventListener("DOMContentLoaded", ensureRemoveButtons);
})();
