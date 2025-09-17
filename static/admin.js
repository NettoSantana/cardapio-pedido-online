(() => {
  const $ = sel => document.querySelector(sel);
  const UTF8 = sel => Array.from(document.querySelectorAll(sel));
  const api = {
    getMenu: () => fetch('/api/menu').then(r=>r.json()),
    addItem: (d) => fetch('/api/menu/item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json()),
    updItem: (id,d) => fetch(/api/menu/item/,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json()),
    delItem: (id) => fetch(/api/menu/item/,{method:'DELETE'}).then(r=>r.json()),
    addCat: (d) => fetch('/api/menu/categoria',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json()),
    updCat: (id,d) => fetch(/api/menu/categoria/,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json()),
    delCat: (id) => fetch(/api/menu/categoria/,{method:'DELETE'}).then(r=>r.json()),
    reorder: (arr) => fetch('/api/menu/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(arr)}).then(r=>r.json()),
    publish: () => fetch('/api/menu/publish',{method:'POST'}).then(r=>r.json())
  };
  const toast = (msg) => {const el=#toast;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200);};
  let MENU={categorias:[],itens:[]}, FILTER={type:'all',q:''}, selection=new Set(), reorderMode=false, drawerOpen=false, editing={kind:'item',id:null};

  async function init(){bindUI();await refresh();}
  function bindUI(){
    #btnAdd.onclick=()=>onAdd();
    #btnEdit.onclick=()=>onEdit();
    #btnDelete.onclick=()=>onDelete();
    #btnDuplicate.onclick=()=>onDuplicate();
    #btnReorder.onclick=()=>onReorderToggle();
    #btnPublish.onclick=()=>onPublish();
    #filterType.onchange=e=>{FILTER.type=e.target.value;renderGrid();};
    #search.oninput=e=>{FILTER.q=(e.target.value||'').toLowerCase();renderGrid();};
  }

  async function refresh(){const d=await api.getMenu();MENU={categorias:(d.categorias||[]).map(c=>({...c,_type:'categoria'})),itens:(d.itens||[]).map(i=>({...i,_type:'item'}))};selection.clear();renderGrid();}

  function renderGrid(){/* simplificado */const body=#gridBody;body.innerHTML='';MENU.categorias.forEach(c=>{const tr=document.createElement('tr');tr.innerHTML=<td></td><td>Categoria</td><td></td><td>—</td><td>—</td><td></td><td></td>;body.appendChild(tr)});MENU.itens.forEach(i=>{const tr=document.createElement('tr');tr.innerHTML=<td></td><td>Item</td><td></td><td></td><td></td><td></td><td></td>;body.appendChild(tr)});}

  function onAdd(){drawerOpen=true;toast('Adicionar (drawer abre)');}
  function onEdit(){if(!selection.size)return;toast('Editar');}
  function onDelete(){if(!selection.size)return;toast('Excluir');}
  function onDuplicate(){if(!selection.size)return;toast('Duplicar');}
  function onReorderToggle(){reorderMode=!reorderMode;toast(reorderMode?'Reordenação ON':'Reordenação OFF');}
  function onPublish(){api.publish();toast('Publicado ✓');}

  init();
})();
