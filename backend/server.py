import os
from flask import Flask, send_from_directory, jsonify

# Caminhos
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Flask serve arquivos estáticos diretamente da pasta "frontend"
# Ex.: /css/style.css, /js/app.js, /img/logo.png
app = Flask(
    __name__,
    static_folder=os.path.join(FRONTEND_DIR),
    static_url_path=""  # mapeia /css, /js, /img direto na raiz
)

@app.route("/health")
def health():
    return jsonify(status="ok")

# Raiz: entrega o index.html
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

# Multi-tenant: /c/<slug> também entrega o index.html (SPA simples)
@app.route("/c/<slug>")
def client_slug(slug: str):
    # No MVP, SPA carrega o mesmo index.html; JS depois resolve o slug
    return send_from_directory(FRONTEND_DIR, "index.html")

if __name__ == "__main__":
    # Execução local opcional. No Railway, o Procfile usa waitress-serve.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
