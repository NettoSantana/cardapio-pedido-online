# -*- coding: utf-8 -*-
import os
import json
import itertools
import time
import base64
from datetime import datetime
from pathlib import Path

from flask import (
    Flask, request, jsonify, abort, send_from_directory, Response, render_template
)

# ===== Caminhos base =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
DEFAULT_SLUG = "bar-do-netto"

DATA_DIR = os.path.join(BASE_DIR, "db")
DB_DIR = os.path.join(DATA_DIR, "json")
ORDERS_FILE = os.path.join(DB_DIR, "orders.json")

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,   # serve arquivos do frontend na raiz "/"
    static_url_path="",
    template_folder=TEMPLATES_DIR # para usar render_template('admin.html'), etc.
)

# ===========================
# Auth (HTTP Basic)
# ===========================
ADMIN_USER = (os.environ.get("ADMIN_USER") or "admin").strip()
ADMIN_PASS = (os.environ.get("ADMIN_PASS") or "changeme").strip()

def _unauthorized():
    return Response(status=401, headers={"WWW-Authenticate": 'Basic realm="Admin"'})

def require_admin(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # 0) DEV bypass por query: ?dev=<ADMIN_USER>
        try:
            if (request.args.get("dev") or "").strip() == ADMIN_USER and ADMIN_USER:
                return fn(*args, **kwargs)
        except Exception:
            pass
        # 1) Query-string: ?u=<user>&p=<pass>
        u = (request.args.get("u") or "").strip()
        p = (request.args.get("p") or "").strip()
        if u and p and u == ADMIN_USER and p == ADMIN_PASS:
            return fn(*args, **kwargs)
        # 2) Basic Auth normal (navegador)
        auth = request.authorization
        if auth and (auth.username or '').strip() == ADMIN_USER and (auth.password or '').strip() == ADMIN_PASS:
            return fn(*args, **kwargs)
        # 3) Fallback: header Authorization manual (proxy)
        h = request.headers.get('Authorization') or ''
        if h.lower().startswith('basic '):
            try:
                decoded = base64.b64decode(h.split(' ',1)[1]).decode('utf-8')
                uu, pp = decoded.split(':', 1)
                if uu.strip() == ADMIN_USER and pp.strip() == ADMIN_PASS:
                    return fn(*args, **kwargs)
            except Exception:
                pass
        return _unauthorized()
    return wrapper

# ===========================
# Persistência pedidos (JSON)
# ===========================
def _ensure_db():
    os.makedirs(DB_DIR, exist_ok=True)
    if not os.path.exists(ORDERS_FILE):
        with open(ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False)

def load_orders():
    _ensure_db()
    try:
        with open(ORDERS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []

def save_orders(orders):
    _ensure_db()
    tmp = ORDERS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ORDERS_FILE)

def _is_today_iso(iso):
    try:
        d = datetime.fromisoformat((iso or "").replace("Z",""))
        now = datetime.utcnow()
        return d.date() == now.date()
    except Exception:
        return False

# ===== Fallback de cardápio =====
FALLBACK_MENU = {
    "tenant": {"slug": "bar-do-netto", "name": "Bar do Netto (fallback)", "open": True, "pix_key": None},
    "categories": [
        {
            "id": 1, "name": "Bebidas", "order": 1, "active": True,
            "items": [
                {"id": 101, "name": "Água Mineral 500ml", "desc": "Sem gás", "price": 4.0, "photo_url": None, "available": True},
                {"id": 102, "name": "Refrigerante Lata", "desc": "Coca, Guaraná ou Sprite", "price": 7.0, "photo_url": None, "available": True},
                {"id": 103, "name": "Cerveja Long Neck", "desc": "Pilsen gelada", "price": 12.0, "photo_url": None, "available": True}
            ]
        },
        {
            "id": 2, "name": "Porções", "order": 2, "active": True,
            "items": [
                {"id": 201, "name": "Batata Frita", "desc": "300g crocante", "price": 24.0, "photo_url": None, "available": True},
                {"id": 202, "name": "Frango à Passarinho", "desc": "400g temperado", "price": 38.0, "photo_url": None, "available": True}
            ]
        }
    ]
}

# ===== Persistência do cardápio (JSON) =====
def _menu_path(slug: str):
    return os.path.join(DATA_DIR, slug, "menu.json")

def load_menu(slug: str):
    path = _menu_path(slug)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        app.logger.warning(f"[menu] fallback usado para slug={slug}. Erro: {e}")
        fb = json.loads(json.dumps(FALLBACK_MENU))
        fb["tenant"]["slug"] = slug or DEFAULT_SLUG
        return fb

def save_menu(slug: str, menu: dict):
    path = _menu_path(slug)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(menu, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def item_index(menu):
    return {it["id"]: it for cat in (menu.get("categories") or []) for it in (cat.get("items") or [])}

def _next_ids(menu):
    cat_ids  = [int(c.get("id", 0)) for c in (menu.get("categories") or [])]
    item_ids = [int(it.get("id", 0)) for c in (menu.get("categories") or []) for it in (c.get("items") or [])]
    return (max(cat_ids or [0]) + 1, max(item_ids or [0]) + 1)

def _find_cat(menu, cat_id: int):
    for c in (menu.get("categories") or []):
        if int(c.get("id")) == int(cat_id):
            return c
    return None

def _find_item(menu, item_id: int):
    for c in (menu.get("categories") or []):
        for it in (c.get("items") or []):
            if int(it.get("id")) == int(item_id):
                return c, it
    return None, None

def get_slug_from_request():
    slug = (request.args.get("slug") or "").strip()
    if slug:
        return slug
    p = (request.path or "").strip("/")
    if p.startswith("c/"):
        return p.split("/", 1)[1]
    return DEFAULT_SLUG

# ===== Health =====
@app.get("/health")
def health():
    return jsonify(status="ok")

# ===== Frontend =====
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.get("/c/<slug>")
def client_slug(slug: str):
    return send_from_directory(FRONTEND_DIR, "index.html")

# Painel admin — tenta templates/, cai para frontend/ se não existir
@app.get("/admin")
@require_admin
def admin_page():
    tpl = Path(TEMPLATES_DIR) / "admin.html"
    if tpl.exists():
        return render_template("admin.html")
    return send_from_directory(FRONTEND_DIR, "admin.html")

@app.get("/admin-alerts")
@require_admin
def admin_alerts_minimal():
    tpl = Path(TEMPLATES_DIR) / "admin_alerts.html"
    if tpl.exists():
        return render_template("admin_alerts.html")
    return send_from_directory(FRONTEND_DIR, "admin_alerts.html")

# ===========================
# API: Cardápio (PUBLIC GET + ADMIN CRUD)
# ===========================
@app.get("/api/menu")
def api_menu():
    slug = get_slug_from_request()
    menu = load_menu(slug)
    return jsonify(menu)

# --- criar categoria ---
@app.post("/api/menu/categories")
@require_admin
def create_category():
    slug = get_slug_from_request()
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    name = (p.get("name") or "").strip()
    order = int(p.get("order") or 0)
    active = bool(p.get("active", True))
    if not name:
        abort(400, "campo 'name' é obrigatório")
    menu = load_menu(slug)
    next_cat_id, _ = _next_ids(menu)
    cat = {"id": next_cat_id, "name": name, "order": order, "active": active, "items": []}
    menu.setdefault("categories", []).append(cat)
    save_menu(slug, menu)
    return jsonify(cat), 201

# --- atualizar categoria ---
@app.patch("/api/menu/categories/<int:cat_id>")
@require_admin
def patch_category(cat_id: int):
    slug = get_slug_from_request()
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    menu = load_menu(slug)
    cat = _find_cat(menu, cat_id)
    if not cat:
        abort(404, "categoria não encontrada")
    if "name" in p:   cat["name"]   = (p.get("name") or "").strip()
    if "order" in p:  cat["order"]  = int(p.get("order") or 0)
    if "active" in p: cat["active"] = bool(p.get("active"))
    save_menu(slug, menu)
    return jsonify(cat)

# --- excluir categoria (e seus itens) ---
@app.delete("/api/menu/categories/<int:cat_id>")
@require_admin
def delete_category(cat_id: int):
    slug = get_slug_from_request()
    menu = load_menu(slug)
    cats = menu.get("categories") or []
    newcats = [c for c in cats if int(c.get("id")) != int(cat_id)]
    if len(newcats) == len(cats):
        abort(404, "categoria não encontrada")
    menu["categories"] = newcats
    save_menu(slug, menu)
    return jsonify({"ok": True, "deleted_category_id": cat_id})

# --- criar item (em uma categoria) ---
@app.post("/api/menu/items")
@require_admin
def create_item():
    slug = get_slug_from_request()
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    cat_id = int(p.get("category_id") or 0)
    name = (p.get("name") or "").strip()
    if not cat_id or not name:
        abort(400, "category_id e name são obrigatórios")
    desc = (p.get("desc") or "").strip()
    price = float(p.get("price") or 0.0)
    photo_url = (p.get("photo_url") or None)
    available = bool(p.get("available", True))
    menu = load_menu(slug)
    cat = _find_cat(menu, cat_id)
    if not cat:
        abort(404, "categoria não encontrada")
    _, next_item_id = _next_ids(menu)
    item = {
        "id": next_item_id,
        "name": name,
        "desc": desc,
        "price": price,
        "photo_url": photo_url,
        "available": available
    }
    cat.setdefault("items", []).append(item)
    save_menu(slug, menu)
    return jsonify(item), 201

# --- atualizar item ---
@app.patch("/api/menu/items/<int:item_id>")
@require_admin
def patch_item(item_id: int):
    slug = get_slug_from_request()
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    menu = load_menu(slug)
    cat, item = _find_item(menu, item_id)
    if not item:
        abort(404, "item não encontrado")
    # mover de categoria?
    if "category_id" in p:
        new_cat_id = int(p.get("category_id") or 0)
        if not new_cat_id:
            abort(400, "category_id inválido")
        new_cat = _find_cat(menu, new_cat_id)
        if not new_cat:
            abort(404, "nova categoria não encontrada")
        # remove do cat atual e adiciona no novo
        cat["items"] = [it for it in (cat.get("items") or []) if int(it.get("id")) != int(item_id)]
        new_cat.setdefault("items", []).append(item)
        cat = new_cat  # passa a referência
    if "name" in p:       item["name"] = (p.get("name") or "").strip()
    if "desc" in p:       item["desc"] = (p.get("desc") or "").strip()
    if "price" in p:      item["price"] = float(p.get("price") or 0.0)
    if "photo_url" in p:  item["photo_url"] = (p.get("photo_url") or None)
    if "available" in p:  item["available"] = bool(p.get("available"))
    save_menu(slug, menu)
    return jsonify(item)

# --- excluir item ---
@app.delete("/api/menu/items/<int:item_id>")
@require_admin
def delete_item(item_id: int):
    slug = get_slug_from_request()
    menu = load_menu(slug)
    for c in (menu.get("categories") or []):
        before = len(c.get("items") or [])
        c["items"] = [it for it in (c.get("items") or []) if int(it.get("id")) != int(item_id)]
        if len(c["items"]) != before:
            save_menu(slug, menu)
            return jsonify({"ok": True, "deleted_item_id": item_id})
    abort(404, "item não encontrado")

# --- reordenar (categorias ou itens de uma categoria) ---
@app.post("/api/menu/reorder")
@require_admin
def reorder_menu():
    """
    Body (um dos formatos):
    {"categories_order":[3,1,2]}
    {"category_id": 1, "items_order":[201,101,105]}
    """
    slug = get_slug_from_request()
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    menu = load_menu(slug)
    if "categories_order" in p:
        order = [int(x) for x in (p.get("categories_order") or [])]
        cats = {int(c.get("id")): c for c in (menu.get("categories") or [])}
        menu["categories"] = [cats[i] for i in order if i in cats] + [c for i,c in cats.items() if i not in order]
        # atualiza order numérico também
        for i, c in enumerate(menu["categories"], start=1):
            c["order"] = i
        save_menu(slug, menu)
        return jsonify({"ok": True, "scope": "categories"})
    cat_id = int(p.get("category_id") or 0)
    if cat_id and "items_order" in p:
        cat = _find_cat(menu, cat_id)
        if not cat:
            abort(404, "categoria não encontrada")
        order = [int(x) for x in (p.get("items_order") or [])]
        items = {int(it.get("id")): it for it in (cat.get("items") or [])}
        cat["items"] = [items[i] for i in order if i in items] + [it for i,it in items.items() if i not in order]
        save_menu(slug, menu)
        return jsonify({"ok": True, "scope": "items", "category_id": cat_id})
    abort(400, "payload inválido para reordenação")

# ===========================
# API: Meus Pedidos (público) / Admin Pedidos
# ===========================
@app.get("/api/my-orders")
def my_orders_by_table():
    slug = (request.args.get("slug") or "").strip() or DEFAULT_SLUG
    table = (request.args.get("table") or "").strip()
    if not table:
        abort(400, "parâmetro 'table' é obrigatório")
    orders = load_orders()
    data = [o for o in orders
            if o.get("tenant_slug") == slug
            and (o.get("table_code") or "").strip().lower() == table.lower()
            and _is_today_iso(o.get("created_at"))
            and (o.get("status") or "").lower() == "done"]
    def _key(o):
        try:
            return datetime.fromisoformat((o.get("created_at") or "").replace("Z",""))
        except Exception:
            return datetime.min
    data.sort(key=_key, reverse=True)
    parcial = 0.0
    slim = []
    for o in data:
        parcial += float(o.get("total") or 0)
        slim.append({
            "id": o.get("id"),
            "created_at": o.get("created_at"),
            "status": o.get("status"),
            "total": o.get("total"),
            "items": [{"name": it.get("name"), "qty": it.get("qty"), "line_total": it.get("line_total")} for it in (o.get("items") or [])]
        })
    return jsonify({"partial_total": parcial, "orders": slim})

@app.get("/api/orders")
@require_admin
def list_orders():
    slug = request.args.get("slug")
    orders = load_orders()
    if slug:
        orders = [o for o in orders if o.get("tenant_slug") == slug]
    return jsonify([_normalize_order_items(o) for o in orders])

@app.post("/api/orders")
def create_order():
    slug = get_slug_from_request()
    menu = load_menu(slug)
    idx = item_index(menu)
    if not request.is_json:
        abort(400, "JSON esperado")
    payload = request.get_json(silent=True) or {}
    table_code = (payload.get("table_code") or "").strip()
    customer_name = (payload.get("customer_name") or "").strip()
    items = payload.get("items") or []
    if not table_code:
        abort(400, "table_code é obrigatório")
    if not isinstance(items, list) or len(items) == 0:
        abort(400, "items deve ser lista não vazia")
    order_items, total = [], 0.0
    for raw in items:
        try:
            item_id = int(raw.get("id"))
            qty = int(raw.get("qty", 1))
            note = (raw.get("note") or "").strip()
        except Exception:
            abort(400, "formato inválido para item")
        if qty <= 0:
            abort(400, f"qty inválido para item {raw.get('id')}")
        ref = idx.get(item_id)
        if not ref or ref.get("available") is False:
            abort(400, f"item {item_id} indisponível")
        price = float(ref["price"])
        line_total = price * qty
        total += line_total
        order_items.append({
            "id": item_id, "name": ref["name"], "price": price,
            "qty": qty, "note": note, "line_total": line_total
        })
    orders = load_orders()
    order_id = (max((o.get("id", 0) for o in orders), default=0) + 1) if orders else 1
    order = {
        "id": order_id,
        "tenant_slug": slug,
        "table_code": table_code,
        "customer_name": customer_name or None,
        "status": "received",
        "items": order_items,
        "subtotal": total,
        "service_fee": 0.0,
        "total": total,
        "created_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "closed": False,
    }
    orders.append(order)
    save_orders(orders)
    return jsonify({"order_id": order_id, "status": order["status"], "total": order["total"]}), 201

@app.get("/api/orders/export.csv")
@require_admin
def export_orders_csv():
    import csv
    from io import StringIO
    slug = (request.args.get("slug") or "").strip() or DEFAULT_SLUG
    scope = (request.args.get("scope") or "today").strip().lower()  # today|all
    orders = load_orders()
    orders = [o for o in orders if o.get("tenant_slug") == slug]
    if scope != "all":
        orders = [o for o in orders if _is_today_iso(o.get("created_at"))]
    def _key(o):
        try:
            return datetime.fromisoformat((o.get("created_at") or "").replace("Z",""))
        except Exception:
            return datetime.min
    orders.sort(key=_key)
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id","created_at","table_code","customer_name","status",
        "items_count","subtotal","service_fee","total","closed","items_compact"
    ])
    for o in orders:
        items = o.get("items") or []
        items_compact = " | ".join([f'{it.get("qty","")}x {it.get("name","")} (= {it.get("line_total",0)})' for it in items])
        writer.writerow([
            o.get("id",""),
            o.get("created_at",""),
            o.get("table_code",""),
            o.get("customer_name",""),
            o.get("status",""),
            len(items),
            o.get("subtotal",0),
            o.get("service_fee",0),
            o.get("total",0),
            o.get("closed", False),
            items_compact
        ])
    csv_data = buf.getvalue()
    filename = f'orders_{slug}_{scope}.csv'
    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

