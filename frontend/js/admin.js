"use strict";

function formataPreco(n) {
  try { return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  catch { return `R$ ${Number(n).toFixed(2)}`; }
}

async function loadOrders() {
  const statusEl = document.getElementById("status");
  const tbody = document.getElementById("ordersTbody");
  statusEl.textContent = "Carregando pedidos...";

  try {
    const res = await fetch("/api/orders", { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const orders = await res.json();

    tbody.innerHTML = "";

    if (!orders.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "muted";
      td.textContent = "Sem pedidos por enquanto.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      for (const o of orders) {
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
        }

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

    statusEl.textContent = "Pronto.";
  } catch (err) {
    console.error("Falha ao carregar pedidos:", err);
    statusEl.textContent = "Erro ao carregar pedidos.";
  }
}

function nextStatus(cur) {
  const flow = ["received", "preparing", "delivering", "done"];
  const idx = flow.indexOf(cur);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx+1] : cur;
}

async function changeStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    loadOrders();
  } catch (err) {
    alert("Erro ao atualizar status");
    console.error(err);
  }
}

document.getElementById("btnReload")?.addEventListener("click", loadOrders);
loadOrders();
