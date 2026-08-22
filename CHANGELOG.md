# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-08-22 (Hardening V1)
### Added
- Request tracing with UUID `requestId` in JSON response and `x-request-id` response header.
- Strict input validation module (`src/api/validation.ts`) covering URL formats, limit bounds (1 to 100), and identifiers.
- In-memory sliding window rate limiter (`src/api/rateLimiter.ts`).
- Full unit test suite with 23 isolated tests across normalizer, validation, rate limiter, providers, and router.
- Dedicated security documentation (`docs/SECURITY.md`) explaining token management and rotation steps.
- Explicit handling of `SHOPEE_EMPTY_CATALOG` when a shop has 0 active listings.

### Fixed
- Removed hardcoded credentials in test files and updated `tests/live_test.cjs` to use environment variables.
- Prevented fallback triggering on client-side invalid requests (`SHOPEE_INVALID_URL`).

## [1.0.0] - 2026-08-22
### Added
- Initial project architecture and structure for `pub-shopee-scraper`.
- Standard API endpoints: `GET /health` and `POST /v1/scrape/shop`.
- Multi-provider architecture with `ShopeeProviderRouter`.
- Primary provider `ApifyShopeeProvider` using `xtracto~shopee-shop-scraper`.
- Fallback provider `CloudflareShopeeProvider` using Browser Run and network response interception.
- Product normalizer `shopeeProductNormalizer` with price conversion to BRL.
