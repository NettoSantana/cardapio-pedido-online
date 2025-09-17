(function(){
  if (window.__menuEditor) return; window.__menuEditor = 1;

  async function fetchJSON(url, opts){
    const r = await fetch(url, opts||{});
    if(!r.ok) throw new Error("HTTP "+r.status);
    return r.json();
  }

  function el(tag, props, children){
    const e = document.createElement(tag);
    if(props){ Object.assign(e, props); if(props.style){ Object.assign(e.style, props.style); } }
    (children||[]).forEach(ch => e.appendChild(typeof ch==="string" ? document.createTextNode(ch) : ch));
    return e;
  }

  function MoneyInput(){ const i = el("input",{type:"number",step:"0.01",min:"0",placeholder:"Preço"}); return i; }

  async function loadMenu(slug){
    const q = slug ? ("?slug="+encodeURIComponent(slug)) : "";
    return fetchJSON("/api/menu"+q);
  }

  function renderEditor(container, menu, slug){
    container.innerHTML = "";

    // --- Estado local ---
    let data = JSON.parse(JSON.stringify(menu||{tenant:{slug:slug||"bar-do-netto",name:""}, categories:[]}));

    // UI: seletor de categoria + lista itens
    const catSelect = el("select",{});
    const btnNewCat = el("button",{textContent:"Nova categoria"});
    const btnDelCat = el("button",{textContent:"Apagar categoria"});
    const catName = el("input",{placeholder:"Nome da categoria"});

    const itemsWrap = el("div",{});
    const itName = el("input",{placeholder:"Nome do item"});
    const itDesc = el("input",{placeholder:"Descrição (opcional)"});
    const itPrice = MoneyInput();
    const itAvail = el("input",{type:"checkbox"}); const itAvailLbl = el("label",{textContent:"Disponível"});
    const btnAddItem = el("button",{textContent:"Adicionar item"});

    const btnSave = el("button",{textContent:"Salvar cardápio", style:{marginTop:"12px"}});
    const msg = el("div",{style:{marginTop:"8px",opacity:0.85}});

    // estilos rápidos
    [catSelect,catName,itName,itDesc,itPrice].forEach(i=>{ i.style.marginRight="8px"; i.style.marginBottom="8px"; i.style.padding="6px"; i.style.width="min(320px, 95%)"; });
    [btnNewCat,btnDelCat,btnAddItem,btnSave].forEach(b=>{ b.style.marginRight="8px"; b.style.padding="6px 10px"; });

    function refreshCatSelect(){
      catSelect.innerHTML = "";
      (data.categories||[]).sort((a,b)=>(a.order||0)-(b.order||0)).forEach(c=>{
        const o = el("option",{value:String(c.id), textContent:c.name||("Cat "+c.id)});
        catSelect.appendChild(o);
      });
      if (data.categories.length===0){
        itemsWrap.innerHTML = "(Sem categorias)";
        return;
      }
      showCat(catSelect.value);
    }

    function showCat(idStr){
      const id = parseInt(idStr||0,10);
      const c = (data.categories||[]).find(x=>parseInt(x.id,10)===id);
      if(!c){ itemsWrap.textContent = "(Categoria não encontrada)"; return; }
      catName.value = c.name||"";
      itemsWrap.innerHTML = "";
      (c.items||[]).forEach(it=>{
        const row = el("div", {style:{display:"flex",gap:"8px",alignItems:"center",margin:"4px 0"}}, [
          el("span",{textContent: (it.name||"") + " — R$ " + (Number(it.price||0).toFixed(2)) }),
          (function(){
            const rm = el("button",{textContent:"remover"});
            rm.onclick = function(){
              c.items = c.items.filter(x=>x!==it);
              showCat(String(c.id));
            };
            return rm;
          })()
        ]);
        itemsWrap.appendChild(row);
      });
    }

    function nextIds(){
      const catIds = (data.categories||[]).map(c=>parseInt(c.id||0,10));
      const itemIds = [];
      (data.categories||[]).forEach(c=>(c.items||[]).forEach(it=>itemIds.push(parseInt(it.id||0,10))));
      return { nextCat: (Math.max(0,...catIds)+1)||1, nextItem: (Math.max(0,...itemIds)+1)||1 };
    }

    btnNewCat.onclick = function(){
      const ids = nextIds();
      data.categories = data.categories || [];
      data.categories.push({id:ids.nextCat, name:"Nova categoria", order:(data.categories.length+1), active:true, items:[]});
      refreshCatSelect();
      catSelect.value = String(ids.nextCat);
      showCat(catSelect.value);
    };

    btnDelCat.onclick = function(){
      const id = parseInt(catSelect.value||0,10);
      data.categories = (data.categories||[]).filter(c=>parseInt(c.id,10)!==id);
      refreshCatSelect();
    };

    catName.oninput = function(){
      const id = parseInt(catSelect.value||0,10);
      const c = (data.categories||[]).find(x=>parseInt(x.id,10)===id);
      if(c){ c.name = catName.value; }
      // atualiza option visível
      const opt = Array.from(catSelect.options).find(o=>parseInt(o.value,10)===id);
      if(opt) opt.textContent = catName.value||("Cat "+id);
    };

    btnAddItem.onclick = function(){
      const id = parseInt(catSelect.value||0,10);
      const c = (data.categories||[]).find(x=>parseInt(x.id,10)===id);
      if(!c) return;
      const ids = nextIds();
      const item = {
        id: ids.nextItem,
        name: itName.value||"Item",
        desc: itDesc.value||"",
        price: parseFloat(itPrice.value||"0")||0,
        available: !!itAvail.checked
      };
      c.items = c.items || [];
      c.items.push(item);
      itName.value = ""; itDesc.value=""; itPrice.value=""; itAvail.checked=true;
      showCat(String(c.id));
    };

    btnSave.onclick = async function(){
      msg.textContent = "Salvando...";
      try{
        const q = slug ? ("?slug="+encodeURIComponent(slug)) : "";
        await fetchJSON("/api/menu/save"+q,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ tenant: data.tenant||{}, categories: data.categories||[] })
        });
        msg.textContent = "Salvo!";
      }catch(e){
        console.error(e); msg.textContent = "Erro ao salvar.";
      }
    };

    // Monta UI
    container.appendChild(el("div",{},[
      el("div",{},[el("strong",{textContent:"Categoria:"}), el("br"), catSelect, btnNewCat, btnDelCat, el("br"), catName]),
      el("hr"),
      el("div",{},[el("strong",{textContent:"Itens:"}), el("br"), itemsWrap, el("br"),
        itName, itDesc, itPrice, (function(){ itAvail.checked=true; itAvailLbl.htmlFor=""; return el("span",{},[itAvail,itAvailLbl]); })(), btnAddItem
      ]),
      el("hr"),
      btnSave, msg
    ]));

    refreshCatSelect();
  }

  // API p/ o botão "Cardápio" já existente
  window.openMenuEditor = async function(slug){
    try{
      const ov = document.getElementById("cardapio-overlay");
      const body = document.getElementById("cardapio-body");
      if(!ov || !body) return;
      body.innerHTML = "Carregando...";
      const menu = await loadMenu(slug||"");
      renderEditor(body, menu, (menu && menu.tenant && menu.tenant.slug) || slug || "");
      ov.style.display = "block";
    }catch(e){
      console.error(e);
    }
  };
})();
