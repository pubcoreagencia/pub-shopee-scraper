import { Env, ShopeeErrorCode, ShopeeScrapeResult } from "../types";
import { ShopeeProviderRouter } from "../providers/ShopeeProviderRouter";
import { validateScrapeRequest } from "./validation";
import { globalRateLimiter } from "./rateLimiter";

function isAuthorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const validTokens = [env.SHOPEE_SCRAPER_TOKEN, env.CATALOG_WORKER_TOKEN].filter(Boolean);
  if (validTokens.length === 0) return true;
  return validTokens.some((t) => auth === `Bearer ${t}`);
}

function getClientIdentifier(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

export async function handleScrapeShop(request: Request, env: Env, requestId: string): Promise<Response> {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
  };

  // 1. Rate Limiting Check
  const clientId = getClientIdentifier(request);
  const rateCheck = globalRateLimiter.isAllowed(clientId);
  if (!rateCheck.allowed) {
    const retrySec = Math.ceil(rateCheck.resetMs / 1000);
    return new Response(
      JSON.stringify({
        success: false,
        requestId,
        provider: "none",
        shop: { shopId: null, username: null, name: null },
        products: [],
        metadata: {
          provider: "none",
          productsFound: 0,
          executionTimeMs: 0,
          requestId,
        },
        errors: [`[${ShopeeErrorCode.RATE_LIMIT}] Rate limit exceeded. Please retry in ${retrySec} seconds.`],
      } satisfies ShopeeScrapeResult),
      {
        status: 429,
        headers: {
          ...headers,
          "retry-after": String(retrySec),
        },
      }
    );
  }

  // 2. Authentication Check
  if (!isAuthorized(request, env)) {
    return new Response(
      JSON.stringify({
        success: false,
        requestId,
        provider: "none",
        shop: { shopId: null, username: null, name: null },
        products: [],
        metadata: {
          provider: "none",
          productsFound: 0,
          executionTimeMs: 0,
          requestId,
        },
        errors: [`[${ShopeeErrorCode.PROVIDER_AUTH_ERROR}] Unauthorized access`],
      } satisfies ShopeeScrapeResult),
      { status: 401, headers }
    );
  }

  // 3. Body Parsing Check
  let rawJson: unknown;
  try {
    rawJson = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        requestId,
        provider: "none",
        shop: { shopId: null, username: null, name: null },
        products: [],
        metadata: {
          provider: "none",
          productsFound: 0,
          executionTimeMs: 0,
          requestId,
        },
        errors: [`[${ShopeeErrorCode.INVALID_RESPONSE}] Invalid or malformed JSON in request body`],
      } satisfies ShopeeScrapeResult),
      { status: 400, headers }
    );
  }

  // 4. Request Validation
  const validation = validateScrapeRequest(rawJson);
  if (!validation.valid || !validation.data) {
    return new Response(
      JSON.stringify({
        success: false,
        requestId,
        provider: "none",
        shop: { shopId: null, username: null, name: null },
        products: [],
        metadata: {
          provider: "none",
          productsFound: 0,
          executionTimeMs: 0,
          requestId,
        },
        errors: [`[${validation.errorCode || ShopeeErrorCode.INVALID_URL}] ${validation.errorMessage || "Validation failed"}`],
      } satisfies ShopeeScrapeResult),
      { status: 400, headers }
    );
  }

  // 5. Execution via Provider Router
  const router = new ShopeeProviderRouter(env);
  const result = await router.scrape(validation.data, requestId);

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 502,
    headers,
  });
}
