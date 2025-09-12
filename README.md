# 🍽️ Cardápio/Pedido Online

## 📖 Visão Geral
Sistema simples e replicável para **bares, restaurantes e motéis**, onde o cliente acessa via **QR Code ou link**, visualiza o **cardápio responsivo** e faz o **pedido online**, sem necessidade de instalar aplicativos ou usar WhatsApp.  

O pedido é processado diretamente pelo **WebApp** e chega em tempo real no **painel do estabelecimento**, onde a equipe pode acompanhar, atualizar o status e gerenciar o cardápio.

---

## 🎯 Objetivo
- Eliminar papel e pedidos manuais.  
- Criar uma solução **acessível e rápida de replicar** para múltiplos clientes.  
- Permitir que cada cliente tenha seu **próprio cardápio e link exclusivo**.  
- Oferecer uma **experiência fluida** tanto para o cliente quanto para o staff.  

---

## ⚙️ Funcionalidades (MVP)

### Cliente (mesa/quarto)
- Acesso via QR/Link.  
- Cardápio em categorias (foto, descrição, preço).  
- Carrinho de compras com observações.  
- Envio de pedido com identificação da mesa/quarto.  
- Acompanhamento de status: **Recebido → Em preparo → A caminho → Concluído**.  
- Pagamento: **PIX manual** (QR fixo configurado pelo estabelecimento).  

### Estabelecimento (painel web)
- Login staff (usuário/senha simples).  
- Dashboard de pedidos em tempo real (fila com alerta sonoro).  
- Mudança de status do pedido.  
- Gerenciamento do cardápio (CRUD de categorias/itens).  
- Controle de mesas/quartos (gerar QRs por mesa).  
- Abrir/fechar loja (exibir aviso “Fechado” no cardápio).  

### Multi-clientes
- Estrutura multi-tenant isolada por **slug**:  

- Cada cliente tem cardápio, pedidos e painel independentes.  

---

## 🧱 Stack Técnica
- **Backend:** Python (Flask).  
- **Banco de dados:** SQLite (MVP) → Postgres na escalada.  
- **Frontend:** HTML + Tailwind + JS (leve).  
- **Autenticação staff:** Flask-Login com sessão simples.  
- **Deploy:** Railway (Nixpacks) com build da branch `main`.  
- **Armazenamento de imagens:** local (MVP) → S3/Cloudflare futuramente.  

---

## 🗂️ Estrutura de Dados
- `tenants`: estabelecimentos.  
- `tables`: mesas/quartos.  
- `categories`: categorias de cardápio.  
- `items`: produtos (nome, preço, descrição, foto, disponibilidade).  
- `orders`: pedidos (mesa, status, total, cliente).  
- `order_items`: itens do pedido (quantidade, observação).  
- `store_settings`: configurações (aberto/fechado, chave PIX, mensagem de fechado).  

---

## 📡 Comunicação em Tempo Real
- MVP: **polling leve** (3–5s) para atualizar pedidos.  
- Futuro: **WebSockets ou SSE**.  
- Alertas visuais e sonoros no painel ao receber novo pedido.  

---

## 📈 Roadmap Futuro
1. **Impressão direta** (suporte ESC/POS para cozinha/garçom).  
2. **PIX dinâmico integrado** (Mercado Pago, Pagar.me, Stripe).  
3. **Relatórios avançados** (gráficos, exportação).  
4. **Usuários por função** (cozinha, caixa, garçom).  
5. **Customização por cliente** (logo, cores, subdomínio próprio).  

---

## 💵 Modelo de Negócio
- Assinatura mensal por cliente (**R$ 79–149** no MVP).  
- Add-ons pagos: PIX integrado, impressão automática, relatórios avançados.  
