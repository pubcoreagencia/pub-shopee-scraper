# PUB Shopee Scraper

Serviço independente e de alto desempenho para ingestão de catálogos de lojas públicas da Shopee Brasil, desenvolvido para a **PUB REC HOLDING**.

---

## 🚀 Arquitetura & Providers

O serviço opera com uma arquitetura multi-provider com roteamento e fallback automático:

1. **Primary Provider — Apify (`xtracto~shopee-shop-scraper`):** Ingestão rápida e confiável via API especializada de catálogo sem necessidade de proxy local ou credenciais de conta Shopee.
2. **Fallback Provider — Cloudflare Browser Run (@cloudflare/playwright):** Resolução nativa de friendly URLs via network listener (`/api/v4/shop/get_shop_base_v2` -> `ShopID`) executada diretamente no Cloudflare Workers.

---

## 📦 Contrato da API

### Healthcheck
```http
GET /health
```
```json
{
  "ok": true,
  "service": "pub-shopee-scraper",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Ingestão de Loja
```http
POST /v1/scrape/shop
Authorization: Bearer <SHOPEE_SCRAPER_TOKEN>
Content-Type: application/json
```

**Payload de entrada:**
```json
{
  "shopUrl": "https://shopee.com.br/9r18ht6m88",
  "limit": 100
}
```
*Também suporta:* `{"shopUsername": "9r18ht6m88", "limit": 100}` ou `{"shopId": "1729928484", "limit": 100}`.

**Resposta padronizada (`ShopeeScrapeResult`):**
```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "apify",
  "shop": {
    "shopId": "1729928484",
    "username": "9r18ht6m88",
    "name": "Zentta Babuche"
  },
  "products": [
    {
      "itemId": "23299366739",
      "shopId": "1729928484",
      "title": "Babuche Infantil EVA com Apliques Decorativos",
      "price": 40.32,
      "originalPrice": null,
      "stock": null,
      "sku": null,
      "images": ["https://down-br.img.susercontent.com/file/sg-..."],
      "category": null,
      "sellerName": "Zentta Babuche",
      "productUrl": "https://shopee.com.br/...",
      "metadata": { ... }
    }
  ],
  "metadata": {
    "provider": "apify",
    "productsFound": 1,
    "executionTimeMs": 8120,
    "costUsd": 0.04,
    "fallbackUsed": false,
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "errors": []
}
```

---

## 🛡️ Erros Estruturados (`ShopeeErrorCode`)

- `SHOPEE_INVALID_URL` — URL malformada, protocolo inválido ou fora do domínio Shopee Brasil.
- `SHOPEE_SHOP_NOT_FOUND` — Loja inexistente ou ShopID não encontrado.
- `SHOPEE_PROVIDER_UNAVAILABLE` — Provider temporariamente indisponível.
- `SHOPEE_PROVIDER_AUTH_ERROR` — Falha de autenticação ou token ausente/inválido.
- `SHOPEE_RATE_LIMIT` — Limite de requisições por minuto excedido (HTTP 429).
- `SHOPEE_EMPTY_CATALOG` — Loja encontrada mas sem anúncios ativos no catálogo.
- `SHOPEE_ANTIFRAUD` — Desafio de antifraude ou login wall detectado.
- `SHOPEE_INVALID_RESPONSE` — Payload de resposta malformado ou inválido.
- `SHOPEE_TIMEOUT` — Tempo limite de requisição excedido.

---

## 🛠️ Comandos

```bash
# Instalar dependências
npm install

# Executar testes unitários (completamente isolados, sem chamadas externas)
npm test

# Validar tipagem TypeScript
npm run typecheck

# Validar build do Worker
npm run build

# Deploy no Cloudflare Workers
npm run deploy
```
