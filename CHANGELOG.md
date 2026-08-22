# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-08-22
### Added
- Initial project architecture and structure for `pub-shopee-scraper`.
- Standard API endpoints: `GET /health` and `POST /v1/scrape/shop`.
- Multi-provider architecture with `ShopeeProviderRouter`.
- Primary provider `ApifyShopeeProvider` using `xtracto~shopee-shop-scraper`.
- Fallback provider `CloudflareShopeeProvider` using Browser Run and network response interception.
- Product normalizer `shopeeProductNormalizer` with price conversion to BRL.
- TypeScript domain types and structured error codes (`ShopeeErrorCode`).
