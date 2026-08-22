import { IShopeeProvider } from "./IShopeeProvider";
import { ApifyShopeeProvider } from "./apify/ApifyShopeeProvider";
import { CloudflareShopeeProvider } from "./browser/CloudflareShopeeProvider";
import { Env, ShopeeErrorCode, ShopeeScraperError, ShopeeScrapeRequest, ShopeeScrapeResult } from "../types";
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

  async scrape(req: ShopeeScrapeRequest): Promise<ShopeeScrapeResult> {
    const startedAt = Date.now();
    const errors: string[] = [];

    const shopUrl = req.shopUrl;
    const shopUsername = req.shopUsername || (shopUrl ? extractFriendlyUsername(shopUrl) : null);
    const shopId = req.shopId || (shopUrl ? extractShopId(shopUrl) : null);

    let resolvedShop = {
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
        return {
          success: true,
          provider: "apify",
          shop: {
            shopId: apifyResult.shop.shopId || resolvedShop.shopId,
            username: apifyResult.shop.username || resolvedShop.username,
            name: apifyResult.shop.name || resolvedShop.name,
          },
          products: apifyResult.products,
          metadata: {
            provider: "apify",
            productsFound: apifyResult.products.length,
            executionTimeMs: apifyResult.executionTimeMs,
            costUsd: apifyResult.costUsd ?? null,
            fallbackUsed: false,
          },
          errors: [],
        };
      } catch (err) {
        apifyError = err instanceof Error ? err.message : String(err);
        errors.push(`[Apify Provider] ${apifyError}`);
      }
    } else {
      apifyError = "APIFY_TOKEN is not configured";
      errors.push(`[Apify Provider] ${apifyError}`);
    }

    // 2. Secondary / Fallback: Cloudflare Browser Run
    if (this.browserProvider) {
      try {
        const browserResult = await this.browserProvider.fetchCatalog(req);
        return {
          success: true,
          provider: "cloudflare-browser-run",
          shop: {
            shopId: browserResult.shop.shopId || resolvedShop.shopId,
            username: browserResult.shop.username || resolvedShop.username,
            name: browserResult.shop.name || resolvedShop.name,
          },
          products: browserResult.products,
          metadata: {
            provider: "cloudflare-browser-run",
            productsFound: browserResult.products.length,
            executionTimeMs: browserResult.executionTimeMs,
            fallbackUsed: true,
            apifyError,
            ...browserResult.metadata,
          },
          errors,
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
      },
      errors,
    };
  }
}
