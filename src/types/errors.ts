export enum ShopeeErrorCode {
  INVALID_URL = "SHOPEE_INVALID_URL",
  SHOP_NOT_FOUND = "SHOPEE_SHOP_NOT_FOUND",
  PROVIDER_UNAVAILABLE = "SHOPEE_PROVIDER_UNAVAILABLE",
  PROVIDER_AUTH_ERROR = "SHOPEE_PROVIDER_AUTH_ERROR",
  RATE_LIMIT = "SHOPEE_RATE_LIMIT",
  EMPTY_CATALOG = "SHOPEE_EMPTY_CATALOG",
  ANTIFRAUD = "SHOPEE_ANTIFRAUD",
  INVALID_RESPONSE = "SHOPEE_INVALID_RESPONSE",
  TIMEOUT = "SHOPEE_TIMEOUT",
}

export class ShopeeScraperError extends Error {
  readonly code: ShopeeErrorCode;
  readonly details?: unknown;

  constructor(code: ShopeeErrorCode, message: string, details?: unknown) {
    super(`[${code}] ${message}`);
    this.code = code;
    this.details = details;
    this.name = "ShopeeScraperError";
  }
}
