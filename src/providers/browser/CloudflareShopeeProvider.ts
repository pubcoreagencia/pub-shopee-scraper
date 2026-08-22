import { acquire, connect } from "@cloudflare/playwright";
import { IShopeeProvider, ShopeeProviderResult } from "../IShopeeProvider";
import { ShopeeErrorCode, ShopeeScraperError, ShopeeScrapeRequest } from "../../types";
import { extractFriendlyUsername, extractShopId, normalizeBrowserItem } from "../../normalizers/shopeeProductNormalizer";

export class CloudflareShopeeProvider implements IShopeeProvider {
  readonly name = "cloudflare-browser-run" as const;
  private readonly browserBinding: BrowserRun;

  constructor(browserBinding: BrowserRun) {
    this.browserBinding = browserBinding;
  }

  async fetchCatalog(req: ShopeeScrapeRequest): Promise<ShopeeProviderResult> {
    const startedAt = Date.now();

    if (!this.browserBinding) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.PROVIDER_UNAVAILABLE,
        "Cloudflare Browser Run binding is not available"
      );
    }

    const sourceUrl = req.shopUrl || (req.shopUsername ? `https://shopee.com.br/${req.shopUsername}` : (req.shopId ? `https://shopee.com.br/shop/${req.shopId}` : null));
    if (!sourceUrl) {
      throw new ShopeeScraperError(
        ShopeeErrorCode.INVALID_URL,
        "No valid shopUrl, shopUsername, or shopId provided for browser provider"
      );
    }

    const extractedUser = extractFriendlyUsername(sourceUrl);
    let resolvedShopId = req.shopId || extractShopId(sourceUrl);
    let resolvedUsername = req.shopUsername || extractedUser;
    let resolvedShopName: string | null = null;
    let shopIdStrategy = resolvedShopId ? "direct-url" : "unresolved";

    let browser: any;
    let context: any;
    let page: any;

    try {
      const { sessionId } = await acquire(this.browserBinding);
      browser = await connect(this.browserBinding, sessionId);
      context = await browser.newContext();
      page = await context.newPage();

      // Listen for natural network response get_shop_base_v2 BEFORE goto
      page.on("response", async (res: any) => {
        try {
          const resUrl = res.url();
          if (resUrl.includes("/api/v4/shop/get_shop_base_v2")) {
            const bodyText = await res.text().catch(() => "");
            if (bodyText) {
              const parsed = JSON.parse(bodyText);
              const dataShopId = parsed?.data?.shopid ?? parsed?.data?.shop_id ?? parsed?.shopid;
              const dataUsername = parsed?.data?.account?.username ?? parsed?.data?.username;
              const dataShopName = parsed?.data?.name ?? parsed?.data?.shop_name;

              if (dataShopId && Number.isFinite(Number(dataShopId))) {
                resolvedShopId = String(dataShopId);
                shopIdStrategy = "network-shop-base";
              }
              if (dataUsername) resolvedUsername = String(dataUsername);
              if (dataShopName) resolvedShopName = String(dataShopName);
            }
          }
        } catch {
          // ignore stream parse errors
        }
      });

      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000).catch(() => undefined);

      if (!resolvedShopId) {
        throw new ShopeeScraperError(
          ShopeeErrorCode.SHOP_NOT_FOUND,
          `Could not resolve Shopee ShopID for ${sourceUrl}`
        );
      }

      // Query products in-page via search_items
      const limit = Math.min(req.limit || 30, 100);
      const searchUrl = `https://shopee.com.br/api/v4/search/search_items?by=pop&limit=${limit}&match_id=${resolvedShopId}&newest=0&order=desc&page_type=shop&scenario=PAGE_SHOP&version=2`;

      const searchResult = await page.evaluate(async (url: string) => {
        try {
          const res = await (globalThis as any).fetch(url, { credentials: "include" });
          const text = await res.text();
          let data: any = null;
          try { data = JSON.parse(text); } catch { data = null; }
          return { status: res.status, data, rawSnippet: text.slice(0, 300) };
        } catch (e) {
          return { status: 0, error: e instanceof Error ? e.message : String(e) };
        }
      }, searchUrl);

      if (searchResult?.data?.error === 90309999) {
        throw new ShopeeScraperError(
          ShopeeErrorCode.ANTIFRAUD,
          "Shopee Antifraud challenge code 90309999 received on catalog endpoint"
        );
      }

      const rawItems = Array.isArray(searchResult?.data?.items)
        ? searchResult.data.items
        : Array.isArray(searchResult?.data?.data?.items)
        ? searchResult.data.data.items
        : [];

      const products = [];
      for (const raw of rawItems) {
        const normalized = normalizeBrowserItem(raw, resolvedShopId);
        if (normalized) products.push(normalized);
      }

      return {
        provider: "cloudflare-browser-run",
        shop: {
          shopId: resolvedShopId,
          username: resolvedUsername,
          name: resolvedShopName,
        },
        products,
        executionTimeMs: Date.now() - startedAt,
        metadata: {
          shopIdStrategy,
          searchStatus: searchResult.status,
          totalRawFound: rawItems.length,
        },
      };
    } finally {
      if (page) await page.close().catch(() => undefined);
      if (context) await context.close().catch(() => undefined);
      if (browser) await browser.close().catch(() => undefined);
    }
  }
}
