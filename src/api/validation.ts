import { ShopeeErrorCode, ShopeeScrapeRequest, ValidatedScrapeRequest } from "../types";
import { extractFriendlyUsername, extractShopId } from "../normalizers/shopeeProductNormalizer";

export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 100;
export const MIN_LIMIT = 1;
export const ALLOWED_HOSTS = new Set(["shopee.com.br"]);

export interface ValidationResult {
  valid: boolean;
  data?: ValidatedScrapeRequest;
  errorCode?: ShopeeErrorCode;
  errorMessage?: string;
}

export function isValidShopeeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_HOSTS.has(hostname) || hostname.endsWith(".shopee.com.br");
    if (!isAllowed) return false;
    if (parsed.pathname === "/" || parsed.pathname === "") return false;
    return true;
  } catch {
    return false;
  }
}

export function isValidUsername(username: string): boolean {
  if (typeof username !== "string") return false;
  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9_.-]+$/.test(trimmed);
}

export function isValidShopId(shopId: string): boolean {
  if (typeof shopId !== "string") return false;
  const trimmed = shopId.trim();
  return /^\d{4,16}$/.test(trimmed);
}

export function validateScrapeRequest(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      valid: false,
      errorCode: ShopeeErrorCode.INVALID_RESPONSE,
      errorMessage: "Request body must be a valid JSON object",
    };
  }

  const req = raw as Record<string, unknown>;

  let shopUrl: string | undefined;
  let shopUsername: string | undefined;
  let shopId: string | undefined;

  if (typeof req.shopUrl === "string" && req.shopUrl.trim()) {
    const trimmedUrl = req.shopUrl.trim();
    if (!isValidShopeeUrl(trimmedUrl)) {
      return {
        valid: false,
        errorCode: ShopeeErrorCode.INVALID_URL,
        errorMessage: "shopUrl must be a valid Shopee Brasil URL (e.g. https://shopee.com.br/username)",
      };
    }
    shopUrl = trimmedUrl;
  }

  if (typeof req.shopUsername === "string" && req.shopUsername.trim()) {
    const trimmedUsername = req.shopUsername.trim();
    if (!isValidUsername(trimmedUsername)) {
      return {
        valid: false,
        errorCode: ShopeeErrorCode.INVALID_URL,
        errorMessage: "shopUsername must be a valid alphanumeric Shopee username",
      };
    }
    shopUsername = trimmedUsername;
  }

  if (typeof req.shopId === "string" || typeof req.shopId === "number") {
    const trimmedShopId = String(req.shopId).trim();
    if (!isValidShopId(trimmedShopId)) {
      return {
        valid: false,
        errorCode: ShopeeErrorCode.INVALID_URL,
        errorMessage: "shopId must be a numeric string between 4 and 16 digits",
      };
    }
    shopId = trimmedShopId;
  }

  // Derive username/shopId from shopUrl if not explicitly provided
  if (shopUrl) {
    if (!shopUsername) {
      const extracted = extractFriendlyUsername(shopUrl);
      if (extracted) shopUsername = extracted;
    }
    if (!shopId) {
      const extracted = extractShopId(shopUrl);
      if (extracted) shopId = extracted;
    }
  }

  if (!shopUrl && !shopUsername && !shopId) {
    return {
      valid: false,
      errorCode: ShopeeErrorCode.INVALID_URL,
      errorMessage: "At least one valid identifier (shopUrl, shopUsername, or shopId) is required",
    };
  }

  // Validate limit
  let limit = DEFAULT_LIMIT;
  if (req.limit !== undefined && req.limit !== null) {
    const parsedLimit = Number(req.limit);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      return {
        valid: false,
        errorCode: ShopeeErrorCode.INVALID_RESPONSE,
        errorMessage: `limit must be a positive integer between ${MIN_LIMIT} and ${MAX_LIMIT}`,
      };
    }
    limit = Math.min(Math.max(Math.floor(parsedLimit), MIN_LIMIT), MAX_LIMIT);
  }

  return {
    valid: true,
    data: {
      shopUrl,
      shopUsername,
      shopId,
      country: "br",
      limit,
    },
  };
}
