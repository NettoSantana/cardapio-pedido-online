"use strict";

function formataPreco(n) {
  try { return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  catch { return `R$ ${Number(n).toFixed(2)}`; }
}
function getSlug() {
  const u = new URL(location.href);
  return u.searchParams.get("slug") || "bar-do-netto";
}
function isTodayIsoZ(iso) {
  if (!iso) return false;
  const d = new Date(iso); if (isNaN(d)) return false;
  const now = new Date();
  return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
}

let lastRefreshAt = null;
let rawOrders = [];       // dados crus da API
let ui = { status: "all", scope: "today", q: "" };

async function fetchOrders() {
  const res = await fetch(`/api/orders?slug=${encodeURIComponent(getSlug())}`, { headers: { "Accept":"application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function applyFilters() {
  let list = [...rawOrders];

  // date scope
  if (ui.scope === "today") list = list.filter(o => isTodayIsoZ(o.created_at));

  // status
  if (ui.status !== "all") list = list.filter(o => (o.status||"").toLowerCase() === ui.status);

  // search
  const q = ui.q.trim().toLowerCase();
  if (q) {
    list = list.filter(o => {
      const idMatch = ("#"+o.id).toLowerCase().includes(q) || String(o.id).includes(q);
      const mesaMatch = (o.table_code||"").toLowerCase().includes(q);
      const itemsMatch = Array.isArray(o.items) && o.items.some(it =>
        (it.name||"").toLowerCase().includes(q)
      );
      return idMatch || mesaMatch || itemsMatch;
    });
  }

  // sort: created_at desc (fallback id desc)
  list.sort((a,b) => {
    const da = new Date(a.created_at||0).getTime();
    const db = new Date(b.created_at||0).getTime();
    if (!isNaN(da) && !isNaN(db) && db!==da) return db-da;
    return (b.id||0) - (a.id||0);
  });

  return list;
}

function render(list) {
  const tbody = document.getElementById("ordersTbody");
  tbody.innerHTML = "";

  if (!list.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "muted";
    td.textContent = "Nenhum pedido encontrado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const o of list) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = `#${o.id}`;

    const tdTable = document.createElement("td");
    tdTable.textContent = o.table_code || "-";

    const tdItems = document.createElement("td");
    if (Array.isArray(o.items) && o.items.length) {
      const ul = document.createElement("ul");
      ul.style.margin = "0"; ul.style.paddingLeft = "16px";
      for (const it of o.items) {
        const li = document.createElement("li");
        const note = it.note ? ` — "${it.note}"` : "";
        li.textContent = `${it.qty}× ${it.name}${note}`;
        ul.appendChild(li);
      }
      tdItems.appendChild(ul);
    } else tdItems.textContent = "-";

    const tdTotal = document.createElement("td");
    tdTotal.textContent = formataPreco(o.total ?? 0);

    const tdStatus = document.createElement("td");
    tdStatus.innerHTML = `<span class="pill">${o.status}</span>`;

    const tdActions = document.createElement("td");
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Avançar";
    nextBtn.className = "btn btn-sm";
    nextBtn.onclick = () => changeStatus(o.id, nextStatus(o.status));
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancelar";
    cancelBtn.className = "btn btn-sm";
    cancelBtn.onclick = () => changeStatus(o.id, "cancelled");
    tdActions.appendChild(nextBtn);
    tdActions.appendChild(cancelBtn);

    tr.appendChild(tdId);
    tr.appendChild(tdTable);
    tr.appendChild(tdItems);
    tr.appendChild(tdTotal);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  }
}

function nextStatus(cur) {
  const flow = ["received", "preparing", "delivering", "done"];
  const idx = flow.indexOf(cur);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx+1] : cur;
}

async function changeStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}?slug=${encodeURIComponent(getSlug())}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    await loadOrders(); // re-render
  } catch (err) {
    alert("Erro ao atualizar status");
    console.error(err);
  }
}

