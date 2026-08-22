export interface ShopeeShop {
  shopId: string | null;
  username: string | null;
  name: string | null;
}

export interface ShopeeProduct {
  itemId: string;
  shopId: string | null;
  title: string;
  price: number | null;
  originalPrice: number | null;
  stock: number | null;
  sku: string | null;
  images: string[];
  category: string | null;
  sellerName: string | null;
  productUrl: string;
  metadata: Record<string, unknown>;
}

export interface ShopeeScrapeRequest {
  shopUrl?: string;
  shopUsername?: string;
  shopId?: string;
  country?: "br";
  limit?: number;
}

export interface ShopeeScrapeMetadata {
  provider: string;
  productsFound: number;
  executionTimeMs: number;
  costUsd?: number | null;
  fallbackUsed?: boolean;
  apifyError?: string | null;
  browserError?: string | null;
  [key: string]: unknown;
}

export interface ShopeeScrapeResult {
  success: boolean;
  provider: "apify" | "cloudflare-browser-run" | "none";
  shop: ShopeeShop;
  products: ShopeeProduct[];
  metadata: ShopeeScrapeMetadata;
  errors: string[];
}
