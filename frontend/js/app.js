"use strict";

function formataPreco(n) {
  try { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  catch { return `R$ ${Number(n).toFixed(2)}`; }
}

// slug atual ( /c/<slug> → <slug> ; senão, default)
function currentSlug() {
  const p = location.pathname.replace(/^\/+|\/+$/g, "");
  if (p.startsWith("c/")) return p.split("/")[1] || "bar-do-netto";
  return "bar-do-netto";
}

// token de mesa da querystring ?t=M01
function currentTableToken() {
  const u = new URL(location.href);
  const t = (u.searchParams.get("t") || "").trim();
  return t || null;
}

// ===== Carrinho (memória no navegador) =====
const cart = [];
function addToCart(item) {
  const idx = cart.findIndex(x => x.id === item.id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  updateCartSummary();
}
function cartTotals() {
  const items = cart.reduce((acc, it) => acc + it.qty, 0);
  const total = cart.reduce((acc, it) => acc + it.price * it.qty, 0);
  return { items, total };
}
function updateCartSummary() {
  const { items, total } = cartTotals();
  const cartCountEl = document.getElementById("cartCount");
  const cartTotalEl = document.getElementById("cartTotal");
  if (cartCountEl) cartCountEl.textContent = `${items} ${items === 1 ? "item" : "itens"}`;
  if (cartTotalEl) cartTotalEl.textContent = formataPreco(total);
}

async function finalizeOrder() {
  const slug = currentSlug();
  const msgEl = document.getElementById("orderMsg");

  // prioriza token ?t= se existir
  const token = currentTableToken();
  const tableInput = document.getElementById("tableCode");
  const tableCode = (token || tableInput?.value || "").trim();
  const customerName = (document.getElementById("customerName")?.value || "").trim();

  msgEl.className = "order-msg";
  if (!tableCode) { msgEl.classList.add("err"); msgEl.textContent = "Informe a mesa/quarto (ex: M01)."; return; }
  if (cart.length === 0) { msgEl.classList.add("err"); msgEl.textContent = "Seu carrinho está vazio."; return; }

  const payload = { table_code: tableCode, customer_name: customerName || undefined, items: cart.map(it => ({ id: it.id, qty: it.qty })) };

  msgEl.textContent = "Enviando pedido...";
  try {
    const res = await fetch(`/api/orders?slug=${encodeURIComponent(slug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!res.ok) { const txt = await res.text(); throw new Error(`HTTP ${res.status} - ${txt}`); }
    const data = await res.json();
    msgEl.classList.add("ok");
    msgEl.textContent = `Pedido #${data.order_id} recebido! Total: ${formataPreco(data.total)}.`;
    cart.splice(0, cart.length);
    updateCartSummary();
  } catch (err) {
    console.error("Falha ao enviar pedido:", err);
    msgEl.classList.add("err");
    msgEl.textContent = "Erro ao enviar pedido. Tente novamente.";
  }
}

(function prefillTableFromToken() {
  const token = currentTableToken();
  const input = document.getElementById("tableCode");
  const statusEl = document.getElementById("status");
  if (token && input) {
    input.value = token;
    input.disabled = true; input.style.display = "none";
    input.classList.add("input-locked");
    if (statusEl) {
      const info = document.createElement("div");
      info.className = "token-info";
      info.textContent = `Mesa/Quarto detectado: ${token}`;
      statusEl.insertAdjacentElement("afterend", info);
    }
  }
})();

// ===== App =====
(async function main() {
  let statusEl = document.getElementById("status");
  if (!statusEl) { statusEl = document.createElement("div"); statusEl.id = "status"; statusEl.style.margin = "10px 0"; document.body.prepend(statusEl); }
  statusEl.textContent = "Carregando cardápio...";

  document.getElementById("btnCheckout")?.addEventListener("click", finalizeOrder);

  const slug = currentSlug();
  try {
    const res = await fetch(`/api/menu?slug=${encodeURIComponent(slug)}`, { headers: { "Accept": "application/json" } });
    if (!res.ok) { const txt = await res.text(); throw new Error(`HTTP ${res.status} - ${txt}`); }
    const data = await res.json();
    console.log("[API] /api/menu →", data);

    const menuEl = document.getElementById("menu");
    menuEl.innerHTML = "";

    (data.categories || []).sort((a,b) => (a.order||0) - (b.order||0)).forEach(cat => {
      const h2 = document.createElement("h2");
      h2.textContent = cat.name || "Categoria";
      h2.className = "cat-title";
      menuEl.appendChild(h2);

      const ul = document.createElement("ul");
      ul.className = "item-list";

      (cat.items || []).forEach(it => {
        const li = document.createElement("li");
        li.className = "item-row";

        const left = document.createElement("div");
        left.className = "item-left";
        const name = document.createElement("div");
        name.className = "item-name";
        name.textContent = it.name || "Item";
        const desc = document.createElement("div");
        desc.className = "item-desc";
        desc.textContent = it.desc || "";
        left.appendChild(name);
        if (desc.textContent) left.appendChild(desc);

        const right = document.createElement("div");
        right.className = "item-right";

        const price = document.createElement("div");
        price.className = "item-price";
        price.textContent = it.available === false ? "Indisponível" : formataPreco(it.price || 0);

        const btn = document.createElement("button");
        btn.className = "btn btn-add";
        btn.type = "button";
        btn.textContent = "Adicionar";
        btn.disabled = it.available === false;
        btn.addEventListener("click", () => addToCart({ id: it.id, name: it.name, price: Number(it.price || 0) }));

        right.appendChild(price);
        right.appendChild(btn);

        if (it.available === false) li.classList.add("item-off");

        li.appendChild(left);
        li.appendChild(right);
        ul.appendChild(li);
      });

      menuEl.appendChild(ul);
    });

    updateCartSummary();
    statusEl.textContent = `Cardápio carregado (slug: ${slug}).`;
  } catch (err) {
    console.error("Falha ao carregar /api/menu:", err);
    statusEl.textContent = `Erro ao carregar cardápio (slug: ${slug}). Veja o console para detalhes.`;
  }
})();

// build=20250912143438
// --- HISTÓRICO DA MESA (cliente) ---
function currentTableToken() {
  const u = new URL(location.href);
  return (u.searchParams.get("t") || "").trim() || null;
}
function timeAgo(iso) {
  if (!iso) return "-";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime())/1000|0);
  if (s < 60) return `${s}s`;
  const m = (s/60)|0; if (m < 60) return `${m}m`;
  const h = (m/60)|0; const rm = m%60; return `${h}h ${rm}m`;
}
async function loadHistory() {
  const slug = (function(){const p=location.pathname.replace(/^\/+|\/+$/g,"");return p.startsWith("c/")?p.split("/")[1]:"bar-do-netto";})();
  const token = currentTableToken() || (document.getElementById("tableCode")?.value || "").trim();
  const box = document.getElementById("history");
  if (!box) return;
  if (!token) { box.innerHTML = '<div class="hist-empty">Informe a mesa para ver o histórico.</div>'; return; }

  box.innerHTML = "<div class='hist-loading'>Carregando histórico…</div>";
  try {
    const res = await fetch(`/api/my-orders?slug=${encodeURIComponent(slug)}&table=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json(); // lista
    if (!Array.isArray(data) || data.length===0) {
      box.innerHTML = "<div class='hist-empty'>Sem pedidos desta mesa hoje.</div>";
      return;
    }
    const parts = [];
    parts.push(`<h2>Histórico da Mesa ${token}</h2>`);
    parts.push("<ul class='hist-list'>");
    for (const o of data) {
      const itens = (o.items||[]).map(it=>`${it.qty}× ${it.name}`).join(", ");
      parts.push(`<li><div class='hist-line'><span class='hist-id'>#${o.id}</span> <span class='hist-time'>${timeAgo(o.created_at)} atrás</span> — <span class='hist-items'>${itens}</span> — <strong>${(o.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong> — <em>${o.status}</em></div></li>`);
    }
    parts.push("</ul>");
    box.innerHTML = parts.join("");
  } catch (e) {
    console.error(e);
    box.innerHTML = "<div class='hist-empty'>Falha ao carregar histórico.</div>";
  }
}
/** Garante que os botões de ação existam (Solicitar + Histórico) */
(function ensureHistoryUI(){
  let checkoutBtn = document.getElementById("btnCheckout");

  // cria/garante container de ações
  let actions = document.querySelector(".actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "actions";
    const menu = document.getElementById("menu");
    if (menu && menu.parentElement) {
      menu.parentElement.insertBefore(actions, menu);
    } else {
      document.querySelector("main.container")?.prepend(actions);
    }
  }

  // se não existir o botão de solicitar, cria um
  if (!checkoutBtn) {
    checkoutBtn = document.createElement("button");
    checkoutBtn.id = "btnCheckout";
    checkoutBtn.className = "btn";
    checkoutBtn.type = "button";
    checkoutBtn.textContent = "Solicitar Pedido";
    actions.appendChild(checkoutBtn);
    checkoutBtn.addEventListener("click", finalizeOrder);
  } else {
    checkoutBtn.textContent = "Solicitar Pedido";
    checkoutBtn.classList.add("btn");
  }

  // cria o botão de histórico se não existir
  let histBtn = document.getElementById("btnHistory");
  if (!histBtn) {
    histBtn = document.createElement("button");
    histBtn.id = "btnHistory";
    histBtn.className = "btn btn-outline";
    histBtn.type = "button";
    histBtn.textContent = "Histórico";
    actions.appendChild(histBtn);
    histBtn.addEventListener("click", loadHistory);
  }

  // garante container do histórico
  let historyBox = document.getElementById("history");
  if (!historyBox) {
    historyBox = document.createElement("div");
    historyBox.id = "history";
    historyBox.className = "history";
    actions.insertAdjacentElement("afterend", historyBox);
  }

  // se a mesa veio por token, já carrega o histórico automático
  if (currentTableToken && currentTableToken()) {
    setTimeout(loadHistory, 200);
  }
})();
/** =======================
 *  Ações do cliente (MVP)
 *  - Chamar Garçom  → POST /api/assist   { token | table_code }
 *  - Fechar Conta   → POST /api/tabs/close-request { token | table_code }
 * ======================= */

(function ensureClientActions(){
  // cria/garante container de ações
  let actions = document.querySelector(".actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "actions";
    const menu = document.getElementById("menu");
    (menu?.parentElement || document.body).insertBefore(actions, menu || null);
  }

  // botão "Chamar Garçom"
  let btnAssist = document.getElementById("btnAssist");
  if (!btnAssist) {
    btnAssist = document.createElement("button");
    btnAssist.id = "btnAssist";
    btnAssist.type = "button";
    btnAssist.className = "btn btn-outline";
    btnAssist.textContent = "Chamar garçom";
    btnAssist.addEventListener("click", callWaiter);
    actions.appendChild(btnAssist);
  }

  // botão "Fechar Conta"
  let btnClose = document.getElementById("btnClose");
  if (!btnClose) {
    btnClose = document.createElement("button");
    btnClose.id = "btnClose";
    btnClose.type = "button";
    btnClose.className = "btn";
    btnClose.textContent = "Fechar conta";
    btnClose.addEventListener("click", requestClose);
    actions.appendChild(btnClose);
  }
})();

/* ------- helpers ------- */
function showToast(msg, ms=2500){
  try {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=> t.remove(), ms);
  } catch(e){ console.warn("[toast]", e); }
}

