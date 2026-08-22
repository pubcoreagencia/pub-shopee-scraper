import { ShopeeProduct, ShopeeScrapeRequest, ShopeeShop } from "../types";

export interface ShopeeProviderResult {
  provider: "apify" | "cloudflare-browser-run";
  shop: ShopeeShop;
  products: ShopeeProduct[];
  executionTimeMs: number;
  costUsd?: number | null;
  metadata?: Record<string, unknown>;
}

export interface IShopeeProvider {
  readonly name: "apify" | "cloudflare-browser-run";
  fetchCatalog(req: ShopeeScrapeRequest): Promise<ShopeeProviderResult>;
}
