import os
import json
from datetime import datetime
from flask import Flask, send_from_directory, jsonify, request, abort

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

# ===== Persistência pedidos (JSON) =====
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

def next_order_id(orders):
    return (max((o.get("id", 0) for o in orders), default=0) + 1) if orders else 1

# ===== Menu por tenant (arquivo) =====
def load_menu(slug: str):
    path = os.path.join(DATA_DIR, slug, "menu.json")
    if not os.path.exists(path):
        abort(404, f"menu não encontrado para slug '{slug}'")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

def item_index(menu):
    return {it["id"]: it for cat in (menu.get("categories") or []) for it in (cat.get("items") or [])}

def get_slug_from_request():
    # 1) query ?slug=  2) se URL começa com /c/<slug>, usa esse  3) default
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
def admin():
    return send_from_directory(FRONTEND_DIR, "admin.html")

# ===== API =====
@app.get("/api/menu")
def api_menu():
    slug = get_slug_from_request()
    menu = load_menu(slug)
    return jsonify(menu)

@app.get("/api/orders")
def list_orders():
    slug = request.args.get("slug")
    orders = load_orders()
    if slug:
        orders = [o for o in orders if o.get("tenant_slug") == slug]
    return jsonify(orders)

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

    # valida e reprecifica
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
    order_id = next_order_id(orders)
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
    }
    orders.append(order)
    save_orders(orders)
    return jsonify({"order_id": order_id, "status": order["status"], "total": order["total"]}), 201

VALID_STATUSES = ["received", "preparing", "delivering", "done", "cancelled"]

@app.patch("/api/orders/<int:order_id>")
def update_order(order_id: int):
    slug = request.args.get("slug")  # opcional: restringe tenant
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
