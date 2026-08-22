# Project Context — PUB Shopee Scraper

## Visão Geral
`pub-shopee-scraper` é um microserviço autônomo da **PUB REC HOLDING** responsável por extrair catálogos de produtos de lojas públicas da Shopee Brasil.

## Princípios de Design
1. **Domínio Limpo:** O produto não possui acoplamento com PUB ECOM, Supabase ou estruturas específicas de outros produtos.
2. **Multi-Provider com Fallback:**
   - **Primary:** Apify `xtracto~shopee-shop-scraper` via API oficial.
   - **Fallback:** Cloudflare Browser Run (@cloudflare/playwright) com resolução nativa de rede (`get_shop_base_v2`).
3. **Observabilidade Total & Rastreabilidade:** Cada execução conta com `requestId` UUIDv4 emitido na resposta e headers HTTP `x-request-id`.
4. **Resiliência e Proteção:** Rate limiting nativo em memória e validação estrita de URLs de entrada.
5. **Segurança Rigorosa:** Chaves e tokens (`APIFY_TOKEN`, `SHOPEE_SCRAPER_TOKEN`) nunca são salvos em versionamento ou expostos em logs/responses.