VALID_STATUSES = ["received", "preparing", "delivering", "done", "cancelled"]

@app.patch("/api/orders/<int:order_id>")
@require_admin
def update_order(order_id: int):
    slug = request.args.get("slug")
    if not request.is_json:
        abort(400, "JSON esperado")
    payload = request.get_json(silent=True) or {}
    new_status = (payload.get("status") or "").strip().lower()
    if new_status not in VALID_STATUSES:
        abort(400, f"status inválido: {new_status}")
    orders = load_orders()
    for o in orders:
        if o.get("id") == order_id and (not slug or o.get("tenant_slug") == slug):
            o["status"] = new_status
            save_orders(orders)
            return jsonify(o)
    abort(404, "pedido não encontrado")

@app.post("/api/tabs/close")
@require_admin
def tabs_close():
    slug = (request.args.get("slug") or "").strip() or DEFAULT_SLUG
    data = request.get_json(silent=True) or {}
    table = (data.get("table") or "").strip()
    if not table:
        abort(400, "campo 'table' é obrigatório")
    orders = load_orders()
    total = 0.0
    affected = []
    for o in orders:
        if o.get("tenant_slug") == slug and _is_today_iso(o.get("created_at")) and (o.get("table_code") or "").strip().lower() == table.lower():
            total += float(o.get("total") or 0)
            affected.append(o.get("id"))
            o["closed"] = True
    save_orders(orders)
    return jsonify({
        "table": table,
        "slug": slug,
        "closed": True,
        "affected_ids": affected,
        "orders_count": len(affected),
        "total": total
    })

