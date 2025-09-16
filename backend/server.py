import os
import json
import itertools
from flask import Flask, send_from_directory, jsonify, request, abort, Response

# Caminhos base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
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
@app.get("/api/orders/export.csv")
@require_admin
def export_orders_csv():
    import csv
    from io import StringIO

    slug = (request.args.get("slug") or "").strip() or DEFAULT_SLUG
    scope = (request.args.get("scope") or "today").strip().lower()  # today|all

    orders = load_orders()
    # filtra por tenant
    orders = [o for o in orders if o.get("tenant_slug") == slug]
    # escopo: só hoje por padrão
    if scope != "all":
        orders = [o for o in orders if _is_today_iso(o.get("created_at"))]

    # ordena por data
    def _key(o):
        try:
            return datetime.fromisoformat((o.get("created_at") or "").replace("Z",""))
        except Exception:
            return datetime.min
    orders.sort(key=_key)

    # monta CSV
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
import time
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
    # Usa table_code se vier explícito; senão tenta do token (MVP: token = mesa mesmo).
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

# 3) POST /api/tabs/close-request (cliente pede para fechar a conta)
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
    since = (request.args.get("since") or "").strip()
    def filter_open(arr):
        return [x for x in arr if x.get("status")=="open"]
    return jsonify({"assist_calls": filter_open(ASSIST_CALLS), "close_requests": filter_open(CLOSE_REQUESTS), "now": now_iso()})

# 5) POST /api/alerts/ack (admin) -> confirmar atendimento
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
    # mascara o usuário deixando só primeiros 2 chars
    masked_user = (user[:2] + "***") if user else ""
    return jsonify(ok=True, admin_user=masked_user, has_admin_pass=has_pass)


@app.get("/health/auth-received")
def _auth_received():
    ok = bool(request.headers.get("Authorization"))
    return jsonify(ok=ok)

@app.get("/health/auth-received")
def _auth_received():
    return jsonify(ok=bool(request.headers.get("Authorization")))
