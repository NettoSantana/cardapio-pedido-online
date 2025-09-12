import os
import itertools
from flask import Flask, send_from_directory, jsonify, request, abort

# Caminhos
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# App Flask serve o frontend estático (um serviço só no Railway)
app = Flask(
    __name__,
    static_folder=os.path.join(FRONTEND_DIR),
    static_url_path=""  # expõe /css, /js, /img direto na raiz
)

# ===== Mock de dados (MVP) =====
MENU = {
    "tenant": {"slug": "bar-do-netto", "name": "Bar do Netto", "open": True, "pix_key": None},
    "categories": [
        {
            "id": 1, "name": "Bebidas", "order": 1, "active": True,
            "items": [
                {"id": 101, "name": "Água Mineral 500ml", "desc": "Sem gás", "price": 4.0, "photo_url": None, "available": True},
                {"id": 102, "name": "Refrigerante Lata", "desc": "Coca, Guaraná ou Sprite", "price": 7.0, "photo_url": None, "available": True},
                {"id": 103, "name": "Cerveja Long Neck", "desc": "Pilsen gelada", "price": 12.0, "photo_url": None, "available": True},
            ],
        },
        {
            "id": 2, "name": "Porções", "order": 2, "active": True,
            "items": [
                {"id": 201, "name": "Batata Frita", "desc": "300g crocante", "price": 24.0, "photo_url": None, "available": True},
                {"id": 202, "name": "Frango à Passarinho", "desc": "400g temperado", "price": 38.0, "photo_url": None, "available": True},
            ],
        },
    ],
}

# Índice rápido de itens por id para validação/repreço
ITEM_INDEX = {it["id"]: it for cat in MENU["categories"] for it in cat["items"]}

# “banco” em memória (MVP)
ORDERS = []
ORDER_ID_SEQ = itertools.count(1)

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
    # MVP: entrega o mesmo index.html para SPA
    return send_from_directory(FRONTEND_DIR, "index.html")

# ===== API =====
@app.get("/api/menu")
def api_menu():
    return jsonify(MENU)

@app.get("/api/orders")
def list_orders():
    # simples para inspeção (sem paginação/autenticação no MVP)
    return jsonify(ORDERS)

@app.post("/api/orders")
def create_order():
    """
    Espera JSON:
    {
      "table_code": "M01",
      "customer_name": "Netto",     (opcional)
      "items": [ {"id":101, "qty":2, "note":"sem gelo?"}, ... ]
    }
    """
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
    order_items = []
    total = 0.0
    for raw in items:
        try:
            item_id = int(raw.get("id"))
            qty = int(raw.get("qty", 1))
            note = (raw.get("note") or "").strip()
        except Exception:
            abort(400, "formato inválido para item")

        if qty <= 0:
            abort(400, f"qty inválido para item {item_id}")

        ref = ITEM_INDEX.get(item_id)
        if not ref or ref.get("available") is False:
            abort(400, f"item {item_id} indisponível")

        price = float(ref["price"])
        line_total = price * qty
        total += line_total

        order_items.append({
            "id": item_id,
            "name": ref["name"],
            "price": price,
            "qty": qty,
            "note": note,
            "line_total": line_total,
        })

    order_id = next(ORDER_ID_SEQ)
    order = {
        "id": order_id,
        "tenant_slug": MENU["tenant"]["slug"],
        "table_code": table_code,
        "customer_name": customer_name or None,
        "status": "received",  # received -> preparing -> delivering -> done
        "items": order_items,
        "subtotal": total,
        "service_fee": 0.0,    # placeholder
        "total": total,        # subtotal + taxas (MVP)
    }
    ORDERS.append(order)

    return jsonify({
        "order_id": order_id,
        "status": order["status"],
        "total": order["total"],
    }), 201

if __name__ == "__main__":
    # Execução local opcional; no Railway usamos o Procfile + waitress.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