def get_service_fee_pct():
    try:
        return float(os.environ.get("SERVICE_FEE_PCT", "0") or 0.0)
    except Exception:
        return 0.0

@app.get("/api/config")
@require_admin
def get_config():
    return jsonify({
        "service_fee_pct": get_service_fee_pct()
    })

# ===== Assist/Close Requests (MVP in-memory) =====
ASSIST_CALLS = []            # {id, table_code, token, requested_at, status}
CLOSE_REQUESTS = []          # {id, table_code, token, requested_at, status}
ASSIST_ID_SEQ = itertools.count(1)
CLOSE_REQ_ID_SEQ = itertools.count(1)
LAST_ASSIST_BY_TABLE = {}    # table_code -> last_epoch

def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def get_assist_cooldown():
    try:
        return int(os.environ.get("ASSIST_COOLDOWN_SECONDS", "60"))
    except Exception:
        return 60

def resolve_table_from_payload(payload):
    table_code = (payload.get("table_code") or "").strip() if isinstance(payload, dict) else ""
    token = (payload.get("token") or "").strip() if isinstance(payload, dict) else ""
    if not table_code and token:
        table_code = token
    return table_code, token

@app.post("/api/assist")
def api_assist():
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    table_code, token = resolve_table_from_payload(p)
    if not table_code:
        abort(400, "table_code ou token obrigatório")
    now = time.time()
    cooldown = get_assist_cooldown()
    last = LAST_ASSIST_BY_TABLE.get(table_code, 0)
    if now - last < cooldown:
        remaining = int(cooldown - (now - last))
        return jsonify({"ok": False, "reason": "cooldown", "retry_in": remaining}), 429
    call_id = next(ASSIST_ID_SEQ)
    item = {"id": call_id, "table_code": table_code, "token": token or None, "requested_at": now_iso(), "status": "open"}
    ASSIST_CALLS.append(item)
    LAST_ASSIST_BY_TABLE[table_code] = now
    return jsonify({"ok": True, "assist_id": call_id, "cooldown": cooldown})