async function loadOrders() {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Carregando pedidos...";
  try {
    rawOrders = await fetchOrders();
    const list = applyFilters();
    render(list);
    lastRefreshAt = new Date();
    statusEl.textContent = `Atualizado às ${lastRefreshAt.toLocaleTimeString("pt-BR")} (slug: ${getSlug()})`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Erro ao carregar pedidos.";
  }
}

// === eventos da UI ===
function bindUI() {
  document.getElementById("btnReload")?.addEventListener("click", loadOrders);
  document.getElementById("dateScope")?.addEventListener("change", (e)=>{ ui.scope = e.target.value; render(applyFilters()); });

  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    let t=null;
    searchBox.addEventListener("input",(e)=>{
      clearTimeout(t);
      t=setTimeout(()=>{
        ui.q = e.target.value || "";
        render(applyFilters());
      },200);
    });
  }

  const tabs = document.getElementById("tabs");
  tabs?.addEventListener("click",(e)=>{
    const el = e.target.closest(".tab"); if(!el) return;
    [...tabs.querySelectorAll(".tab")].forEach(t=>t.classList.remove("active"));
    el.classList.add("active");
    ui.status = el.dataset.status || "all";
    render(applyFilters());
  });
}

// init
bindUI();
loadOrders();
setInterval(loadOrders, 5000);
async function fetchTabsSummary() {
  const res = await fetch(`/api/tabs/summary?slug=${encodeURIComponent(getSlug())}`, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function closeTab(table) {
  if (!confirm(`Fechar conta da mesa ${table}?`)) return;
  try {
    const res = await fetch(`/api/tabs/close?slug=${encodeURIComponent(getSlug())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    await renderTabsSummary();   // atualiza cards
    await loadOrders();          // atualiza lista
  } catch (e) {
    alert("Erro ao fechar conta.");
    console.error(e);
  }
}
function printTab(table, items) {
  const total = items.reduce((a,b)=>a+(b.total||0),0);
  const rows = items.map(it=>`<tr><td>#${it.id}</td><td>${(new Date(it.created_at)).toLocaleTimeString("pt-BR")}</td><td style="text-align:right">${(it.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>`).join("");
  const w = window.open("", "_blank", "width=420,height=600");
  const html = `
    <html><head><meta charset="utf-8"><title>Conta Mesa ${table}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:12px}
      h2{margin:0 0 8px}
      table{width:100%;border-collapse:collapse}
      td,th{padding:6px;border-bottom:1px solid #eee}
      .tot{font-weight:700;text-align:right}
    </style></head>
    <body>
      <h2>Conta — Mesa ${table}</h2>
      <table>
        <thead><tr><th>Pedido</th><th>Hora</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2" class="tot">TOTAL</td><td class="tot">${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr></tfoot>
      </table>
      <script>window.print();<\/script>
    </body></html>`;
  w.document.write(html); w.document.close();
}
async function renderTabsSummary() {
  const grid = document.getElementById("tablesGrid");
  if (!grid) return;
  grid.innerHTML = '<div class="card"><div class="muted">Carregando…</div></div>';

  // precisamos dos pedidos para montar os itens da impressão
  const [summary, orders] = await Promise.all([fetchTabsSummary(), fetchOrders()]);
  // apenas de hoje, do slug atual
  const todayOrders = orders.filter(o => isTodayIsoZ(o.created_at) && (o.tenant_slug ? o.tenant_slug===getSlug() : true));

  grid.innerHTML = "";
  if (!summary.length) {
    grid.innerHTML = '<div class="muted">Sem mesas hoje.</div>';
    return;
  }

  for (const t of summary) {
    const card = document.createElement("div");
    card.className = "card";

    const h3 = document.createElement("h3");
    h3.textContent = `Mesa ${t.table}`;
    const badge = document.createElement("span");
    badge.className = "badge " + (t.closed ? "closed" : "open");
    badge.textContent = t.closed ? "Fechada" : "Aberta";
    h3.appendChild(document.createTextNode(" "));
    h3.appendChild(badge);

    const row1 = document.createElement("div");
    row1.className = "row";
    const c1 = document.createElement("div"); c1.textContent = `${t.count} pedido(s)`;
    const c2 = document.createElement("div"); c2.textContent = (t.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    row1.appendChild(c1); row1.appendChild(c2);

    const actions = document.createElement("div");
    actions.className = "actions";
    const btnClose = document.createElement("button");
    btnClose.className = "btn btn-sm";
    btnClose.textContent = "Fechar conta";
    btnClose.disabled = t.closed || t.count===0;
    btnClose.onclick = () => closeTab(t.table);

    const btnPrint = document.createElement("button");
    btnPrint.className = "btn btn-sm btn-outline";
    btnPrint.textContent = "Imprimir";
    btnPrint.onclick = () => {
      const items = todayOrders.filter(o => (o.table_code||"").trim().toLowerCase() === t.table.toLowerCase());
      printTab(t.table, items);
    };

    actions.appendChild(btnClose);
    actions.appendChild(btnPrint);

    card.appendChild(h3);
    card.appendChild(row1);
    card.appendChild(actions);
    grid.appendChild(card);
  }
}
async function fetchTabsSummary() {
  const res = await fetch(`/api/tabs/summary?slug=${encodeURIComponent(getSlug())}`, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function closeTab(table) {
  if (!confirm(`Fechar conta da mesa ${table}?`)) return;
  try {
    const res = await fetch(`/api/tabs/close?slug=${encodeURIComponent(getSlug())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    await renderTabsSummary();
    await loadOrders();
  } catch (e) {
    alert("Erro ao fechar conta.");
    console.error(e);
  }
}
function printTab(table, items) {
  const total = items.reduce((a,b)=>a+(b.total||0),0);
  const rows = items.map(it=>`<tr><td>#${it.id}</td><td>${(new Date(it.created_at)).toLocaleTimeString("pt-BR")}</td><td style="text-align:right">${(it.total||0).toLocaleString('pt-BR',{style:'currency','currency':'BRL'})}</td></tr>`).join("");
  const w = window.open("", "_blank", "width=420,height=600");
  const html = `
    <html><head><meta charset="utf-8"><title>Conta Mesa ${table}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:12px}
      h2{margin:0 0 8px}
      table{width:100%;border-collapse:collapse}
      td,th{padding:6px;border-bottom:1px solid #eee}
      .tot{font-weight:700;text-align:right}
    </style></head>
    <body>
      <h2>Conta — Mesa ${table}</h2>
      <table>
        <thead><tr><th>Pedido</th><th>Hora</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2" class="tot">TOTAL</td><td class="tot">${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr></tfoot>
      </table>
      <script>window.print();<\/script>
    </body></html>`;
  w.document.write(html); w.document.close();
}
async function renderTabsSummary() {
  const grid = document.getElementById("tablesGrid");
  if (!grid) return;
  grid.innerHTML = '<div class="card"><div class="muted">Carregando…</div></div>';

  const [summary, orders] = await Promise.all([fetchTabsSummary(), fetchOrders()]);
  const todayOrders = orders.filter(o => isTodayIsoZ(o.created_at) && (o.tenant_slug ? o.tenant_slug===getSlug() : true));

  grid.innerHTML = "";
  if (!summary.length) {
    grid.innerHTML = '<div class="muted">Sem mesas hoje.</div>';
    return;
  }

  for (const t of summary) {
    const card = document.createElement("div");
    card.className = "card";

    const h3 = document.createElement("h3");
    h3.textContent = `Mesa ${t.table}`;
    const badge = document.createElement("span");
    badge.className = "badge " + (t.closed ? "closed" : "open");
    badge.textContent = t.closed ? "Fechada" : "Aberta";
    h3.appendChild(document.createTextNode(" "));
    h3.appendChild(badge);

    const row1 = document.createElement("div");
    row1.className = "row";
    const c1 = document.createElement("div"); c1.textContent = `${t.count} pedido(s)`;
    const c2 = document.createElement("div"); c2.textContent = (t.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    row1.appendChild(c1); row1.appendChild(c2);

    const actions = document.createElement("div");
    actions.className = "actions";
    const btnClose = document.createElement("button");
    btnClose.className = "btn btn-sm";
    btnClose.textContent = "Fechar conta";
    btnClose.disabled = t.closed || t.count===0;
    btnClose.onclick = () => closeTab(t.table);

    const btnPrint = document.createElement("button");
    btnPrint.className = "btn btn-sm btn-outline";
    btnPrint.textContent = "Imprimir";
    btnPrint.onclick = () => {
      const items = todayOrders.filter(o => (o.table_code||"").trim().toLowerCase() === t.table.toLowerCase());
      printTab(t.table, items);
    };

    actions.appendChild(btnClose);
    actions.appendChild(btnPrint);

    card.appendChild(h3);
    card.appendChild(row1);
    card.appendChild(actions);
    grid.appendChild(card);
  }
}
async function fetchTabsSummary() {
  const res = await fetch(`/api/tabs/summary?slug=${encodeURIComponent(getSlug())}`, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function closeTab(table) {
  if (!confirm(`Fechar conta da mesa ${table}?`)) return;
  try {
    const res = await fetch(`/api/tabs/close?slug=${encodeURIComponent(getSlug())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    await renderTabsSummary();
    await loadOrders();
  } catch (e) {
    alert("Erro ao fechar conta.");
    console.error(e);
  }
}
function printTab(table, items) {
  const total = items.reduce((a,b)=>a+(b.total||0),0);
  const rows = items.map(it=>`<tr><td>#${it.id}</td><td>${(new Date(it.created_at)).toLocaleTimeString("pt-BR")}</td><td style="text-align:right">${(it.total||0).toLocaleString('pt-BR',{style:'currency','currency':'BRL'})}</td></tr>`).join("");
  const w = window.open("", "_blank", "width=420,height=600");
  const html = `
    <html><head><meta charset="utf-8"><title>Conta Mesa ${table}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:12px}
      h2{margin:0 0 8px}
      table{width:100%;border-collapse:collapse}
      td,th{padding:6px;border-bottom:1px solid #eee}
      .tot{font-weight:700;text-align:right}
    </style></head>
    <body>
      <h2>Conta — Mesa ${table}</h2>
      <table>
        <thead><tr><th>Pedido</th><th>Hora</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2" class="tot">TOTAL</td><td class="tot">${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr></tfoot>
      </table>
      <script>window.print();<\/script>
    </body></html>`;
  w.document.write(html); w.document.close();
}
async function renderTabsSummary() {
  const grid = document.getElementById("tablesGrid");
  if (!grid) return;
  grid.innerHTML = '<div class="card"><div class="muted">Carregando…</div></div>';

  const [summary, orders] = await Promise.all([fetchTabsSummary(), fetchOrders()]);
  const todayOrders = orders.filter(o => isTodayIsoZ(o.created_at) && (o.tenant_slug ? o.tenant_slug===getSlug() : true));

  grid.innerHTML = "";
  if (!summary.length) {
    grid.innerHTML = '<div class="muted">Sem mesas hoje.</div>';
    return;
  }

  for (const t of summary) {
    const card = document.createElement("div");
    card.className = "card";

    const h3 = document.createElement("h3");
    h3.textContent = `Mesa ${t.table}`;
    const badge = document.createElement("span");
    badge.className = "badge " + (t.closed ? "closed" : "open");
    badge.textContent = t.closed ? "Fechada" : "Aberta";
    h3.appendChild(document.createTextNode(" "));
    h3.appendChild(badge);

    const row1 = document.createElement("div");
    row1.className = "row";
    const c1 = document.createElement("div"); c1.textContent = `${t.count} pedido(s)`;
    const c2 = document.createElement("div"); c2.textContent = (t.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    row1.appendChild(c1); row1.appendChild(c2);

    const actions = document.createElement("div");
    actions.className = "actions";
    const btnClose = document.createElement("button");
    btnClose.className = "btn btn-sm";
    btnClose.textContent = "Fechar conta";
    btnClose.disabled = t.closed || t.count===0;
    btnClose.onclick = () => closeTab(t.table);

    const btnPrint = document.createElement("button");
    btnPrint.className = "btn btn-sm btn-outline";
    btnPrint.textContent = "Imprimir";
    btnPrint.onclick = () => {
      const items = todayOrders.filter(o => (o.table_code||"").trim().toLowerCase() === t.table.toLowerCase());
      printTab(t.table, items);
    };

    actions.appendChild(btnClose);
    actions.appendChild(btnPrint);

    card.appendChild(h3);
    card.appendChild(row1);
    card.appendChild(actions);
    grid.appendChild(card);
  }
}
/* Sanitiza duplicatas da seção "Mesas de hoje" (mantém só a primeira) */
(function removeTabsSummaryDuplicates(){
  try {
    const sections = Array.from(document.querySelectorAll(".tabs-summary"));
    if (sections.length > 1) {
      sections.slice(1).forEach(s => s.parentNode && s.parentNode.removeChild(s));
    }
  } catch (e) { console.warn("tabs-summary cleanup:", e); }
})();
(function bindExportButtons(){
  try {
    const today = document.getElementById("btnExportToday");
    const all = document.getElementById("btnExportAll");
    const slug = getSlug();
    if (today) today.addEventListener("click", ()=> window.open(`/api/orders/export.csv?slug=${encodeURIComponent(slug)}&scope=today`, "_blank"));
    if (all) all.addEventListener("click", ()=> window.open(`/api/orders/export.csv?slug=${encodeURIComponent(slug)}&scope=all`, "_blank"));
  } catch(e) { console.warn("export buttons:", e); }
})();

let SERVICE_FEE_PCT = 0;
async function fetchAdminConfig(){
  try{
    const r = await fetch(`/api/config?slug=${encodeURIComponent(getSlug())}`, {headers:{Accept:"application/json"}});
    if(r.ok){ const c = await r.json(); SERVICE_FEE_PCT = Number(c.service_fee_pct||0); }
  }catch(e){ console.warn("config", e); }
}
window.addEventListener("load", fetchAdminConfig);

function printTab(table, items){
  const subtotal = items.reduce((a,b)=>a+(b.total||0),0);
  const fee = Math.round(subtotal*(SERVICE_FEE_PCT||0)*100)/100;
  const grand = Math.round((subtotal+fee)*100)/100;
  const rows = (items||[]).map(it=>`<tr><td>#${it.id}</td><td>${(new Date(it.created_at)).toLocaleTimeString("pt-BR")}</td><td style="text-align:right">${(it.total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td></tr>`).join("");
  const w = window.open("","_blank","width=420,height=600");
  const html = `
  <html><head><meta charset="utf-8"><title>Conta Mesa ${table}</title>
  <style>body{font-family:Arial,sans-serif;padding:12px}h2{margin:0 0 8px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #eee}.tot{font-weight:700}.right{text-align:right}.muted{color:#666}</style></head>
  <body>
    <h2>Conta — Mesa ${table}</h2>
    <div class="muted">${new Date().toLocaleString("pt-BR")}${SERVICE_FEE_PCT?` • Taxa de serviço: ${(SERVICE_FEE_PCT*100).toFixed(0)}%`:``}</div>
    <table>
      <thead><tr><th>Pedido</th><th>Hora</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2" class="tot right">Subtotal</td><td class="tot right">${subtotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td></tr>
        <tr><td colspan="2" class="tot right">Taxa de serviço ${SERVICE_FEE_PCT?`(${(SERVICE_FEE_PCT*100).toFixed(0)}%)`:``}</td><td class="tot right">${fee.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td></tr>
        <tr><td colspan="2" class="tot right">TOTAL</td><td class="tot right">${grand.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td></tr>
      </tfoot>
    </table>
    <script>window.print();<\/script>
  </body></html>`;
  w.document.write(html); w.document.close();
}
