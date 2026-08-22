# Architecture — PUB Shopee Scraper

## Diagrama de Fluxo

```
[ Client / Product API ]
          │
          ▼
   POST /v1/scrape/shop
          │
          ├──► Rate Limiter Check (60 req/min)
          │
          ├──► Request Validation (Domain / Limit / Identifiers)
          │
          ▼
 [ ShopeeProviderRouter ] (Associa requestId)
          │
          ├──► (1) ApifyShopeeProvider ──► Apify Actor (xtracto~shopee-shop-scraper) ──► ShopeeProduct[]
          │             │ (on failure / auth / timeout)
          │             ▼
          └──► (2) CloudflareShopeeProvider ──► Browser Run (page.on("response")) ──► ShopeeProduct[]
```

## Tratamento de Erros Estruturados
- `SHOPEE_INVALID_URL`
- `SHOPEE_SHOP_NOT_FOUND`
- `SHOPEE_PROVIDER_UNAVAILABLE`
- `SHOPEE_PROVIDER_AUTH_ERROR`
- `SHOPEE_RATE_LIMIT`
- `SHOPEE_EMPTY_CATALOG`
- `SHOPEE_ANTIFRAUD`
- `SHOPEE_INVALID_RESPONSE`
- `SHOPEE_TIMEOUT`
