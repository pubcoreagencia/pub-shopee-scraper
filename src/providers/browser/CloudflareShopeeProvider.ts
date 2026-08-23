import { IShopeeProvider, ShopeeProviderResult } from "../IShopeeProvider";
import { ShopeeErrorCode, ShopeeScraperError, ValidatedScrapeRequest } from "../../types";
import { extractFriendlyUsername, extractShopId, normalizeBrowserItem } from "../../normalizers/shopeeProductNormalizer";

export class CloudflareShopeeProvider implements IShopeeProvider {
  readonly name = "cloudflare-browser-run" as const;
  private readonly browserBinding: BrowserRun;

  constructor(browserBinding: BrowserRun) {
    this.browserBinding = browserBinding;
  }

  async fetchCatalog(req: ValidatedScrapeRequest): Promise<ShopeeProviderResult> {
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
      const { acquire, connect } = await import("@cloudflare/playwright");
      const { sessionId } = await acquire(this.browserBinding);
      browser = await connect(this.browserBinding, sessionId);
      context = await browser.newContext();
      page = await context.newPage();

      const capturedItems: any[] = [];

      // Listen for natural network responses before goto
      page.on("response", async (res: any) => {
        try {
          const resUrl = res.url();
          // 1. Shop base info
          if (resUrl.includes("/api/v4/shop/get_shop_base") || resUrl.includes("/api/v4/shop/get_shop_detail")) {
            const bodyText = await res.text().catch(() => "");
            if (bodyText) {
              const parsed = JSON.parse(bodyText);
              const dataShopId = parsed?.data?.shopid ?? parsed?.data?.shop_id ?? parsed?.shopid ?? parsed?.data?.userid;
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

          // 2. Catalog / Search Items
          if (resUrl.includes("/api/v4/search/search_items") || resUrl.includes("/api/v4/shop/rcmd_items") || resUrl.includes("/api/v4/recommend/recommend")) {
            const bodyText = await res.text().catch(() => "");
            if (bodyText) {
              const parsed = JSON.parse(bodyText);
              const items = parsed?.items || parsed?.data?.items || parsed?.data?.sections?.[0]?.data?.item || [];
              if (Array.isArray(items)) {
                for (const it of items) {
                  capturedItems.push(it);
                }
              }
            }
          }
        } catch {
          // ignore stream parse errors
        }
      });

      // Pre-resolution of username via public Shopee endpoint if needed
      if (!resolvedShopId && resolvedUsername) {
        try {
          const baseApiRes = await fetch(`https://shopee.com.br/api/v4/shop/get_shop_base?username=${encodeURIComponent(resolvedUsername)}`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/json",
            }
          });
          if (baseApiRes.ok) {
            const baseData: any = await baseApiRes.json();
            if (baseData?.data?.shopid) {
              resolvedShopId = String(baseData.data.shopid);
              resolvedShopName = baseData.data.name || resolvedShopName;
              shopIdStrategy = "direct-api-shop-base";
            }
          }
        } catch {}
      }

      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000).catch(() => undefined);

      // Extract shopId from page content if still unresolved
      if (!resolvedShopId) {
        try {
          const content = await page.content();
          const match = content.match(/(?:shopid|shop_id|userid)["'\s:=]+["']?(\d{4,})/i) || content.match(/-i\.(\d{4,})\./i);
          if (match?.[1]) {
            resolvedShopId = match[1];
            shopIdStrategy = "dom-html-regex";
          }
        } catch {}
      }

      if (!resolvedShopId) {
        throw new ShopeeScraperError(
          ShopeeErrorCode.SHOP_NOT_FOUND,
          `Could not resolve Shopee ShopID for ${sourceUrl}`
        );
      }

      // Scroll to trigger lazy loading of product cards
      await page.evaluate(() => {
        window.scrollBy(0, 1200);
      }).catch(() => undefined);
      await page.waitForTimeout(2000).catch(() => undefined);

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

      const rawItems: any[] = [];

      if (Array.isArray(searchResult?.data?.items)) {
        rawItems.push(...searchResult.data.items);
      } else if (Array.isArray(searchResult?.data?.data?.items)) {
        rawItems.push(...searchResult.data.data.items);
      }

      // Merge naturally captured items from network
      for (const cap of capturedItems) {
        rawItems.push(cap);
      }

      // Fallback: DOM extraction if search_items was blocked (antifraud 90309999) or empty
      if (rawItems.length === 0) {
        const domItems = await page.evaluate((targetShopId: string | null) => {
          const extracted: any[] = [];
          const links = Array.from(document.querySelectorAll('a[href*="-i."]'));
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            const match = href.match(/-i\.(\d+)\.(\d+)/);
            if (!match) continue;
            const itemShopId = match[1];
            const itemId = match[2];
            if (targetShopId && itemShopId !== targetShopId && targetShopId !== 'unknown') continue;
            
            const nameEl = a.querySelector('div[class*="line-clamp"], div[data-sqe="name"], div.whitespace-normal') || a;
            const name = nameEl.textContent?.trim() || '';
            if (!name || name.length < 3) continue;

            const imgEl = a.querySelector('img');
            const img = imgEl?.getAttribute('src') || '';
            
            const priceEl = a.querySelector('span[class*="price"], div[class*="price"], span.text-base');
            const priceText = priceEl?.textContent?.replace(/[^\d.,]/g, '').replace(',', '.') || '0';
            const parsedPrice = parseFloat(priceText) || 0;

            extracted.push({
              item_basic: {
                itemid: itemId,
                shopid: itemShopId,
                name,
                price: parsedPrice * 100000,
                image: img,
                url: href.startsWith('http') ? href : `https://shopee.com.br${href}`,
              }
            });
          }
          return extracted;
        }, resolvedShopId);

        for (const it of domItems) {
          rawItems.push(it);
        }
      }

      const products = [];
      const seenItemIds = new Set<string>();

      for (const raw of rawItems) {
        const normalized = normalizeBrowserItem(raw, resolvedShopId);
        if (normalized && !seenItemIds.has(normalized.itemId)) {
          seenItemIds.add(normalized.itemId);
          products.push(normalized);
        }
      }

      if (products.length === 0 && searchResult?.data?.error === 90309999 && rawItems.length === 0) {
        throw new ShopeeScraperError(
          ShopeeErrorCode.ANTIFRAUD,
          "Shopee Antifraud challenge code 90309999 received on catalog endpoint"
        );
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
