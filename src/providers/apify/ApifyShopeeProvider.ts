import { IShopeeProvider, ShopeeProviderResult } from "../IShopeeProvider";
import { ShopeeErrorCode, ShopeeScraperError, ShopeeScrapeRequest } from "../../types";
import { extractFriendlyUsername, extractShopId, normalizeApifyItem } from "../../normalizers/shopeeProductNormalizer";

export class ApifyShopeeProvider implements IShopeeProvider {
  readonly name = "apify" as const;
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async fetchCatalog(req: ShopeeScrapeRequest): Promise<ShopeeProviderResult> {
    const startedAt = Date.now();

    if (!this.token || !this.token.trim()) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.PROVIDER_AUTH_ERROR,
        "APIFY_TOKEN is missing or not configured in environment"
      );
    }

    const target = req.shopUsername || req.shopUrl || req.shopId;
    if (!target) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.INVALID_URL,
        "Neither shopUrl, shopUsername, nor shopId was provided"
      );
    }

    const shopUsername = req.shopUsername || (req.shopUrl ? extractFriendlyUsername(req.shopUrl) : null);
    const shopTarget = shopUsername || (req.shopUrl ? req.shopUrl : req.shopId!);
    const actorId = "xtracto~shopee-shop-scraper";

    const body = {
      shop: shopTarget,
      country: req.country || "br",
      maxProducts: req.limit || 100,
      fetchDetail: false,
      delay: 1,
    };

    let runRes: Response;
    try {
      runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?waitForFinish=120`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.TIMEOUT,
        `Network error initiating Apify Actor run: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (runRes.status === 401 || runRes.status === 403) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.PROVIDER_AUTH_ERROR,
        `Invalid or unauthorized APIFY_TOKEN (HTTP ${runRes.status})`
      );
    }

    if (runRes.status === 429) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.RATE_LIMIT,
        "Apify rate limit exceeded (HTTP 429)"
      );
    }

    if (!runRes.ok) {
      const errText = await runRes.text().catch(() => "");
      throw new ShopeeScraperError(
        ShopeeErrorCode.PROVIDER_UNAVAILABLE,
        `Apify actor start returned HTTP ${runRes.status}: ${errText.slice(0, 200)}`
      );
    }

    let runData: any;
    try {
      runData = await runRes.json();
    } catch {
      throw new ShopeeScraperError(
        ShopeeErrorCode.INVALID_RESPONSE,
        "Failed to parse Apify run JSON response"
      );
    }

    const status = runData?.data?.status;
    if (status !== "SUCCEEDED") {
      throw new ShopeeScraperError(
        ShopeeErrorCode.PROVIDER_UNAVAILABLE,
        `Apify Actor run finished with status ${status}`
      );
    }

    const datasetId = runData?.data?.defaultDatasetId;
    if (!datasetId) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.INVALID_RESPONSE,
        "No defaultDatasetId found in Apify run response"
      );
    }

    const costUsd = typeof runData?.data?.usageTotalUsd === "number" ? runData.data.usageTotalUsd : null;

    let datasetRes: Response;
    try {
      datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
        headers: {
          authorization: `Bearer ${this.token}`,
        },
      });
    } catch (err) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.TIMEOUT,
        `Failed to fetch dataset items: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!datasetRes.ok) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.INVALID_RESPONSE,
        `Fetch dataset items returned HTTP ${datasetRes.status}`
      );
    }

    let rawItems: any[];
    try {
      rawItems = await datasetRes.json();
    } catch {
      throw new ShopeeScraperError(
        ShopeeErrorCode.INVALID_RESPONSE,
        "Failed to parse dataset items JSON"
      );
    }

    if (!Array.isArray(rawItems)) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.INVALID_RESPONSE,
        "Dataset items response is not an array"
      );
    }

    let resolvedShopId = req.shopId || (req.shopUrl ? extractShopId(req.shopUrl) : null);
    let resolvedShopName: string | null = null;
    const products = [];

    for (const raw of rawItems) {
      const normalized = normalizeApifyItem(raw, resolvedShopId);
      if (!normalized) continue;

      if (normalized.shopId && !resolvedShopId) {
        resolvedShopId = normalized.shopId;
      }
      if (normalized.sellerName && !resolvedShopName) {
        resolvedShopName = normalized.sellerName;
      }
      products.push(normalized);
    }

    return {
      provider: "apify",
      shop: {
        shopId: resolvedShopId,
        username: shopUsername,
        name: resolvedShopName,
      },
      products,
      executionTimeMs: Date.now() - startedAt,
      costUsd,
    };
  }
}