function getParam(name){
  const url = new URL(location.href);
  return (url.searchParams.get(name) || "").trim();
}

function getTableCode(){
  // 1) token do QR (preferido): ?t=M01
  const t = getParam("t");
  if (t) return t;

  // 2) tentar achar input de mesa no DOM
  const candIds = ["table", "table_code", "mesa", "quarto"];
  for (const id of candIds){
    const el = document.getElementById(id);
    if (el && el.value && el.value.trim()) return el.value.trim();
  }
  // 3) procurar genericamente por inputs com placeholder de mesa
  const input = [...document.querySelectorAll("input")].find(i => {
    const ph = (i.placeholder || "").toLowerCase();
    return ph.includes("mesa") || ph.includes("quarto");
  });
  if (input?.value?.trim()) return input.value.trim();

  return "";
}

/* ------- ações ------- */
async function callWaiter(){
  const table = getTableCode();
  if (!table) { showToast("Informe a mesa/quarto para chamar o garçom."); return; }

  const btn = document.getElementById("btnAssist");
  btn.disabled = true;

  try{
    const res = await fetch("/api/assist", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ token: table })
    });
    const data = await res.json().catch(()=> ({}));
    if (res.ok && data?.ok){
      const cd = Number(data.cooldown || 60);
      showToast("✅ Garçom chamado! Aguarde, já vão até você.");
      // reabilita após cooldown
      setTimeout(()=> btn.disabled = false, Math.max(3, cd) * 1000);
    } else if (res.status === 429 && data?.reason === "cooldown") {
      const retry = Number(data.retry_in || 30);
      showToast(`⏳ Aguarde ${retry}s para chamar novamente.`);
      setTimeout(()=> btn.disabled = false, Math.max(3, retry) * 1000);
    } else {
      btn.disabled = false;
      showToast("Não foi possível chamar o garçom. Tente novamente.");
    }
  } catch(e){
    console.error("[assist] failed", e);
    btn.disabled = false;
    showToast("Falha na rede. Tente novamente.");
  }
}

async function requestClose(){
  const table = getTableCode();
  if (!table) { showToast("Informe a mesa/quarto para fechar a conta."); return; }

  const btn = document.getElementById("btnClose");
  btn.disabled = true;

  try{
    const res = await fetch("/api/tabs/close-request", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ token: table })
    });
    const data = await res.json().catch(()=> ({}));
    if (res.ok && data?.ok){
      showToast("✅ Pedido de fechamento enviado. Em instantes iremos até você.");
    } else {
      showToast("Não foi possível solicitar fechamento. Tente novamente.");
    }
  } catch(e){
    console.error("[close-request] failed", e);
    showToast("Falha na rede. Tente novamente.");
  } finally {
    // reabilita em 10s para evitar spam
    setTimeout(()=> btn.disabled = false, 10000);
  }
}
