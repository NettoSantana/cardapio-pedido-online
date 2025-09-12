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