@app.post("/api/tabs/close-request")
def api_close_request():
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    table_code, token = resolve_table_from_payload(p)
    if not table_code:
        abort(400, "table_code ou token obrigatório")
    req_id = next(CLOSE_REQ_ID_SEQ)
    item = {"id": req_id, "table_code": table_code, "token": token or None, "requested_at": now_iso(), "status": "open"}
    CLOSE_REQUESTS.append(item)
    return jsonify({"ok": True, "request_id": req_id})

@app.get("/api/alerts")
@require_admin
def api_alerts():
    def filter_open(arr):
        return [x for x in arr if x.get("status")=="open"]
    return jsonify({"assist_calls": filter_open(ASSIST_CALLS), "close_requests": filter_open(CLOSE_REQUESTS), "now": now_iso()})

@app.post("/api/alerts/ack")
@require_admin
def api_alerts_ack():
    if not request.is_json: abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    typ = (p.get("type") or "").strip()  # "assist" | "close"
    rid = int(p.get("id") or 0)
    if typ not in ("assist","close") or rid<=0: abort(400, "type/id inválidos")
    arr = ASSIST_CALLS if typ=="assist" else CLOSE_REQUESTS
    for x in arr:
        if int(x.get("id")) == rid and x.get("status") == "open":
            x["status"] = "ack"
            x["ack_at"] = now_iso()
            return jsonify({"ok": True})
    return jsonify({"ok": False, "reason": "not_found_or_closed"}), 404

