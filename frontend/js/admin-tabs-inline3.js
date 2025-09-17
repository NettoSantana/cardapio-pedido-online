(function(){
 if(window.__nettabs2)return; window.__nettabs2=1;

 function el(t,props,txt){var e=document.createElement(t); if(props) Object.assign(e,props); if(txt!=null) e.textContent=txt; return e;}
 function css(e,o){Object.assign(e.style,o);}

 function ensureOverlay(){
   var ov=document.getElementById("cardapio-overlay");
   if(!ov){
     ov=el("div",{id:"cardapio-overlay"}); css(ov,{position:"fixed",inset:"0",background:"rgba(0,0,0,.4)",display:"none",zIndex:"9998"});
     document.body.appendChild(ov);
   }
   var panel=document.getElementById("cardapio-panel");
   if(!panel){ panel=el("div",{id:"cardapio-panel"}); css(panel,{position:"fixed",top:"64px",left:"50%",transform:"translateX(-50%)",width:"min(980px,95vw)",height:"min(70vh,calc(100vh - 96px))",background:"#fff",borderRadius:"10px",boxShadow:"0 10px 30px rgba(0,0,0,.2)",zIndex:"9999",display:"flex",flexDirection:"column",overflow:"hidden"}); ov.appendChild(panel); }

   panel.innerHTML=""; // reset
   var head=el("div",{id:"cardapio-head"}); css(head,{display:"flex",gap:"8px",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid #eee"});
   var left=el("div",null,null); left.appendChild(el("strong",null,"Editor de Cardápio"));
   var right=el("div",{id:"cardapio-actions"});

   function mkbtn(id,label,bg){var b=el("button",{id:id},label); css(b,{border:"0",padding:"6px 12px",borderRadius:"999px",background:bg||"#0d6efd",color:"#fff",fontWeight:"600",cursor:"pointer",marginLeft:"8px"}); b.onmouseenter=()=>b.style.opacity=".9"; b.onmouseleave=()=>b.style.opacity="1"; return b;}
   var bRemIt = mkbtn("btn-remove-item","Remover item","#dc3545");
   var bRemCat= mkbtn("btn-remove-cat","Remover categoria","#6c757d");
   var bSave  = mkbtn("btn-save","Salvar","#0d6efd");
   var bClose = mkbtn("btn-close","Fechar","#6c757d");

   right.appendChild(bRemIt); right.appendChild(bRemCat); right.appendChild(bSave); right.appendChild(bClose);
   head.appendChild(left); head.appendChild(right);

   var body=el("div",{id:"cardapio-body"}); css(body,{flex:"1",overflow:"auto",padding:"12px 16px"});
   var ta=el("textarea",{id:"cardapio-editor"}); css(ta,{width:"100%",height:"100%",minHeight:"300px",fontFamily:"ui-monospace,Consolas,monospace",fontSize:"13px"});
   body.appendChild(ta);

   panel.appendChild(head); panel.appendChild(body);

   function J(){ try{return JSON.parse(ta.value||"{}");}catch(e){alert("JSON inválido"); throw e; } }
   function P(o){ ta.value=JSON.stringify(o,null,2); }

   bClose.onclick=function(){ ov.style.display="none"; };
   bSave.onclick=async function(){
     try{
       var m=J(); var r=await fetch("/api/menu/save?slug=bar-do-netto",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(m)});
       if(!r.ok){ var t=await r.text(); alert("Erro ao salvar: "+t); return;}
       alert("Salvo!");
     }catch(e){ console.error(e); }
   };
   bRemCat.onclick=function(){
     var m=J(), cs=m.categories||[]; if(!cs.length){alert("Sem categorias"); return;}
     var cid=prompt("ID da categoria a remover:", cs[0].id); if(!cid) return;
     var n=cs.length; m.categories=cs.filter(c=>String(c.id)!==String(cid));
     if(m.categories.length===n){ alert("Categoria não encontrada"); return;}
     P(m);
   };
   bRemIt.onclick=function(){
     var m=J(), cs=m.categories||[]; if(!cs.length){alert("Sem categorias"); return;}
     var cid=prompt("Categoria (ID):", cs[0].id); if(!cid) return;
     var c=cs.find(x=>String(x.id)===String(cid)); if(!c){alert("Cat não encontrada"); return;}
     var its=c.items||[]; if(!its.length){alert("Sem itens"); return;}
     var iid=prompt("Item (ID):", its[0].id); if(!iid) return;
     var n=its.length; c.items=its.filter(it=>String(it.id)!==String(iid));
     if(c.items.length===n){ alert("Item não encontrado"); return;}
     P(m);
   };

   fetch("/api/menu?slug=bar-do-netto").then(r=>r.json()).then(P).catch(e=>{ console.error(e); ta.value='{"categories":[]}'; });

   ov.onclick=function(e){ if(e.target===ov) ov.style.display="none"; };
 }

 function show(){ ensureOverlay(); document.getElementById("cardapio-overlay").style.display="block"; }

 function mountTabs(){
   var badge=document.getElementById("alertsBadge");
   var host=badge?badge.parentElement:null;
   if(!host){ var h1=document.querySelector(".topbar h1, header h1, .header h1, .appbar h1, h1"); host=h1?h1.parentElement:null; }
   if(!host || host.querySelector(".admin-tabs")) return false;

   var wrap=document.createElement("span"); wrap.className="admin-tabs";
   function pill(txt,active){var b=document.createElement("button"); b.type="button"; b.className="pill"+(active?" active":""); b.textContent=txt; b.style.marginLeft="8px"; return b;}
   var bPainel=pill("Painel",true);
   var bMenu=pill("Cardápio",false);
   var style=document.createElement("style"); style.textContent=".pill{border:0;border-radius:999px;padding:6px 12px;font-weight:600;background:#e9ecef;cursor:pointer}.pill.active{background:#0d6efd;color:#fff}";
   document.head.appendChild(style);
   wrap.appendChild(bPainel); wrap.appendChild(bMenu);
   if(badge) host.insertBefore(wrap,badge); else { var t=host.querySelector("h1,.title"); t?t.insertAdjacentElement("afterend",wrap):host.appendChild(wrap); }

   bPainel.onclick=function(){ bPainel.classList.add("active"); bMenu.classList.remove("active"); var ov=document.getElementById("cardapio-overlay"); if(ov) ov.style.display="none"; };
   bMenu.onclick=function(){ bMenu.classList.add("active"); bPainel.classList.remove("active"); show(); };
   return true;
 }

 var ok=false, tries=0, iv=setInterval(function(){ tries++; ok=mountTabs()||ok; if(ok||tries>30) clearInterval(iv); },300);
 document.addEventListener("DOMContentLoaded", mountTabs);
})();
