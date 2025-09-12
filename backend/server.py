import os
import json
import base64
from datetime import datetime
from flask import Flask, send_from_directory, jsonify, request, abort, Response

# Caminhos
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DB_DIR = os.path.join(BASE_DIR, "db")
DATA_DIR = os.path.join(BASE_DIR, "data")
ORDERS_FILE = os.path.join(DB_DIR, "orders.json")
DEFAULT_SLUG = "bar-do-netto"

app = Flask(
    __name__,
    static_folder=os.path.join(FRONTEND_DIR),
    static_url_path=""
)

# ===========================
# Auth (HTTP Basic)
# ===========================
ADMIN_USER = os.environ.get("ADMIN_USER") or "admin"
ADMIN_PASS = os.environ.get("ADMIN_PASS") or "changeme"

def _unauthorized():
    return Response(status=401, headers={"WWW-Authenticate": 'Basic realm="Admin"'})

def _parse_basic_auth():
    h = request.headers.get("Authorization", "")
    if not h.lower().startswith("basic "):
        return None, None
    try:
        raw = base64.b64decode(h.split(" ", 1)[1]).decode("utf-8")
        user, pwd = raw.split(":", 1)
        return user, pwd
    except Exception:
        return None, None

def require_admin(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user, pwd = _parse_basic_auth()
        if user == ADMIN_USER and pwd == ADMIN_PASS:
            return fn(*args, **kwargs)
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

def load_menu(slug: str):
    path = os.path.join(DATA_DIR, slug, "menu.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        app.logger.warning(f"[menu] fallback usado para slug={slug}. Erro: {e}")
        fb = json.loads(json.dumps(FALLBACK_MENU))
        fb["tenant"]["slug"] = slug or DEFAULT_SLUG
        return fb

def item_index(menu):
    return {it["id"]: it for cat in (menu.get("categories") or []) for it in (cat.get("items") or [])}

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

@app.get("/admin")
@require_admin
def admin():
    return send_from_directory(FRONTEND_DIR, "admin.html")

# ===== API =====
@app.get("/api/menu")
def api_menu():
    slug = get_slug_from_request()
    menu = load_menu(slug)
    return jsonify(menu)

# Histórico público da mesa (dia atual)
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
            and _is_today_iso(o.get("created_at"))]

    def _key(o):
        try:
            return datetime.fromisoformat((o.get("created_at") or "").replace("Z",""))
        except Exception:
            return datetime.min
    data.sort(key=_key, reverse=True)

    slim = []
    for o in data:
        slim.append({
            "id": o.get("id"),
            "created_at": o.get("created_at"),
            "status": o.get("status"),
            "total": o.get("total"),
            "items": [{"name": it.get("name"), "qty": it.get("qty"), "line_total": it.get("line_total")} for it in (o.get("items") or [])]
        })
    return jsonify(slim)

# Admin-only: listar pedidos
@app.get("/api/orders")
@require_admin
def list_orders():
    slug = request.args.get("slug")
    orders = load_orders()
    if slug:
        orders = [o for o in orders if o.get("tenant_slug") == slug]
    return jsonify(orders)

# Público: criar pedido
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
        "closed": False,  # <— importante para “Fechar conta”
    }
    orders.append(order)
    save_orders(orders)
    return jsonify({"order_id": order_id, "status": order["status"], "total": order["total"]}), 201

@app.get("/api/tabs/summary")
@require_admin
def tabs_summary():
    slug = (request.args.get("slug") or "").strip() or DEFAULT_SLUG
    orders = [o for o in load_orders() if o.get("tenant_slug") == slug and _is_today_iso(o.get("created_at"))]

    tables = {}
    for o in orders:
        mesa = (o.get("table_code") or "-").strip()
        t = tables.setdefault(mesa, {"table": mesa, "total": 0.0, "count": 0, "closed": True})
        t["total"] += float(o.get("total") or 0)
        t["count"] += 1
        if not o.get("closed", False):
            t["closed"] = False

    result = sorted(tables.values(), key=lambda x: x["table"])
    return jsonify(result)
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)

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
