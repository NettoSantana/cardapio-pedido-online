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
    const orders = await res.json(); // lista

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
        tdId.className = "mono";

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
        } else {
          tdItems.textContent = "-";
        }

        const tdTotal = document.createElement("td");
        tdTotal.textContent = formataPreco(o.total ?? o.subtotal ?? 0);
        tdTotal.className = "mono";

        const tdStatus = document.createElement("td");
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = o.status || "received";
        tdStatus.appendChild(pill);

        const tdCreated = document.createElement("td");
        tdCreated.textContent = o.created_at || "-";

        tr.appendChild(tdId);
        tr.appendChild(tdTable);
        tr.appendChild(tdItems);
        tr.appendChild(tdTotal);
        tr.appendChild(tdStatus);
        tr.appendChild(tdCreated);
        tbody.appendChild(tr);
      }
    }

    statusEl.textContent = "Pronto.";
  } catch (err) {
    console.error("Falha ao carregar pedidos:", err);
    statusEl.textContent = "Erro ao carregar pedidos.";
  }
}

document.getElementById("btnReload")?.addEventListener("click", loadOrders);
loadOrders();
