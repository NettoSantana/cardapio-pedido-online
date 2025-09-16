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
/* ======================== Alerts (garçom / fechar conta) ======================== */
(function setupAlerts(){
  const box   = document.getElementById("alertsBox");
  const stat  = document.getElementById("alertsStatus");
  const list  = document.getElementById("alertsList");
  if (!box || !stat || !list) return; // admin sem bloco

  let lastData = null;
  let timer = null;

  async function fetchAlerts(){
    try{
      const url = new URL("/api/alerts", location.origin);
      url.searchParams.set("since", ""); // reservado
      const res = await fetch(url, { headers: { "Accept":"application/json" }});
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      lastData = data;
      renderAlerts(data);
      stat.textContent = "Atualizado às " + new Date().toLocaleTimeString();
    } catch(e){
      console.error("[alerts] fail", e);
      stat.textContent = "Falha ao carregar (ver console).";
    }
  }

  function renderList(title, items, type){
    const section = document.createElement("div");
    const h = document.createElement("h3");
    h.textContent = title;
    h.style.margin = "12px 0 6px";
    section.appendChild(h);

    if (!items || !items.length) {
      const p = document.createElement("div");
      p.style.color = "#555";
      p.textContent = "Nenhum";
      section.appendChild(p);
      return section;
    }

    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.padding = "0";
    ul.style.margin = "0";

    items.forEach(it => {
      const li = document.createElement("li");
      li.className = "card";
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.alignItems = "center";
      li.style.marginTop = "8px";

      const left = document.createElement("div");
      left.innerHTML = `<strong>Mesa:</strong> ${it.table_code} <span style="color:#555">(${type} • ${new Date(it.requested_at).toLocaleTimeString()})</span>`;
      const right = document.createElement("div");

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Confirmar";
      btn.onclick = () => ack(type, it.id, btn);

      right.appendChild(btn);
      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });

    section.appendChild(ul);
    return section;
  }

  function renderAlerts(data){
    list.innerHTML = "";
    list.appendChild(renderList("Chamadas de garçom", data.assist_calls || [], "assist"));
    list.appendChild(renderList("Solicitações de fechar conta", data.close_requests || [], "close"));
  }

  async function ack(type, id, btn){
    try{
      btn.disabled = true;
      const res = await fetch("/api/alerts/ack", {
        method: "POST",
        headers: { "Content-Type":"application/json", "Accept":"application/json" },
        body: JSON.stringify({ type, id })
      });
      const data = await res.json().catch(()=> ({}));
      if (res.ok && data.ok) {
        await fetchAlerts();
      } else {
        console.warn("[ack] fail", data);
        alert("Não foi possível confirmar. Tente novamente.");
      }
    } catch(e){
      console.error("[ack] err", e);
      alert("Falha de rede. Tente novamente.");
    } finally {
      btn.disabled = false;
    }
  }

  // inicia o polling
  fetchAlerts();
  timer = setInterval(fetchAlerts, 5000);
})();
/* --- Pós-render: normaliza UI da tabela --- */
(function patchAdminUI(){
  // roda depois de cada atualização do painel
  const origRender = window.renderOrders;
  window.renderOrders = function(data){
    const out = origRender ? origRender(data) : undefined;
    try{
      // 1) marca a tabela e colunas (se existirem)
      const table = document.querySelector("table");
      if (table) table.classList.add("admin-table");

      // descobre a coluna de Itens (3ª col normalmente)
      const rows = document.querySelectorAll("tbody tr");
      rows.forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (!tds.length) return;

        // marca colunas conhecidas para CSS ajudar no alinhamento
        if (tds[0]) tds[0].classList.add("admin-col-id");
        if (tds[1]) tds[1].classList.add("admin-col-mesa");
        if (tds[2]) tds[2].classList.add("items-col");   // <- itens
        if (tds[3]) tds[3].classList.add("admin-col-tot");
        if (tds[4]) tds[4].classList.add("admin-col-sta");
        if (tds[5]) tds[5].classList.add("admin-col-act","actions-cell");

        // 2) transforma cada linha de item para (texto + botão) inline
        const itemsCell = tds[2];
        if (itemsCell){
          // pega linhas já renderizadas (li, divs ou brs) e normaliza
          // estratégia: fatiar pelo <br> ou por elementos de linha existentes
          const parts = [];
          // se já veio com .item-row, só dá o class e segue
          const existingRows = itemsCell.querySelectorAll(".item-row");
          if (existingRows.length === 0){
            // tenta dividir manualmente
            const html = itemsCell.innerHTML
              .replace(/\n+/g,"")
              .replace(/<\/?ul>|<\/?ol>|<\/?li>/gi,"")
              .replace(/&nbsp;/g, " ")
              .trim();
            const chunks = html.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
            itemsCell.innerHTML = ""; // vamos remontar
            chunks.forEach(txt => {
              const row = document.createElement("div");
              row.className = "item-row";
              const span = document.createElement("span");
              span.className = "item-text";
              span.textContent = txt.replace(/\s+/g," ").trim();
              row.appendChild(span);
              // só adiciona botão se o pedido não estiver "done/cancelled"
              const orderDone = (tds[4]?.textContent || "").toLowerCase().includes("done")
                             || (tds[4]?.textContent || "").toLowerCase().includes("cancel");
              if (!orderDone){
                const btn = document.createElement("button");
                btn.className = "btn-small entregar-btn";
                btn.type = "button";
                btn.textContent = "Entregar";
                // se existir data-order-id no TR e data-item-id no texto, você pode ligar aqui
                btn.addEventListener("click", () => {
                  // fallback: dispara o mesmo handler original se existir
                  if (window.onDeliverItem) window.onDeliverItem(tr, span.textContent);
                });
                row.appendChild(btn);
              }
              itemsCell.appendChild(row);
            });
          } else {
            // já está em item-row: garante classes e botão inline
            existingRows.forEach(row => {
              row.classList.add("item-row");
              const textEl = row.querySelector(".item-text") || row.firstElementChild;
              if (textEl) textEl.classList.add("item-text");
              const orderDone = (tds[4]?.textContent || "").toLowerCase().includes("done")
                             || (tds[4]?.textContent || "").toLowerCase().includes("cancel");
              if (!orderDone && !row.querySelector(".entregar-btn")){
                const btn = document.createElement("button");
                btn.className = "btn-small entregar-btn";
                btn.type = "button";
                btn.textContent = "Entregar";
                btn.addEventListener("click", () => {
                  if (window.onDeliverItem) window.onDeliverItem(tr, textEl?.textContent || "");
                });
                row.appendChild(btn);
              }
            });
          }
        }

        // 3) some com "Avançar" se ainda existir
        const btns = tds[5]?.querySelectorAll("button, a") || [];
        btns.forEach(b => {
          const label = (b.textContent || "").trim().toLowerCase();
          if (label === "avançar" || label === "avancar") {
            b.classList.add("btn-advance");
          }
        });
      });
    }catch(e){ console.error("patchAdminUI:", e); }
    return out;
  };
})();
/* === Patch de UI: força item+Entregar na mesma linha e esconde "Avançar" === */
(function adminFixLoop(){
  function textEquals(el, wanted){
    return (el.textContent || "").trim().toLowerCase() === wanted.toLowerCase();
  }
  function buildItemRows(cell){
    if (!cell) return;
    if (cell.querySelector(".item-row")) return; // já processado
    const html = cell.innerHTML
      .replace(/\n+/g," ")
      .replace(/<\/?ul>|<\/?ol>|<\/?li>/gi,"")
      .replace(/&nbsp;/g," ")
      .trim();
    const parts = html.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    cell.innerHTML = "";
    parts.forEach(p=>{
      const row = document.createElement("div");
      row.className = "item-row";
      const span = document.createElement("span");
      span.className = "item-text";
      span.textContent = p.replace(/\s+/g," ").trim();
      row.appendChild(span);
      cell.appendChild(row);
    });
  }
  function moveEntregarButtonsToItems(tr){
    const tds = tr.querySelectorAll("td");
    if (tds.length < 6) return;
    const itemsCell = tds[2];
    const actionsCell = tds[5];
    if (!itemsCell || !actionsCell) return;

    // marca colunas pra CSS
    tds[0]?.classList.add("admin-col-id");
    tds[1]?.classList.add("admin-col-mesa");
    itemsCell.classList.add("items-col");
    tds[3]?.classList.add("admin-col-tot");
    tds[4]?.classList.add("admin-col-sta");
    actionsCell.classList.add("admin-col-act","actions-cell");

    // esconde "Avançar"
    actionsCell.querySelectorAll("button, a").forEach(b=>{
      if (textEquals(b,"avançar") || textEquals(b,"avancar")) b.style.display = "none";
    });

    // constrói linhas de item (se necessário)
    buildItemRows(itemsCell);

    // pega todos botões "Entregar" que estejam na célula de ações
    const entregarBtns = Array.from(actionsCell.querySelectorAll("button, a"))
      .filter(b => textEquals(b,"entregar"));

    if (entregarBtns.length === 0) return;

    const itemRows = Array.from(itemsCell.querySelectorAll(".item-row"));
    // distribui 1:1; se sobrar, vai todos no último item
    entregarBtns.forEach((btn, idx)=>{
      btn.classList.add("btn-small","entregar-btn");
      btn.style.display = ""; // garante visível
      const target = itemRows[idx] || itemRows[itemRows.length-1];
      if (target && !target.querySelector(".entregar-btn")){
        target.appendChild(btn);
      }else{
        // se já tem, cria um clone "leve"
        const clone = btn.cloneNode(true);
        target.appendChild(clone);
      }
    });
  }

  function tick(){
    try{
      const table = document.querySelector("table");
      if (!table) return;
      table.classList.add("admin-table");
      document.querySelectorAll("tbody tr").forEach(moveEntregarButtonsToItems);
    }catch(e){ console.error("adminFixLoop:", e); }
  }
  setInterval(tick, 1200);
  // roda uma vez já
  document.addEventListener("DOMContentLoaded", tick);
})();
/* === Patch de UI (idempotente) === */
(function(){
  if (window.__adminFixLoop) return; window.__adminFixLoop = true;

  function textEq(el, wanted){
    return (el.textContent||"").trim().toLowerCase() === wanted.toLowerCase();
  }
  function buildItemRows(cell){
    if (!cell || cell.querySelector(".item-row")) return;
    const raw = cell.innerHTML.replace(/\n+/g," ")
      .replace(/<\/?ul>|<\/?ol>|<\/?li>/gi,"")
      .replace(/&nbsp;/g," ").trim();
    const parts = raw.split(/<br\s*\/?>/i).map(s=>s.trim()).filter(Boolean);
    if (!parts.length) return;
    cell.innerHTML = "";
    parts.forEach(p=>{
      const row = document.createElement("div");
      row.className = "item-row";
      const t = document.createElement("span");
      t.className = "item-text";
      t.textContent = p.replace(/\s+/g," ").trim();
      row.appendChild(t);
      cell.appendChild(row);
    });
  }
  function fixRow(tr){
    const tds = tr.querySelectorAll("td");
    if (tds.length < 6) return;
    const items = tds[2], total = tds[3], status = tds[4], actions = tds[5];

    tds[0]?.classList.add("admin-col-id");
    tds[1]?.classList.add("admin-col-mesa");
    items?.classList.add("items-col");
    total?.classList.add("admin-col-tot");
    status?.classList.add("admin-col-sta");
    actions?.classList.add("admin-col-act","actions-cell");

    // 1) esconder QUALQUER coisa que não seja Cancelar (ex.: Avançar)
    actions.querySelectorAll("button, a").forEach(b=>{
      const txt = (b.textContent||"").trim().toLowerCase();
      if (txt !== "cancelar" && txt !== "entregar") b.style.display = "none";
    });

    // 2) construir linhas de itens se necessário
    buildItemRows(items);

    // 3) mover todos os "Entregar" da célula de ações para cada item
    const entregarBtns = Array.from(actions.querySelectorAll("button, a"))
      .filter(b => textEq(b,"entregar"));
    if (!entregarBtns.length) return;

    const rows = Array.from(items.querySelectorAll(".item-row"));
    entregarBtns.forEach((btn, i)=>{
      btn.classList.add("btn-small","entregar-btn");
      btn.style.display = "";
      const target = rows[i] || rows[rows.length-1];
      if (!target) return;
      // evita duplicar
      if (!target.querySelector(".entregar-btn")) {
        target.appendChild(btn);
      } else {
        const clone = btn.cloneNode(true);
        target.appendChild(clone);
      }
    });
  }

  function tick(){
    try{
      const table = document.querySelector("table");
      if (!table) return;
      table.classList.add("admin-table");
      document.querySelectorAll("tbody tr").forEach(fixRow);
    }catch(e){ console.error("adminFixLoop:", e); }
  }
  document.addEventListener("DOMContentLoaded", tick);
  setInterval(tick, 800);
})();
