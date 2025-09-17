(function(){
  if (window.__nettabs4) return; window.__nettabs4 = 1;

  // util
  function el(t,props,txt){const e=document.createElement(t); if(props) Object.assign(e,props); if(txt!=null) e.textContent=txt; return e;}
  function css(e,o){Object.assign(e.style,o);}
  const SLUG = "bar-do-netto";

  // ------------ Overlay + Editor ------------
  function ensureOverlay(){
    let ov = document.getElementById("cardapio-overlay");
    if(!ov){ ov = el("div",{id:"cardapio-overlay"}); css(ov,{position:"fixed",inset:"0",background:"rgba(0,0,0,.4)",display:"none",zIndex:"9998"}); document.body.appendChild(ov); }
    let panel = document.getElementById("cardapio-panel");
    if(!panel){ panel = el("div",{id:"cardapio-panel"}); css(panel,{position:"fixed",top:"64px",left:"50%",transform:"translateX(-50%)",width:"min(980px,95vw)",height:"min(75vh,calc(100vh - 96px))",background:"#fff",borderRadius:"10px",boxShadow:"0 10px 30px rgba(0,0,0,.2)",zIndex:"9999",display:"flex",flexDirection:"column",overflow:"hidden"}); ov.appendChild(panel); }

    panel.innerHTML = "";

    const head = el("div"); css(head,{display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid #eee"});
    const left = el("div"); left.appendChild(el("strong",null,"Editor de Cardápio"));
    const right = el("div",{id:"cardapio-actions"});

    function pill(id,label,bg){const b=el("button",{id},label); css(b,{border:"0",padding:"6px 12px",borderRadius:"999px",background:bg||"#0d6efd",color:"#fff",fontWeight:"600",cursor:"pointer"}); b.onmouseenter=()=>b.style.opacity=".9"; b.onmouseleave=()=>b.style.opacity="1"; return b;}

    const btnAddCat  = pill("btn-add-cat","+ Categoria","#198754");
    const btnEditCat = pill("btn-edit-cat","✎ Categoria","#0d6efd");
    const btnAddItem = pill("btn-add-item","+ Item","#198754");
    const btnEditItem= pill("btn-edit-item","✎ Item","#0d6efd");
    const btnDelItem = pill("btn-del-item","– Item","#dc3545");
    const btnDelCat  = pill("btn-del-cat","– Categoria","#6c757d");
    const btnSave    = pill("btn-save","Salvar","#0d6efd");
    const btnClose   = pill("btn-close","Fechar","#6c757d");

    [btnAddCat,btnEditCat,btnAddItem,btnEditItem,btnDelItem,btnDelCat,btnSave,btnClose].forEach(b=>right.appendChild(b));
    head.appendChild(left); head.appendChild(right);

    const body = el("div",{id:"cardapio-body"}); css(body,{flex:"1",overflow:"auto",padding:"12px 16px"});
    const ta = el("textarea",{id:"cardapio-editor"}); css(ta,{width:"100%",height:"100%",minHeight:"340px",fontFamily:"ui-monospace,Consolas,monospace",fontSize:"13px",lineHeight:"1.4"});
    body.appendChild(ta);
    panel.appendChild(head); panel.appendChild(body);

    function J(){ try{return JSON.parse(ta.value||"{}");}catch(e){ alert("JSON inválido"); throw e; } }
    function P(o){ ta.value = JSON.stringify(o,null,2); }

    // Handlers
    btnClose.onclick = ()=>{ ov.style.display="none"; };
    btnSave.onclick = async ()=>{
      try{
        const m=J();
        const r=await fetch("/api/menu/save?slug="+encodeURIComponent(SLUG),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(m)});
        if(!r.ok){return alert("Erro ao salvar: "+(await r.text()));}
        alert("Salvo!");
      }catch(err){ console.error(err); alert("Falha ao salvar.");}
    };

    btnAddCat.onclick = ()=>{
      const m=J(); m.categories = m.categories||[];
      const id   = prompt("ID da categoria (numérico ou texto curto):", (m.categories[m.categories.length-1]?.id||"") + "" );
      if(!id) return;
      const name = prompt("Nome da categoria:", "Nova categoria");
      const order= parseInt(prompt("Ordem (número crescente):","1")||"1",10);
      if(m.categories.some(c=>String(c.id)===String(id))) return alert("Já existe categoria com esse ID.");
      m.categories.push({id, name: name||("Categoria "+id), order: isNaN(order)?1:order, active:true, items:[]});
      P(m);
    };

    btnEditCat.onclick = ()=>{
      const m=J(); const cs=m.categories||[]; if(!cs.length) return alert("Sem categorias.");
      const id = prompt("ID da categoria a editar:", cs[0].id);
      if(!id) return;
      const c = cs.find(x=>String(x.id)===String(id)); if(!c) return alert("Categoria não encontrada.");
      const name = prompt(`Nome da categoria (${c.name}):`, c.name);
      const order= parseInt(prompt(`Ordem (${c.order||1}):`, (c.order||1))|| (c.order||1),10);
      const active= (prompt(`Ativa? (s/n) [atual ${c.active!==false?"s":"n"}]:`,"s")||"s").toLowerCase().startsWith("s");
      if(name!=null) c.name=name;
      if(!isNaN(order)) c.order=order;
      c.active=!!active;
      P(m);
    };

    btnAddItem.onclick = ()=>{
      const m=J(); const cs=m.categories||[]; if(!cs.length) return alert("Cadastre uma categoria primeiro.");
      const cid = prompt("Categoria (ID):", cs[0].id); if(!cid) return;
      const c = cs.find(x=>String(x.id)===String(cid)); if(!c) return alert("Categoria não encontrada.");
      c.items = c.items||[];
      const newid = prompt("ID do item:", (c.items[c.items.length-1]?.id||"") + "");
      if(!newid) return;
      if(c.items.some(it=>String(it.id)===String(newid))) return alert("Já existe item com esse ID nessa categoria.");
      const name = prompt("Nome do item:", "Novo item");
      const desc = prompt("Descrição (opcional):","")||"";
      const price= parseFloat(prompt("Preço (ex: 12.50):","0")||"0");
      const available = (prompt("Disponível? (s/n)","s")||"s").toLowerCase().startsWith("s");
      c.items.push({id:newid, name:name||("Item "+newid), desc, price:isNaN(price)?0:price, photo_url:null, available});
      P(m);
    };

    btnEditItem.onclick = ()=>{
      const m=J(); const cs=m.categories||[]; if(!cs.length) return alert("Sem categorias.");
      const cid = prompt("Categoria (ID):", cs[0].id); if(!cid) return;
      const c = cs.find(x=>String(x.id)===String(cid)); if(!c) return alert("Categoria não encontrada.");
      const its=c.items||[]; if(!its.length) return alert("Sem itens na categoria.");
      const iid = prompt("Item (ID):", its[0].id); if(!iid) return;
      const it = its.find(x=>String(x.id)===String(iid)); if(!it) return alert("Item não encontrado.");
      const name = prompt(`Nome (${it.name}):`, it.name);
      const desc = prompt(`Descrição (${it.desc||""}):`, it.desc||"");
      const price= parseFloat(prompt(`Preço (${it.price||0}):`, it.price||0));
      const available=(prompt(`Disponível? (s/n) [${it.available!==false?"s":"n"}]:`,"s")||"s").toLowerCase().startsWith("s");
      if(name!=null) it.name=name;
      it.desc=desc||"";
      if(!isNaN(price)) it.price=price;
      it.available=!!available;
      P(m);
    };

    btnDelItem.onclick = ()=>{
      const m=J(); const cs=m.categories||[]; if(!cs.length) return alert("Sem categorias.");
      const cid = prompt("Categoria (ID):", cs[0].id); if(!cid) return;
      const c = cs.find(x=>String(x.id)===String(cid)); if(!c) return alert("Categoria não encontrada.");
      const its=c.items||[]; if(!its.length) return alert("Sem itens.");
      const iid = prompt("Item (ID) a remover:", its[0].id); if(!iid) return;
      const n=its.length; c.items=its.filter(it=>String(it.id)!==String(iid));
      if(c.items.length===n) return alert("Item não encontrado.");
      P(m);
    };

    btnDelCat.onclick = ()=>{
      const m=J(); const cs=m.categories||[]; if(!cs.length) return alert("Sem categorias.");
      const cid = prompt("Categoria (ID) a remover:", cs[0].id); if(!cid) return;
      const n=cs.length; m.categories=cs.filter(c=>String(c.id)!==String(cid));
      if(m.categories.length===n) return alert("Categoria não encontrada.");
      P(m);
    };

    // carrega JSON atual
    fetch("/api/menu?slug="+encodeURIComponent(SLUG))
      .then(r=>r.json()).then(P)
      .catch(_=>{ ta.value = JSON.stringify({tenant:{slug:SLUG,name:""},categories:[]},null,2); });

    // fechar ao clicar fora
    ov.onclick = (e)=>{ if(e.target===ov) ov.style.display="none"; };
  }

  function showOverlay(){ ensureOverlay(); const ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="block"; }

  // ------------ Abas em pílula (fixam mesmo com remount do DOM) ------------
  function hostEl(){
    const badge = document.getElementById("alertsBadge");
    if (badge && badge.parentElement) return badge.parentElement;
    const h1 = document.querySelector(".topbar h1, header h1, .header h1, .appbar h1, h1");
    return h1 ? h1.parentElement : null;
  }

  function mountTabsOnce(){
    const host = hostEl(); if(!host) return false;
    if (host.querySelector(".admin-tabs-pills")) return true;

    const wrap = el("span",{className:"admin-tabs-pills"});
    const style = el("style");
    style.textContent = ".pill{border:0;border-radius:999px;padding:6px 12px;font-weight:600;background:#e9ecef;cursor:pointer;margin-left:8px}.pill.active{background:#0d6efd;color:#fff}";
    document.head.appendChild(style);

    const bPainel = el("button",{className:"pill active",type:"button"},"Painel");
    const bMenu   = el("button",{className:"pill",type:"button"},"Cardápio");
    wrap.appendChild(bPainel); wrap.appendChild(bMenu);

    // injeta antes do badge (se existir) ou após o título
    const badge = document.getElementById("alertsBadge");
    if (badge) host.insertBefore(wrap, badge); else {
      const t = host.querySelector("h1,.title"); t ? t.insertAdjacentElement("afterend", wrap) : host.appendChild(wrap);
    }

    bPainel.onclick = ()=>{ bPainel.classList.add("active"); bMenu.classList.remove("active"); const ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none"; };
    bMenu.onclick   = ()=>{ bMenu.classList.add("active"); bPainel.classList.remove("active"); showOverlay(); };

    // Observa remoções e remonta se sumirem
    const mo = new MutationObserver(()=>{ if(!host.isConnected || !host.querySelector(".admin-tabs-pills")) { setTimeout(tryMount, 100); } });
    mo.observe(document.body, {childList:true,subtree:true});
    return true;
  }

  function tryMount(){
    let ok = mountTabsOnce();
    if(!ok) setTimeout(tryMount, 300);
  }

  document.addEventListener("DOMContentLoaded", tryMount);
  tryMount(); // caso o admin re-renderize depois
})();