# ===== Debug admin env (temporário) =====
@app.get("/health/admin-env")
def admin_env_health():
    user = (os.environ.get("ADMIN_USER") or "").strip()
    has_pass = bool((os.environ.get("ADMIN_PASS") or "").strip())
    masked_user = (user[:2] + "***") if user else ""
    return jsonify(ok=True, admin_user=masked_user, has_admin_pass=has_pass)

# ===== ROTA TEMPORÁRIA DE DEBUG =====
@app.get("/admin-debug")
def admin_debug():
    if (os.environ.get("ADMIN_AUTH_BYPASS") or "").strip() != "1":
        if request.args.get("dev", "").strip() != (os.environ.get("ADMIN_USER") or "").strip():
            abort(401)
    slug = (request.args.get("slug") or "").strip()
    if not slug:
        abort(400, "slug é obrigatório")
    tpl = Path(TEMPLATES_DIR) / "admin.html"
    if tpl.exists():
        return render_template("admin.html")
    return send_from_directory(FRONTEND_DIR, "admin.html")

# --- helpers admin (itens/entrega) ---
def _normalize_order_items(order):
    try:
        for it in order.get("items", []):
            if "delivered_qty" not in it:
                it["delivered_qty"] = 0
    except Exception:
        pass
    return order

def _recompute_status(order):
    if (order.get("status") or "").lower() == "cancelled":
        return order["status"]
    items = order.get("items", [])
    if not items:
        order["status"] = "done"
        return order["status"]
    total_units = sum(int(i.get("qty",0)) for i in items)
    delivered   = sum(int(i.get("delivered_qty",0)) for i in items)
    if delivered <= 0:
        order["status"] = "received"
    elif delivered < total_units:
        order["status"] = "delivering"
    else:
        order["status"] = "done"
    return order["status"]

