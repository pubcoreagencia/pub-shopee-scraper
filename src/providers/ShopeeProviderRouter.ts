import { IShopeeProvider } from "./IShopeeProvider";
import { ApifyShopeeProvider } from "./apify/ApifyShopeeProvider";
import { CloudflareShopeeProvider } from "./browser/CloudflareShopeeProvider";
import { Env, ShopeeErrorCode, ShopeeScraperError, ShopeeScrapeResult, ValidatedScrapeRequest } from "../types";
import { extractFriendlyUsername, extractShopId } from "../normalizers/shopeeProductNormalizer";

export class ShopeeProviderRouter {
  private readonly apifyProvider: ApifyShopeeProvider | null = null;
  private readonly browserProvider: CloudflareShopeeProvider | null = null;

  constructor(env: Env) {
    if (env.APIFY_TOKEN && env.APIFY_TOKEN.trim()) {
      this.apifyProvider = new ApifyShopeeProvider(env.APIFY_TOKEN.trim());
    }
    if (env.BROWSER) {
      this.browserProvider = new CloudflareShopeeProvider(env.BROWSER);
    }
  }

  async scrape(req: ValidatedScrapeRequest, requestId: string): Promise<ShopeeScrapeResult> {
    const startedAt = Date.now();
    const errors: string[] = [];

    const shopUrl = req.shopUrl;
    const shopUsername = req.shopUsername || (shopUrl ? extractFriendlyUsername(shopUrl) : null);
    const shopId = req.shopId || (shopUrl ? extractShopId(shopUrl) : null);

    const resolvedShop = {
      shopId: shopId ?? null,
      username: shopUsername ?? null,
      name: null as string | null,
    };

    let apifyError: string | null = null;
    let browserError: string | null = null;

    // 1. Primary: Apify
    if (this.apifyProvider) {
      try {
        const apifyResult = await this.apifyProvider.fetchCatalog(req);
        const shop = {
          shopId: apifyResult.shop.shopId || resolvedShop.shopId,
          username: apifyResult.shop.username || resolvedShop.username,
          name: apifyResult.shop.name || resolvedShop.name,
        };

        const resultErrors: string[] = [];
        if (apifyResult.products.length === 0) {
          resultErrors.push(`[${ShopeeErrorCode.EMPTY_CATALOG}] No active products found in the shop catalog`);
        }

        return {
          success: true,
          requestId,
          provider: "apify",
          shop,
          products: apifyResult.products,
          metadata: {
            provider: "apify",
            productsFound: apifyResult.products.length,
            executionTimeMs: apifyResult.executionTimeMs,
            costUsd: apifyResult.costUsd ?? null,
            fallbackUsed: false,
            requestId,
          },
          errors: resultErrors,
        };
      } catch (err) {
        if (err instanceof ShopeeScraperError && err.code === ShopeeErrorCode.INVALID_URL) {
          // Client error: do not attempt fallback
          return {
            success: false,
            requestId,
            provider: "none",
            shop: resolvedShop,
            products: [],
            metadata: {
              provider: "none",
              productsFound: 0,
              executionTimeMs: Date.now() - startedAt,
              fallbackUsed: false,
              requestId,
            },
            errors: [err.message],
          };
        }

        apifyError = err instanceof Error ? err.message : String(err);
        errors.push(`[Apify Provider] ${apifyError}`);
      }
    } else {
      apifyError = "APIFY_TOKEN is not configured in environment";
      errors.push(`[Apify Provider] ${apifyError}`);
    }

    // 2. Secondary / Fallback: Cloudflare Browser Run
    if (this.browserProvider) {
      try {
        const browserResult = await this.browserProvider.fetchCatalog(req);
        const shop = {
          shopId: browserResult.shop.shopId || resolvedShop.shopId,
          username: browserResult.shop.username || resolvedShop.username,
          name: browserResult.shop.name || resolvedShop.name,
        };

        const resultErrors: string[] = [...errors];
        if (browserResult.products.length === 0) {
          resultErrors.push(`[${ShopeeErrorCode.EMPTY_CATALOG}] No active products found via browser search`);
        }

        return {
          success: true,
          requestId,
          provider: "cloudflare-browser-run",
          shop,
          products: browserResult.products,
          metadata: {
            provider: "cloudflare-browser-run",
            productsFound: browserResult.products.length,
            executionTimeMs: browserResult.executionTimeMs,
            fallbackUsed: true,
            apifyError,
            requestId,
            ...browserResult.metadata,
          },
          errors: resultErrors,
        };
      } catch (err) {
        browserError = err instanceof Error ? err.message : String(err);
        errors.push(`[Browser Provider Fallback] ${browserError}`);
      }
    } else {
      browserError = "Cloudflare Browser Run binding not configured";
      errors.push(`[Browser Provider Fallback] ${browserError}`);
    }

    // 3. All providers exhausted
    return {
      success: false,
      requestId,
      provider: "none",
      shop: resolvedShop,
      products: [],
      metadata: {
        provider: "none",
        productsFound: 0,
        executionTimeMs: Date.now() - startedAt,
        fallbackUsed: true,
        apifyError,
        browserError,
        requestId,
      },
      errors,
    };
  }
}
