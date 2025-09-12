import os
from flask import Flask, send_from_directory, jsonify

# Caminhos
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# App Flask serve o frontend estático (um serviço só no Railway)
app = Flask(
    __name__,
    static_folder=os.path.join(FRONTEND_DIR),
    static_url_path=""  # expõe /css, /js, /img direto na raiz
)

# Healthcheck JSON
@app.get("/health")
def health():
    return jsonify(status="ok")

# Raiz -> index.html
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

# Multi-tenant SPA -> também index.html (JS lê o slug)
@app.get("/c/<slug>")
def client_slug(slug: str):
    return send_from_directory(FRONTEND_DIR, "index.html")

# ===== API (MVP) =====
# Cardápio mockado (estático) — estrutura compatível com o que definimos
@app.get("/api/menu")
def api_menu():
    data = {
        "tenant": {
            "slug": "bar-do-netto",
            "name": "Bar do Netto",
            "open": True,
            "pix_key": None,
        },
        "categories": [
            {
                "id": 1,
                "name": "Bebidas",
                "order": 1,
                "active": True,
                "items": [
                    {
                        "id": 101,
                        "name": "Água Mineral 500ml",
                        "desc": "Sem gás",
                        "price": 4.0,
                        "photo_url": None,
                        "available": True
                    },
                    {
                        "id": 102,
                        "name": "Refrigerante Lata",
                        "desc": "Coca, Guaraná ou Sprite",
                        "price": 7.0,
                        "photo_url": None,
                        "available": True
                    },
                    {
                        "id": 103,
                        "name": "Cerveja Long Neck",
                        "desc": "Pilsen gelada",
                        "price": 12.0,
                        "photo_url": None,
                        "available": True
                    }
                ]
            },
            {
                "id": 2,
                "name": "Porções",
                "order": 2,
                "active": True,
                "items": [
                    {
                        "id": 201,
                        "name": "Batata Frita",
                        "desc": "300g crocante",
                        "price": 24.0,
                        "photo_url": None,
                        "available": True
                    },
                    {
                        "id": 202,
                        "name": "Frango à Passarinho",
                        "desc": "400g temperado",
                        "price": 38.0,
                        "photo_url": None,
                        "available": True
                    }
                ]
            }
        ]
    }
    return jsonify(data)

if __name__ == "__main__":
    # Execução local opcional; no Railway usamos o Procfile + waitress.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
