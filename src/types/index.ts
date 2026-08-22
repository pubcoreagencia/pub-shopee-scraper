export * from "./errors";
export * from "./shopee";

export interface Env {
  BROWSER: BrowserRun;
  APIFY_TOKEN?: string;
  SHOPEE_SCRAPER_TOKEN?: string;
  CATALOG_WORKER_TOKEN?: string;
}