@app.patch("/api/orders/<int:order_id>/items/<int:item_id>/deliver")
@require_admin
def deliver_item(order_id:int, item_id:int):
    if not request.is_json:
        abort(400, "JSON esperado")
    p = request.get_json(silent=True) or {}
    qty_req = int(p.get("qty", 0) or 0)
    slug = (request.args.get("slug") or "").strip() or None
    orders = load_orders()
    found = None
    for o in orders:
        if o.get("id") == order_id and (not slug or o.get("tenant_slug") == slug):
            _normalize_order_items(o)
            for it in o.get("items", []):
                if int(it.get("id")) == int(item_id):
                    found = (o, it)
                    break
            break
    if not found:
        abort(404, "pedido/item não encontrado")
    order, item = found
    qty_total = int(item.get("qty", 0))
    qty_deliv = int(item.get("delivered_qty", 0))
    remaining = max(0, qty_total - qty_deliv)
    if remaining <= 0:
        return jsonify({"ok": True, "order": order})
    deliver_now = remaining if qty_req <= 0 or qty_req > remaining else qty_req
    item["delivered_qty"] = qty_deliv + deliver_now
    _recompute_status(order)
    save_orders(orders)
    return jsonify({"ok": True, "order": order, "delivered_item": {"id": item_id, "delivered_now": deliver_now, "remaining": qty_total - item["delivered_qty"]}})

# ===== MAIN =====
if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
